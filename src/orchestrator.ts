/**
 * Orchestrator
 * 
 * Coordinates the onboarding pack generation using an MCP-compatible tool-calling
 * pattern. Defines tools/actions the agent can invoke and manages the workflow.
 * Integrates with GitHub Copilot SDK and Microsoft Learn MCP Server.
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { RepoScanner } from './repoScanner.js';
import { LocalModelClient, getLocalModelClient } from './localModelClient.js';
import { CopilotSdkClient } from './copilotSdkClient.js';
import type {
  RepoMetadata,
  OnboardingPack,
  GenerationConfig,
  WorkflowStep,
  OrchestratorTool,
  StarterTask,
  Prerequisite,
  SetupStep,
  TroubleshootingItem,
  DirectoryNode,
  MicrosoftTechDetection,
  ProgressCallback,
  ProgressInfo,
  AgentsDoc,
  AgentSkill,
  AgentMcpServer,
  AgentWorkflow,
} from './types.js';

/** Union type for LLM clients the orchestrator can use */
type LlmClient = LocalModelClient | CopilotSdkClient;

export class Orchestrator {
  private config: GenerationConfig;
  private scanner: RepoScanner;
  private localModel: LlmClient;
  private copilotSdkClient: CopilotSdkClient | null = null;
  private repoMetadata: RepoMetadata | null = null;
  private steps: WorkflowStep[] = [];
  private verbose: boolean;
  private onProgress?: ProgressCallback;
  private totalSteps = 9;
  private currentStepNumber = 0;

  constructor(config: GenerationConfig) {
    this.config = config;
    this.scanner = new RepoScanner(config.repoPath);

    if (config.useCopilotSdk) {
      // Use GitHub Copilot SDK as the LLM provider
      this.copilotSdkClient = new CopilotSdkClient({
        model: config.copilotModel,
      });
      this.localModel = this.copilotSdkClient;
    } else {
      const cloudConfig = config.cloudEndpoint && config.cloudApiKey
        ? { endpoint: config.cloudEndpoint, apiKey: config.cloudApiKey }
        : undefined;
      this.localModel = getLocalModelClient(
        config.foundryEndpoint,
        config.cloudModel || config.foundryModel,
        cloudConfig
      );
    }
    this.verbose = config.verbose || false;
    this.onProgress = config.onProgress;
  }

  /**
   * Available tools for the orchestration session
   */
  private getTools(): OrchestratorTool[] {
    return [
      {
        name: 'scanRepo',
        description: 'Scan the repository to extract metadata, languages, dependencies, and structure',
        parameters: {},
        handler: async () => this.toolScanRepo(),
      },
      {
        name: 'localSummarize',
        description: 'Use local model to summarize file contents (privacy-sensitive)',
        parameters: {
          filePath: { type: 'string', description: 'Relative path to the file', required: true },
        },
        handler: async (params) => this.toolLocalSummarize(params.filePath as string),
      },
      {
        name: 'localAnalyzeArchitecture',
        description: 'Use local model to analyze and describe the architecture',
        parameters: {
          keyFiles: { type: 'array', description: 'List of key file paths to analyze', required: true },
        },
        handler: async (params) => this.toolLocalAnalyzeArchitecture(params.keyFiles as string[]),
      },
      {
        name: 'localGenerateTasks',
        description: 'Use local model to generate starter tasks',
        parameters: {},
        handler: async () => this.toolLocalGenerateTasks(),
      },
      {
        name: 'localGenerateDiagram',
        description: 'Use local model to generate a Mermaid diagram',
        parameters: {},
        handler: async () => this.toolLocalGenerateDiagram(),
      },
      {
        name: 'writeDoc',
        description: 'Write a documentation file to the output directory',
        parameters: {
          filename: { type: 'string', description: 'Output filename', required: true },
          content: { type: 'string', description: 'File content', required: true },
        },
        handler: async (params) => this.toolWriteDoc(params.filename as string, params.content as string),
      },
      {
        name: 'runCommand',
        description: 'Execute a shell command in the repository',
        parameters: {
          command: { type: 'string', description: 'Command to execute', required: true },
        },
        handler: async (params) => this.toolRunCommand(params.command as string),
      },
    ];
  }

  /**
   * Run the complete onboarding pack generation workflow
   */
  async run(): Promise<OnboardingPack> {
    this.log('Starting onboarding pack generation...');

    // Step 1: Check LLM provider availability
    await this.executeStep('check-foundry', 'Checking LLM provider', async () => {
      this.reportDetail('Connecting to inference endpoint...');
      const status = await this.localModel.checkStatus();
      if (status.available) {
        const isCopilot = 'isCopilotSdk' in this.localModel && this.localModel.isCopilotSdk;
        const providerName = isCopilot ? 'GitHub Copilot SDK'
          : this.localModel.isCloudMode ? 'Microsoft Foundry' : 'Foundry Local';
        this.log(`✓ ${providerName} available at ${status.endpoint}`);
        this.log(`  Active model: ${status.activeModel}`);
        this.reportDetail(`${providerName} online — model: ${status.activeModel || 'default'}`);
      } else if (!this.config.skipLocalModel) {
        this.log('⚠ LLM provider not available. Using fallback generation.');
        this.reportDetail('LLM provider unavailable — using fallback');
      }
      return status;
    });

    // Step 2: Scan repository
    await this.executeStep('scan-repo', 'Scanning repository', async () => {
      this.reportDetail('Reading file tree and detecting languages...');
      this.repoMetadata = await this.scanner.scan();
      const primary = this.repoMetadata.languages[0]?.name || 'Unknown';
      this.log(`✓ Found ${this.repoMetadata.languages.length} languages`);
      this.log(`  Primary: ${primary}`);
      this.log(`  Dependencies: ${this.repoMetadata.dependencies.length}`);
      this.reportDetail(`Found ${this.repoMetadata.languages.length} languages, ${this.repoMetadata.dependencies.length} deps — primary: ${primary}`);
      return this.repoMetadata;
    });

    if (!this.repoMetadata) {
      throw new Error('Failed to scan repository');
    }

    // Step 3: Analyze key files locally
    let keyFileSummaries: Record<string, string> = {};
    await this.executeStep('analyze-files', 'Analyzing key files', async () => {
      const keyFiles = this.identifyKeyFiles();
      if (this.localModel.isReady && !this.config.skipLocalModel) {
        const filesToProcess = keyFiles.slice(0, 10);
        for (let i = 0; i < filesToProcess.length; i++) {
          const file = filesToProcess[i];
          try {
            this.reportDetail(`Summarizing file ${i + 1}/${filesToProcess.length}: ${file}`);
            const content = await this.scanner.readFile(file);
            const summary = await this.localModel.summarizeFile(file, content);
            keyFileSummaries[file] = summary;
            this.log(`  Summarized: ${file}`);
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : 'unknown error';
            this.log(`  Skipped: ${file} (${errMsg})`);
            this.reportDetail(`Skipped: ${file} (${errMsg})`);
          }
        }
      } else {
        // Fallback: basic file description
        for (const file of keyFiles) {
          keyFileSummaries[file] = `Key file in the project`;
        }
      }
      return keyFileSummaries;
    });

    // Step 4: Generate architecture overview
    let architectureOverview = '';
    await this.executeStep('gen-architecture', 'Generating architecture overview', async () => {
      this.reportDetail('Building structure tree and sending to model...');
      const structureTree = this.scanner.formatStructureTree(this.repoMetadata!.structure);
      
      if (this.localModel.isReady && !this.config.skipLocalModel) {
        architectureOverview = await this.localModel.generateArchitectureSummary(
          structureTree,
          keyFileSummaries
        );
      } else {
        architectureOverview = this.generateFallbackArchitecture();
      }
      return architectureOverview;
    });

    // Step 5: Generate starter tasks
    let tasks: StarterTask[] = [];
    await this.executeStep('gen-tasks', 'Generating starter tasks', async () => {
      const keyFiles = this.identifyKeyFiles();
      if (this.localModel.isReady && !this.config.skipLocalModel) {
        // Generate tasks in two batches to avoid truncation
        const repoContext = `Project: ${this.repoMetadata!.name}\nArchitecture: ${architectureOverview}`;
        const langs = this.repoMetadata!.languages.map(l => l.name);
        
        this.reportDetail('Generating tasks batch 1/2 (tasks 1-5)...');
        const batch1Text = await this.localModel.generateStarterTasks(
          repoContext, langs, keyFiles, 1, 5
        );
        const batch1 = this.parseTasksFromText(batch1Text);
        
        let batch2: StarterTask[] = [];
        try {
          this.reportDetail('Generating tasks batch 2/2 (tasks 6-10)...');
          const batch2Text = await this.localModel.generateStarterTasks(
            repoContext, langs, keyFiles, 6, 10
          );
          batch2 = this.parseTasksFromText(batch2Text);
          // Re-number batch 2
          batch2 = batch2.map((t, i) => ({ ...t, id: batch1.length + i + 1 }));
        } catch {
          this.log('  ⚠ Second task batch failed, using fallback for remaining tasks');
        }
        
        tasks = [...batch1, ...batch2];
        
        // If we still have fewer than 10, pad with fallback tasks
        if (tasks.length < 10) {
          const fallback = this.generateFallbackTasks();
          const needed = 10 - tasks.length;
          const extras = fallback.slice(fallback.length - needed).map((t, i) => ({ ...t, id: tasks.length + i + 1 }));
          tasks = [...tasks, ...extras];
        }
        
        // Ensure exactly 10 tasks
        tasks = tasks.slice(0, 10).map((t, i) => ({ ...t, id: i + 1 }));
      } else {
        tasks = this.generateFallbackTasks();
      }
      return tasks;
    });

    // Step 6: Generate Mermaid diagram
    let diagram = '';
    await this.executeStep('gen-diagram', 'Generating component diagram', async () => {
      if (this.localModel.isReady && !this.config.skipLocalModel) {
        this.reportDetail('Extracting components and relationships...');
        const components = this.extractComponents();
        const relationships = this.extractRelationships();
        diagram = await this.localModel.generateMermaidDiagram(components, relationships);
        // Clean up the diagram if needed
        diagram = this.cleanMermaidDiagram(diagram);
      } else {
        diagram = this.generateFallbackDiagram();
      }
      return diagram;
    });

    // Step 7: Compile onboarding pack
    const pack = await this.executeStep('compile-pack', 'Compiling onboarding pack', async () => {
      return this.compileOnboardingPack(architectureOverview, tasks, diagram, keyFileSummaries);
    });

    // Step 8: Microsoft Learn validation
    await this.executeStep('ms-learn-validate', 'Validating Microsoft technologies', async () => {
      this.reportDetail('Scanning dependencies for Microsoft SDKs...');
      const detections = this.detectMicrosoftTechnologies();
      if (detections.length > 0) {
        pack.microsoftTechValidation = detections;
        this.log(`  Found ${detections.length} Microsoft technologies:`);
        this.reportDetail(`Found ${detections.length} Microsoft technologies`);
        for (const det of detections) {
          this.log(`    • ${det.name} (${det.category}, ${det.confidence} confidence)`);
        }
      } else {
        this.log('  No Microsoft technologies detected');
        this.reportDetail('No Microsoft technologies detected');
      }
      return detections;
    });

    // Step 9: Write output files
    await this.executeStep('write-files', 'Writing output files', async () => {
      this.reportDetail('Writing ONBOARDING.md, RUNBOOK.md, TASKS.md, AGENTS.md, diagram.mmd...');
      await this.writeOutputFiles(pack);
      return true;
    });

    this.log('\n✓ Onboarding pack generated successfully!');
    this.log(`  Output directory: ${this.config.outputDir}`);

    // Clean up SDK client resources if needed
    if (this.copilotSdkClient) {
      await this.copilotSdkClient.dispose();
    }

    return pack;
  }

  /**
   * Execute a workflow step with logging and error handling
   */
  private async executeStep<T>(id: string, name: string, action: () => Promise<T>): Promise<T> {
    this.currentStepNumber++;
    const step: WorkflowStep = { id, name, status: 'running' };
    this.steps.push(step);
    this.log(`\n[${this.currentStepNumber}/${this.totalSteps}] ${name}...`);
    this.reportProgress(id, name, 'running');

    try {
      const result = await action();
      step.status = 'completed';
      step.result = result;
      this.reportProgress(id, name, 'completed');
      return result;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      this.log(`  ✗ Failed: ${step.error}`);
      this.reportProgress(id, name, 'failed', step.error);
      throw error;
    }
  }

  /**
   * Report progress via callback
   */
  private reportProgress(
    stepId: string,
    stepName: string,
    stepStatus: 'running' | 'completed' | 'failed',
    detail?: string
  ): void {
    if (!this.onProgress) return;
    const baseProgress = Math.round(((this.currentStepNumber - 1) / this.totalSteps) * 100);
    const stepProgress = stepStatus === 'completed'
      ? Math.round((this.currentStepNumber / this.totalSteps) * 100)
      : baseProgress + Math.round((1 / this.totalSteps) * 50);
    this.onProgress({
      stepNumber: this.currentStepNumber,
      totalSteps: this.totalSteps,
      stepId,
      stepName,
      stepStatus,
      detail,
      progress: Math.min(stepProgress, 99),
    });
  }

  /**
   * Report sub-step detail (within a step)
   */
  private reportDetail(detail: string): void {
    if (!this.onProgress) return;
    const currentStep = this.steps[this.steps.length - 1];
    if (!currentStep) return;
    const baseProgress = Math.round(((this.currentStepNumber - 1) / this.totalSteps) * 100);
    const midProgress = baseProgress + Math.round((1 / this.totalSteps) * 50);
    this.onProgress({
      stepNumber: this.currentStepNumber,
      totalSteps: this.totalSteps,
      stepId: currentStep.id,
      stepName: currentStep.name,
      stepStatus: 'running',
      detail,
      progress: Math.min(midProgress, 99),
    });
  }

  /**
   * Tool: Scan repository
   */
  private async toolScanRepo(): Promise<RepoMetadata> {
    this.repoMetadata = await this.scanner.scan();
    return this.repoMetadata;
  }

  /**
   * Tool: Summarize file locally
   */
  private async toolLocalSummarize(filePath: string): Promise<string> {
    const content = await this.scanner.readFile(filePath);
    return this.localModel.summarizeFile(filePath, content);
  }

  /**
   * Tool: Analyze architecture locally
   */
  private async toolLocalAnalyzeArchitecture(keyFiles: string[]): Promise<string> {
    const summaries: Record<string, string> = {};
    for (const file of keyFiles) {
      const content = await this.scanner.readFile(file);
      summaries[file] = await this.localModel.summarizeFile(file, content);
    }
    const structureTree = this.scanner.formatStructureTree(this.repoMetadata!.structure);
    return this.localModel.generateArchitectureSummary(structureTree, summaries);
  }

  /**
   * Tool: Generate tasks locally
   */
  private async toolLocalGenerateTasks(): Promise<string> {
    if (!this.repoMetadata) throw new Error('Repository not scanned');
    const context = `Project: ${this.repoMetadata.name}\nLanguages: ${this.repoMetadata.languages.map(l => l.name).join(', ')}`;
    return this.localModel.generateStarterTasks(context, this.repoMetadata.languages.map(l => l.name));
  }

  /**
   * Tool: Generate diagram locally
   */
  private async toolLocalGenerateDiagram(): Promise<string> {
    const components = this.extractComponents();
    const relationships = this.extractRelationships();
    return this.localModel.generateMermaidDiagram(components, relationships);
  }

  /**
   * Tool: Write documentation file
   */
  private async toolWriteDoc(filename: string, content: string): Promise<void> {
    const outputPath = join(this.config.outputDir, filename);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, 'utf-8');
  }

  /**
   * Tool: Run command
   */
  private async toolRunCommand(command: string): Promise<string> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.config.repoPath });
      return stdout || stderr;
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Detect Microsoft technologies from repo metadata and generate Learn MCP validation queries
   */
  private detectMicrosoftTechnologies(): MicrosoftTechDetection[] {
    if (!this.repoMetadata) return [];

    const detections: MicrosoftTechDetection[] = [];
    const meta = this.repoMetadata;

    // Detect .NET / C# / F#
    const hasDotnet = meta.languages.some(l => ['c#', 'csharp', 'f#', 'fsharp', 'vb.net'].includes(l.name.toLowerCase()));
    const hasCsproj = meta.buildFiles.some(bf => bf.path.endsWith('.csproj') || bf.path.endsWith('.fsproj') || bf.path.endsWith('.sln'));
    if (hasDotnet || hasCsproj || meta.buildFiles.some(bf => bf.type === 'dotnet')) {
      detections.push({
        name: '.NET',
        category: 'dotnet',
        confidence: 'high',
        evidence: hasCsproj ? 'Found .csproj/.fsproj files' : 'Detected C#/F# source files',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: '.NET getting started overview', purpose: 'Verify .NET version and setup' },
          { tool: 'microsoft_docs_search', query: '.NET what\'s new latest version', purpose: 'Check current .NET version' },
          { tool: 'microsoft_code_sample_search', query: '.NET project setup', language: 'csharp', purpose: 'Find setup code samples' },
        ],
      });
    }

    // Detect ASP.NET Core
    const hasAspNet = meta.dependencies.some(d =>
      d.name.toLowerCase().includes('microsoft.aspnetcore') || d.name.toLowerCase().includes('asp.net')
    );
    if (hasAspNet) {
      detections.push({
        name: 'ASP.NET Core',
        category: 'dotnet',
        confidence: 'high',
        evidence: 'Found ASP.NET Core NuGet packages',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'ASP.NET Core getting started tutorial', purpose: 'Setup and configuration' },
          { tool: 'microsoft_docs_search', query: 'ASP.NET Core middleware pipeline', purpose: 'Understand request pipeline' },
          { tool: 'microsoft_code_sample_search', query: 'ASP.NET Core minimal API', language: 'csharp', purpose: 'Find API patterns' },
        ],
      });
    }

    // Detect TypeScript
    const hasTypeScript = meta.languages.some(l => l.name.toLowerCase() === 'typescript');
    if (hasTypeScript) {
      detections.push({
        name: 'TypeScript',
        category: 'typescript',
        confidence: 'high',
        evidence: 'TypeScript source files detected',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'TypeScript configuration tsconfig', purpose: 'Verify TypeScript setup' },
          { tool: 'microsoft_docs_search', query: 'TypeScript best practices', purpose: 'Review best practices' },
        ],
      });
    }

    // Detect Azure SDKs (npm @azure/* packages)
    const azureNpmDeps = meta.dependencies.filter(d => d.name.startsWith('@azure/'));
    if (azureNpmDeps.length > 0) {
      for (const dep of azureNpmDeps.slice(0, 5)) {
        const serviceName = dep.name.replace('@azure/', '').replace(/-/g, ' ');
        detections.push({
          name: `Azure SDK: ${dep.name}`,
          category: 'azure-service',
          confidence: 'high',
          evidence: `Found npm package ${dep.name}`,
          learnQueries: [
            { tool: 'microsoft_docs_search', query: `${dep.name} getting started`, purpose: `Verify ${serviceName} SDK usage` },
            { tool: 'microsoft_code_sample_search', query: serviceName, language: 'javascript', purpose: `Find ${serviceName} code samples` },
          ],
        });
      }
    }

    // Detect Azure SDKs (.NET Azure.* packages)
    const azureDotnetDeps = meta.dependencies.filter(d =>
      d.name.startsWith('Azure.') || d.name.startsWith('Microsoft.Azure.')
    );
    if (azureDotnetDeps.length > 0) {
      for (const dep of azureDotnetDeps.slice(0, 5)) {
        detections.push({
          name: `Azure SDK: ${dep.name}`,
          category: 'azure-service',
          confidence: 'high',
          evidence: `Found NuGet package ${dep.name}`,
          learnQueries: [
            { tool: 'microsoft_docs_search', query: `${dep.name} getting started`, purpose: `Verify Azure SDK usage` },
            { tool: 'microsoft_code_sample_search', query: dep.name, language: 'csharp', purpose: 'Find code samples' },
          ],
        });
      }
    }

    // Detect Azure Functions
    const hasHostJson = meta.configFiles.some(cf => cf.path.includes('host.json'));
    const hasFuncDep = meta.dependencies.some(d =>
      d.name.includes('azure-functions') || d.name.includes('Microsoft.Azure.Functions')
    );
    if (hasHostJson || hasFuncDep) {
      detections.push({
        name: 'Azure Functions',
        category: 'azure-service',
        confidence: hasHostJson ? 'high' : 'medium',
        evidence: hasHostJson ? 'Found host.json configuration' : 'Found Azure Functions dependency',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'Azure Functions overview triggers bindings', purpose: 'Understand Functions architecture' },
          { tool: 'microsoft_docs_search', query: 'Azure Functions local development', purpose: 'Setup local development' },
          { tool: 'microsoft_code_sample_search', query: 'Azure Functions', language: hasDotnet ? 'csharp' : 'python', purpose: 'Find trigger/binding examples' },
        ],
      });
    }

    // Detect Bicep / ARM templates
    const hasBicep = meta.languages.some(l => l.name.toLowerCase() === 'bicep') ||
      this.hasFileExtension(meta, '.bicep');
    const hasArm = meta.configFiles.some(cf => cf.path.includes('azuredeploy.json') || cf.path.includes('mainTemplate.json'));
    if (hasBicep || hasArm) {
      detections.push({
        name: hasBicep ? 'Bicep' : 'ARM Templates',
        category: 'azure-service',
        confidence: 'high',
        evidence: hasBicep ? 'Found .bicep files' : 'Found ARM template files',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'Bicep overview Azure resource deployment', purpose: 'Understand infrastructure as code' },
          { tool: 'microsoft_docs_search', query: 'Bicep best practices modules', purpose: 'Review deployment best practices' },
        ],
      });
    }

    // Detect Azure DevOps / GitHub Actions for Azure
    const hasAzurePipelines = meta.configFiles.some(cf => cf.path.includes('azure-pipelines'));
    const hasAzureGHActions = meta.configFiles.some(cf =>
      cf.path.includes('.github') && cf.path.includes('azure')
    );
    if (hasAzurePipelines || hasAzureGHActions) {
      detections.push({
        name: hasAzurePipelines ? 'Azure Pipelines' : 'GitHub Actions for Azure',
        category: 'devops',
        confidence: 'high',
        evidence: hasAzurePipelines ? 'Found azure-pipelines.yml' : 'Found Azure GitHub Actions workflow',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: hasAzurePipelines ? 'Azure Pipelines YAML reference' : 'GitHub Actions deploy to Azure', purpose: 'Verify CI/CD configuration' },
        ],
      });
    }

    // Detect Semantic Kernel
    const hasSemanticKernel = meta.dependencies.some(d =>
      d.name.toLowerCase().includes('semantic-kernel') || d.name.includes('Microsoft.SemanticKernel')
    );
    if (hasSemanticKernel) {
      detections.push({
        name: 'Semantic Kernel',
        category: 'ai-ml',
        confidence: 'high',
        evidence: 'Found Semantic Kernel dependency',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'Semantic Kernel overview plugins', purpose: 'Understand SK architecture' },
          { tool: 'microsoft_code_sample_search', query: 'Semantic Kernel', language: 'csharp', purpose: 'Find SK code patterns' },
        ],
      });
    }

    // Detect Azure OpenAI
    const hasAzureOpenAI = meta.dependencies.some(d =>
      d.name.includes('openai') && (d.name.includes('azure') || d.name.includes('@azure'))
    );
    if (hasAzureOpenAI) {
      detections.push({
        name: 'Azure OpenAI',
        category: 'ai-ml',
        confidence: 'high',
        evidence: 'Found Azure OpenAI SDK dependency',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'Azure OpenAI getting started', purpose: 'Setup and authentication' },
          { tool: 'microsoft_docs_search', query: 'Azure OpenAI models deployment', purpose: 'Understand model options' },
        ],
      });
    }

    // Detect Microsoft Graph
    const hasGraph = meta.dependencies.some(d =>
      d.name.toLowerCase().includes('microsoft-graph') || d.name.includes('Microsoft.Graph')
    );
    if (hasGraph) {
      detections.push({
        name: 'Microsoft Graph',
        category: 'graph',
        confidence: 'high',
        evidence: 'Found Microsoft Graph SDK dependency',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'Microsoft Graph API getting started', purpose: 'Understand Graph API' },
          { tool: 'microsoft_docs_search', query: 'Microsoft Graph SDK authentication', purpose: 'Verify auth patterns' },
        ],
      });
    }

    // Detect VS Code extension
    const hasVscodeExt = meta.dependencies.some(d => d.name === '@types/vscode' || d.name === 'vscode');
    const hasVscodeManifest = meta.configFiles.some(cf => cf.path === '.vscodeignore') ||
      meta.entryPoints.some(ep => ep.includes('extension.ts') || ep.includes('extension.js'));
    if (hasVscodeExt || hasVscodeManifest) {
      detections.push({
        name: 'VS Code Extension',
        category: 'vscode',
        confidence: 'high',
        evidence: hasVscodeExt ? 'Found @types/vscode dependency' : 'Found VS Code extension files',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'VS Code extension API development', purpose: 'Extension development guide' },
          { tool: 'microsoft_code_sample_search', query: 'VS Code extension', language: 'typescript', purpose: 'Find extension examples' },
        ],
      });
    }

    // Detect Entity Framework
    const hasEF = meta.dependencies.some(d => d.name.includes('Microsoft.EntityFrameworkCore'));
    if (hasEF) {
      detections.push({
        name: 'Entity Framework Core',
        category: 'dotnet',
        confidence: 'high',
        evidence: 'Found Entity Framework Core NuGet package',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'Entity Framework Core getting started', purpose: 'Understand EF Core setup' },
          { tool: 'microsoft_docs_search', query: 'Entity Framework Core migrations', purpose: 'Verify migration patterns' },
        ],
      });
    }

    // Detect Foundry Local
    const hasFoundry = meta.dependencies.some(d => d.name.includes('foundry'));
    if (hasFoundry) {
      detections.push({
        name: 'Foundry Local',
        category: 'ai-ml',
        confidence: 'medium',
        evidence: 'Found Foundry-related dependency',
        learnQueries: [
          { tool: 'microsoft_docs_search', query: 'Foundry Local AI models on device', purpose: 'Understand local model deployment' },
        ],
      });
    }

    return detections;
  }

  /**
   * Identify key files to analyze
   */
  private identifyKeyFiles(): string[] {
    if (!this.repoMetadata) return [];

    const keyFiles: string[] = [];

    // Add entry points
    keyFiles.push(...this.repoMetadata.entryPoints);

    // Add README
    const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'README'];
    for (const readme of readmeFiles) {
      if (existsSync(join(this.config.repoPath, readme))) {
        keyFiles.push(readme);
        break;
      }
    }

    // Add build files
    for (const bf of this.repoMetadata.buildFiles.slice(0, 3)) {
      keyFiles.push(bf.path);
    }

    // Add config files
    for (const cf of this.repoMetadata.configFiles.filter(c => c.type === 'ci').slice(0, 2)) {
      keyFiles.push(cf.path);
    }

    return [...new Set(keyFiles)];
  }

  /**
   * Extract components from metadata
   */
  private extractComponents(): string[] {
    if (!this.repoMetadata) return [];

    const components: string[] = [];

    // Add top-level directories as components
    const topDirs = this.repoMetadata.structure.children?.filter(c => c.type === 'directory') || [];
    for (const dir of topDirs) {
      // Skip common non-component dirs
      if (['node_modules', '.git', 'dist', 'build', '.github'].includes(dir.name)) continue;
      components.push(`${dir.name} (directory)`);
    }

    // Add main language frameworks
    for (const lang of this.repoMetadata.languages.slice(0, 3)) {
      components.push(`${lang.name} (${lang.percentage}%)`);
    }

    // Add key dependencies as components
    const keyDeps = this.repoMetadata.dependencies
      .filter(d => d.type === 'production')
      .slice(0, 10);
    for (const dep of keyDeps) {
      if (this.isFrameworkDep(dep.name)) {
        components.push(`${dep.name} (framework)`);
      }
    }

    return components;
  }

  /**
   * Check if repo contains files with a given extension
   */
  private hasFileExtension(meta: RepoMetadata, ext: string): boolean {
    const checkNode = (node: DirectoryNode): boolean => {
      if (node.type === 'file' && node.name.endsWith(ext)) return true;
      if (node.children) return node.children.some(c => checkNode(c));
      return false;
    };
    return checkNode(meta.structure);
  }

  /**
   * Check if a dependency is a framework
   */
  private isFrameworkDep(name: string): boolean {
    const frameworks = [
      'react', 'vue', 'angular', 'express', 'fastify', 'koa', 'next', 'nuxt',
      'nestjs', 'django', 'flask', 'fastapi', 'spring', 'aspnetcore', 'dotnet',
    ];
    return frameworks.some(f => name.toLowerCase().includes(f));
  }

  /**
   * Extract relationships from metadata
   */
  private extractRelationships(): string {
    if (!this.repoMetadata) return '';

    const relationships: string[] = [];

    // Infer relationships from build files
    for (const bf of this.repoMetadata.buildFiles) {
      if (bf.scripts) {
        if (bf.scripts.build) relationships.push('src -> dist (build)');
        if (bf.scripts.test) relationships.push('src -> tests (test)');
        if (bf.scripts.start) relationships.push('entry -> runtime (start)');
      }
    }

    // Infer from common patterns
    const dirs = this.repoMetadata.structure.children?.map(c => c.name) || [];
    if (dirs.includes('src') && dirs.includes('tests')) {
      relationships.push('tests -> src (testing)');
    }
    if (dirs.includes('api') && dirs.includes('client')) {
      relationships.push('client -> api (HTTP)');
    }

    return relationships.join('\n');
  }

  /**
   * Compile the complete onboarding pack
   */
  private compileOnboardingPack(
    architecture: string,
    tasks: StarterTask[],
    diagram: string,
    fileSummaries: Record<string, string>
  ): OnboardingPack {
    const meta = this.repoMetadata!;

    return {
      onboarding: {
        projectName: meta.name,
        overview: this.generateOverview(meta),
        architecture,
        keyFlows: this.generateKeyFlows(meta, fileSummaries),
        dependencyMap: {
          internal: [],
          external: meta.dependencies.slice(0, 20).map(d => ({
            name: d.name,
            purpose: `${d.ecosystem} ${d.type} dependency`,
            version: d.version,
          })),
        },
        gettingStarted: this.generateGettingStarted(meta),
      },
      runbook: {
        prerequisites: this.generatePrerequisites(meta),
        setup: this.generateSetupSteps(meta),
        build: this.generateBuildCommand(meta),
        run: this.generateRunCommand(meta),
        test: this.generateTestCommand(meta),
        troubleshooting: this.generateTroubleshooting(meta),
        commonCommands: this.generateCommonCommands(meta),
      },
      tasks: { tasks },
      agents: this.generateAgentsDoc(meta),
      diagram,
    };
  }

  /**
   * Generate AGENTS.md content from repo metadata
   */
  private generateAgentsDoc(meta: RepoMetadata): AgentsDoc {
    const skills: AgentSkill[] = [];
    const mcpServers: AgentMcpServer[] = [];
    const workflows: AgentWorkflow[] = [];

    // Detect skills from build system and languages
    const bf = meta.buildFiles[0];
    if (bf) {
      skills.push({
        name: `${bf.type}-build`,
        description: `Build and manage the ${bf.type} project`,
        triggers: ['build', 'install dependencies', 'compile'],
      });
    }

    if (meta.testFrameworks.length > 0) {
      skills.push({
        name: 'test-runner',
        description: `Run tests using ${meta.testFrameworks.join(', ')}`,
        triggers: ['run tests', 'test coverage', 'check tests'],
      });
    }

    for (const lang of meta.languages.slice(0, 3)) {
      skills.push({
        name: `${lang.name.toLowerCase()}-development`,
        description: `Develop and review ${lang.name} code`,
        triggers: [`write ${lang.name}`, `review ${lang.name}`, `refactor ${lang.name}`],
      });
    }

    // Detect MCP servers from config files
    mcpServers.push({
      name: 'microsoft-learn',
      url: 'https://learn.microsoft.com/api/mcp',
      tools: ['microsoft_docs_search', 'microsoft_docs_fetch', 'microsoft_code_sample_search'],
    });

    // Detect workflows from build scripts
    workflows.push({
      name: 'onboarding',
      description: 'New contributor onboarding workflow',
      steps: ['Clone repository', 'Install dependencies', 'Run tests', 'Read ONBOARDING.md'],
    });

    if (bf?.scripts?.build) {
      workflows.push({
        name: 'development',
        description: 'Standard development workflow',
        steps: ['Create feature branch', 'Make changes', 'Run tests', 'Build project', 'Submit PR'],
      });
    }

    if (meta.configFiles.some(cf => cf.type === 'ci')) {
      workflows.push({
        name: 'ci-cd',
        description: 'Continuous integration and deployment',
        steps: ['Push to branch', 'CI runs tests', 'CI runs build', 'Deploy on merge to main'],
      });
    }

    // Code review workflow — always included for educational value
    workflows.push({
      name: 'code-review',
      description: 'Structured code review workflow for learning and quality assurance',
      steps: [
        'Open the pull request and read the description',
        'Review the diff file-by-file, starting with tests',
        'Check code style and naming conventions',
        'Verify tests cover the changes',
        'Run the test suite locally',
        'Leave constructive feedback with specific suggestions',
      ],
    });

    return {
      projectName: meta.name,
      description: `Agent configuration for ${meta.name} — a ${meta.languages[0]?.name || 'multi-language'} project with ${meta.dependencies.length} dependencies.`,
      skills,
      mcpServers,
      workflows,
    };
  }

  /**
   * Generate overview text
   */
  private generateOverview(meta: RepoMetadata): string {
    const primaryLang = meta.languages[0]?.name || 'Unknown';
    const langList = meta.languages.slice(0, 3).map(l => `${l.name} (${l.percentage}%)`).join(', ');
    
    return `${meta.name} is a ${primaryLang} project with ${meta.dependencies.length} dependencies. ` +
           `Languages used: ${langList}. ` +
           `Test frameworks: ${meta.testFrameworks.join(', ') || 'None detected'}.`;
  }

  /**
   * Generate key flows
   */
  private generateKeyFlows(meta: RepoMetadata, summaries: Record<string, string>): Array<{
    name: string;
    description: string;
    steps: string[];
    involvedFiles: string[];
  }> {
    const flows = [];

    // Build flow
    if (meta.buildFiles.length > 0) {
      const bf = meta.buildFiles[0];
      flows.push({
        name: 'Build',
        description: `Build the project using ${bf.type}`,
        steps: this.getBuildSteps(bf),
        involvedFiles: [bf.path],
      });
    }

    // Entry point flow
    if (meta.entryPoints.length > 0) {
      flows.push({
        name: 'Application Startup',
        description: 'Main entry point and initialization',
        steps: ['Load configuration', 'Initialize dependencies', 'Start main process'],
        involvedFiles: meta.entryPoints,
      });
    }

    return flows;
  }

  /**
   * Get build steps for a build file
   */
  private getBuildSteps(bf: { type: string; scripts?: Record<string, string> }): string[] {
    switch (bf.type) {
      case 'npm':
      case 'yarn':
      case 'pnpm':
        return ['Install dependencies', 'Run build script', 'Output to dist/build folder'];
      case 'dotnet':
        return ['Restore NuGet packages', 'Build solution', 'Output to bin folder'];
      case 'maven':
        return ['Download dependencies', 'Compile sources', 'Package artifact'];
      case 'cargo':
        return ['Fetch crates', 'Compile Rust code', 'Output to target folder'];
      case 'go':
        return ['Download modules', 'Build binary', 'Output executable'];
      default:
        return ['Install dependencies', 'Run build command'];
    }
  }

  /**
   * Generate getting started text
   */
  private generateGettingStarted(meta: RepoMetadata): string {
    const bf = meta.buildFiles[0];
    if (!bf) return 'Clone the repository and follow the README instructions.';

    switch (bf.type) {
      case 'npm':
        return 'Run `npm install` to install dependencies, then `npm run dev` or `npm start` to run the project.';
      case 'yarn':
        return 'Run `yarn` to install dependencies, then `yarn dev` or `yarn start` to run the project.';
      case 'pnpm':
        return 'Run `pnpm install` to install dependencies, then `pnpm dev` or `pnpm start` to run the project.';
      case 'dotnet':
        return 'Run `dotnet restore` to restore packages, then `dotnet run` to start the application.';
      case 'pip':
        return 'Create a virtual environment, install dependencies with `pip install -r requirements.txt`, then run the main script.';
      case 'cargo':
        return 'Run `cargo build` to compile, then `cargo run` to execute.';
      case 'go':
        return 'Run `go mod download` for dependencies, then `go run .` to start.';
      default:
        return 'Check the build configuration files for instructions.';
    }
  }

  /**
   * Generate prerequisites
   */
  private generatePrerequisites(meta: RepoMetadata): Prerequisite[] {
    const prereqs: Prerequisite[] = [];

    // Based on build system
    const bf = meta.buildFiles[0];
    if (bf) {
      switch (bf.type) {
        case 'npm':
        case 'yarn':
        case 'pnpm':
          prereqs.push({
            name: 'Node.js',
            description: 'JavaScript runtime (v18+ recommended)',
            installCommand: 'Download from nodejs.org or use nvm',
            verifyCommand: 'node --version',
          });
          if (bf.type === 'yarn') {
            prereqs.push({
              name: 'Yarn',
              description: 'Package manager',
              installCommand: 'npm install -g yarn',
              verifyCommand: 'yarn --version',
            });
          }
          if (bf.type === 'pnpm') {
            prereqs.push({
              name: 'pnpm',
              description: 'Fast package manager',
              installCommand: 'npm install -g pnpm',
              verifyCommand: 'pnpm --version',
            });
          }
          break;
        case 'dotnet':
          prereqs.push({
            name: '.NET SDK',
            description: '.NET development kit (v8+ recommended)',
            installCommand: 'Download from dotnet.microsoft.com',
            verifyCommand: 'dotnet --version',
          });
          break;
        case 'pip':
          prereqs.push({
            name: 'Python',
            description: 'Python interpreter (v3.10+ recommended)',
            installCommand: 'Download from python.org or use pyenv',
            verifyCommand: 'python --version',
          });
          break;
        case 'go':
          prereqs.push({
            name: 'Go',
            description: 'Go programming language (v1.21+ recommended)',
            installCommand: 'Download from go.dev',
            verifyCommand: 'go version',
          });
          break;
        case 'cargo':
          prereqs.push({
            name: 'Rust',
            description: 'Rust toolchain',
            installCommand: 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
            verifyCommand: 'rustc --version',
          });
          break;
      }
    }

    // Detect Python from languages even if no pip build file
    const hasPython = meta.languages.some(l => l.name.toLowerCase() === 'python');
    const hasPythonPrereq = prereqs.some(p => p.name === 'Python');
    if (hasPython && !hasPythonPrereq) {
      prereqs.unshift({
        name: 'Python',
        description: `Python interpreter (v3.10+ recommended) — ${meta.languages.find(l => l.name.toLowerCase() === 'python')?.percentage || 0}% of codebase`,
        installCommand: 'Download from python.org or use pyenv',
        verifyCommand: 'python --version',
      });
    }

    // Detect Jupyter notebooks
    const hasNotebooks = this.hasFileExtension(meta, '.ipynb');
    if (hasNotebooks) {
      prereqs.push({
        name: 'Jupyter',
        description: 'Notebook environment for running .ipynb files',
        installCommand: 'pip install jupyter',
        verifyCommand: 'jupyter --version',
      });
    }

    // Detect Bicep/ARM templates → Azure CLI
    const hasBicep = meta.languages.some(l => l.name.toLowerCase() === 'bicep') ||
      this.hasFileExtension(meta, '.bicep');
    if (hasBicep) {
      prereqs.push({
        name: 'Azure CLI',
        description: 'Azure command-line interface for deploying Bicep/ARM templates',
        installCommand: 'Download from learn.microsoft.com/cli/azure/install-azure-cli',
        verifyCommand: 'az --version',
      });
    }

    // Detect Azure Functions (host.json + function_app.py)
    const hasHostJson = meta.configFiles.some(cf => cf.path.includes('host.json'));
    const hasFunctionApp = meta.entryPoints.some(ep => ep.includes('function_app'));
    if (hasHostJson || hasFunctionApp) {
      prereqs.push({
        name: 'Azure Functions Core Tools',
        description: 'Local development tools for Azure Functions',
        installCommand: 'npm install -g azure-functions-core-tools@4',
        verifyCommand: 'func --version',
      });
    }

    // Detect requirements.txt even without pip build file
    const hasRequirements = meta.buildFiles.some(bf => bf.path.includes('requirements.txt')) ||
      meta.configFiles.some(cf => cf.path.includes('requirements.txt'));
    if (hasRequirements && hasPython) {
      const hasPip = prereqs.some(p => p.name === 'pip');
      if (!hasPip) {
        prereqs.push({
          name: 'pip',
          description: 'Python package manager (usually included with Python)',
          installCommand: 'python -m ensurepip --upgrade',
          verifyCommand: 'pip --version',
        });
      }
    }

    // Git is usually needed
    prereqs.push({
      name: 'Git',
      description: 'Version control system',
      installCommand: 'Download from git-scm.com',
      verifyCommand: 'git --version',
    });

    return prereqs;
  }

  /**
   * Generate setup steps
   */
  private generateSetupSteps(meta: RepoMetadata): SetupStep[] {
    const steps: SetupStep[] = [];
    let order = 1;

    // Clone step
    if (meta.gitInfo?.remoteUrl) {
      steps.push({
        order: order++,
        title: 'Clone the repository',
        description: 'Get the source code',
        commands: [`git clone ${meta.gitInfo.remoteUrl}`, `cd ${meta.name}`],
      });
    }

    // Install dependencies
    const bf = meta.buildFiles[0];
    if (bf) {
      const cmd = this.getInstallCommand(bf.type);
      if (cmd) {
        steps.push({
          order: order++,
          title: 'Install dependencies',
          description: `Use ${bf.type} to install project dependencies`,
          commands: [cmd],
        });
      }
    }

    // Environment setup
    if (meta.configFiles.some(cf => cf.type === 'env')) {
      steps.push({
        order: order++,
        title: 'Configure environment',
        description: 'Set up environment variables',
        commands: ['cp .env.example .env', '# Edit .env with your values'],
      });
    }

    return steps;
  }

  /**
   * Get install command for build type
   */
  private getInstallCommand(type: string): string | null {
    switch (type) {
      case 'npm': return 'npm install';
      case 'yarn': return 'yarn';
      case 'pnpm': return 'pnpm install';
      case 'dotnet': return 'dotnet restore';
      case 'pip': return 'pip install -r requirements.txt';
      case 'cargo': return 'cargo fetch';
      case 'go': return 'go mod download';
      case 'maven': return 'mvn dependency:resolve';
      case 'gradle': return './gradlew dependencies';
      default: return null;
    }
  }

  /**
   * Generate build command
   */
  private generateBuildCommand(meta: RepoMetadata): {
    title: string;
    description: string;
    commands: string[];
    notes?: string;
  } {
    const bf = meta.buildFiles[0];
    if (!bf) {
      return {
        title: 'Build',
        description: 'No build system detected',
        commands: ['# Check project documentation for build instructions'],
      };
    }

    const buildCommands: Record<string, string[]> = {
      npm: bf.scripts?.build ? ['npm run build'] : ['# No build script defined'],
      yarn: bf.scripts?.build ? ['yarn build'] : ['# No build script defined'],
      pnpm: bf.scripts?.build ? ['pnpm build'] : ['# No build script defined'],
      dotnet: ['dotnet build'],
      cargo: ['cargo build --release'],
      go: ['go build -o bin/app .'],
      maven: ['mvn package'],
      gradle: ['./gradlew build'],
    };

    return {
      title: 'Build',
      description: `Build the project using ${bf.type}`,
      commands: buildCommands[bf.type] || ['# Check project documentation'],
    };
  }

  /**
   * Generate run command
   */
  private generateRunCommand(meta: RepoMetadata): {
    title: string;
    description: string;
    commands: string[];
    notes?: string;
  } {
    const bf = meta.buildFiles[0];
    if (!bf) {
      return {
        title: 'Run',
        description: 'Start the application',
        commands: ['# Check project documentation'],
      };
    }

    const runCommands: Record<string, string[]> = {
      npm: bf.scripts?.start ? ['npm start'] : bf.scripts?.dev ? ['npm run dev'] : ['node dist/index.js'],
      yarn: bf.scripts?.start ? ['yarn start'] : bf.scripts?.dev ? ['yarn dev'] : ['node dist/index.js'],
      pnpm: bf.scripts?.start ? ['pnpm start'] : bf.scripts?.dev ? ['pnpm dev'] : ['node dist/index.js'],
      dotnet: ['dotnet run'],
      cargo: ['cargo run'],
      go: ['go run .'],
      pip: ['python main.py'],
    };

    return {
      title: 'Run',
      description: 'Start the application',
      commands: runCommands[bf.type] || ['# Check project documentation'],
    };
  }

  /**
   * Generate test command
   */
  private generateTestCommand(meta: RepoMetadata): {
    title: string;
    description: string;
    commands: string[];
    notes?: string;
  } {
    const bf = meta.buildFiles[0];
    
    const testCommands: Record<string, string[]> = {
      npm: bf?.scripts?.test ? ['npm test'] : ['# No test script defined'],
      yarn: bf?.scripts?.test ? ['yarn test'] : ['# No test script defined'],
      pnpm: bf?.scripts?.test ? ['pnpm test'] : ['# No test script defined'],
      dotnet: ['dotnet test'],
      cargo: ['cargo test'],
      go: ['go test ./...'],
      pip: ['pytest'],
      maven: ['mvn test'],
      gradle: ['./gradlew test'],
    };

    const frameworks = meta.testFrameworks.length > 0
      ? `Test frameworks: ${meta.testFrameworks.join(', ')}`
      : 'No test framework detected';

    return {
      title: 'Test',
      description: 'Run the test suite',
      commands: testCommands[bf?.type || ''] || ['# Check project documentation'],
      notes: frameworks,
    };
  }

  /**
   * Generate troubleshooting items
   */
  private generateTroubleshooting(meta: RepoMetadata): TroubleshootingItem[] {
    const items: TroubleshootingItem[] = [];
    const bf = meta.buildFiles[0];

    // Common issues based on build type
    if (bf?.type === 'npm' || bf?.type === 'yarn' || bf?.type === 'pnpm') {
      items.push({
        problem: 'node_modules issues or dependency conflicts',
        solution: 'Delete node_modules and lock file, then reinstall',
        commands: ['rm -rf node_modules', 'rm package-lock.json', 'npm install'],
      });
      items.push({
        problem: 'Port already in use',
        solution: 'Kill the process using the port or use a different port',
        commands: ['# Find process: lsof -i :3000', '# Kill: kill -9 <PID>'],
      });
    }

    if (bf?.type === 'dotnet') {
      items.push({
        problem: 'Package restore fails',
        solution: 'Clear NuGet cache and restore',
        commands: ['dotnet nuget locals all --clear', 'dotnet restore'],
      });
    }

    // Generic items
    items.push({
      problem: 'Environment variables not loaded',
      solution: 'Ensure .env file exists and is properly configured',
      commands: ['cp .env.example .env', '# Edit .env with your values'],
    });

    return items;
  }

  /**
   * Generate common commands
   */
  private generateCommonCommands(meta: RepoMetadata): Array<{
    title: string;
    description: string;
    commands: string[];
  }> {
    const commands = [];
    const bf = meta.buildFiles[0];

    if (bf?.scripts) {
      for (const [name, script] of Object.entries(bf.scripts).slice(0, 10)) {
        const pm = bf.type === 'yarn' ? 'yarn' : bf.type === 'pnpm' ? 'pnpm' : 'npm run';
        commands.push({
          title: name,
          description: script.slice(0, 80),
          commands: [`${pm} ${name}`],
        });
      }
    }

    return commands;
  }

  /**
   * Parse tasks from generated text
   */
  private parseTasksFromText(text: string): StarterTask[] {
    const tasks: StarterTask[] = [];
    
    // Match numbered tasks: "1. Title" or "1) Title" or "### 1. Title"
    const taskBlocks = text.split(/(?=(?:^|\n)\s*(?:###?\s*)?\d+[\.\)\:]\s)/m).filter(b => b.trim());

    for (const block of taskBlocks) {
      if (tasks.length >= 10) break;
      
      const titleMatch = block.match(/(?:###?\s*)?\d+[\.\)\:]\s*(.+?)(?:\n|$)/);
      if (!titleMatch) continue;
      
      const title = titleMatch[1].trim().replace(/\*\*/g, '');
      if (!title || title.length < 3) continue;
      
      // Parse structured fields
      const descMatch = block.match(/Description:\s*(.+?)(?:\n(?=[A-Z])|$)/s);
      const diffMatch = block.match(/Difficulty:\s*(easy|medium|hard)/i);
      const timeMatch = block.match(/Time:\s*(.+?)(?:\n|$)/);
      const learningMatch = block.match(/Learning:\s*(.+?)(?:\n(?=[A-Z])|$)/s);
      const criteriaMatch = block.match(/Criteria:\s*(.+?)(?:\n(?=[A-Z])|$)/s);
      const hintsMatch = block.match(/Hints:\s*(.+?)(?:\n(?=[A-Z])|$)/s);
      const filesMatch = block.match(/Files:\s*(.+?)(?:\n(?=[A-Z])|$)/s);
      const skillsMatch = block.match(/Skills:\s*(.+?)(?:\n|$)/);

      const idx = tasks.length;
      const difficulty = diffMatch ? diffMatch[1].toLowerCase() as 'easy' | 'medium' | 'hard' :
        idx < 3 ? 'easy' : idx < 7 ? 'medium' : 'hard';

      const criteria = criteriaMatch 
        ? criteriaMatch[1].split(/;|\n-/).map(c => c.trim()).filter(c => c.length > 0)
        : [`Complete ${title.toLowerCase()}`];

      const hints = hintsMatch
        ? hintsMatch[1].split(/;|\n-/).map(h => h.trim()).filter(h => h.length > 0)
        : ['Check the related files for context'];

      const relatedFiles = filesMatch
        ? filesMatch[1].split(/[,;]/).map(f => f.trim().replace(/`/g, '')).filter(f => f.length > 0)
        : [];

      const skills = skillsMatch
        ? skillsMatch[1].split(/[,;]/).map(s => s.trim().replace(/`/g, '')).filter(s => s.length > 0)
        : [];

      tasks.push({
        id: tasks.length + 1,
        title: title.slice(0, 80),
        description: descMatch ? descMatch[1].trim().slice(0, 300) : block.slice(0, 300),
        difficulty,
        estimatedTime: timeMatch ? timeMatch[1].trim() : (idx < 3 ? '30 minutes' : idx < 7 ? '1-2 hours' : '2-4 hours'),
        learningObjective: learningMatch ? learningMatch[1].trim().slice(0, 200) : undefined,
        acceptanceCriteria: criteria.slice(0, 3),
        hints: hints.slice(0, 2),
        relatedFiles: relatedFiles.slice(0, 3),
        skills: skills.slice(0, 3),
      });
    }

    return tasks.length >= 5 ? tasks : this.generateFallbackTasks();
  }

  /**
   * Generate fallback architecture description
   */
  private generateFallbackArchitecture(): string {
    if (!this.repoMetadata) return 'Unable to analyze architecture.';

    const structure = this.repoMetadata.structure;
    const topDirs = structure.children?.filter(c => c.type === 'directory').map(c => c.name) || [];
    const langs = this.repoMetadata.languages.map(l => l.name).join(', ');

    return `This ${langs} project has a ${topDirs.length > 5 ? 'monorepo' : 'standard'} structure ` +
           `with ${topDirs.length} main directories: ${topDirs.slice(0, 5).join(', ')}. ` +
           `The project uses ${this.repoMetadata.buildFiles[0]?.type || 'custom'} for build management.`;
  }

  /**
   * Generate fallback tasks
   */
  private generateFallbackTasks(): StarterTask[] {
    return [
      {
        id: 1, title: 'Review README and documentation', description: 'Read through the README and any documentation to understand the project',
        difficulty: 'easy', estimatedTime: '30 minutes', learningObjective: 'Learn to navigate project documentation and understand project purpose at a high level',
        acceptanceCriteria: ['Summarize the project purpose'], hints: ['Start with README.md'], relatedFiles: ['README.md'], skills: ['documentation'],
      },
      {
        id: 2, title: 'Set up local development environment', description: 'Install dependencies and verify you can run the project',
        difficulty: 'easy', estimatedTime: '30 minutes', learningObjective: 'Learn to set up development environments and manage project dependencies',
        acceptanceCriteria: ['Project runs locally'], hints: ['Follow the runbook setup steps'], relatedFiles: ['package.json'], skills: ['setup'],
      },
      {
        id: 3, title: 'Run the test suite', description: 'Execute all tests and understand the testing strategy',
        difficulty: 'easy', estimatedTime: '30 minutes', learningObjective: 'Learn how automated testing works and how to interpret test results',
        acceptanceCriteria: ['All tests pass'], hints: ['Check for test commands in package.json'], relatedFiles: [], skills: ['testing'],
      },
      {
        id: 4, title: 'Add a missing unit test', description: 'Find an untested function and add test coverage',
        difficulty: 'medium', estimatedTime: '1 hour', learningObjective: 'Learn to write unit tests and understand code coverage principles',
        acceptanceCriteria: ['New test passes', 'Coverage increases'], hints: ['Look for complex functions without tests'], relatedFiles: [], skills: ['testing'],
      },
      {
        id: 5, title: 'Fix a typo or improve documentation', description: 'Find and fix documentation issues',
        difficulty: 'easy', estimatedTime: '30 minutes', learningObjective: 'Learn the PR workflow: branch, commit, push, and submit a pull request',
        acceptanceCriteria: ['PR submitted with fix'], hints: ['Check code comments and README'], relatedFiles: [], skills: ['documentation'],
      },
      {
        id: 6, title: 'Add input validation', description: 'Add validation to a function that accepts user input',
        difficulty: 'medium', estimatedTime: '1-2 hours', learningObjective: 'Learn defensive programming and input validation patterns for security',
        acceptanceCriteria: ['Invalid inputs are rejected', 'Tests cover new validation'], hints: ['Look for functions handling external data'], relatedFiles: [], skills: ['security', 'validation'],
      },
      {
        id: 7, title: 'Improve error handling', description: 'Find a place where errors could be handled better',
        difficulty: 'medium', estimatedTime: '1-2 hours', learningObjective: 'Learn error handling patterns and how to write user-friendly error messages',
        acceptanceCriteria: ['Errors provide useful messages'], hints: ['Look for generic catch blocks'], relatedFiles: [], skills: ['error-handling'],
      },
      {
        id: 8, title: 'Add TypeScript types or JSDoc', description: 'Improve type safety in a module',
        difficulty: 'medium', estimatedTime: '1-2 hours', learningObjective: 'Learn how static typing improves code quality and catches bugs early',
        acceptanceCriteria: ['Types are accurate', 'No type errors'], hints: ['Start with any types or missing annotations'], relatedFiles: [], skills: ['typescript'],
      },
      {
        id: 9, title: 'Refactor a complex function', description: 'Break down a long function into smaller pieces',
        difficulty: 'hard', estimatedTime: '2-4 hours', learningObjective: 'Learn refactoring techniques: extract method, single responsibility, and clean code principles',
        acceptanceCriteria: ['Function is easier to understand', 'Tests still pass'], hints: ['Look for functions over 50 lines'], relatedFiles: [], skills: ['refactoring'],
      },
      {
        id: 10, title: 'Add a small feature', description: 'Implement a minor enhancement from the issue tracker',
        difficulty: 'hard', estimatedTime: '2-4 hours', learningObjective: 'Learn end-to-end feature development: spec reading, implementation, testing, and documentation',
        acceptanceCriteria: ['Feature works as specified', 'Tests added'], hints: ['Check issues labeled good-first-issue'], relatedFiles: [], skills: ['feature-development'],
      },
    ];
  }

  /**
   * Generate fallback Mermaid diagram
   */
  private generateFallbackDiagram(): string {
    if (!this.repoMetadata) {
      return 'graph TD\n    A[Project] --> B[Source]\n    A --> C[Tests]\n    A --> D[Config]';
    }

    const topDirs = this.repoMetadata.structure.children
      ?.filter(c => c.type === 'directory')
      .slice(0, 8)
      .map(c => c.name) || [];

    let diagram = 'graph TD\n';
    diagram += `    Root[${this.repoMetadata.name}]\n`;
    
    for (const dir of topDirs) {
      const id = dir.replace(/[^a-zA-Z0-9]/g, '_');
      diagram += `    Root --> ${id}[${dir}/]\n`;
    }

    // Add some relationships
    if (topDirs.includes('src') && topDirs.includes('dist')) {
      diagram += '    src --> |build| dist\n';
    }
    if (topDirs.includes('src') && topDirs.includes('tests')) {
      diagram += '    tests --> |test| src\n';
    }

    return diagram;
  }

  /**
   * Clean up Mermaid diagram output
   */
  private cleanMermaidDiagram(diagram: string): string {
    // Remove markdown code fences if present
    let cleaned = diagram.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '');
    
    // Split into lines and keep only valid Mermaid syntax lines
    const lines = cleaned.split('\n');
    const mermaidLines: string[] = [];
    let foundStart = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines but keep them for formatting
      if (!trimmed) {
        if (foundStart) mermaidLines.push('');
        continue;
      }
      
      // Detect diagram start
      if (trimmed.startsWith('graph ') || trimmed.startsWith('flowchart ')) {
        foundStart = true;
        mermaidLines.push(trimmed);
        continue;
      }
      
      if (!foundStart) continue;
      
      // Keep only lines that look like valid Mermaid syntax
      const isMermaidLine = 
        trimmed.startsWith('subgraph ') ||
        trimmed === 'end' ||
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\s*-->/) ||   // Node --> 
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\s*---/) ||   // Node ---
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\s*-.->/) ||  // Node -.->
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\s*==>/) ||   // Node ==>
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\[/) ||       // NodeId[Label]
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\(/) ||       // NodeId(Label)
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*\{/) ||       // NodeId{Label}
        trimmed.match(/^[A-Za-z_][A-Za-z0-9_]*>/) ||        // NodeId>Label]
        trimmed.startsWith('classDef ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('style ') ||
        trimmed.startsWith('linkStyle ') ||
        trimmed.startsWith('click ') ||
        trimmed.startsWith('direction ');
      
      if (isMermaidLine) {
        mermaidLines.push(line); // Preserve original indentation
      }
    }
    
    cleaned = mermaidLines.join('\n').trim();
    
    // Ensure it starts with graph or flowchart
    if (!cleaned.startsWith('graph') && !cleaned.startsWith('flowchart')) {
      cleaned = 'graph TD\n' + cleaned;
    }

    return cleaned;
  }

  /**
   * Write all output files
   */
  private async writeOutputFiles(pack: OnboardingPack): Promise<void> {
    await mkdir(this.config.outputDir, { recursive: true });

    // Write ONBOARDING.md
    const onboardingContent = this.renderOnboarding(pack);
    await writeFile(join(this.config.outputDir, 'ONBOARDING.md'), onboardingContent, 'utf-8');
    this.log('  Written: ONBOARDING.md');

    // Write RUNBOOK.md
    const runbookContent = this.renderRunbook(pack);
    await writeFile(join(this.config.outputDir, 'RUNBOOK.md'), runbookContent, 'utf-8');
    this.log('  Written: RUNBOOK.md');

    // Write TASKS.md
    const tasksContent = this.renderTasks(pack);
    await writeFile(join(this.config.outputDir, 'TASKS.md'), tasksContent, 'utf-8');
    this.log('  Written: TASKS.md');

    // Write AGENTS.md
    const agentsContent = this.renderAgents(pack);
    await writeFile(join(this.config.outputDir, 'AGENTS.md'), agentsContent, 'utf-8');
    this.log('  Written: AGENTS.md');

    // Write diagram.mmd
    await writeFile(join(this.config.outputDir, 'diagram.mmd'), pack.diagram, 'utf-8');
    this.log('  Written: diagram.mmd');

    // Write VALIDATION.md if Microsoft technologies were detected
    if (pack.microsoftTechValidation && pack.microsoftTechValidation.length > 0) {
      const validationContent = this.renderValidation(pack);
      await writeFile(join(this.config.outputDir, 'VALIDATION.md'), validationContent, 'utf-8');
      this.log('  Written: VALIDATION.md');
    }
  }

  /**
   * Render ONBOARDING.md content
   */
  private renderOnboarding(pack: OnboardingPack): string {
    const { onboarding } = pack;
    let content = `# ${onboarding.projectName} - Onboarding Guide\n\n`;
    content += `## Overview\n\n${onboarding.overview}\n\n`;
    content += `## Getting Started\n\n${onboarding.gettingStarted}\n\n`;
    content += `## Architecture\n\n${onboarding.architecture}\n\n`;
    
    if (onboarding.keyFlows.length > 0) {
      content += `## Key Flows\n\n`;
      for (const flow of onboarding.keyFlows) {
        content += `### ${flow.name}\n\n${flow.description}\n\n`;
        content += `**Steps:**\n${flow.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
        if (flow.involvedFiles.length > 0) {
          content += `**Files:** ${flow.involvedFiles.map(f => `\`${f}\``).join(', ')}\n\n`;
        }
      }
    }

    content += `## Component Diagram\n\n\`\`\`mermaid\n${pack.diagram}\n\`\`\`\n\n`;

    // For Instructors section
    content += `## For Instructors\n\n`;
    content += `This section summarises the project for instructors, supervisors, and mentors overseeing student onboarding.\n\n`;
    content += `### Project Complexity\n\n`;
    const langCount = onboarding.dependencyMap.external.length;
    const flowCount = onboarding.keyFlows.length;
    const complexity = langCount > 20 ? 'High' : langCount > 8 ? 'Medium' : 'Low';
    content += `- **Dependency count:** ${langCount}\n`;
    content += `- **Key flows:** ${flowCount}\n`;
    content += `- **Estimated complexity:** ${complexity}\n\n`;
    content += `### Learning Outcomes\n\n`;
    content += `Students working through the onboarding tasks will learn to:\n\n`;
    content += `1. Navigate and understand an unfamiliar codebase\n`;
    content += `2. Set up and run a real-world development environment\n`;
    content += `3. Read and write automated tests\n`;
    content += `4. Contribute code through the pull request workflow\n`;
    content += `5. Use GitHub Copilot as a learning and productivity tool\n\n`;
    content += `### Suggested Session Plan\n\n`;
    content += `| Session | Focus | Tasks |\n`;
    content += `|---------|-------|-------|\n`;
    content += `| 1 | Orientation & setup | Tasks 1-3 (easy) |\n`;
    content += `| 2 | First contribution | Tasks 4-5 (easy-medium) |\n`;
    content += `| 3 | Deeper work | Tasks 6-8 (medium) |\n`;
    content += `| 4 | Independent feature | Tasks 9-10 (hard) |\n\n`;

    if (onboarding.dependencyMap.external.length > 0) {
      content += `## Key Dependencies\n\n`;
      content += `| Package | Purpose | Version |\n|---------|---------|--------|\n`;
      for (const dep of onboarding.dependencyMap.external.slice(0, 15)) {
        content += `| ${dep.name} | ${dep.purpose} | ${dep.version || '-'} |\n`;
      }
      content += '\n';
    }

    // Microsoft Learn validation references
    if (pack.microsoftTechValidation && pack.microsoftTechValidation.length > 0) {
      content += `## Microsoft Technology References\n\n`;
      content += `The following Microsoft technologies were detected in this repository. `;
      content += `Use the [Microsoft Learn MCP Server](https://learn.microsoft.com/api/mcp) to verify details and find up-to-date documentation.\n\n`;

      content += `| Technology | Category | Confidence | Evidence |\n`;
      content += `|------------|----------|------------|----------|\n`;
      for (const tech of pack.microsoftTechValidation) {
        content += `| ${tech.name} | ${tech.category} | ${tech.confidence} | ${tech.evidence} |\n`;
      }
      content += '\n';

      content += `### Validation Queries\n\n`;
      content += `Run these queries with the Microsoft Learn MCP tools to verify and deepen understanding:\n\n`;
      for (const tech of pack.microsoftTechValidation) {
        content += `#### ${tech.name}\n\n`;
        for (const q of tech.learnQueries) {
          if (q.tool === 'microsoft_code_sample_search') {
            content += `- \`${q.tool}(query="${q.query}", language="${q.language || 'csharp'}")\` — ${q.purpose}\n`;
          } else {
            content += `- \`${q.tool}(query="${q.query}")\` — ${q.purpose}\n`;
          }
        }
        content += '\n';
      }
    }

    return content;
  }

  /**
   * Render RUNBOOK.md content
   */
  private renderRunbook(pack: OnboardingPack): string {
    const { runbook } = pack;
    let content = `# Runbook\n\nOperational guide for building, running, and troubleshooting this project.\n\n`;

    content += `## Prerequisites\n\n`;
    for (const prereq of runbook.prerequisites) {
      content += `### ${prereq.name}\n\n${prereq.description}\n\n`;
      if (prereq.installCommand) content += `**Install:** \`${prereq.installCommand}\`\n\n`;
      if (prereq.verifyCommand) content += `**Verify:** \`${prereq.verifyCommand}\`\n\n`;
    }

    content += `## Setup\n\n`;
    for (const step of runbook.setup) {
      content += `### ${step.order}. ${step.title}\n\n${step.description}\n\n`;
      if (step.commands?.length) {
        content += `\`\`\`bash\n${step.commands.join('\n')}\n\`\`\`\n\n`;
      }
    }

    const renderCommand = (cmd: { title: string; description: string; commands: string[]; notes?: string }) => {
      let text = `## ${cmd.title}\n\n${cmd.description}\n\n`;
      text += `\`\`\`bash\n${cmd.commands.join('\n')}\n\`\`\`\n\n`;
      if (cmd.notes) text += `> ${cmd.notes}\n\n`;
      return text;
    };

    content += renderCommand(runbook.build);
    content += renderCommand(runbook.run);
    content += renderCommand(runbook.test);

    if (runbook.troubleshooting.length > 0) {
      content += `## Troubleshooting\n\n`;
      for (const item of runbook.troubleshooting) {
        content += `### Problem: ${item.problem}\n\n**Solution:** ${item.solution}\n\n`;
        if (item.commands?.length) {
          content += `\`\`\`bash\n${item.commands.join('\n')}\n\`\`\`\n\n`;
        }
      }
    }

    if (runbook.commonCommands.length > 0) {
      content += `## Common Commands\n\n`;
      content += `| Command | Description |\n|---------|-------------|\n`;
      for (const cmd of runbook.commonCommands) {
        content += `| \`${cmd.commands[0]}\` | ${cmd.title} |\n`;
      }
      content += '\n';
    }

    // Microsoft Learn troubleshooting references
    if (pack.microsoftTechValidation && pack.microsoftTechValidation.length > 0) {
      content += `## Microsoft Learn Resources\n\n`;
      content += `For troubleshooting and deeper understanding of the Microsoft technologies used in this project:\n\n`;
      for (const tech of pack.microsoftTechValidation) {
        const troubleshootQuery = tech.learnQueries.find(q => q.purpose.toLowerCase().includes('troubleshoot'));
        const setupQuery = tech.learnQueries[0];
        content += `- **${tech.name}**: \`microsoft_docs_search(query="${tech.name} troubleshooting")\`\n`;
        if (setupQuery) {
          content += `  - Setup: \`${setupQuery.tool}(query="${setupQuery.query}")\`\n`;
        }
      }
      content += '\n';
    }

    return content;
  }

  /**
   * Render TASKS.md content
   */
  private renderTasks(pack: OnboardingPack): string {
    let content = `# Starter Tasks\n\nGood first issues for new contributors, ordered by difficulty.\n\n`;
    content += `## Legend\n\n🟢 Easy (< 1 hour) | 🟡 Medium (1-2 hours) | 🔴 Hard (2+ hours)\n\n`;

    const difficultyEmoji = { easy: '🟢', medium: '🟡', hard: '🔴' };

    for (const task of pack.tasks.tasks) {
      const emoji = difficultyEmoji[task.difficulty];
      content += `## ${emoji} Task ${task.id}: ${task.title}\n\n`;
      content += `**Difficulty:** ${task.difficulty} | **Time:** ${task.estimatedTime}\n\n`;
      content += `${task.description}\n\n`;

      if (task.learningObjective) {
        content += `### 🎯 Learning Objective\n\n${task.learningObjective}\n\n`;
      }

      content += `### Acceptance Criteria\n\n`;
      for (const ac of task.acceptanceCriteria) {
        content += `- [ ] ${ac}\n`;
      }
      content += '\n';

      if (task.hints.length > 0) {
        content += `### Hints\n\n`;
        for (const hint of task.hints) {
          content += `- ${hint}\n`;
        }
        content += '\n';
      }

      if (task.relatedFiles.length > 0) {
        content += `### Related Files\n\n`;
        for (const file of task.relatedFiles) {
          content += `- \`${file}\`\n`;
        }
        content += '\n';
      }

      content += '---\n\n';
    }

    return content;
  }

  /**
   * Render AGENTS.md — Agent skills, MCP servers, and workflows
   */
  private renderAgents(pack: OnboardingPack): string {
    const { agents } = pack;
    let content = `# ${agents.projectName} — Agent Configuration\n\n`;
    content += `${agents.description}\n\n`;

    if (agents.skills.length > 0) {
      content += `## Skills\n\n`;
      content += `| Skill | Description | Triggers |\n`;
      content += `|-------|-------------|----------|\n`;
      for (const skill of agents.skills) {
        content += `| ${skill.name} | ${skill.description} | ${skill.triggers.join(', ')} |\n`;
      }
      content += '\n';
    }

    if (agents.mcpServers.length > 0) {
      content += `## MCP Servers\n\n`;
      for (const server of agents.mcpServers) {
        content += `### ${server.name}\n\n`;
        content += `**URL:** \`${server.url}\`\n\n`;
        content += `**Tools:** ${server.tools.map(t => '`' + t + '`').join(', ')}\n\n`;
      }
    }

    if (agents.workflows.length > 0) {
      content += `## Workflows\n\n`;
      for (const wf of agents.workflows) {
        content += `### ${wf.name}\n\n`;
        content += `${wf.description}\n\n`;
        content += wf.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n';
      }
    }

    content += `## How to Use with GitHub Copilot\n\n`;
    content += `This repository is configured for GitHub Copilot Agent Mode. Use these example prompts in VS Code:\n\n`;
    content += `| Goal | Example Prompt |\n`;
    content += `|------|---------------|\n`;
    content += `| Understand the project | "Explain the architecture of this project" |\n`;
    content += `| Start a task | "Help me work on Task 1 from TASKS.md" |\n`;
    content += `| Review code | "Review the changes in my current branch" |\n`;
    content += `| Find documentation | "What does the ${agents.projectName} API do?" |\n`;
    content += `| Debug an issue | "Why is this test failing?" |\n`;
    content += `| Learn a concept | "Explain how error handling works in this codebase" |\n`;
    content += '\n';
    content += `> **Tip:** Open the onboarding docs (ONBOARDING.md, RUNBOOK.md, TASKS.md) as context when chatting with Copilot for better answers.\n\n`;

    return content;
  }

  /**
   * Render VALIDATION.md — Microsoft Learn validation report
   */
  private renderValidation(pack: OnboardingPack): string {
    const techs = pack.microsoftTechValidation || [];
    let content = `# Microsoft Technology Validation Report\n\n`;
    content += `This report lists Microsoft technologies detected in the repository and provides `;
    content += `verification queries for the [Microsoft Learn MCP Server](https://learn.microsoft.com/api/mcp).\n\n`;
    content += `## Setup\n\n`;
    content += `To validate these technologies, ensure you have the Microsoft Learn MCP Server configured:\n\n`;
    content += `\`\`\`json\n`;
    content += `{\n  "mcpServers": {\n    "microsoft-learn": {\n      "type": "http",\n      "url": "https://learn.microsoft.com/api/mcp"\n    }\n  }\n}\n`;
    content += `\`\`\`\n\n`;

    content += `## Detected Technologies (${techs.length})\n\n`;
    content += `| # | Technology | Category | Confidence | Evidence |\n`;
    content += `|---|------------|----------|------------|----------|\n`;
    techs.forEach((tech, i) => {
      content += `| ${i + 1} | ${tech.name} | ${tech.category} | ${tech.confidence} | ${tech.evidence} |\n`;
    });
    content += '\n';

    content += `## Validation Queries\n\n`;
    content += `Run these queries to verify technical details against official Microsoft documentation.\n\n`;

    for (const tech of techs) {
      content += `### ${tech.name}\n\n`;
      content += `**Category:** ${tech.category} | **Detected via:** ${tech.evidence}\n\n`;

      content += `| Step | Tool | Query | Purpose |\n`;
      content += `|------|------|-------|--------|\n`;
      tech.learnQueries.forEach((q, i) => {
        const queryStr = q.tool === 'microsoft_code_sample_search'
          ? `${q.tool}(query="${q.query}", language="${q.language || 'csharp'}")`
          : `${q.tool}(query="${q.query}")`;
        content += `| ${i + 1} | ${q.tool} | \`${queryStr}\` | ${q.purpose} |\n`;
      });
      content += '\n';
    }

    content += `## Verification Checklist\n\n`;
    content += `After running the validation queries, confirm:\n\n`;
    content += `- [ ] All technology names match official Microsoft documentation\n`;
    content += `- [ ] SDK versions referenced are current (not deprecated)\n`;
    content += `- [ ] API patterns align with latest best practices\n`;
    content += `- [ ] Prerequisites in RUNBOOK.md include correct install/verify commands\n`;
    content += `- [ ] Configuration examples are accurate\n`;
    content += `- [ ] Security recommendations are up to date\n\n`;

    content += `## Additional Skills\n\n`;
    content += `Use these companion skills for deeper verification:\n\n`;
    content += `- **[microsoft-docs](../.github/skills/microsoft-docs/SKILL.md)** — Search concepts, tutorials, configuration guides\n`;
    content += `- **[microsoft-code-reference](../.github/skills/microsoft-code-reference/SKILL.md)** — API lookups, code samples, error troubleshooting\n`;
    content += `- **[microsoft-skill-creator](../.github/skills/microsoft-skill-creator/SKILL.md)** — Create new skills for detected technologies\n`;

    return content;
  }

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }
}
