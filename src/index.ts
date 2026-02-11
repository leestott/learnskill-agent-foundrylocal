#!/usr/bin/env node
import 'dotenv/config';
/**
 * Repo Onboarding Pack Generator CLI
 * 
 * Usage: onboard --repo <path|url>
 * 
 * Generates an engineering onboarding pack using:
 * - Foundry Local for privacy-sensitive local inference
 * - GitHub Copilot SDK (@github/copilot-sdk) for agentic workflows
 * - MCP-compatible orchestration for multi-step workflows
 * - Microsoft Learn MCP Server for technology validation
 */

import { program } from 'commander';
import { resolve, join } from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { Orchestrator } from './orchestrator.js';
import { getLocalModelClient } from './localModelClient.js';
import { validateGitHubUrl } from './validation.js';
import type { GenerationConfig } from './types.js';

const VERSION = '1.0.0';

program
  .name('onboard')
  .description('Generate an engineering onboarding pack for a repository')
  .version(VERSION)
  .argument('[repo]', 'Path to local repository or GitHub URL (https://github.com/owner/repo)')
  .option('-o, --output <dir>', 'Output directory for generated docs (default: ./docs in repo)')
  .option('-e, --endpoint <url>', 'Foundry Local endpoint (auto-detected from foundry service)')
  .option('-m, --model <name>', 'Foundry Local model (default: phi-4)')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('--skip-local', 'Skip local model calls (use fallback generation)', false)
  .option('--check-status', 'Only check Foundry Local status and exit', false)
  .option('--cloud-endpoint <url>', 'Microsoft Foundry cloud endpoint URL')
  .option('--cloud-api-key <key>', 'API key for cloud endpoint (or set FOUNDRY_CLOUD_API_KEY)')
  .option('--cloud-model <name>', 'Cloud model deployment name (default: gpt-4o-mini)')
  .option('--copilot-sdk', 'Use GitHub Copilot SDK for inference (requires Copilot CLI)', false)
  .option('--copilot-model <name>', 'Copilot SDK model (default: claude-sonnet-4)')
  .action(async (repo: string | undefined, options) => {
    try {
      // Check status doesn't require repo
      if (options.checkStatus) {
        await checkFoundryStatus(options.endpoint, options.model);
        return;
      }
      
      if (!repo) {
        console.error('Error: repo argument is required unless using --check-status');
        process.exit(1);
      }
      
      await run(repo, options);
    } catch (error) {
      console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();

async function run(repo: string, options: {
  output?: string;
  endpoint?: string;
  model?: string;
  verbose?: boolean;
  skipLocal?: boolean;
  cloudEndpoint?: string;
  cloudApiKey?: string;
  cloudModel?: string;
  copilotSdk?: boolean;
  copilotModel?: string;
}): Promise<void> {
  const verbose = options.verbose || false;

  console.log('🚀 Repo Onboarding Pack Generator v' + VERSION);
  console.log('');

  // Resolve repository path
  let repoPath: string;
  let isCloned = false;

  if (isGitHubUrl(repo)) {
    console.log(`📥 Cloning repository: ${repo}`);
    repoPath = await cloneRepository(repo);
    isCloned = true;
    console.log(`   Cloned to: ${repoPath}`);
  } else {
    repoPath = resolve(repo);
    if (!existsSync(repoPath)) {
      throw new Error(`Repository path does not exist: ${repoPath}`);
    }
  }

  // Determine output directory
  const outputDir = options.output 
    ? resolve(options.output)
    : join(repoPath, 'docs');

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  if (verbose) {
    console.log(`📁 Repository: ${repoPath}`);
    console.log(`📂 Output: ${outputDir}`);
    console.log('');
  }

  // Create configuration — only use cloud when explicitly requested via --cloud-endpoint
  const useCloud = !!options.cloudEndpoint;
  const cloudApiKey = useCloud ? (options.cloudApiKey || process.env.FOUNDRY_CLOUD_API_KEY) : undefined;
  const cloudEndpoint = useCloud ? options.cloudEndpoint : undefined;
  const cloudModel = useCloud ? (options.cloudModel || process.env.FOUNDRY_CLOUD_MODEL) : undefined;
  const config: GenerationConfig = {
    repoPath,
    outputDir,
    foundryEndpoint: options.endpoint,
    foundryModel: options.model,
    verbose,
    skipLocalModel: options.skipLocal,
    cloudEndpoint,
    cloudApiKey: cloudApiKey,
    cloudModel,
    useCopilotSdk: options.copilotSdk,
    copilotModel: options.copilotModel,
  };

  // Run orchestrator
  const orchestrator = new Orchestrator(config);
  await orchestrator.run();

  // Summary
  console.log('');
  console.log('📦 Generated files:');
  console.log(`   • ${join(outputDir, 'ONBOARDING.md')} - Architecture overview`);
  console.log(`   • ${join(outputDir, 'RUNBOOK.md')} - How to build/run/test`);
  console.log(`   • ${join(outputDir, 'TASKS.md')} - Starter tasks`);
  console.log(`   • ${join(outputDir, 'AGENTS.md')} - Agent configuration`);
  console.log(`   • ${join(outputDir, 'diagram.mmd')} - Component diagram`);
  console.log('');

  if (isCloned) {
    console.log(`💡 Cloned repo available at: ${repoPath}`);
  }

  console.log('🎉 Done! Share these docs with new engineers.');
}

/**
 * Check if the input is a GitHub URL
 */
function isGitHubUrl(input: string): boolean {
  return input.startsWith('https://github.com/') || 
         input.startsWith('git@github.com:') ||
         input.startsWith('http://github.com/');
}

/**
 * Clone a GitHub repository to a temporary directory
 * Uses validated/sanitized URL to prevent command injection
 */
async function cloneRepository(url: string): Promise<string> {
  const { owner, repo, sanitizedUrl } = validateGitHubUrl(url);
  
  const repoName = `${owner}-${repo}`;
  const tempDir = join(tmpdir(), 'onboard-repos', repoName);

  // Clean up if exists
  if (existsSync(tempDir)) {
    console.log('   Using cached clone...');
    // Pull latest using spawnSync with explicit arguments (safer than execSync with string)
    const { spawnSync } = await import('child_process');
    try {
      spawnSync('git', ['pull', '--quiet'], { cwd: tempDir, stdio: 'pipe' });
    } catch {
      // Ignore pull errors
    }
    return tempDir;
  }

  // Clone using validated URL
  await mkdir(join(tmpdir(), 'onboard-repos'), { recursive: true });
  
  // Use array arguments to prevent command injection
  const { spawnSync } = await import('child_process');
  const result = spawnSync('git', ['clone', '--depth', '1', '--quiet', sanitizedUrl, tempDir], {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  
  if (result.status !== 0) {
    throw new Error(`Failed to clone repository: ${result.stderr || 'Unknown error'}`);
  }

  return tempDir;
}

/**
 * Check Foundry Local status
 */
async function checkFoundryStatus(endpoint?: string, model?: string): Promise<void> {
  console.log('🔍 Checking Foundry Local status...\n');
  
  const client = getLocalModelClient(endpoint, model);
  const status = await client.checkStatus();

  if (status.available) {
    console.log('✅ Foundry Local is running');
    console.log(`   Endpoint: ${status.endpoint}`);
    console.log(`   Models: ${status.models.join(', ') || 'Unknown'}`);
    console.log(`   Active: ${status.activeModel || 'Default'}`);
  } else {
    console.log('❌ Foundry Local is not available');
    console.log(`   Tried: ${status.endpoint}`);
    console.log('');
    console.log('To start Foundry Local:');
    console.log('  1. Install: winget install Microsoft.FoundryLocal');
    console.log('  2. Run: foundry-local serve');
    console.log('');
    console.log('Or use --skip-local to generate without local inference.');
  }
}
