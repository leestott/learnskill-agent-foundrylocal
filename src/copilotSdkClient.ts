/**
 * GitHub Copilot SDK Client
 * 
 * Wraps the @github/copilot-sdk to provide agentic LLM capabilities.
 * Supports GitHub Copilot models, BYOK with Foundry Local, and Azure OpenAI.
 * 
 * Requires the Copilot CLI to be installed: npm install -g @github/copilot
 * SDK docs: https://github.com/github/copilot-sdk
 */

import { CopilotClient, type CopilotSession } from '@github/copilot-sdk';
import type { LocalModelRequest, LocalModelResponse, FoundryLocalStatus } from './types.js';

export interface CopilotSdkConfig {
  /** Model name (e.g. "gpt-5", "claude-sonnet-4.5") */
  model?: string;
  /** GitHub token for authentication (or uses logged-in user) */
  githubToken?: string;
  /** BYOK provider config for custom endpoints */
  provider?: {
    type: 'openai' | 'azure';
    baseUrl: string;
    apiKey?: string;
  };
}

export class CopilotSdkClient {
  private client: CopilotClient | null = null;
  private session: CopilotSession | null = null;
  private config: CopilotSdkConfig;
  private available: boolean = false;

  constructor(config: CopilotSdkConfig = {}) {
    this.config = {
      model: config.model || 'claude-sonnet-4',
      ...config,
    };
  }

  /**
   * Check if the Copilot CLI is available and start the SDK client
   */
  async checkStatus(): Promise<FoundryLocalStatus> {
    try {
      this.client = new CopilotClient({
        autoStart: true,
        githubToken: this.config.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
      });
      await this.client.start();
      this.available = true;

      return {
        available: true,
        endpoint: 'copilot-sdk',
        models: [this.config.model || 'claude-sonnet-4'],
        activeModel: this.config.model,
      };
    } catch (error) {
      this.available = false;
      const errMsg = error instanceof Error ? error.message : String(error);
      return {
        available: false,
        endpoint: 'copilot-sdk',
        models: [],
      };
    }
  }

  /**
   * Create a session with optional BYOK provider
   */
  private async getSession(): Promise<CopilotSession> {
    if (!this.client) {
      throw new Error('Copilot SDK client not started. Call checkStatus() first.');
    }

    if (this.session) {
      return this.session;
    }

    const sessionConfig: Record<string, unknown> = {
      model: this.config.model,
    };

    // BYOK: Use custom provider (Foundry Local or Azure OpenAI)
    if (this.config.provider) {
      sessionConfig.provider = {
        type: this.config.provider.type,
        baseUrl: this.config.provider.baseUrl,
        apiKey: this.config.provider.apiKey,
      };
    }

    this.session = await this.client.createSession(sessionConfig as Parameters<CopilotClient['createSession']>[0]);
    return this.session;
  }

  /**
   * Send a completion request via the Copilot SDK
   */
  async complete(request: LocalModelRequest): Promise<LocalModelResponse> {
    if (!this.available) {
      throw new Error('Copilot SDK is not available. Ensure the Copilot CLI is installed (npm install -g @github/copilot).');
    }

    const session = await this.getSession();

    // Build prompt with system message context
    let prompt = request.prompt;
    if (request.systemPrompt) {
      prompt = `<system>\n${request.systemPrompt}\n</system>\n\n${request.prompt}`;
    }

    const result = await session.sendAndWait({ prompt });
    const content = result?.data?.content || '';

    return {
      content,
      usage: undefined, // SDK doesn't expose token counts
    };
  }

  /**
   * Summarize file contents using Copilot SDK
   */
  async summarizeFile(filePath: string, content: string): Promise<string> {
    const response = await this.complete({
      systemPrompt: 'You are a code analyst. Provide a concise summary of the file\'s purpose, key exports, and main functionality. Keep it under 100 words.',
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
      systemPrompt: 'You are a configuration analyst. Identify important configuration keys, environment variables, secrets patterns (but NOT actual values), and what they configure. Output as a structured list.',
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
      systemPrompt: 'You are a dependency analyst. For each dependency, provide a one-line description of its purpose. Be specific and technical.',
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
      systemPrompt: `Generate a Mermaid flowchart diagram. Output ONLY valid Mermaid syntax. No markdown fences. No explanatory text. Start with "graph TD".

Requirements:
- Use subgraphs to group related components (at least 2 subgraphs)
- Use meaningful node IDs
- Include 8-15 nodes
- Show data flow direction with arrows`,
      prompt: `Components:\n${components.join('\n')}\n\nRelationships:\n${relationships}`,
      maxTokens: 512,
    });
    return response.content;
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      await this.session.destroy();
      this.session = null;
    }
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
    this.available = false;
  }

  get isReady(): boolean {
    return this.available;
  }

  get isCloudMode(): boolean {
    return !this.config.provider; // Using Copilot's own models = cloud
  }

  get isCopilotSdk(): boolean {
    return true;
  }

  get currentModel(): string {
    return this.config.model || 'claude-sonnet-4';
  }

  get currentEndpoint(): string {
    return this.config.provider?.baseUrl || 'copilot-sdk';
  }
}
