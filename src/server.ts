import 'dotenv/config';
/**
 * Web UI Server for Repo Onboarding Pack Generator
 * 
 * Provides a browser-based interface for generating onboarding documentation.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { join } from 'path';
import { readFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { Orchestrator } from './orchestrator.js';
import { getLocalModelClient, LocalModelClient } from './localModelClient.js';
import { validateDirectory, validateGitHubUrl, validateEndpoint, validateModelName, validateCloudEndpoint, validateApiKey } from './validation.js';
import type { GenerationConfig } from './types.js';

const DEFAULT_PORT = 3000;
const MAX_PORT_ATTEMPTS = 10;

interface GenerationRequest {
  repoPath: string;
  outputDir?: string;
  endpoint?: string;
  model?: string;
  skipLocal?: boolean;
  cloudEndpoint?: string;
  cloudApiKey?: string;
  cloudModel?: string;
  useCloud?: boolean;
}

interface StepDetail {
  stepNumber: number;
  totalSteps: number;
  stepId: string;
  stepName: string;
  stepStatus: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
}

interface GenerationProgress {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  step: string;
  progress: number;
  error?: string;
  outputDir?: string;
  steps: StepDetail[];
  currentStepNumber: number;
  totalSteps: number;
}

// Store for tracking generation jobs
const jobs = new Map<string, GenerationProgress>();

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const testServer = createServer();
    testServer.once('error', () => resolve(false));
    testServer.once('listening', () => {
      testServer.close(() => resolve(true));
    });
    testServer.listen(port);
  });
}

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
    console.log(`⚠️  Port ${port} is in use, trying ${port + 1}...`);
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + MAX_PORT_ATTEMPTS - 1}`);
}

/**
 * Start the web UI server
 */
export async function startServer(port = DEFAULT_PORT): Promise<void> {
  const availablePort = await findAvailablePort(port);
  
  const server = createServer(async (req, res) => {
    try {
      await handleRequest(req, res);
    } catch (error) {
      console.error('Request error:', error);
      sendJson(res, 500, { error: 'Internal server error' });
    }
  });

  server.listen(availablePort, () => {
    console.log(`\n🌐 Web UI running at http://localhost:${availablePort}`);
    if (availablePort !== port) {
      console.log(`   (Port ${port} was in use, using ${availablePort} instead)`);
    }
    console.log('   Open this URL in your browser to use the graphical interface.\n');
  });
}

/**
 * Handle incoming HTTP requests
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Use WHATWG URL API instead of deprecated url.parse()
  const baseUrl = `http://${req.headers.host || 'localhost'}`;
  const url = new URL(req.url || '/', baseUrl);
  const method = req.method || 'GET';

  // Set CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route handling
  switch (url.pathname) {
    case '/':
      await serveHtml(res);
      break;
    case '/api/status':
      await handleStatusCheck(res);
      break;
    case '/api/cloud-config':
      handleCloudConfig(res);
      break;
    case '/api/cloud-status':
      await handleCloudStatusCheck(res);
      break;
    case '/api/load-model':
      if (method === 'POST') {
        await handleLoadModel(req, res);
      } else {
        sendJson(res, 405, { error: 'Method not allowed' });
      }
      break;
    case '/api/test-model':
      if (method === 'POST') {
        await handleTestModel(req, res);
      } else {
        sendJson(res, 405, { error: 'Method not allowed' });
      }
      break;
    case '/api/generate':
      if (method === 'POST') {
        await handleGenerate(req, res);
      } else {
        sendJson(res, 405, { error: 'Method not allowed' });
      }
      break;
    case '/api/job':
      const jobId = url.searchParams.get('id');
      handleJobStatus(res, jobId);
      break;
    case '/api/files':
      const dir = url.searchParams.get('dir');
      await handleListFiles(res, dir);
      break;
    case '/api/file':
      const filePath = url.searchParams.get('path');
      await handleReadFile(res, filePath);
      break;
    default:
      sendJson(res, 404, { error: 'Not found' });
  }
}

/**
 * Serve the main HTML page
 */
async function serveHtml(res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.writeHead(200);
  res.end(getHtmlPage());
}

/**
 * Handle Foundry Local status check
 */
async function handleStatusCheck(res: ServerResponse): Promise<void> {
  try {
    const client = getLocalModelClient();
    const status = await client.checkStatus();
    // Add loaded models info (models currently running in Foundry Local)
    const loadedModels = status.models || [];
    sendJson(res, 200, { ...status, loadedModels });
  } catch (error) {
    sendJson(res, 200, { available: false, error: String(error) });
  }
}

/**
 * Return cloud configuration status from environment variables
 */
function handleCloudConfig(res: ServerResponse): void {
  const endpoint = process.env.FOUNDRY_CLOUD_ENDPOINT || '';
  const model = process.env.FOUNDRY_CLOUD_MODEL || '';
  const apiKeySet = !!(process.env.FOUNDRY_CLOUD_API_KEY);
  sendJson(res, 200, {
    endpointConfigured: !!endpoint,
    endpoint: endpoint ? endpoint.replace(/^(https?:\/\/[^/]+).*/, '$1/...') : '',
    apiKeyConfigured: apiKeySet,
    modelConfigured: !!model,
    model,
  });
}

/**
 * Handle Foundry Cloud status check — tests live connectivity to the cloud endpoint
 */
async function handleCloudStatusCheck(res: ServerResponse): Promise<void> {
  const endpoint = process.env.FOUNDRY_CLOUD_ENDPOINT || '';
  const apiKey = process.env.FOUNDRY_CLOUD_API_KEY || '';
  const model = process.env.FOUNDRY_CLOUD_MODEL || 'gpt-4o-mini';

  if (!endpoint || !apiKey) {
    sendJson(res, 200, { available: false, error: 'Cloud endpoint or API key not configured', endpoint: '', models: [] });
    return;
  }

  try {
    const client = new LocalModelClient(undefined, model, { endpoint, apiKey });
    const status = await client.checkStatus();
    sendJson(res, 200, status);
  } catch (error) {
    sendJson(res, 200, { available: false, endpoint, error: String(error), models: [] });
  }
}

// Track model loading jobs
const modelLoadJobs = new Map<string, { status: 'loading' | 'completed' | 'failed'; error?: string }>();

/**
 * Handle model loading/downloading request
 */
async function handleLoadModel(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  
  let request: { model: string };
  try {
    request = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (!request.model) {
    sendJson(res, 400, { error: 'model is required' });
    return;
  }

  const modelName = request.model;
  
  // Check if already loading
  const existingJob = modelLoadJobs.get(modelName);
  if (existingJob?.status === 'loading') {
    sendJson(res, 200, { status: 'loading', message: 'Model is already being loaded' });
    return;
  }

  // Start loading in background
  modelLoadJobs.set(modelName, { status: 'loading' });
  
  // Run foundry model run in background
  loadModelAsync(modelName).catch(error => {
    modelLoadJobs.set(modelName, { status: 'failed', error: String(error) });
  });

  sendJson(res, 202, { 
    status: 'loading', 
    message: `Loading model ${modelName}. This may take a few minutes if downloading is required.` 
  });
}

/**
 * Load/download model asynchronously using foundry CLI
 */
async function loadModelAsync(modelName: string): Promise<void> {
  const { spawn } = await import('child_process');
  
  return new Promise((resolve, reject) => {
    // Use foundry model run to load the model
    const proc = spawn('foundry', ['model', 'run', modelName], {
      stdio: 'pipe',
    });
    
    let stderr = '';
    
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        modelLoadJobs.set(modelName, { status: 'completed' });
        resolve();
      } else {
        const error = stderr || `Process exited with code ${code}`;
        modelLoadJobs.set(modelName, { status: 'failed', error });
        reject(new Error(error));
      }
    });
    
    proc.on('error', (err) => {
      modelLoadJobs.set(modelName, { status: 'failed', error: err.message });
      reject(err);
    });
    
    // Timeout after 10 minutes (model downloads can be large)
    setTimeout(() => {
      proc.kill();
      const error = 'Model loading timed out after 10 minutes';
      modelLoadJobs.set(modelName, { status: 'failed', error });
      reject(new Error(error));
    }, 10 * 60 * 1000);
  });
}

/**
 * Handle model test request - makes a simple inference call to verify model is working
 */
async function handleTestModel(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  
  let request: { model: string };
  try {
    request = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (!request.model) {
    sendJson(res, 400, { error: 'model is required' });
    return;
  }

  try {
    const client = getLocalModelClient(undefined, request.model);
    const status = await client.checkStatus();
    
    if (!status.available) {
      sendJson(res, 200, { success: false, error: 'Foundry Local is not available' });
      return;
    }

    // Make a simple test completion call
    const response = await client.complete({
      prompt: 'Say "hello" in one word.',
      maxTokens: 10,
      temperature: 0,
    });
    
    if (response.content && response.content.length > 0) {
      console.log(`[Test] Model ${request.model} responded: "${response.content.trim()}"`);
      sendJson(res, 200, { 
        success: true, 
        response: response.content.trim(),
        model: client.currentModel
      });
    } else {
      sendJson(res, 200, { success: false, error: 'Model returned empty response' });
    }
  } catch (error) {
    console.error(`[Test] Model ${request.model} test failed:`, error);
    sendJson(res, 200, { 
      success: false, 
      error: error instanceof Error ? error.message : 'Test call failed' 
    });
  }
}

/**
 * Handle generation request
 */
async function handleGenerate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  
  let request: GenerationRequest;
  try {
    request = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (!request.repoPath) {
    sendJson(res, 400, { error: 'repoPath is required' });
    return;
  }

  // Validate inputs
  let repoPath: string;
  try {
    if (request.repoPath.startsWith('https://github.com/')) {
      const { sanitizedUrl } = validateGitHubUrl(request.repoPath);
      repoPath = request.repoPath; // Will be cloned
    } else {
      repoPath = validateDirectory(request.repoPath);
    }
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid input' });
    return;
  }

  if (request.endpoint) {
    try {
      validateEndpoint(request.endpoint);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid endpoint' });
      return;
    }
  }

  if (request.model) {
    try {
      validateModelName(request.model);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid model name' });
      return;
    }
  }

  // Cloud mode: read configuration from environment variables
  if (request.useCloud) {
    const envEndpoint = process.env.FOUNDRY_CLOUD_ENDPOINT;
    const envApiKey = process.env.FOUNDRY_CLOUD_API_KEY;
    const envModel = process.env.FOUNDRY_CLOUD_MODEL;
    if (!envEndpoint || !envApiKey) {
      sendJson(res, 400, { error: 'Cloud mode requires FOUNDRY_CLOUD_ENDPOINT and FOUNDRY_CLOUD_API_KEY in your .env file' });
      return;
    }
    try {
      validateCloudEndpoint(envEndpoint);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid cloud endpoint in .env' });
      return;
    }
    try {
      validateApiKey(envApiKey);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid API key in .env' });
      return;
    }
    request.cloudEndpoint = envEndpoint;
    request.cloudApiKey = envApiKey;
    request.cloudModel = envModel;
  } else if (request.cloudEndpoint) {
    // Legacy: direct cloud credentials in request (CLI mode)
    try {
      validateCloudEndpoint(request.cloudEndpoint);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid cloud endpoint' });
      return;
    }
    if (!request.cloudApiKey) {
      sendJson(res, 400, { error: 'API key is required when using a cloud endpoint' });
      return;
    }
    try {
      validateApiKey(request.cloudApiKey);
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'Invalid API key' });
      return;
    }
  }

  // Create job
  // Define the 9 orchestrator steps for progress tracking
  const stepDefinitions: Array<{ stepId: string; stepName: string }> = [
    { stepId: 'clone-repo', stepName: 'Cloning repository' },
    { stepId: 'check-foundry', stepName: 'Checking AI provider' },
    { stepId: 'scan-repo', stepName: 'Scanning repository' },
    { stepId: 'analyze-files', stepName: 'Analyzing key files' },
    { stepId: 'gen-architecture', stepName: 'Generating architecture overview' },
    { stepId: 'gen-tasks', stepName: 'Generating starter tasks' },
    { stepId: 'gen-diagram', stepName: 'Generating component diagram' },
    { stepId: 'compile-pack', stepName: 'Compiling onboarding pack' },
    { stepId: 'ms-learn-validate', stepName: 'Validating Microsoft technologies' },
    { stepId: 'write-files', stepName: 'Writing output files' },
  ];

  const jobId = generateJobId();
  const job: GenerationProgress = {
    id: jobId,
    status: 'pending',
    step: 'Initializing...',
    progress: 0,
    steps: stepDefinitions.map((s, i) => ({
      stepNumber: i + 1,
      totalSteps: stepDefinitions.length,
      stepId: s.stepId,
      stepName: s.stepName,
      stepStatus: 'pending' as const,
    })),
    currentStepNumber: 0,
    totalSteps: stepDefinitions.length,
  };
  jobs.set(jobId, job);

  // Start generation in background
  runGeneration(jobId, request).catch(error => {
    const j = jobs.get(jobId);
    if (j) {
      j.status = 'failed';
      j.error = error instanceof Error ? error.message : String(error);
    }
  });

  sendJson(res, 202, { jobId, message: 'Generation started' });
}

/**
 * Run the generation process
 */
async function runGeneration(jobId: string, request: GenerationRequest): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = 'running';
  job.step = 'Preparing...';
  job.progress = 2;

  try {
    let repoPath = request.repoPath;
    
    // Clone if GitHub URL
    if (repoPath.startsWith('https://github.com/')) {
      // Update clone step
      const cloneStep = job.steps.find(s => s.stepId === 'clone-repo');
      if (cloneStep) {
        cloneStep.stepStatus = 'running';
        job.step = 'Cloning repository...';
        job.currentStepNumber = cloneStep.stepNumber;
      }
      
      const { spawnSync } = await import('child_process');
      const { tmpdir } = await import('os');
      const { owner, repo, sanitizedUrl } = validateGitHubUrl(repoPath);
      
      const tempDir = join(tmpdir(), 'onboard-repos', `${owner}-${repo}`);
      await mkdir(join(tmpdir(), 'onboard-repos'), { recursive: true });
      
      if (!existsSync(tempDir)) {
        const result = spawnSync('git', ['clone', '--depth', '1', '--quiet', sanitizedUrl, tempDir], {
          stdio: 'pipe',
          encoding: 'utf-8',
        });
        
        if (result.status !== 0) {
          if (cloneStep) cloneStep.stepStatus = 'failed';
          throw new Error(`Failed to clone: ${result.stderr}`);
        }
      }
      
      if (cloneStep) cloneStep.stepStatus = 'completed';
      repoPath = tempDir;
    } else {
      // Mark clone step as completed (skipped) for local repos
      const cloneStep = job.steps.find(s => s.stepId === 'clone-repo');
      if (cloneStep) cloneStep.stepStatus = 'completed';
    }

    const outputDir = request.outputDir || join(repoPath, 'docs');
    await mkdir(outputDir, { recursive: true });

    const config: GenerationConfig = {
      repoPath,
      outputDir,
      foundryEndpoint: request.endpoint,
      foundryModel: request.model,
      verbose: false,
      skipLocalModel: request.skipLocal,
      cloudEndpoint: request.cloudEndpoint,
      cloudApiKey: request.cloudApiKey,
      cloudModel: request.cloudModel,
      onProgress: (info) => {
        // Update current step text and progress
        job.step = `[${info.stepNumber}/${info.totalSteps}] ${info.stepName}`;
        job.progress = info.progress;
        job.currentStepNumber = info.stepNumber;
        job.totalSteps = info.totalSteps;

        // Update the matching step in the steps array
        const stepEntry = job.steps.find(s => s.stepId === info.stepId);
        if (stepEntry) {
          stepEntry.stepStatus = info.stepStatus;
          if (info.detail) stepEntry.detail = info.detail;
        }
      },
    };

    const orchestrator = new Orchestrator(config);
    await orchestrator.run();

    job.step = 'Complete!';
    job.progress = 100;
    job.status = 'completed';
    job.outputDir = outputDir;
    // Mark any remaining pending steps as completed
    for (const s of job.steps) {
      if (s.stepStatus === 'pending' || s.stepStatus === 'running') s.stepStatus = 'completed';
    }

  } catch (error) {
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : String(error);
  }
}

/**
 * Handle job status request
 */
function handleJobStatus(res: ServerResponse, jobId: string | null): void {
  if (!jobId) {
    sendJson(res, 400, { error: 'Job ID required' });
    return;
  }

  const job = jobs.get(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job not found' });
    return;
  }

  sendJson(res, 200, job);
}

/**
 * Handle file listing request
 */
async function handleListFiles(res: ServerResponse, dir: string | null): Promise<void> {
  if (!dir) {
    sendJson(res, 400, { error: 'Directory path required' });
    return;
  }

  try {
    const validatedDir = validateDirectory(dir);
    const files = await readdir(validatedDir);
    sendJson(res, 200, { files });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : 'Failed to list files' });
  }
}

/**
 * Handle file read request
 */
async function handleReadFile(res: ServerResponse, filePath: string | null): Promise<void> {
  if (!filePath) {
    sendJson(res, 400, { error: 'File path required' });
    return;
  }

  try {
    // Basic path validation
    if (filePath.includes('..')) {
      throw new Error('Path traversal not allowed');
    }
    
    const content = await readFile(filePath, 'utf-8');
    sendJson(res, 200, { content });
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : 'Failed to read file' });
  }
}

/**
 * Read request body
 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

/**
 * Generate unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get the HTML page content
 */
function getHtmlPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Repo Onboarding Pack Generator</title>
  <style>
    :root {
      --primary: #0969da;
      --primary-dark: #0550ae;
      --success: #1a7f37;
      --warning: #bf8700;
      --error: #cf222e;
      --bg: #f6f8fa;
      --card-bg: #ffffff;
      --border: #d0d7de;
      --text: #1f2328;
      --text-muted: #656d76;
      --skeleton: #e1e4e8;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 1rem;
    }
    
    @media (min-width: 640px) {
      .container { padding: 2rem; }
    }
    
    header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    
    header h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    @media (min-width: 640px) {
      header h1 { font-size: 2rem; }
    }
    
    header p {
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    
    @media (min-width: 640px) {
      .card { padding: 1.5rem; margin-bottom: 1.5rem; }
    }
    
    .card h2 {
      font-size: 1.1rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .form-group {
      margin-bottom: 1rem;
    }
    
    label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.25rem;
    }
    
    .hint {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }
    
    input[type="text"], input[type="url"], select {
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 0.95rem;
      background: var(--card-bg);
      color: var(--text);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    
    input:focus, select:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.15);
    }
    
    input.error, select.error {
      border-color: var(--error);
      box-shadow: 0 0 0 3px rgba(207, 34, 46, 0.1);
    }
    
    .input-wrapper {
      position: relative;
    }
    
    .input-wrapper .recent-btn {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .input-wrapper .recent-btn:hover {
      background: var(--border);
    }
    
    .recent-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-top: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 100;
      display: none;
    }
    
    .recent-dropdown.open {
      display: block;
    }
    
    .recent-item {
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      font-size: 0.875rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .recent-item:last-child {
      border-bottom: none;
    }
    
    .recent-item:hover {
      background: var(--bg);
    }
    
    .recent-item .remove-recent {
      color: var(--error);
      padding: 0.25rem;
      font-size: 1rem;
      line-height: 1;
    }
    
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .checkbox-group input {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    
    .checkbox-group label {
      cursor: pointer;
      font-weight: normal;
    }
    
    .btn-group {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    button {
      background: var(--primary);
      color: white;
      border: none;
      padding: 0.625rem 1.25rem;
      border-radius: 6px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s, transform 0.1s;
    }
    
    button:hover:not(:disabled) {
      background: var(--primary-dark);
    }
    
    button:active:not(:disabled) {
      transform: scale(0.98);
    }
    
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .btn-secondary {
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
    }
    
    .btn-secondary:hover:not(:disabled) {
      background: var(--border);
    }
    
    .btn-danger {
      background: var(--error);
    }
    
    .btn-danger:hover:not(:disabled) {
      background: #a40e26;
    }
    
    .status-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    
    .status-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 0.875rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    
    .status-badge.live {
      background: #dafbe1;
      color: var(--success);
    }
    
    .status-badge.offline {
      background: #ffebe9;
      color: var(--error);
    }
    
    .status-badge .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }
    
    .status-badge.live .dot {
      background: var(--success);
    }
    
    .status-badge.offline .dot {
      background: var(--error);
      animation: none;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    .skeleton {
      background: linear-gradient(90deg, var(--skeleton) 25%, #f0f2f5 50%, var(--skeleton) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }
    
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    
    .skeleton-row {
      height: 1.5rem;
      margin-bottom: 0.5rem;
    }
    
    .status-details {
      background: var(--bg);
      border-radius: 6px;
      padding: 0.75rem 1rem;
    }
    
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 0.4rem 0;
      border-bottom: 1px solid var(--border);
      gap: 1rem;
    }
    
    .status-row:last-child {
      border-bottom: none;
    }
    
    .status-label {
      font-weight: 500;
      color: var(--text-muted);
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    
    .status-value {
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.8rem;
      word-break: break-all;
      text-align: right;
    }
    
    .progress-container {
      margin-top: 1rem;
    }
    
    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    
    .progress-bar {
      height: 8px;
      background: var(--bg);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    
    .progress-fill {
      height: 100%;
      background: var(--primary);
      transition: width 0.3s ease;
    }
    
    .progress-fill.indeterminate {
      width: 30% !important;
      animation: indeterminate 1.5s ease-in-out infinite;
    }
    
    .progress-fill.completed {
      background: var(--success);
      animation: none;
    }
    
    @keyframes indeterminate {
      0% { margin-left: 0; }
      50% { margin-left: 70%; }
      100% { margin-left: 0; }
    }
    
    .progress-text {
      font-size: 0.85rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .step-tracker {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    
    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.375rem 0;
      font-size: 0.825rem;
      position: relative;
    }
    
    .step-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 0.7rem;
      position: relative;
      z-index: 1;
    }
    
    .step-item:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 28px;
      bottom: -4px;
      width: 2px;
      background: var(--border);
    }
    
    .step-item.step-completed:not(:last-child)::before {
      background: var(--success);
    }
    
    .step-item.step-running:not(:last-child)::before {
      background: var(--primary);
      opacity: 0.4;
    }
    
    .step-pending .step-icon {
      background: var(--bg);
      border: 2px solid var(--border);
      color: var(--text-muted);
    }
    
    .step-running .step-icon {
      background: #ddf4ff;
      border: 2px solid var(--primary);
      color: var(--primary);
      animation: pulseIcon 1.5s ease-in-out infinite;
    }
    
    .step-completed .step-icon {
      background: #dafbe1;
      border: 2px solid var(--success);
      color: var(--success);
    }
    
    .step-failed .step-icon {
      background: #ffebe9;
      border: 2px solid var(--error);
      color: var(--error);
    }
    
    @keyframes pulseIcon {
      0%, 100% { box-shadow: 0 0 0 0 rgba(9, 105, 218, 0.3); }
      50% { box-shadow: 0 0 0 4px rgba(9, 105, 218, 0); }
    }
    
    .step-content {
      flex: 1;
      min-width: 0;
    }
    
    .step-name {
      font-weight: 500;
      color: var(--text);
    }
    
    .step-pending .step-name {
      color: var(--text-muted);
    }
    
    .step-running .step-name {
      color: var(--primary);
    }
    
    .step-completed .step-name {
      color: var(--success);
    }
    
    .step-failed .step-name {
      color: var(--error);
    }
    
    .step-detail {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.125rem;
    }
    
    .step-failed .step-detail {
      color: var(--error);
    }
    
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .results {
      margin-top: 0.5rem;
    }
    
    .file-list {
      list-style: none;
    }
    
    .file-list li {
      padding: 0.625rem;
      border: 1px solid var(--border);
      border-radius: 6px;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
      transition: background 0.2s;
    }
    
    .file-list li:hover {
      background: var(--bg);
    }
    
    .file-name {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: monospace;
      font-size: 0.875rem;
    }
    
    .file-actions {
      display: flex;
      gap: 0.25rem;
    }
    
    .icon-btn {
      background: transparent;
      color: var(--primary);
      padding: 0.375rem 0.5rem;
      font-size: 0.8rem;
      border-radius: 4px;
    }
    
    .icon-btn:hover {
      background: var(--bg);
    }
    
    .modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    
    .modal.open {
      display: flex;
    }
    
    .modal-content {
      background: var(--card-bg);
      border-radius: 8px;
      width: 100%;
      max-width: 850px;
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .modal-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .modal-header h3 {
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .modal-actions {
      display: flex;
      gap: 0.25rem;
    }
    
    .modal-body {
      padding: 1rem;
      overflow: auto;
      flex: 1;
    }
    
    .modal-body pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    
    .close-btn {
      background: transparent;
      color: var(--text-muted);
      font-size: 1.25rem;
      padding: 0.25rem 0.5rem;
    }
    
    .toast {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
      background: var(--text);
      color: var(--card-bg);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      opacity: 0;
      transform: translateY(1rem);
      transition: opacity 0.3s, transform 0.3s;
      z-index: 1001;
    }
    
    .toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    
    .model-status {
      margin-top: 0.5rem;
      padding: 0.75rem;
      border-radius: 6px;
      font-size: 0.85rem;
      display: none;
    }
    
    .model-status.show {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    
    .model-status.loading {
      background: #fff8c5;
      border: 1px solid #bf8700;
      color: #6d5800;
    }
    
    .model-status.downloading {
      background: #ddf4ff;
      border: 1px solid var(--primary);
      color: var(--primary-dark);
    }
    
    .model-status.success {
      background: #dafbe1;
      border: 1px solid var(--success);
      color: var(--success);
    }
    
    .model-status.error {
      background: #ffebe9;
      border: 1px solid var(--error);
      color: var(--error);
    }
    
    .model-status .model-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    
    .model-status-text {
      flex: 1;
    }
    
    .model-status-btn {
      background: transparent;
      color: inherit;
      padding: 0.25rem 0.5rem;
      font-size: 0.8rem;
      border: 1px solid currentColor;
      opacity: 0.8;
    }
    
    .model-status-btn:hover {
      opacity: 1;
      background: rgba(0,0,0,0.05);
    }
    
    .error-message {
      background: #ffebe9;
      border: 1px solid #cf222e;
      color: var(--error);
      padding: 1rem;
      border-radius: 6px;
      margin-top: 1rem;
      font-size: 0.875rem;
    }
    
    .icon { font-size: 1.1rem; }
    
    .info-panel {
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    
    .info-panel-header {
      padding: 0.625rem 1rem;
      font-weight: 600;
      font-size: 0.95rem;
    }
    
    .info-panel-body {
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
    }
    
    .info-panel-body p {
      margin-bottom: 0.5rem;
    }
    
    .info-panel-body p:last-child {
      margin-bottom: 0;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.375rem 1rem;
      margin: 0.5rem 0;
    }
    
    @media (max-width: 500px) {
      .info-grid { grid-template-columns: 1fr; }
    }
    
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 0.375rem;
      font-size: 0.8rem;
    }
    
    .info-icon {
      flex-shrink: 0;
    }
    
    .info-models {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    
    .local-info {
      background: #ddf4ff;
      border-color: #54aeff;
    }
    
    .local-info .info-panel-header {
      background: #54aeff22;
      color: var(--primary-dark);
    }
    
    .cloud-info {
      background: #f5f0ff;
      border-color: #8250df;
    }
    
    .cloud-info .info-panel-header {
      background: #8250df22;
      color: #6639ba;
    }
    
    @media (prefers-color-scheme: dark) {
      .local-info {
        background: #0d1117;
        border-color: #388bfd;
      }
      .local-info .info-panel-header {
        background: #388bfd22;
        color: #58a6ff;
      }
      .cloud-info {
        background: #0d1117;
        border-color: #8b5cf6;
      }
      .cloud-info .info-panel-header {
        background: #8b5cf622;
        color: #a78bfa;
      }
    }
    
    .refresh-btn {
      background: transparent;
      color: var(--primary);
      padding: 0.25rem 0.5rem;
      font-size: 0.8rem;
    }
    
    kbd {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 0.125rem 0.375rem;
      font-size: 0.75rem;
      font-family: monospace;
    }
    
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --card-bg: #161b22;
        --border: #30363d;
        --text: #c9d1d9;
        --text-muted: #8b949e;
        --skeleton: #21262d;
      }
      
      input[type="text"], input[type="url"], select {
        background: var(--bg);
        color: var(--text);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📦 Repo Onboarding Pack Generator</h1>
      <p>Generate engineering onboarding docs using hybrid AI (Foundry Local + GitHub Copilot)</p>
    </header>
    
    <div class="card" role="region" aria-label="Configuration">
      <h2>⚙️ Configuration</h2>
      <form id="generate-form" novalidate>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label style="font-size: 1rem; font-weight: 600;">🔧 AI Provider</label>
          <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem;">
            <label style="font-weight: normal; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
              <input type="radio" name="provider" value="local" checked> 🖥️ Foundry Local
            </label>
            <label style="font-weight: normal; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
              <input type="radio" name="provider" value="cloud"> ☁️ Microsoft Foundry (Cloud)
            </label>
          </div>
          <p class="hint">Choose between privacy-preserving local inference or cloud-hosted models</p>
        </div>
        
        <div id="local-section">
        <div class="info-panel local-info">
          <div class="info-panel-header">🖥️ Foundry Local — On-Device AI</div>
          <div class="info-panel-body">
            <p>Run models <strong>privately on your machine</strong> with no data leaving your device. Ideal for sensitive codebases and offline work.</p>
            <div class="info-grid">
              <div class="info-item"><span class="info-icon">🔒</span><span><strong>Privacy:</strong> Data stays on-device</span></div>
              <div class="info-item"><span class="info-icon">⚡</span><span><strong>Latency:</strong> No network round-trips</span></div>
              <div class="info-item"><span class="info-icon">🌐</span><span><strong>Offline:</strong> Works without internet</span></div>
              <div class="info-item"><span class="info-icon">💻</span><span><strong>Requires:</strong> GPU with 4 GB+ VRAM</span></div>
            </div>
            <p class="info-models"><strong>Recommended models:</strong> phi-4 (14B), Phi-4-mini (3.8B), Qwen 2.5 (1.5B–7B), DeepSeek-R1 distills</p>
          </div>
        </div>
        <div class="form-group" style="background: var(--bg); padding: 1rem; border-radius: 8px; border: 2px solid var(--primary); margin-bottom: 1rem;">
          <label for="model" style="font-size: 1.1rem;">🤖 Step 1: Select & Load Model <span aria-hidden="true">*</span></label>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 0.5rem;">
            <select id="model" name="model" aria-describedby="model-hint" style="flex: 1;" required>
              <option value="">Loading models...</option>
            </select>
            <button type="button" id="load-model-btn" class="btn-secondary" style="white-space: nowrap;" disabled>
              📥 Load Model
            </button>
          </div>
          <p class="hint" id="model-hint">Select a model and click "Load Model" to prepare it for inference.<br>
            <strong>Recommended:</strong> phi-4 (14B) or larger for best quality. Models &lt; 3B may produce incomplete output.</p>
          <div id="model-status" class="model-status" role="status" aria-live="polite">
            <div class="model-spinner"></div>
            <span class="model-status-text"></span>
            <button type="button" class="model-status-btn" id="dismiss-model-status" style="display:none;">Dismiss</button>
          </div>
        </div>
        
        <!-- Foundry Local Status - shown after Step 1 -->
        <div id="foundry-status-section" style="margin-bottom: 1.5rem; padding: 0.75rem 1rem; background: var(--bg-muted); border-radius: 8px; border-left: 4px solid var(--border);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 500; color: var(--text-muted);">🔌 Foundry Local Status</span>
            <button type="button" class="refresh-btn" onclick="checkStatus()" title="Refresh status" aria-label="Refresh status" style="background: none; border: none; cursor: pointer; font-size: 1rem;">🔄</button>
          </div>
          <div id="foundry-status" class="status-section" aria-live="polite" style="margin-top: 0.5rem;">
            <div class="status-header">
              <span class="status-badge offline"><span class="dot"></span> Checking...</span>
            </div>
          </div>
        </div>
        </div>
        
        <div id="cloud-section" style="display: none;">
        <div class="info-panel cloud-info">
          <div class="info-panel-header">☁️ Microsoft Foundry — Cloud-Hosted Models</div>
          <div class="info-panel-body">
            <p>Use <strong>powerful cloud models</strong> via Microsoft Foundry. Best for large repos and highest-quality output.</p>
            <div class="info-grid">
              <div class="info-item"><span class="info-icon">🚀</span><span><strong>Power:</strong> Access GPT-4o, Phi-4, DeepSeek-R1 &amp; more</span></div>
              <div class="info-item"><span class="info-icon">📈</span><span><strong>Scale:</strong> No local hardware limits</span></div>
              <div class="info-item"><span class="info-icon">🔑</span><span><strong>Auth:</strong> Requires API key &amp; endpoint</span></div>
              <div class="info-item"><span class="info-icon">💰</span><span><strong>Cost:</strong> Pay-per-token pricing applies</span></div>
            </div>
            <p class="info-models"><strong>Popular deployments:</strong> gpt-4o-mini, gpt-4o, Phi-4, DeepSeek-R1, Mistral Large</p>
          </div>
        </div>
          <!-- Unified Cloud Status Panel -->
          <div id="cloud-status-section" style="margin-bottom: 1.5rem; padding: 0.75rem 1rem; background: var(--bg-muted); border-radius: 8px; border-left: 4px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: 500; color: var(--text-muted);">☁️ Microsoft Foundry Cloud Status</span>
              <button type="button" class="refresh-btn" onclick="checkCloudStatus()" title="Refresh cloud status" aria-label="Refresh cloud status" style="background: none; border: none; cursor: pointer; font-size: 1rem;">🔄</button>
            </div>
            <div id="cloud-status" class="status-section" aria-live="polite" style="margin-top: 0.5rem;">
              <div class="status-header">
                <span class="status-badge offline"><span class="dot"></span> Checking...</span>
              </div>
            </div>
            <div id="cloud-env-details" style="margin-top: 0.75rem; font-size: 0.9rem; border-top: 1px solid var(--border); padding-top: 0.6rem;">
              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <span id="env-endpoint-status">⏳ Checking configuration...</span>
                <span id="env-key-status"></span>
                <span id="env-model-status"></span>
              </div>
              <p style="margin: 0.5rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
                Configure via <code style="background: var(--bg-hover); padding: 0.1rem 0.3rem; border-radius: 3px;">.env</code>:
                <code style="background: var(--bg-hover); padding: 0.1rem 0.3rem; border-radius: 3px;">FOUNDRY_CLOUD_ENDPOINT</code>,
                <code style="background: var(--bg-hover); padding: 0.1rem 0.3rem; border-radius: 3px;">FOUNDRY_CLOUD_API_KEY</code>,
                <code style="background: var(--bg-hover); padding: 0.1rem 0.3rem; border-radius: 3px;">FOUNDRY_CLOUD_MODEL</code>
              </p>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label for="repoPath">📁 Repository Path or GitHub URL <span aria-hidden="true">*</span></label>
          <div class="input-wrapper">
            <input type="text" id="repoPath" name="repoPath" 
                   placeholder="C:\\path\\to\\repo or https://github.com/owner/repo" 
                   required
                   aria-describedby="repoPath-hint"
                   autocomplete="off">
            <button type="button" class="recent-btn" id="recent-toggle" title="Recent repos" aria-label="Show recent repositories">Recent ▾</button>
            <div class="recent-dropdown" id="recent-dropdown" role="listbox" aria-label="Recent repositories"></div>
          </div>
          <p class="hint" id="repoPath-hint">Enter a local directory path or a GitHub HTTPS URL</p>
        </div>
        
        <div class="form-group">
          <label for="outputDir">📂 Output Directory</label>
          <input type="text" id="outputDir" name="outputDir" 
                 placeholder="Default: ./docs in the repository"
                 aria-describedby="outputDir-hint">
          <p class="hint" id="outputDir-hint">Where to save generated documentation (leave blank for default)</p>
        </div>
        
        <details style="margin-bottom: 1rem;">
          <summary style="cursor: pointer; color: var(--text-muted); font-size: 0.9rem;">⚙️ Advanced Options</summary>
          <div style="padding: 1rem 0;">
            <div class="form-group">
              <label for="endpoint">Foundry Local Endpoint</label>
              <input type="url" id="endpoint" name="endpoint" 
                     placeholder="Auto-detected"
                     aria-describedby="endpoint-hint">
              <p class="hint" id="endpoint-hint">Usually auto-detected; override if needed</p>
            </div>
          </div>
        </details>
        
        <div class="form-group" id="skip-local-group">
          <div class="checkbox-group">
            <input type="checkbox" id="skipLocal" name="skipLocal" aria-describedby="skipLocal-hint">
            <label for="skipLocal">Skip local model (use fallback generation)</label>
          </div>
          <p class="hint" id="skipLocal-hint">Enable if Foundry Local is not running</p>
        </div>
        
        <div class="btn-group">
          <button type="submit" id="generate-btn">
            <span class="icon" aria-hidden="true">🚀</span>
            Step 3: Generate Onboarding Pack
          </button>
        </div>
      </form>
      
      <div id="progress-section" class="progress-container" style="display: none;" role="status" aria-live="polite">
        <div class="progress-header">
          <span class="progress-text" id="progress-text"><span class="spinner"></span> Starting...</span>
          <button type="button" class="btn-secondary btn-danger" id="cancel-btn" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
            Cancel
          </button>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" id="progress-fill" style="width: 0%"></div>
        </div>
        <div id="step-tracker" class="step-tracker" style="margin-top: 0.75rem;"></div>
      </div>
      
      <div id="error-section" class="error-message" style="display: none;" role="alert"></div>
    </div>
    
    <div class="card" id="results-card" style="display: none;" role="region" aria-label="Generated Files">
      <h2>✅ Generated Files</h2>
      <div class="results">
        <ul class="file-list" id="file-list" role="list"></ul>
      </div>
    </div>
  </div>
  
  <div class="modal" id="preview-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-content">
      <div class="modal-header">
        <h3 id="modal-title">📄 File Preview</h3>
        <div class="modal-actions">
          <button class="icon-btn" id="copy-btn" title="Copy to clipboard (Ctrl+C)" aria-label="Copy content">📋 Copy</button>
          <button class="icon-btn" id="download-btn" title="Download file" aria-label="Download file">⬇️ Download</button>
          <button class="close-btn" id="close-modal" title="Close (Escape)" aria-label="Close preview">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <pre id="modal-content"></pre>
      </div>
      <div style="padding: 0.5rem 1rem; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted);">
        Press <kbd>Esc</kbd> to close • <kbd>Ctrl+C</kbd> to copy
      </div>
    </div>
  </div>
  
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    const form = document.getElementById('generate-form');
    const generateBtn = document.getElementById('generate-btn');
    const progressSection = document.getElementById('progress-section');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const cancelBtn = document.getElementById('cancel-btn');
    const errorSection = document.getElementById('error-section');
    const resultsCard = document.getElementById('results-card');
    const fileList = document.getElementById('file-list');
    const modal = document.getElementById('preview-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const modelSelect = document.getElementById('model');
    const loadModelBtn = document.getElementById('load-model-btn');
    const endpointInput = document.getElementById('endpoint');
    const repoPathInput = document.getElementById('repoPath');
    const recentToggle = document.getElementById('recent-toggle');
    const recentDropdown = document.getElementById('recent-dropdown');
    const toast = document.getElementById('toast');
    
    let cachedModels = [];
    let currentJobId = null;
    let pollAbort = null;
    let currentFileName = '';
    let currentFileContent = '';
    
    // Toast notification
    function showToast(message, duration = 2000) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), duration);
    }
    
    // Recent repos management
    function getRecentRepos() {
      try {
        return JSON.parse(localStorage.getItem('recentRepos') || '[]').slice(0, 5);
      } catch { return []; }
    }
    
    function addRecentRepo(repo) {
      const recent = getRecentRepos().filter(r => r !== repo);
      recent.unshift(repo);
      localStorage.setItem('recentRepos', JSON.stringify(recent.slice(0, 5)));
      updateRecentDropdown();
    }
    
    function removeRecentRepo(repo, e) {
      e.stopPropagation();
      const recent = getRecentRepos().filter(r => r !== repo);
      localStorage.setItem('recentRepos', JSON.stringify(recent));
      updateRecentDropdown();
    }
    
    function updateRecentDropdown() {
      const recent = getRecentRepos();
      if (recent.length === 0) {
        recentDropdown.innerHTML = '<div class="recent-item" style="color: var(--text-muted)">No recent repos</div>';
        return;
      }
      recentDropdown.innerHTML = recent.map(repo => \`
        <div class="recent-item" role="option" onclick="selectRecentRepo('\${repo.replace(/'/g, "\\\\'")}')">
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">\${repo}</span>
          <button class="remove-recent" onclick="removeRecentRepo('\${repo.replace(/'/g, "\\\\'")}', event)" aria-label="Remove from recent">&times;</button>
        </div>
      \`).join('');
    }
    
    function selectRecentRepo(repo) {
      repoPathInput.value = repo;
      recentDropdown.classList.remove('open');
      repoPathInput.focus();
    }
    
    recentToggle.addEventListener('click', () => {
      updateRecentDropdown();
      recentDropdown.classList.toggle('open');
    });
    
    document.addEventListener('click', (e) => {
      if (!recentToggle.contains(e.target) && !recentDropdown.contains(e.target)) {
        recentDropdown.classList.remove('open');
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape to close modal
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
      // R to refresh status (when not typing)
      if (e.key === 'r' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        checkStatus();
      }
    });
    
    function closeModal() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
    
    function openModal() {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      closeModalBtn.focus();
    }
    
    // Check cloud environment configuration
    async function loadCloudConfig() {
      try {
        const res = await fetch('/api/cloud-config');
        const config = await res.json();
        const endpointEl = document.getElementById('env-endpoint-status');
        const keyEl = document.getElementById('env-key-status');
        const modelEl = document.getElementById('env-model-status');
        if (endpointEl) endpointEl.innerHTML = config.endpointConfigured
          ? '\u2705 Endpoint: <strong>' + config.endpoint + '</strong>'
          : '\u274c Endpoint: not configured';
        if (keyEl) keyEl.innerHTML = config.apiKeyConfigured
          ? '\u2705 API Key: configured'
          : '\u274c API Key: not configured';
        if (modelEl) modelEl.innerHTML = config.modelConfigured
          ? '\u2705 Model: <strong>' + config.model + '</strong>'
          : '\u26a0\ufe0f Model: not set (will default to gpt-4o-mini)';
      } catch (e) {
        var endpointEl = document.getElementById('env-endpoint-status');
        if (endpointEl) endpointEl.textContent = '\u274c Unable to check cloud configuration';
      }
      // Also check live connectivity
      checkCloudStatus();
    }

    // Check Foundry Cloud live connectivity
    async function checkCloudStatus() {
      const statusDiv = document.getElementById('cloud-status');
      const statusSection = document.getElementById('cloud-status-section');
      if (!statusDiv || !statusSection) return;
      statusDiv.innerHTML = '<div class="status-header"><span class="status-badge offline"><span class="dot"></span> Checking...</span></div>';
      try {
        const res = await fetch('/api/cloud-status');
        if (!res.ok) throw new Error('Failed to fetch cloud status');
        const status = await res.json();
        if (status.available) {
          const modelCount = (status.models || []).length;
          statusSection.style.borderLeftColor = 'var(--success)';
          statusDiv.innerHTML = '\x3cdiv style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center;">'
            + '\x3cspan class="status-badge live">\x3cspan class="dot">\x3c/span> Online\x3c/span>'
            + '\x3cspan style="color: var(--text-muted); font-size: 0.85rem;">\x3cstrong>Endpoint:\x3c/strong> ' + status.endpoint + '\x3c/span>'
            + '\x3cspan style="color: var(--text-muted); font-size: 0.85rem;">\x3cstrong>Active:\x3c/strong> ' + (status.activeModel || 'None') + '\x3c/span>'
            + '\x3cspan style="color: var(--text-muted); font-size: 0.85rem;">\x3cstrong>Models:\x3c/strong> ' + modelCount + ' available\x3c/span>'
            + '\x3c/div>';
        } else {
          statusSection.style.borderLeftColor = 'var(--warning)';
          statusDiv.innerHTML = '\x3cdiv style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center;">'
            + '\x3cspan class="status-badge offline">\x3cspan class="dot">\x3c/span> Offline\x3c/span>'
            + '\x3cspan style="color: var(--text-muted); font-size: 0.85rem;">\x3cstrong>Endpoint:\x3c/strong> ' + (status.endpoint || 'Not configured') + '\x3c/span>'
            + '\x3c/div>'
            + '\x3cp class="hint" style="margin-top: 0.5rem; margin-bottom: 0;">'
            + (status.error ? status.error : 'Check your .env configuration and endpoint availability.')
            + '\x3c/p>';
        }
      } catch (error) {
        statusSection.style.borderLeftColor = 'var(--warning)';
        statusDiv.innerHTML = '\x3cdiv class="status-header">\x3cspan class="status-badge offline">\x3cspan class="dot">\x3c/span> Error\x3c/span>\x3c/div>'
            + '\x3cp class="hint" style="margin-top: 0.5rem;">Could not check cloud status. ' + error.message + '\x3c/p>';
      }
    }

    // Check Foundry status on load
    async function checkStatus() {
      const statusDiv = document.getElementById('foundry-status');
      const statusSection = document.getElementById('foundry-status-section');
      statusDiv.innerHTML = \`
        <div class="status-header">
          <span class="status-badge offline"><span class="dot"></span> Checking...</span>
        </div>
      \`;
      
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('Failed to fetch status');
        const status = await res.json();
        cachedModels = status.cachedModels || [];
        loadedModels = status.loadedModels || status.models || [];
        
        if (status.available) {
          const loadedCount = loadedModels.length;
          statusSection.style.borderLeftColor = 'var(--success)';
          
          statusDiv.innerHTML = \`
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center;">
              <span class="status-badge live"><span class="dot"></span> Online</span>
              <span style="color: var(--text-muted); font-size: 0.85rem;">
                <strong>Endpoint:</strong> \${status.endpoint}
              </span>
              <span style="color: var(--text-muted); font-size: 0.85rem;">
                <strong>Active:</strong> \${status.activeModel || 'None'}
              </span>
              <span style="color: var(--text-muted); font-size: 0.85rem;">
                <strong>Models:</strong> \${loadedCount} running / \${cachedModels.length} cached
              </span>
            </div>
          \`;
          endpointInput.placeholder = status.endpoint;
          populateModelPicker(null, loadedModels);
        } else {
          statusSection.style.borderLeftColor = 'var(--warning)';
          statusDiv.innerHTML = \`
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; align-items: center;">
              <span class="status-badge offline"><span class="dot"></span> Offline</span>
              <span style="color: var(--text-muted); font-size: 0.85rem;">
                <strong>Endpoint:</strong> \${status.endpoint || 'Not detected'}
              </span>
              <span style="color: var(--text-muted); font-size: 0.85rem;">
                <strong>Cached:</strong> \${cachedModels.length} models available
              </span>
            </div>
            <p class="hint" style="margin-top: 0.5rem; margin-bottom: 0;">
              Start with: <code>foundry service start</code> or check "Skip local model"
            </p>
          \`;
          populateModelPicker(null, []);
        }
      } catch (error) {
        statusDiv.innerHTML = \`
          <div class="status-header">
            <span class="status-badge offline"><span class="dot"></span> Error</span>
          </div>
          <p class="hint" style="margin-top: 0.5rem;">Could not check status. \${error.message}</p>
        \`;
        modelSelect.innerHTML = '<option value="">-- Select a model --</option>';
        loadModelBtn.disabled = true;
      }
    }
    
    function populateModelPicker(activeModel, loadedModels = []) {
      modelSelect.innerHTML = '';
      
      // Always add placeholder option first
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '-- Select a model --';
      placeholder.disabled = false;
      modelSelect.appendChild(placeholder);
      
      if (cachedModels.length === 0) {
        loadModelBtn.disabled = true;
        return;
      }
      
      const aliasMap = new Map();
      for (const model of cachedModels) {
        if (!aliasMap.has(model.alias)) aliasMap.set(model.alias, model);
      }
      for (const [alias, model] of aliasMap) {
        const option = document.createElement('option');
        option.value = alias;
        // Check if model is currently loaded in Foundry Local
        const isLoaded = loadedModels.some(m => 
          m.toLowerCase().includes(alias.toLowerCase()) || 
          alias.toLowerCase().includes(m.split('-')[0].toLowerCase())
        );
        const loadedIndicator = isLoaded ? ' ✓ Ready' : '';
        // Warn about small models (< 3GB file size likely < 3B params)
        const sizeNum = parseFloat(model.fileSize);
        const isSmall = sizeNum > 0 && sizeNum < 3;
        const sizeWarning = isSmall ? ' ⚠️' : '';
        option.textContent = \`\${alias} (\${model.device}, \${model.fileSize})\${loadedIndicator}\${sizeWarning}\`;
        option.dataset.loaded = isLoaded ? 'true' : 'false';
        option.dataset.small = isSmall ? 'true' : 'false';
        modelSelect.appendChild(option);
      }
      
      // Don't pre-select any model - user must choose
      modelSelect.selectedIndex = 0;
      loadModelBtn.disabled = true;
      
      // Update model status when selection changes
      updateModelStatus();
    }
    
    // Track loaded models
    let loadedModels = [];
    let modelLoadingInProgress = false;
    
    // Model status display
    const modelStatusDiv = document.getElementById('model-status');
    const modelStatusText = modelStatusDiv.querySelector('.model-status-text');
    const dismissModelStatusBtn = document.getElementById('dismiss-model-status');
    
    function showModelStatus(type, message, showDismiss = false) {
      modelStatusDiv.className = 'model-status show ' + type;
      modelStatusText.textContent = message;
      dismissModelStatusBtn.style.display = showDismiss ? 'inline-block' : 'none';
      // Hide spinner for success/error
      const spinner = modelStatusDiv.querySelector('.model-spinner');
      spinner.style.display = (type === 'loading' || type === 'downloading') ? 'block' : 'none';
    }
    
    function hideModelStatus() {
      modelStatusDiv.classList.remove('show');
    }
    
    dismissModelStatusBtn.addEventListener('click', hideModelStatus);
    
    function updateModelStatus() {
      const selectedOption = modelSelect.options[modelSelect.selectedIndex];
      if (!selectedOption || !selectedOption.value) {
        hideModelStatus();
        loadModelBtn.disabled = true;
        loadModelBtn.textContent = '📥 Load Model';
        return;
      }
      
      const isLoaded = selectedOption.dataset.loaded === 'true';
      const modelName = selectedOption.value;
      
      // Always enable load button when a model is selected
      loadModelBtn.disabled = modelLoadingInProgress;
      
      if (isLoaded) {
        showModelStatus('success', 
          \`✅ Model "\${modelName}" appears loaded. Click "Reload" to refresh it if needed.\`, 
          true
        );
        loadModelBtn.textContent = '🔄 Reload Model';
      } else {
        showModelStatus('loading', 
          \`⚠️ Model "\${modelName}" is cached but not currently loaded. Click "Load Model" to start it.\`, 
          true
        );
        loadModelBtn.textContent = '📥 Load Model';
      }
    }
    
    // Listen for model selection changes
    modelSelect.addEventListener('change', updateModelStatus);
    
    // Load model button click handler
    loadModelBtn.addEventListener('click', async () => {
      await loadSelectedModel();
    });
    
    // Load model on demand - allows loading/reloading any model
    async function loadSelectedModel() {
      const selectedModel = modelSelect.value;
      if (!selectedModel || modelLoadingInProgress) return false;
      
      modelLoadingInProgress = true;
      loadModelBtn.disabled = true;
      loadModelBtn.textContent = '⏳ Loading...';
      showModelStatus('downloading', 
        \`📥 Loading model "\${selectedModel}"... This may take a moment.\`
      );
      
      try {
        const res = await fetch('/api/load-model', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: selectedModel }),
        });
        
        const data = await res.json();
        
        if (res.ok) {
          // Wait a moment for model to initialize
          showModelStatus('downloading', 
            \`📥 Model "\${selectedModel}" loading... Testing connection...\`
          );
          
          // Give it a few seconds then test
          await new Promise(r => setTimeout(r, 3000));
          
          // Test model with a simple call
          const testRes = await fetch('/api/test-model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: selectedModel }),
          });
          
          const testData = await testRes.json();
          
          if (testRes.ok && testData.success) {
            showModelStatus('success', \`✅ Model "\${selectedModel}" is loaded and responding!\`, true);
            loadModelBtn.textContent = '🔄 Reload Model';
            // Update the option to show it's now loaded
            const selectedOption = modelSelect.options[modelSelect.selectedIndex];
            if (selectedOption && !selectedOption.textContent.includes('✓ Ready')) {
              selectedOption.textContent += ' ✓ Ready';
            }
            if (selectedOption) selectedOption.dataset.loaded = 'true';
            // Refresh the status section to show the model is now active
            await checkStatus();
            return true;
          } else {
            showModelStatus('error', \`⚠️ Model loaded but test failed: \${testData.error || 'No response'}\`, true);
            loadModelBtn.textContent = '📥 Load Model';
            return false;
          }
        } else {
          showModelStatus('error', \`❌ Failed to load model: \${data.error || 'Unknown error'}\`, true);
          loadModelBtn.textContent = '📥 Load Model';
          return false;
        }
      } catch (error) {
        showModelStatus('error', \`❌ Failed to load model: \${error.message}\`, true);
        loadModelBtn.textContent = '📥 Load Model';
        return false;
      } finally {
        modelLoadingInProgress = false;
        loadModelBtn.disabled = false;
      }
    }
    
    async function pollModelLoadStatus(modelName) {
      // Poll status endpoint to check if model is now loaded
      for (let i = 0; i < 60; i++) { // Poll for up to 5 minutes
        await new Promise(r => setTimeout(r, 5000)); // 5 second intervals
        
        try {
          const res = await fetch('/api/status');
          const status = await res.json();
          loadedModels = status.loadedModels || status.models || [];
          
          const isNowLoaded = loadedModels.some(m => 
            m.toLowerCase().includes(modelName.toLowerCase()) ||
            modelName.toLowerCase().includes(m.split('-')[0].toLowerCase())
          );
          
          if (isNowLoaded) {
            showModelStatus('success', \`✅ Model "\${modelName}" is now loaded and ready!\`, true);
            loadModelBtn.textContent = '✅ Model Ready';
            loadModelBtn.disabled = true;
            // Refresh model picker to update loaded status
            populateModelPicker(null, loadedModels);
            // Re-select the loaded model
            for (let i = 0; i < modelSelect.options.length; i++) {
              if (modelSelect.options[i].value === modelName) {
                modelSelect.selectedIndex = i;
                break;
              }
            }
            return;
          }
          
          showModelStatus('downloading', 
            \`📥 Loading model "\${modelName}"... (\${i * 5}s elapsed)\`
          );
        } catch (error) {
          // Continue polling
        }
      }
      
      showModelStatus('error', \`⚠️ Model loading is taking longer than expected. Please check Foundry Local status.\`, true);
    }
    
    checkStatus();
    
    // Provider toggle
    document.querySelectorAll('input[name="provider"]').forEach(function(radio) {
      radio.addEventListener('change', function(e) {
        var isCloud = e.target.value === 'cloud';
        document.getElementById('local-section').style.display = isCloud ? 'none' : 'block';
        document.getElementById('cloud-section').style.display = isCloud ? 'block' : 'none';
        document.getElementById('skip-local-group').style.display = isCloud ? 'none' : '';
        // Clear error styling when switching
        modelSelect.classList.remove('error');
        if (isCloud) loadCloudConfig();
      });
    });
    
    // Form validation
    function validateForm() {
      let valid = true;
      const repoPath = repoPathInput.value.trim();
      const skipLocal = document.getElementById('skipLocal').checked;
      const selectedModel = modelSelect.value;
      
      repoPathInput.classList.remove('error');
      modelSelect.classList.remove('error');
      
      if (!repoPath) {
        repoPathInput.classList.add('error');
        showToast('Please enter a repository path or GitHub URL');
        valid = false;
      } else if (repoPath.startsWith('https://') && !repoPath.match(/^https:\\/\\/github\\.com\\/[\\w.-]+\\/[\\w.-]+/)) {
        repoPathInput.classList.add('error');
        showToast('Invalid GitHub URL format. Expected: https://github.com/owner/repo');
        valid = false;
      }
      
      // Require model selection unless skipping local model or using cloud
      const isCloud = document.querySelector('input[name="provider"]:checked').value === 'cloud';
      if (!isCloud && !skipLocal && !selectedModel) {
        modelSelect.classList.add('error');
        showToast('Please select a model or check "Skip local model"');
        valid = false;
      }
      
      return valid;
    }
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validateForm()) {
        // Error messages are shown by validateForm()
        return;
      }
      
      const formData = new FormData(form);
      const repoPath = formData.get('repoPath').trim();
      
      const data = {
        repoPath,
        outputDir: formData.get('outputDir') || undefined,
        ...(document.querySelector('input[name="provider"]:checked').value === 'cloud' ? {
          useCloud: true,
        } : {
          endpoint: formData.get('endpoint') || undefined,
          model: formData.get('model') || undefined,
          skipLocal: formData.get('skipLocal') === 'on',
        }),
      };
      
      // Save to recent
      addRecentRepo(repoPath);
      
      // Reset UI
      errorSection.style.display = 'none';
      resultsCard.style.display = 'none';
      progressSection.style.display = 'block';
      generateBtn.disabled = true;
      progressFill.style.width = '0%';
      progressFill.classList.add('indeterminate');
      progressFill.classList.remove('completed');
      progressText.innerHTML = '<span class="spinner"></span> Starting...';
      stepTracker.innerHTML = '';
      
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        const text = await res.text();
        let result;
        try {
          result = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(text || 'Invalid server response');
        }
        
        if (!res.ok) throw new Error(result.error || \`Server error: \${res.status}\`);
        
        currentJobId = result.jobId;
        progressFill.classList.remove('indeterminate');
        await pollJobStatus(currentJobId);
        
      } catch (error) {
        errorSection.textContent = error.message;
        errorSection.style.display = 'block';
        progressSection.style.display = 'none';
      } finally {
        generateBtn.disabled = false;
        currentJobId = null;
      }
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
      if (pollAbort) pollAbort.abort();
      currentJobId = null;
      progressSection.style.display = 'none';
      generateBtn.disabled = false;
      showToast('Generation cancelled');
    });
    
    const stepTracker = document.getElementById('step-tracker');

    var stepEmojiMap = {
      'clone-repo': '📥',
      'check-foundry': '🔌',
      'scan-repo': '🔍',
      'analyze-files': '📄',
      'gen-architecture': '🏗️',
      'gen-tasks': '📋',
      'gen-diagram': '📊',
      'compile-pack': '📦',
      'ms-learn-validate': '🔬',
      'write-files': '💾',
    };

    function escapeHtml(text) {
      var div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    }

    function getStepIcon(status) {
      switch (status) {
        case 'completed': return '✓';
        case 'running': return '◉';
        case 'failed': return '✗';
        default: return '○';
      }
    }

    function renderStepTracker(steps) {
      if (!steps || !steps.length) return;
      stepTracker.innerHTML = steps.map(function(s) {
        var cls = 'step-' + (s.stepStatus || 'pending');
        var icon = getStepIcon(s.stepStatus);
        var emoji = stepEmojiMap[s.stepId] || '•';
        var detail = s.detail ? '<div class="step-detail">' + escapeHtml(s.detail) + '</div>' : '';
        var runningIndicator = s.stepStatus === 'running'
          ? ' <span class="spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-left:4px;"></span>'
          : '';
        return '<div class="step-item ' + cls + '">'
          + '<div class="step-icon">' + icon + '</div>'
          + '<div class="step-content">'
          + '<div class="step-name">' + emoji + ' ' + escapeHtml(s.stepName) + runningIndicator + '</div>'
          + detail
          + '</div></div>';
      }).join('');
    }

    async function pollJobStatus(jobId) {
      pollAbort = new AbortController();
      
      while (currentJobId === jobId) {
        await new Promise(r => setTimeout(r, 500));
        if (currentJobId !== jobId) break;
        
        try {
          const res = await fetch(\`/api/job?id=\${jobId}\`, { signal: pollAbort.signal });
          const job = await res.json();
          
          const progress = job.progress || 0;
          progressFill.style.width = progress + '%';
          document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', progress);
          
          // Render step tracker
          if (job.steps && job.steps.length) {
            renderStepTracker(job.steps);
          }
          
          // Find current running step's detail
          var runningStep = (job.steps || []).find(function(s) { return s.stepStatus === 'running'; });
          var detailSuffix = runningStep && runningStep.detail ? ' — ' + escapeHtml(runningStep.detail) : '';
          
          if (progress > 0) {
            progressText.innerHTML = \`<span class="spinner"></span> \${escapeHtml(job.step || 'Processing...')}\${detailSuffix} (\${progress}%)\`;
          } else {
            progressText.innerHTML = \`<span class="spinner"></span> \${escapeHtml(job.step || 'Processing...')}\${detailSuffix}\`;
          }
          
          if (job.status === 'completed') {
            progressFill.style.width = '100%';
            progressFill.classList.remove('indeterminate');
            progressFill.classList.add('completed');
            progressText.innerHTML = '✅ Generation complete!';
            // Final render with all steps completed
            if (job.steps) renderStepTracker(job.steps);
            showResults(job.outputDir);
            showToast('Onboarding pack generated!');
            break;
          }
          
          if (job.status === 'failed') {
            if (job.steps) renderStepTracker(job.steps);
            throw new Error(job.error || 'Generation failed');
          }
        } catch (error) {
          if (error.name === 'AbortError') break;
          if (error.message.includes('failed')) throw error;
        }
      }
    }
    
    function showResults(outputDir) {
      const files = ['ONBOARDING.md', 'RUNBOOK.md', 'TASKS.md', 'diagram.mmd'];
      const safePath = outputDir.replace(/\\\\/g, '/');
      
      fileList.innerHTML = files.map(file => \`
        <li role="listitem">
          <span class="file-name">📄 \${file}</span>
          <div class="file-actions">
            <button class="icon-btn" onclick="previewFile('\${safePath}/\${file}', '\${file}')" title="Preview">👁️</button>
            <button class="icon-btn" onclick="downloadFile('\${safePath}/\${file}', '\${file}')" title="Download">⬇️</button>
          </div>
        </li>
      \`).join('');
      
      resultsCard.style.display = 'block';
    }
    
    async function previewFile(path, name) {
      try {
        const res = await fetch(\`/api/file?path=\${encodeURIComponent(path)}\`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        currentFileName = name;
        currentFileContent = data.content || '';
        
        modalTitle.textContent = '📄 ' + name;
        modalContent.textContent = currentFileContent;
        openModal();
      } catch (error) {
        showToast('Failed to load: ' + error.message);
      }
    }
    
    async function downloadFile(path, name) {
      try {
        const res = await fetch(\`/api/file?path=\${encodeURIComponent(path)}\`);
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        const blob = new Blob([data.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Downloaded ' + name);
      } catch (error) {
        showToast('Download failed: ' + error.message);
      }
    }
    
    // Modal controls
    closeModalBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentFileContent);
        showToast('Copied to clipboard!');
      } catch {
        showToast('Copy failed');
      }
    });
    
    downloadBtn.addEventListener('click', () => {
      if (!currentFileContent) return;
      const blob = new Blob([currentFileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Downloaded ' + currentFileName);
    });
  </script>
</body>
</html>`;
}

// CLI entry point for starting the server
if (process.argv[1]?.includes('server')) {
  const port = parseInt(process.env.PORT || '3000', 10);
  startServer(port);
}
