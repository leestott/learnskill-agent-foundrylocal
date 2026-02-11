/**
 * Foundry Local Model Client
 * 
 * Provides an OpenAI-compatible interface to Foundry Local for privacy-sensitive
 * local inference tasks like file summarization, config extraction, and dependency analysis.
 * 
 * Foundry Local exposes an OpenAI-compatible API at /v1/chat/completions
 */

import OpenAI, { AzureOpenAI } from 'openai';
import { spawnSync } from 'child_process';
import type { FoundryLocalStatus, LocalModelRequest, LocalModelResponse, CachedModel } from './types.js';

const DEFAULT_ENDPOINT = 'http://localhost:5273';
const DEFAULT_MODEL = 'phi-4';

/**
 * Auto-detect Foundry Local endpoint by running `foundry service status`
 * Foundry Local uses dynamic ports, so we parse the service status output
 */
function discoverFoundryEndpoint(): string | null {
  try {
    const result = spawnSync('foundry service status', {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });
    
    if (result.status === 0 && result.stdout) {
      // Parse: "🟢 Model management service is running on http://127.0.0.1:58243/openai/status"
      const match = result.stdout.match(/running on (https?:\/\/[^\/\s]+)/i);
      if (match) {
        return match[1];
      }
    }
    if (result.error) {
      console.error('[FoundryLocal] Discovery error:', result.error.message);
    }
  } catch (err) {
    console.error('[FoundryLocal] Discovery exception:', err);
  }
  return null;
}

/**
 * Get cached models from `foundry model list`
 * Parses the output to extract alias, model ID, device, task, and file size
 */
export function getCachedModels(): CachedModel[] {
  try {
    const result = spawnSync('foundry model list', {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });
    
    if (result.status !== 0 || !result.stdout) {
      return [];
    }

    const models: CachedModel[] = [];
    const lines = result.stdout.split('\n');
    
    let currentAlias: string | null = null;
    
    for (const line of lines) {
      // Skip separator lines and headers
      if (line.startsWith('---') || line.startsWith('Alias') || !line.trim()) {
        continue;
      }
      
      // Parse model line - format varies:
      // "phi-4                          GPU        chat           8.37 GB      MIT          Phi-4-cuda-gpu:1"
      // Lines starting with spaces are variant model IDs for same alias
      
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Check if this is a new alias (doesn't start with whitespace) or a variant
      const isVariant = line.startsWith(' ') || line.startsWith('\t');
      
      // Parse columns - try to extract meaningful data
      // Format: Alias | Device | Task | File Size | License | Model ID
      const parts = trimmedLine.split(/\s{2,}/); // Split on 2+ spaces
      
      if (parts.length >= 4) {
        if (!isVariant && parts[0] && !parts[0].includes(':')) {
          // This is a new alias line
          currentAlias = parts[0];
        }
        
        // Find the model ID (ends with :N pattern typically)
        const modelIdPart = parts.find(p => p.includes(':') && /:\d+$/.test(p));
        
        if (modelIdPart) {
          const device = parts.find(p => ['GPU', 'CPU'].includes(p)) || 'GPU';
          const task = parts.find(p => p === 'chat' || p.includes('chat')) || 'chat';
          const sizeMatch = trimmedLine.match(/(\d+\.?\d*\s*[KMGT]?B)/i);
          
          models.push({
            alias: currentAlias || modelIdPart.split('-')[0] || 'unknown',
            modelId: modelIdPart,
            device,
            task,
            fileSize: sizeMatch ? sizeMatch[1] : 'Unknown',
          });
        }
      }
    }
    
    return models;
  } catch {
    return [];
  }
}

export class LocalModelClient {
  private client: OpenAI | null = null;
  private endpoint: string;
  private model: string;
  private isAvailable: boolean = false;
  private cloudMode: boolean;
  private isAzure: boolean;
  private apiKey: string;

  constructor(endpoint?: string, model?: string, cloudConfig?: { endpoint: string; apiKey: string }) {
    this.cloudMode = !!cloudConfig;
    this.apiKey = cloudConfig?.apiKey || 'foundry-local';

    if (this.cloudMode) {
      // Cloud mode: use Microsoft Foundry endpoint directly
      this.endpoint = cloudConfig!.endpoint.replace(/\/+$/, '');
      this.model = model || process.env.FOUNDRY_CLOUD_MODEL || 'gpt-4o-mini';
      // Detect Azure OpenAI endpoints (cognitiveservices.azure.com or openai.azure.com)
      this.isAzure = /\.(cognitiveservices\.azure\.com|openai\.azure\.com|services\.ai\.azure\.com|services\.foundry\.microsoft\.com)/.test(this.endpoint);
    } else {
      // Local mode: auto-discover Foundry Local endpoint
      this.endpoint = endpoint 
        || process.env.FOUNDRY_LOCAL_ENDPOINT 
        || discoverFoundryEndpoint() 
        || DEFAULT_ENDPOINT;
      this.model = model || process.env.FOUNDRY_LOCAL_MODEL || DEFAULT_MODEL;
      this.isAzure = false;
    }
  }

  /**
   * Resolve model alias to full model ID
   * Foundry Local requires full model IDs like "Phi-4-cuda-gpu:1" not aliases like "phi-4"
   */
  private resolveModelId(alias: string, cachedModels: CachedModel[]): string {
    // Check if it's already a full model ID (contains colon)
    if (alias.includes(':')) {
      return alias;
    }
    
    const lowerAlias = alias.toLowerCase();
    
    // Priority 1: Exact alias match (e.g. "phi-4-mini" matches alias "phi-4-mini" not "phi-4-mini-reasoning")
    const exactAlias = cachedModels.find(m => m.alias.toLowerCase() === lowerAlias);
    if (exactAlias) {
      return exactAlias.modelId;
    }
    
    // Priority 2: Model ID starts with alias
    const startsWithMatch = cachedModels.find(m => m.modelId.toLowerCase().startsWith(lowerAlias));
    if (startsWithMatch) {
      return startsWithMatch.modelId;
    }
    
    // Return original if no match found
    return alias;
  }

  /**
   * Check if Foundry Local is running and discover available models
   */
  async checkStatus(): Promise<FoundryLocalStatus> {
    // Cloud mode: verify endpoint connectivity
    if (this.cloudMode) {
      try {
        this.initClient();
        this.isAvailable = true;
        if (this.isAzure) {
          // Azure endpoints: try listing deployments
          const response = await fetch(`${this.endpoint}/openai/models?api-version=2024-12-01-preview`, {
            method: 'GET',
            headers: { 'api-key': this.apiKey },
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) {
            const data = await response.json() as { data?: Array<{ id: string }> };
            const models = data.data?.map((m: { id: string }) => m.id) || [this.model];
            return { available: true, endpoint: this.endpoint, models, activeModel: this.model };
          }
        } else {
          const response = await fetch(`${this.endpoint}/v1/models`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.apiKey}`, 'api-key': this.apiKey },
            signal: AbortSignal.timeout(10000),
          });
          if (response.ok) {
            const data = await response.json() as { data?: Array<{ id: string }> };
            const models = data.data?.map((m: { id: string }) => m.id) || [this.model];
            return { available: true, endpoint: this.endpoint, models, activeModel: this.model };
          }
        }
        // Some cloud endpoints don't expose models listing — still mark available
        return { available: true, endpoint: this.endpoint, models: [this.model], activeModel: this.model };
      } catch {
        this.isAvailable = false;
        return { available: false, endpoint: this.endpoint, models: [] };
      }
    }

    // Get cached models from foundry CLI
    const cachedModels = getCachedModels();
    
    // Try fetching models — if the endpoint fails, re-discover once
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Try the OpenAI-compatible models endpoint
        const response = await fetch(`${this.endpoint}/v1/models`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) {
          // If first attempt failed, try re-discovering
          if (attempt === 0) {
            const discovered = discoverFoundryEndpoint();
            if (discovered && discovered !== this.endpoint) {
              this.endpoint = discovered;
              continue;
            }
          }
          return { available: false, endpoint: this.endpoint, models: [], cachedModels };
        }

        const data = await response.json() as { data?: Array<{ id: string }> };
        const models = data.data?.map((m: { id: string }) => m.id) || [];
        
        // Resolve model alias to full ID
        this.model = this.resolveModelId(this.model, cachedModels.length > 0 ? cachedModels : 
          models.map(id => ({ alias: id.split('-')[0].toLowerCase(), modelId: id, device: 'GPU', task: 'chat', fileSize: 'Unknown' }))
        );
        
        this.isAvailable = true;
        this.initClient();

        return {
          available: true,
          endpoint: this.endpoint,
          models,
          activeModel: this.model,
          cachedModels,
        };
      } catch (error) {
        // If first attempt failed with connection error, try re-discovering
        if (attempt === 0) {
          const discovered = discoverFoundryEndpoint();
          if (discovered && discovered !== this.endpoint) {
            this.endpoint = discovered;
            continue;
          }
        }

        // Try alternative status endpoint
        try {
          const statusResponse = await fetch(`${this.endpoint}/openai/status`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });
          
          if (statusResponse.ok) {
            // Resolve model alias to full ID
            this.model = this.resolveModelId(this.model, cachedModels);
            
            this.isAvailable = true;
            this.initClient();
            return {
              available: true,
              endpoint: this.endpoint,
              models: [this.model],
              activeModel: this.model,
              cachedModels,
            };
          }
        } catch {
          // Status endpoint also failed
        }
      }
    }

    return { available: false, endpoint: this.endpoint, models: [], cachedModels };
  }

  private initClient(): void {
    if (this.cloudMode && this.isAzure) {
      // Azure OpenAI uses a different client with api-version and deployment-based routing
      this.client = new AzureOpenAI({
        endpoint: this.endpoint,
        apiKey: this.apiKey,
        apiVersion: '2024-12-01-preview',
      });
    } else {
      this.client = new OpenAI({
        baseURL: `${this.endpoint}/v1`,
        apiKey: this.apiKey,
      });
    }
  }

  /**
   * Send a completion request to Foundry Local with retry on connection errors
   */
  async complete(request: LocalModelRequest): Promise<LocalModelResponse> {
    if (!this.isAvailable || !this.client) {
      throw new Error(this.cloudMode
        ? 'Cloud endpoint is not available. Check your endpoint URL and API key.'
        : 'Foundry Local is not available. Please start it first.');
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    
    messages.push({ role: 'user', content: request.prompt });

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages,
          ...(this.isAzure || this.cloudMode
            ? { max_completion_tokens: request.maxTokens || 2048 }
            : { max_tokens: request.maxTokens || 2048 }),
          temperature: request.temperature ?? 0.3,
        });

        const content = completion.choices[0]?.message?.content || '';
        
        return {
          content,
          usage: completion.usage ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          } : undefined,
        };
      } catch (error) {
        const isConnectionError = error instanceof Error && 
          (error.message.includes('Connection error') || error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed'));
        
        if (isConnectionError && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 5000));
          if (!this.cloudMode) {
            // Foundry Local may have restarted on a new port — re-discover
            const newEndpoint = discoverFoundryEndpoint();
            if (newEndpoint && newEndpoint !== this.endpoint) {
              this.endpoint = newEndpoint;
              this.initClient();
            }
          }
          continue;
        }
        throw error;
      }
    }
    throw new Error('Foundry Local request failed after retries');
  }

  /**
   * Summarize file contents locally (privacy-sensitive)
   */
  async summarizeFile(filePath: string, content: string): Promise<string> {
    const response = await this.complete({
      systemPrompt: `You are a code analyst. Provide a concise summary of the file's purpose, key exports, and main functionality. Keep it under 100 words.`,
      prompt: `File: ${filePath}\n\nContent:\n${content.slice(0, 8000)}`,
      maxTokens: 256,
    });
    return response.content;
  }

  /**
   * Extract configuration patterns from a config file
   */
  async extractConfigPatterns(filePath: string, content: string): Promise<string> {
    const response = await this.complete({
      systemPrompt: `You are a configuration analyst. Identify important configuration keys, environment variables, secrets patterns (but NOT actual values), and what they configure. Output as a structured list.`,
      prompt: `File: ${filePath}\n\nContent:\n${content.slice(0, 4000)}`,
      maxTokens: 512,
    });
    return response.content;
  }

  /**
   * Generate dependency inventory with purpose descriptions
   */
  async analyzeDependencies(dependencies: string[], ecosystem: string): Promise<string> {
    const response = await this.complete({
      systemPrompt: `You are a dependency analyst. For each dependency, provide a one-line description of its purpose. Be specific and technical.`,
      prompt: `Ecosystem: ${ecosystem}\n\nDependencies:\n${dependencies.slice(0, 50).join('\n')}`,
      maxTokens: 1024,
    });
    return response.content;
  }

  /**
   * Generate architecture summary from file structure and key files
   */
  async generateArchitectureSummary(
    structure: string,
    keyFileSummaries: Record<string, string>
  ): Promise<string> {
    const summariesText = Object.entries(keyFileSummaries)
      .map(([file, summary]) => `${file}: ${summary}`)
      .join('\n');

    const response = await this.complete({
      systemPrompt: `You are a software architect. Based on the directory structure and file summaries below, describe the architecture of this project.

RULES:
- Only reference directories and files that appear in the data below
- Classify the architecture pattern as one of: Monolith, Microservices, Monorepo, Notebook/Script Collection, Serverless, CLI Tool, Library/SDK, Plugin/Extension
- List each top-level directory as a component with a one-line purpose
- Describe 2-3 key interactions between components
- Do NOT fabricate components, APIs, or features not evidenced in the data
- If the repo contains mostly notebooks (.ipynb files), classify as "Notebook/Script Collection" not "Monolithic"

Output format:
### Pattern: {pattern name}
{2-3 paragraphs describing the architecture}

### Components
| Component | Directory | Purpose |
|-----------|-----------|---------|`,
      prompt: `Directory Structure:\n${structure}\n\nKey File Summaries:\n${summariesText}`,
      maxTokens: 1024,
    });
    return response.content;
  }

  /**
   * Generate starter tasks based on codebase analysis
   */
  async generateStarterTasks(
    repoContext: string,
    techStack: string[],
    keyFiles: string[] = [],
    batchStart: number = 1,
    batchEnd: number = 10
  ): Promise<string> {
    const response = await this.complete({
      systemPrompt: `You are a senior engineer creating onboarding tasks for students and new contributors. Each task should progressively build skills. Generate tasks ${batchStart} through ${batchEnd} in this EXACT format. Output ONLY the numbered tasks, no other text.

Format for each task:
{N}. {Title}
Description: {What to do, referencing real files}
Difficulty: {easy|medium|hard}
Time: {estimate}
Learning: {what skill or concept the student will learn by completing this task}
Criteria: {criterion1}; {criterion2}; {criterion3}
Hints: {hint1}; {hint2}
Files: {file1}, {file2}
Skills: {skill1}, {skill2}

Difficulty distribution: tasks 1-3 easy, tasks 4-7 medium, tasks 8-10 hard.
Topics should build progressively: reading code → writing tests → adding features → refactoring.
Easy tasks teach code navigation and comprehension. Medium tasks teach modification and testing. Hard tasks teach design and architecture.`,
      prompt: `Repository Context:\n${repoContext}\n\nTech Stack: ${techStack.join(', ')}\n\nKey Files:\n${keyFiles.join('\n')}`,
      maxTokens: 2048,
    });
    return response.content;
  }

  /**
   * Generate Mermaid diagram from architecture analysis
   */
  async generateMermaidDiagram(
    components: string[],
    relationships: string
  ): Promise<string> {
    const response = await this.complete({
      systemPrompt: `Generate a Mermaid flowchart diagram. Output ONLY valid Mermaid syntax. No markdown fences. No explanatory text. No comments. Start with "graph TD".

Requirements:
- Use subgraphs to group related components (at least 2 subgraphs)
- Use meaningful node IDs (e.g., DataPipeline not A)
- Include 8-15 nodes
- Show data flow direction with arrows
- Every line must be valid Mermaid syntax`,
      prompt: `Components:\n${components.join('\n')}\n\nRelationships:\n${relationships}`,
      maxTokens: 512,
    });
    return response.content;
  }

  get isReady(): boolean {
    return this.isAvailable;
  }

  get isCloudMode(): boolean {
    return this.cloudMode;
  }

  get currentModel(): string {
    return this.model;
  }

  get currentEndpoint(): string {
    return this.endpoint;
  }
}

// Singleton instance for convenience
let defaultClient: LocalModelClient | null = null;

export function getLocalModelClient(
  endpoint?: string,
  model?: string,
  cloudConfig?: { endpoint: string; apiKey: string }
): LocalModelClient {
  if (!defaultClient || endpoint || model || cloudConfig) {
    defaultClient = new LocalModelClient(endpoint, model, cloudConfig);
  }
  return defaultClient;
}
