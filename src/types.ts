/**
 * Shared TypeScript types for the Repo Onboarding Pack generator
 */

export interface RepoMetadata {
  name: string;
  path: string;
  languages: LanguageInfo[];
  buildFiles: BuildFile[];
  configFiles: ConfigFile[];
  structure: DirectoryNode;
  dependencies: DependencyInfo[];
  entryPoints: string[];
  testFrameworks: string[];
  gitInfo?: GitInfo;
}

export interface LanguageInfo {
  name: string;
  percentage: number;
  fileCount: number;
  extensions: string[];
}

export interface BuildFile {
  type: 'npm' | 'yarn' | 'pnpm' | 'dotnet' | 'maven' | 'gradle' | 'make' | 'cargo' | 'go' | 'pip' | 'other';
  path: string;
  scripts?: Record<string, string>;
}

export interface ConfigFile {
  type: 'env' | 'docker' | 'ci' | 'editor' | 'linter' | 'other';
  path: string;
  description?: string;
}

export interface DirectoryNode {
  name: string;
  type: 'file' | 'directory';
  children?: DirectoryNode[];
  size?: number;
  extension?: string;
}

export interface DependencyInfo {
  name: string;
  version?: string;
  type: 'production' | 'development' | 'peer';
  ecosystem: string;
}

export interface GitInfo {
  remoteUrl?: string;
  defaultBranch?: string;
  hasGitHubActions: boolean;
  contributorsCount?: number;
}

export interface OnboardingPack {
  onboarding: OnboardingDoc;
  runbook: RunbookDoc;
  tasks: TasksDoc;
  agents: AgentsDoc;
  diagram: string; // Mermaid diagram content
  microsoftTechValidation?: MicrosoftTechDetection[];
}

export interface OnboardingDoc {
  projectName: string;
  overview: string;
  architecture: string;
  keyFlows: KeyFlow[];
  dependencyMap: DependencyMap;
  gettingStarted: string;
}

export interface KeyFlow {
  name: string;
  description: string;
  steps: string[];
  involvedFiles: string[];
}

export interface DependencyMap {
  internal: InternalDependency[];
  external: ExternalDependency[];
}

export interface InternalDependency {
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'extends';
}

export interface ExternalDependency {
  name: string;
  purpose: string;
  version?: string;
}

export interface RunbookDoc {
  prerequisites: Prerequisite[];
  setup: SetupStep[];
  build: CommandBlock;
  run: CommandBlock;
  test: CommandBlock;
  deploy?: CommandBlock;
  troubleshooting: TroubleshootingItem[];
  commonCommands: CommandBlock[];
}

export interface Prerequisite {
  name: string;
  description: string;
  installCommand?: string;
  verifyCommand?: string;
}

export interface SetupStep {
  order: number;
  title: string;
  description: string;
  commands?: string[];
}

export interface CommandBlock {
  title: string;
  description: string;
  commands: string[];
  notes?: string;
}

export interface TroubleshootingItem {
  problem: string;
  solution: string;
  commands?: string[];
}

export interface TasksDoc {
  tasks: StarterTask[];
}

export interface AgentsDoc {
  projectName: string;
  description: string;
  skills: AgentSkill[];
  mcpServers: AgentMcpServer[];
  workflows: AgentWorkflow[];
}

export interface AgentSkill {
  name: string;
  description: string;
  triggers: string[];
}

export interface AgentMcpServer {
  name: string;
  url: string;
  tools: string[];
}

export interface AgentWorkflow {
  name: string;
  description: string;
  steps: string[];
}

export interface StarterTask {
  id: number;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
  learningObjective?: string;
  acceptanceCriteria: string[];
  hints: string[];
  relatedFiles: string[];
  skills: string[];
}

export interface FoundryLocalStatus {
  available: boolean;
  endpoint: string;
  models: string[];
  activeModel?: string;
  cachedModels?: CachedModel[];
}

export interface CachedModel {
  alias: string;
  modelId: string;
  device: string;
  task: string;
  fileSize: string;
}

export interface LocalModelRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LocalModelResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface OrchestratorTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export interface ProgressInfo {
  stepNumber: number;
  totalSteps: number;
  stepId: string;
  stepName: string;
  stepStatus: 'running' | 'completed' | 'failed';
  detail?: string;
  progress: number; // 0-100
}

export type ProgressCallback = (info: ProgressInfo) => void;

export interface GenerationConfig {
  repoPath: string;
  outputDir: string;
  foundryEndpoint?: string;
  foundryModel?: string;
  verbose?: boolean;
  skipLocalModel?: boolean;
  // Microsoft Foundry cloud options
  cloudEndpoint?: string;
  cloudApiKey?: string;
  cloudModel?: string;
  // GitHub Copilot SDK options
  useCopilotSdk?: boolean;
  copilotModel?: string;
  // Progress reporting
  onProgress?: ProgressCallback;
}

export interface MicrosoftTechDetection {
  name: string;
  category: 'azure-service' | 'dotnet' | 'typescript' | 'ai-ml' | 'devops' | 'vscode' | 'graph' | 'other';
  confidence: 'high' | 'medium';
  evidence: string;
  learnQueries: LearnMcpQuery[];
}

export interface LearnMcpQuery {
  tool: 'microsoft_docs_search' | 'microsoft_docs_fetch' | 'microsoft_code_sample_search';
  query: string;
  language?: string;
  url?: string;
  purpose: string;
}
