# Building a Hybrid AI Onboarding Pack Generator with Foundry Local, Microsoft Foundry, and GitHub Copilot SDK

*How we used three AI backends   on-device, cloud, and Copilot SDK   to automatically generate engineering onboarding documentation for any GitHub repository, and what we learned about model quality along the way.*

---

## The Problem: Onboarding Is Slow

Every engineering team knows the pain: a new developer joins, gets pointed at a repository, and spends days, sometimes weeks, piecing together how the codebase works. Where's the entry point? How do I build this? What should I work on first?

Documentation exists in theory. In practice, it's scattered across READMEs that haven't been updated, Confluence pages nobody maintains, and tribal knowledge locked in Slack or Teams threads.

**What if an AI agent could analyze any repository and generate a complete onboarding pack in minutes?**

That's what we built.

## The Solution: Repo Onboarding Pack Generator

The [Repo Onboarding Pack Generator](https://github.com/leestott/learnskill-agent-foundrylocal) is an open-source tool that analyzes any GitHub repository and produces six files:

| File | What It Contains |
|------|-----------------|
| **ONBOARDING.md** | Architecture overview, component map, key flows, dependency inventory, instructor section with learning outcomes |
| **RUNBOOK.md** | Build, run, test, and deploy commands with troubleshooting |
| **TASKS.md** | 10 starter tasks with acceptance criteria, hints, and learning objectives |
| **AGENTS.md** | Agent skills, MCP servers, workflows (incl. code-review), and GitHub Copilot usage guide |
| **VALIDATION.md** | Microsoft Learn validation queries for detected technologies |
| **diagram.mmd** | Mermaid component diagram showing system relationships |

It runs as a **CLI tool** or through a **web UI**, and supports three AI backends:

- **Foundry Local**   fully on-device inference, no data leaves your machine
- **Microsoft Foundry**   cloud-hosted models for higher quality output
- **GitHub Copilot SDK**   agentic workflows using [`@github/copilot-sdk`](https://github.com/github/copilot-sdk) (v0.1.23)

## How It Works: A 9-Step Pipeline

The generator follows a structured pipeline, visible in real-time through the web UI's step tracker:

1. **Check AI provider**   connect to Foundry Local, Microsoft Foundry cloud, or GitHub Copilot SDK
2. **Scan repository**   detect languages, dependencies, build systems, project structure
3. **Analyze key files**   LLM summarizes important source files (entry points, configs, READMEs)
4. **Generate architecture overview**   LLM produces the ONBOARDING.md content
5. **Generate starter tasks**   LLM creates 10 difficulty-graded tasks with learning objectives
6. **Generate component diagram**   LLM outputs a Mermaid diagram
7. **Compile onboarding pack**   assemble all sections into final documents
8. **Validate Microsoft technologies**   detect Azure, .NET, TypeScript etc. and generate Learn MCP queries
9. **Write output files**   save ONBOARDING.md, RUNBOOK.md, TASKS.md, AGENTS.md, diagram.mmd, and VALIDATION.md

## The Web UI in Action

We built a browser-based interface that makes the tool accessible to anyone, no terminal required.

### Choosing Your AI Provider

The home screen lets you pick between Foundry Local (on-device), Microsoft Foundry (cloud), or GitHub Copilot SDK. The status panel shows real-time connection info, which model is loaded, the endpoint URL, and whether the service is online.

**Foundry Local   privacy-first, on-device inference:**

![Web UI home with Foundry Local selected](docs/images/web-ui-home.png)

With Foundry Local, you get a dropdown of all cached models (18+ models available including Phi-4, Qwen 2.5, DeepSeek-R1, and Llama variants). Everything runs on your GPU   no API keys, no cloud, no data exfiltration risk.

**Microsoft Foundry   cloud-hosted, higher quality:**

![Web UI with Microsoft Foundry Cloud selected](docs/images/web-ui-cloud.png)

Switch to cloud mode and the UI shows your Microsoft Foundry endpoint status, configured model (here, gpt-5.2), and API key status. Cloud settings are loaded from environment variables, no secrets in the UI.

### Generating Documentation

Fill in the form, paste a GitHub URL, pick your model, set an output directory, and hit Generate:

![Web UI form filled with Azure-Samples repo](docs/images/web-ui-form-filled.png)

### Real-Time Progress Tracking

The step tracker shows exactly what's happening at each stage, with per-step details like "Found 6 languages, 0 deps   primary: Python" and file-by-file analysis progress:

![Progress tracker   early steps](docs/images/web-ui-progress.png)

Each step transitions through pending → running (with spinner) → completed (green checkmark), giving you full visibility into the 9-step pipeline:

![Progress tracker   mid-generation](docs/images/web-ui-progress-mid.png)

### Generation Complete

When all 9 steps finish, you get a success summary and can preview or download each generated file directly from the browser:

![All steps completed with generated files](docs/images/web-ui-complete.png)

## Testing Against a Real Repository

We tested the tool against [Azure-Samples/chat-with-your-data-solution-accelerator](https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator)   a popular RAG pattern accelerator with **1,200+ stars**, **620+ forks**, and **34 contributors**. It's a non-trivial monorepo with a Python backend, TypeScript frontend, Azure Functions for batch processing, Bicep infrastructure-as-code, Docker support, and comprehensive test suites.

![Azure-Samples repo on GitHub](docs/images/sample-repo-github.png)

This is exactly the kind of repo where a new engineer would struggle to get oriented quickly.

## Three Providers, One Pipeline: A Quality Comparison

We ran the generator **four times** against the same repository   once per provider/interface combination   to compare output quality, size, and content.

| Run | Interface | Provider | Model |
|-----|-----------|----------|-------|
| docscli-local | CLI | Foundry Local | qwen2.5-coder-1.5b |
| docsweblocal | Web UI | Foundry Local | qwen2.5-coder-1.5b |
| docswebcloud | Web UI | Microsoft Foundry | gpt-5.2 |
| docswebgithub | Web UI | GitHub Copilot SDK | Copilot model |

### Output Size Comparison

File sizes in **bytes**   larger LLM-generated files generally indicate richer, more detailed content.

| File | Local (1.5B) | Cloud (gpt-5.2) | Copilot SDK |
|------|-------------:|----------------:|------------:|
| ONBOARDING.md | 3,937 | **6,020** | **6,874** |
| RUNBOOK.md | 2,358 | 2,358 | 2,358 |
| TASKS.md | 8,158 | **10,078** | **9,714** |
| AGENTS.md | 2,323 | 2,323 | 2,323 |
| diagram.mmd | 285 | 733 | **1,393** |
| VALIDATION.md | 2,549 | 2,549 | 2,549 |
| **Total** | **19,610** | **24,061** | **25,211** |

RUNBOOK.md, AGENTS.md, and VALIDATION.md are identical across all providers   they are generated deterministically from repo metadata, not by the LLM. The real quality differences show in ONBOARDING.md, TASKS.md, and diagram.mmd, where cloud and Copilot SDK produce **23–29% more content**.

### Where Quality Diverged

The biggest differences appeared in architecture recognition, starter tasks, and diagrams.

#### Architecture Recognition

Each provider classified the same monorepo differently:

**Foundry Local (1.5B)** called it monolithic:
> *"The project is structured as a monolithic application, where all components are tightly coupled and reside in a single codebase."*

**Microsoft Foundry (gpt-5.2)** identified it as a monorepo with deployable parts:
> *"This project is a single repository that contains multiple deployable parts: a Python backend (including an Azure Functions batch/ingestion workload and an admin UI), a separate TypeScript/Vite frontend web app, and an optional Microsoft Teams extension."*

**GitHub Copilot SDK** went deepest with an Azure-native RAG classification:
> *"This is an Azure-native RAG (Retrieval Augmented Generation) solution accelerator using a serverless architecture. The system enables conversational search over user documents by combining Azure OpenAI for LLM capabilities with Azure AI Search for vector retrieval."*

#### Starter Tasks

Every provider generated 10 tasks with learning objectives. The depth difference is dramatic.

**Local model** tasks are generic templates anyone could have written:
> *"🟢 Task 1: Review Code Structure"*
> Criteria: "Know the location of the `api`, `database`, and `orchestrator` directories"

The local model also produced parsing artifacts   field labels bled into content.

**Cloud model** tasks reference exact files and real workflows:
> *"🟢 Task 1: Trace the Chat Request Path (Frontend → Backend)"*
> *Learning: Code navigation in a monorepo; understanding API boundaries between TypeScript frontend and Python backend*
> Hints: "Search for the chat endpoint path in `code/frontend/src/api/*`"

**Copilot SDK** tasks tie to real engineering concepts:
> *"🟢 Task 1: Explore the RAG Architecture Documentation"*
> *Learning: Understanding RAG (Retrieval Augmented Generation) patterns and Azure service integration*
> Related files: `README.md`, `docs/integrated_vectorization.md`, `docs/conversation_flow_options.md`

#### Component Diagrams

| Provider | Nodes | Subgraphs | Edge Labels | Size |
|----------|------:|----------:|:-----------:|-----:|
| Foundry Local | 10 | 0 | No | 285 bytes |
| Microsoft Foundry | 12 | 3 | No | 733 bytes |
| GitHub Copilot SDK | 14 | 5 | Yes | 1,393 bytes |

The local model produced a flat graph with raw directory names. The cloud model added meaningful subgraphs. Copilot SDK produced the richest diagram with labeled edges and component-level detail including a "User Interface Layer" subgraph with React Chat UI, Streamlit Admin, and Teams Bot components.

### The Takeaway

| Aspect | Foundry Local | Microsoft Foundry | GitHub Copilot SDK |
|--------|:------------:|:----------------:|:------------------:|
| **Privacy** | ✅ No data leaves machine | ❌ Cloud | ❌ Cloud |
| **Cost** | ✅ Free (GPU required) | 💰 Pay-per-token | Copilot subscription |
| **Architecture accuracy** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Task specificity** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Diagram quality** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Parsing cleanliness** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Setup** | `winget install` | API key | `npm i -g @github/copilot` |

**Use Foundry Local** for proprietary codebases where data cannot leave the machine, or for quick drafts to refine manually.

**Use Microsoft Foundry** when output quality matters   onboarding packs for open-source projects, team documentation, or generating contributor guides.

**Use GitHub Copilot SDK** when you have a Copilot subscription and want the highest-quality output with no API key management   especially for students with GitHub Education access.

## Technical Implementation Highlights

### Architecture

The project has 8 source files in `src/`:

| File | Role |
|------|------|
| `index.ts` | CLI entry point   Commander argument parsing |
| `server.ts` | Web UI   HTTP server with SSE progress streaming |
| `orchestrator.ts` | 9-step generation pipeline with tool-calling pattern |
| `localModelClient.ts` | LLM client for Foundry Local and Microsoft Foundry (OpenAI-compatible) |
| `copilotSdkClient.ts` | LLM client for GitHub Copilot SDK (`@github/copilot-sdk` v0.1.23) |
| `repoScanner.ts` | Repository analysis   languages, deps, build systems, structure |
| `types.ts` | Shared TypeScript interfaces |
| `validation.ts` | Input validation and security checks |

### Hybrid AI Client

The `LocalModelClient` class abstracts both Foundry backends behind a single OpenAI-compatible interface:

```typescript
// Both backends use the same OpenAI SDK   just different endpoints
const client = new OpenAI({
  baseURL: isCloud
    ? `${cloudEndpoint}/openai/deployments/${cloudModel}`
    : `${localEndpoint}/v1`,
  apiKey: isCloud ? cloudApiKey : "foundry-local",
});
```

The `CopilotSdkClient` wraps `@github/copilot-sdk` for agentic workflows:

```typescript
// Session-based conversations with the Copilot CLI
import { CopilotClient, type CopilotSession } from '@github/copilot-sdk';

const client = new CopilotClient();
const session = await client.createSession({ model: 'claude-sonnet-4' });
const response = await session.sendAndWait(prompt);
```

Foundry Local auto-discovers its dynamic port via `foundry service status`, cloud endpoints come from environment variables, and the Copilot SDK communicates via JSON-RPC with the Copilot CLI.

### Step-by-Step Progress Tracking

The web UI uses Server-Sent Events (SSE) to stream progress from the 9-step pipeline. Each step reports its status (pending → running → completed) with human-readable detail messages:

```
Step 3: Scanning repository...
  → Found 6 languages, 0 deps   primary: Python
Step 4: Analyzing key files...
  → Summarizing file 3/6: code/app.py
```

### Microsoft Learn Integration

When the scanner detects Microsoft technologies (TypeScript, Bicep, Azure SDKs, .NET), the generator produces a VALIDATION.md file with [Microsoft Learn MCP Server](https://github.com/MicrosoftDocs/mcp) queries:

```
microsoft_docs_search(query="Bicep overview Azure resource deployment")
microsoft_docs_search(query="TypeScript configuration tsconfig")
```

These let teams verify the generated documentation against official Microsoft sources.

## Build Something Like This

This project demonstrates several patterns you can reuse:

1. **Hybrid local/cloud/SDK AI**   Use Foundry Local for privacy, cloud for quality, Copilot SDK for agentic workflows   same pipeline for all three
2. **Structured multi-step pipelines**   Break complex AI tasks into discrete steps with progress tracking
3. **Repository analysis**   Scan codebases for languages, dependencies, patterns, and structure
4. **SSE-based progress streaming**   Keep users informed during long-running AI workflows
5. **Agent Skills**   Package AI behaviors as reusable skills that Copilot agents can invoke
6. **Tool-calling pattern**   Define orchestrator tools (`scanRepo`, `localSummarize`, `writeDoc`, etc.) mirroring the Copilot Extensions schema

### Getting Started

```bash
# Clone the project
git clone https://github.com/leestott/learnskill-agent-foundrylocal
cd learnskill-agent-foundrylocal

# Install dependencies
npm install

# Run the web UI
npm run web
# Open http://localhost:3000

# Or use the CLI
npm run onboard -- https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator
```

### Prerequisites

- **Node.js 20+**
- **Foundry Local**   `winget install Microsoft.FoundryLocal` (for on-device inference)
- **Microsoft Foundry account**   [ai.azure.com](https://ai.azure.com/) (for cloud inference)
- **GitHub Copilot CLI**   `npm install -g @github/copilot` (for Copilot SDK mode)

### Try It on Your Own Repos

The best way to evaluate the tool is to run it against a repository you know well. You'll immediately see where the AI gets it right and where it needs refinement   and you can compare all three providers for your specific codebase.

```bash
# Your repo, local model
npm run onboard -- https://github.com/your-org/your-repo --model phi-4

# Your repo, cloud model
npm run onboard -- https://github.com/your-org/your-repo \
  --cloud-endpoint $FOUNDRY_CLOUD_ENDPOINT \
  --cloud-api-key $FOUNDRY_CLOUD_API_KEY \
  --cloud-model gpt-4o-mini

# Your repo, Copilot SDK
npm run onboard -- https://github.com/your-org/your-repo --copilot-sdk
```

---

*The Repo Onboarding Pack Generator is open-source under the MIT License. Contributions welcome   check [TASKS.md](docs/demos/docswebcloud/TASKS.md) for example starter issues.*

*Built with [Foundry Local](https://github.com/microsoft/foundry), [Microsoft Foundry](https://ai.azure.com/), the [GitHub Copilot SDK](https://github.com/github/copilot-sdk), the [OpenAI SDK](https://github.com/openai/openai-node), and the [Microsoft Learn MCP Server](https://github.com/MicrosoftDocs/mcp).*
