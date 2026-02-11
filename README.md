# Repo Onboarding Pack Generator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Foundry Local](https://img.shields.io/badge/Foundry%20Local-Compatible-purple.svg)](https://github.com/microsoft/foundry)
[![Microsoft Foundry](https://img.shields.io/badge/Microsoft%20Foundry-Cloud%20Ready-0078D4.svg)](https://foundry.microsoft.com/)
[![GitHub Copilot](https://img.shields.io/badge/Copilot-Agent%20Skill-orange.svg)](https://github.com/features/copilot)
[![Microsoft Learn MCP](https://img.shields.io/badge/Learn_MCP-Integrated-0078D4?logo=microsoft)](https://github.com/MicrosoftDocs/mcp)

<p align="center">
  <img src="https://img.shields.io/badge/🚀_Hybrid_AI-Documentation_Generator-blueviolet?style=for-the-badge" alt="Hybrid AI Documentation Generator">
</p>

<p align="center">
  <strong>Generate comprehensive onboarding documentation for any repository using hybrid AI</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#web-ui">Web UI</a> •
  <a href="#cli-usage">CLI</a> •
  <a href="#agent-skill">Agent Skill</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Features

Generate comprehensive onboarding documentation for any repository using a hybrid AI approach:
- **Foundry Local** for privacy-sensitive local inference (no data leaves your machine)
- **Microsoft Foundry** for cloud-hosted models with higher quality and faster inference
- **Copilot SDK patterns** for orchestration and multi-step workflows
- **Agent Skills** for reusable, teachable AI behaviors

## Quick Start

```bash
# Install dependencies
npm install

# Run with Foundry Local (privacy-preserving)
npm run onboard -- https://github.com/microsoft/vscode

# Run with Microsoft Foundry (cloud — higher quality)
npm run onboard -- https://github.com/microsoft/vscode \
  --cloud-endpoint https://your-project.services.foundry.microsoft.com \
  --cloud-api-key YOUR_API_KEY \
  --cloud-model gpt-4o-mini
```

## What It Generates

| File | Purpose |
|------|---------|
| `ONBOARDING.md` | Architecture overview, key flows, dependency map |
| `RUNBOOK.md` | Build, run, test commands + troubleshooting |
| `TASKS.md` | 10 starter tasks for new contributors |
| `VALIDATION.md` | Microsoft Learn validation queries & checklist (when MS tech detected) |
| `diagram.mmd` | Mermaid component diagram |

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                     CLI (index.ts)                     │
│              Commander argument parsing                │
└─────────────────────────┬──────────────────────────────┘
                          │
┌─────────────────────────▼──────────────────────────────┐
│                 Orchestrator                            │
│        Copilot SDK-style workflow coordination         │
├────────────────────┬───────────────────────────────────┤
│                    │                                    │
│  ┌─────────────────▼─────────────────┐                 │
│  │         RepoScanner               │                 │
│  │  - Language detection             │                 │
│  │  - Build system analysis          │                 │
│  │  - Dependency extraction          │                 │
│  │  - Structure mapping              │                 │
│  └───────────────────────────────────┘                 │
│                                                         │
│  ┌───────────────────────────────────┐                 │
│  │       LocalModelClient            │                 │
│  │  - Foundry Local API calls        │    ◄───────┐   │
│  │  - Microsoft Foundry (cloud)       │            │   │
│  │  - File summarization             │   Foundry  │   │
│  │  - Architecture analysis          │    Local    │   │
│  │  - Task generation                │      or    │   │
│  └───────────────────────────────────┘    Azure   │   │
│                                           Cloud   │   │
└────────────────────────────────────────────┬──────┘   │
                                             │          │
                          OpenAI-compatible API ────────┘
                          Local: http://localhost:PORT/v1/
                          Cloud: https://<project>.services.foundry.microsoft.com/v1/
```

## Hybrid AI Approach

This tool supports two inference backends — use whichever fits your needs:

### Foundry Local (Privacy-First)

All processing stays on your machine:

- **File summarization**: Analyze source code content locally
- **Config pattern extraction**: Identify configuration without exposing secrets
- **Dependency inventory**: Generate descriptions for packages
- **Architecture inference**: Determine patterns from structure

> Install: `winget install Microsoft.FoundryLocal` — see [Starting Foundry Local](#starting-foundry-local)

### Microsoft Foundry (Cloud)

Higher-quality output using cloud-hosted models:

- **Larger models**: Access GPT-4o, Phi-4, DeepSeek-R1, and more
- **Faster inference**: No GPU required on your machine
- **Same workflow**: Identical 9-step pipeline, just a different backend
- **OpenAI-compatible**: Works with any Microsoft Foundry deployment

> Get started at [foundry.microsoft.com](https://foundry.microsoft.com/) — see [Cloud Usage](#cloud-usage)

### What the Copilot Agent Does

Orchestration and coordination (same for both backends):

- **Workflow planning**: Sequence the analysis steps
- **File operations**: Write generated documentation
- **Command execution**: Run build/test verification
- **Cross-file analysis**: Understand relationships

## GitHub Copilot SDK Integration

This project uses the [`@copilot-extensions/preview-sdk`](https://www.npmjs.com/package/@copilot-extensions/preview-sdk) (v5.0.0) and follows the [GitHub Copilot Extensions](https://docs.github.com/en/copilot/building-copilot-extensions) architecture to function as a reusable AI agent.

### Copilot Tool-Calling Pattern

The orchestrator (`src/orchestrator.ts`) implements the Copilot Extensions **tool-calling pattern** — each capability is defined as a discrete tool with a name, description, typed parameters, and an async handler:

```typescript
// OrchestratorTool interface mirrors the Copilot Extensions tool schema
interface OrchestratorTool {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}
```

Seven tools are registered for the orchestration session:

| Tool | Purpose |
|------|---------|
| `scanRepo` | Scan repository structure, languages, and dependencies |
| `localSummarize` | Summarize a file using the local/cloud model |
| `localAnalyzeArchitecture` | Generate architecture overview from key files |
| `localGenerateTasks` | Create starter tasks for new contributors |
| `localGenerateDiagram` | Generate a Mermaid component diagram |
| `writeDoc` | Write a documentation file to the output directory |
| `runCommand` | Execute a shell command in the repository context |

This mirrors how Copilot Extensions expose capabilities to the LLM — each tool is self-describing and independently invocable, enabling the agent to compose multi-step workflows.

### Agent Skill Structure

The project ships as a set of **GitHub Copilot Agent Skills** in `.github/skills/`. Each skill follows the [Copilot custom instructions format](https://docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot) with YAML frontmatter and trigger phrases:

```yaml
---
name: repo-onboarding-pack
description: Generate comprehensive engineering onboarding documentation...
compatibility: Works with any Git repository...
---
```

Skills are activated by natural-language trigger phrases (e.g., *"Create onboarding pack for this repo"*) and include quality gates, prompt templates, and validation checklists — so Copilot can autonomously generate and verify output.

### Workflow Session

The 9-step generation pipeline runs as a **Copilot SDK-style session** — a stateful sequence of tool invocations with progress tracking, error recovery, and structured output:

1. Check inference endpoint → 2. Scan repo → 3. Analyze files → 4. Architecture → 5. Tasks → 6. Diagram → 7. Compile → 8. Microsoft Learn validation → 9. Write files

Each step reports progress via a callback (`ProgressCallback`), enabling real-time UI updates in both the CLI and web interface.

### Copilot Instructions

The project includes `.github/copilot-instructions.md` which configures GitHub Copilot's behavior when working in this repository — linking to skills, defining workflows, and setting up the Microsoft Learn MCP integration.

## CLI Usage

### Foundry Local (Default)

```bash
# Basic usage
npx onboard <repo>

# Options
npx onboard ./my-project \
  --output ./onboarding-docs \
  --model phi-4 \
  --verbose
```

### Cloud Usage

```bash
# Using Microsoft Foundry cloud models
npx onboard https://github.com/owner/repo \
  --cloud-endpoint https://your-project.services.foundry.microsoft.com \
  --cloud-api-key YOUR_API_KEY \
  --cloud-model gpt-4o-mini \
  --verbose

# Using environment variable for API key
export FOUNDRY_CLOUD_API_KEY=your-key-here
npx onboard https://github.com/owner/repo \
  --cloud-endpoint https://your-project.services.foundry.microsoft.com \
  --cloud-model gpt-4o
```

### Other Commands

```bash
# Check Foundry Local status
npx onboard --check-status

# Skip AI entirely (use fallback generation)
npx onboard ./my-project --skip-local
```

## Web UI

Launch the graphical interface for a browser-based experience:

```bash
# Start the web server
npm run web

# Or with custom port
PORT=8080 npm run web
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `R` | Refresh Foundry status |
| `Esc` | Close preview modal |
| `Ctrl+C` | Copy file content (in modal) |

### Screenshots

**Home — Foundry Local provider with model selection and live status:**

<p align="center">
  <img src="docs/images/web-ui-home.png" alt="Web UI — Foundry Local selected with model dropdown and status panel" width="700">
</p>

**Cloud provider — Microsoft Foundry with endpoint, model, and API key status:**

<p align="center">
  <img src="docs/images/web-ui-cloud.png" alt="Web UI — Microsoft Foundry Cloud provider with gpt-5.2 status" width="700">
</p>

**Form filled — ready to generate onboarding docs for a GitHub repository:**

<p align="center">
  <img src="docs/images/web-ui-form-filled.png" alt="Web UI — form filled with Azure-Samples repo URL and model selected" width="700">
</p>

**Step-by-step progress — real-time tracking of the 10-step generation pipeline:**

<p align="center">
  <img src="docs/images/web-ui-progress.png" alt="Web UI — progress tracker showing steps 1-3 completed, step 4 running" width="700">
</p>

<p align="center">
  <img src="docs/images/web-ui-progress-mid.png" alt="Web UI — mid-progress with 6 steps completed" width="700">
</p>

**Generation complete — all steps done with generated files listed for preview/download:**

<p align="center">
  <img src="docs/images/web-ui-complete.png" alt="Web UI — all 10 steps completed with generated files" width="700">
</p>

**Web UI Features:**
- 🔌 Real-time Foundry Local connection status with model details
- ☁️ Microsoft Foundry cloud support with provider toggle
- 📂 Support for local paths and GitHub URLs
- 🕒 Recent repositories dropdown (stored locally)
- 📊 Step-by-step progress tracking with per-step details and cancel support
- 👁️ Preview generated files with syntax highlighting
- 📋 Copy to clipboard and download buttons
- ⌨️ Keyboard shortcuts (Esc to close, R to refresh)
- ♿ Full accessibility support (ARIA labels, focus management)
- 🌙 Automatic dark mode support

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Output directory | `./docs` in repo |
| `-e, --endpoint <url>` | Foundry Local endpoint | Auto-detected |
| `-m, --model <name>` | Local model to use | `phi-4` |
| `-v, --verbose` | Show detailed progress | `false` |
| `--skip-local` | Skip AI calls (use fallback) | `false` |
| `--check-status` | Check Foundry status and exit | - |
| `--cloud-endpoint <url>` | Microsoft Foundry endpoint URL | - |
| `--cloud-api-key <key>` | Cloud API key | `$FOUNDRY_CLOUD_API_KEY` |
| `--cloud-model <name>` | Cloud model deployment name | `gpt-4o-mini` |

## Example Runs

### Sample Repository

We tested against [Azure-Samples/chat-with-your-data-solution-accelerator](https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator) — a popular RAG pattern accelerator with 1.2k+ stars, Python backend, TypeScript frontend, Bicep infrastructure, and 34+ contributors.

<p align="center">
  <img src="docs/images/sample-repo-github.png" alt="Azure-Samples/chat-with-your-data-solution-accelerator on GitHub" width="700">
</p>

### Foundry Local Output (qwen2.5-1.5b — on-device)

```bash
npm run onboard -- https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator \
  --model qwen2.5-1.5b --output ./docsweblocal
```

| File | Size | Quality |
|------|------|---------|
| ONBOARDING.md | 5.5 KB | Generic monorepo overview, basic component list |
| RUNBOOK.md | 2.4 KB | Standard build/run commands |
| TASKS.md | 2.9 KB | 10 templated tasks (generic — "fix a typo", "add a test") |
| VALIDATION.md | 2.5 KB | Detected TypeScript + Bicep |
| diagram.mmd | 2.0 KB | Component diagram with duplicate edges |

### Microsoft Foundry Output (gpt-5.2 — cloud)

```bash
npm run onboard -- https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator \
  --cloud-endpoint $FOUNDRY_CLOUD_ENDPOINT \
  --cloud-api-key $FOUNDRY_CLOUD_API_KEY \
  --cloud-model gpt-5.2 --output ./docswebcloud
```

| File | Size | Quality |
|------|------|---------|
| ONBOARDING.md | 5.6 KB | Detailed monorepo breakdown: component table, key interactions, file-level references |
| RUNBOOK.md | 2.4 KB | Standard build/run commands |
| TASKS.md | 8.1 KB | 10 repo-specific tasks with exact file paths, acceptance criteria, time estimates |
| VALIDATION.md | 2.5 KB | Same Microsoft tech detection |
| diagram.mmd | 0.8 KB | Clean Mermaid diagram with grouped subgraphs (Dev Environment, Application & Data, Infrastructure) |

### Quality Comparison

The cloud model (gpt-5.2) produced significantly higher-quality output:

- **TASKS.md**: 10 actionable, repo-specific tasks (e.g., "Add a typed wrapper for chat history fetch in `code/frontend/src/api/`") vs generic templates ("Fix a typo or improve documentation")
- **ONBOARDING.md**: Detailed component table mapping directories to purposes, key interaction descriptions with file-level citations
- **diagram.mmd**: Clean subgraph-based Mermaid diagram vs duplicated edge graph

The local model (qwen2.5-1.5b) is ideal for **privacy-sensitive use cases** where no data should leave the machine — it produces usable documentation that can be refined. The cloud model is best when **output quality** is the priority.

### Example 1: Small TypeScript Project

```bash
npm run onboard -- ./my-typescript-app --verbose
```

Output:
```
🚀 Repo Onboarding Pack Generator v1.0.0

[1/9] Checking Foundry Local...
✓ Foundry Local available at http://localhost:5273
  Active model: phi-4

[2/9] Scanning repository...
✓ Found 2 languages
  Primary: TypeScript
  Dependencies: 15

[3/9] Analyzing key files...
  Summarized: src/index.ts
  Summarized: package.json

[4/9] Generating architecture overview...
[5/9] Generating starter tasks...
[6/9] Generating component diagram...
[7/9] Compiling onboarding pack...
[8/9] Validating Microsoft technologies...
  Detected: TypeScript, Azure SDKs
[9/9] Writing output files...
  Written: ONBOARDING.md
  Written: RUNBOOK.md
  Written: TASKS.md
  Written: VALIDATION.md
  Written: diagram.mmd

✓ Onboarding pack generated successfully!
  Output directory: ./my-typescript-app/docs
```

### Example 2: GitHub Repository (Fine-Tuning Project)

```bash
npm run onboard -- https://github.com/microsoft-foundry/fine-tuning --verbose
```

Outputs onboarding documentation for the Microsoft Foundry fine-tuning project.

### Example 3: Express Framework

```bash
npm run onboard -- ./dotnet-console-app --verbose
```

Detects .NET project structure, NuGet dependencies, and generates appropriate runbook commands.

## Agent Skill

This project includes reusable agent skills at `.github/skills/`.

### Available Skills

| Skill | Purpose |
|-------|---------|
| [`repo-onboarding-pack`](.github/skills/repo-onboarding-pack/SKILL.md) | Generate onboarding documentation for repositories |
| [`microsoft-skill-creator`](.github/skills/microsoft-skill-creator/SKILL.md) | Create new agent skills for Microsoft technologies |
| [`microsoft-docs`](.github/skills/microsoft-docs/SKILL.md) | Query Microsoft documentation for concepts & tutorials |
| [`microsoft-code-reference`](.github/skills/microsoft-code-reference/SKILL.md) | API lookups, code samples, error troubleshooting |

### Installing the Skills

1. Copy all skills to your target repo:
   ```bash
   cp -r .github/skills/* /path/to/repo/.github/skills/
   ```

2. The `repo-onboarding-pack` skill triggers on phrases like:
   - "Create onboarding pack for this repo"
   - "Generate runbook for the project"
   - "New engineer onboarding docs"
   - "Help me understand this repo quickly"

### Skill Structure

```
.github/skills/
├── repo-onboarding-pack/
│   ├── SKILL.md                    # Main onboarding skill
│   └── references/
│       ├── checklist.md            # Quality verification
│       ├── mermaid-patterns.md     # Diagram templates
│       └── microsoft-tech-verification.md
├── microsoft-skill-creator/
│   ├── SKILL.md                    # Create skills for Microsoft tech
│   └── references/
│       └── skill-templates.md      # SDK, Azure, Framework, API templates
├── microsoft-docs/
│   └── SKILL.md                    # Microsoft documentation queries
└── microsoft-code-reference/
    └── SKILL.md                    # API/SDK verification
```

## Microsoft Learn MCP Server

This project integrates with the [Microsoft Learn MCP Server](https://github.com/MicrosoftDocs/mcp) for verifying Microsoft technology details.

### Quick Setup

**VS Code (one-click):**

[![Install in VS Code](https://img.shields.io/badge/Install_Microsoft_Learn_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect/mcp/install?name=microsoft-learn&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Flearn.microsoft.com%2Fapi%2Fmcp%22%7D)

**Manual Configuration (`.mcp.json`):**

This project includes a `.mcp.json` file that auto-configures the MCP server:

```json
{
  "mcpServers": {
    "microsoft-learn": {
      "type": "http",
      "url": "https://learn.microsoft.com/api/mcp"
    }
  }
}
```

### MCP Tools Available

| Tool | Use For |
|------|---------|
| `microsoft_docs_search` | Search official documentation |
| `microsoft_docs_fetch` | Get full page content |
| `microsoft_code_sample_search` | Find code examples |

### Example Usage

```
# Search for Azure Functions documentation
microsoft_docs_search(query="azure functions triggers bindings")

# Get full tutorial content
microsoft_docs_fetch(url="https://learn.microsoft.com/azure/azure-functions/...")

# Find code samples in specific language
microsoft_code_sample_search(query="semantic kernel", language="csharp")
```

See [microsoft-tech-verification.md](.github/skills/repo-onboarding-pack/references/microsoft-tech-verification.md) for detailed guidance.

## Development

### Prerequisites

- Node.js 20+
- **Foundry Local** (for local inference) or **Microsoft Foundry** account (for cloud inference)

### Setup

Use the automated setup script to verify prerequisites, install dependencies, and configure your environment:

```bash
# Windows (PowerShell)
.\setup.ps1

# Linux / macOS
chmod +x setup.sh && ./setup.sh

# Or via npm (auto-detects OS)
npm run setup
```

The setup script checks Node.js 20+, Git, installs npm packages, verifies TypeScript compilation, creates `.env` from `.env.example`, checks Foundry Local status, and validates cloud configuration.

Alternatively, set up manually:

```bash
# Clone
git clone <repo-url>
cd repo-onboarding-pack

# Install
npm install

# Build
npm run build

# Run in dev mode
npm run dev -- --help
```

### Starting Foundry Local

```bash
# Install Foundry Local
winget install Microsoft.FoundryLocal

# Start the server
foundry service start

# Check status (shows dynamic port)
foundry service status

# Verify API (port is auto-discovered)
curl http://127.0.0.1:<port>/v1/models
```

> **Note:** Foundry Local uses dynamic ports. This tool auto-discovers the port via `foundry service status`. Model aliases (e.g., `phi-4`) are automatically resolved to full model IDs (e.g., `Phi-4-cuda-gpu:1`).

### Setting Up Microsoft Foundry (Cloud)

1. Go to [foundry.microsoft.com](https://foundry.microsoft.com/) and create a project
2. Deploy a model (e.g., `gpt-4o-mini`, `Phi-4`, `DeepSeek-R1`)
3. Copy the **endpoint URL** and **API key** from the deployment page
4. Use them with the `--cloud-endpoint` and `--cloud-api-key` flags:

```bash
npx onboard https://github.com/owner/repo \
  --cloud-endpoint https://your-project.services.foundry.microsoft.com \
  --cloud-api-key YOUR_KEY \
  --cloud-model gpt-4o-mini
```

Alternatively, set the API key as an environment variable:

```bash
# Windows
set FOUNDRY_CLOUD_API_KEY=your-key-here

# Linux/macOS
export FOUNDRY_CLOUD_API_KEY=your-key-here
```

### Project Structure

```
src/
├── index.ts          # CLI entry point
├── server.ts         # Web UI server
├── orchestrator.ts   # Workflow coordination
├── localModelClient.ts  # Foundry Local interface
├── repoScanner.ts    # Repository analysis
├── validation.ts     # Security input validation
└── types.ts          # TypeScript interfaces
```

## Configuration

### Environment Variables

```bash
# .env

# Foundry Local settings
FOUNDRY_LOCAL_ENDPOINT=http://localhost:5273
FOUNDRY_LOCAL_MODEL=phi-4
OUTPUT_DIR=./docs

# Microsoft Foundry cloud settings
FOUNDRY_CLOUD_ENDPOINT=https://your-project.services.foundry.microsoft.com
FOUNDRY_CLOUD_API_KEY=your-api-key-here
FOUNDRY_CLOUD_MODEL=gpt-4o-mini
```

### Copilot Instructions

Add to `.github/copilot-instructions.md`:

```markdown
## Onboarding Documentation

When asked to create onboarding documentation:
1. Use the repo-onboarding-pack skill
2. Verify Microsoft tech details via Learn MCP tools
3. Follow the quality checklist before completing
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Check [TASKS.md](docs/demos/docswebcloud/TASKS.md) for example starter tasks generated by the tool.

## Security

Please report security vulnerabilities according to our [Security Policy](SECURITY.md).

## License

This project is licensed under the [MIT License](LICENSE).
