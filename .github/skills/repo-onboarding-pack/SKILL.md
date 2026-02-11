---
name: repo-onboarding-pack
description: Generate comprehensive engineering onboarding documentation for any repository. Use when users want to create onboarding materials, runbooks, starter tasks, architecture docs, or help new engineers understand a codebase quickly. Analyzes repo structure, dependencies, build systems, and generates actionable documentation.
compatibility: Works with any Git repository. Enhanced with Foundry Local for privacy-sensitive analysis. Uses Microsoft Learn MCP Server (https://learn.microsoft.com/api/mcp) for Microsoft technology verification.
---

# Repo Onboarding Pack Generator

Create comprehensive onboarding documentation that helps engineers get productive in any codebase quickly.

## Prerequisites

### Model Size Requirements

The quality of generated documentation depends heavily on model capability. Small models (< 3B parameters) produce incomplete, hallucinated, or truncated output.

| Model Size | Quality | Recommended |
|------------|---------|-------------|
| < 3B params (e.g. qwen2.5-1.5b) | **Poor** — truncation, hallucination, incomplete sections | No |
| 7-14B params (e.g. phi-4, deepseek-r1-14b) | **Good** — structured output, complete sections | **Yes** |
| 20B+ params (e.g. gpt-oss-20b) | **Best** — detailed, accurate, well-organized | Yes (if GPU available) |

**Minimum recommended model: phi-4 (14B) or equivalent.**

### Microsoft Learn MCP Server (Recommended)

This skill uses the Microsoft Learn MCP Server to verify Microsoft technology details. Install it:

**VS Code (one-click):**
[![Install in VS Code](https://img.shields.io/badge/Install_in-VS_Code-0098FF?style=flat-square&logo=visualstudiocode)](https://vscode.dev/redirect/mcp/install?name=microsoft-learn&config=%7B%22type%22%3A%22http%22%2C%22url%22%3A%22https%3A%2F%2Flearn.microsoft.com%2Fapi%2Fmcp%22%7D)

**Manual config** (`.mcp.json` in project root):
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

### Related Skills

Install these companion skills for best results:
- **[repo-agents-pack](../repo-agents-pack/SKILL.md)** — AGENTS.md generation guidance (skills, MCP servers, workflows)
- **[microsoft-docs](../microsoft-docs/SKILL.md)** — Concept lookups, tutorials, architecture guides
- **[microsoft-code-reference](../microsoft-code-reference/SKILL.md)** — API verification, code samples, error troubleshooting
- **[microsoft-skill-creator](../microsoft-skill-creator/SKILL.md)** — Create new skills for Microsoft technologies found in scanned repos

## Trigger Phrases

This skill activates when users say things like:
- "Create onboarding pack for this repo"
- "Generate runbook for the project"
- "New engineer onboarding docs"
- "Help me understand this repo quickly"
- "Create architecture documentation"
- "Generate starter tasks for new contributors"
- "Analyze this codebase structure"

## What This Skill Generates

| Document | Purpose | Minimum Content |
|----------|---------|-----------------|
| `ONBOARDING.md` | Architecture overview, key flows, dependency map | 5 sections, 200+ words |
| `RUNBOOK.md` | How to build, run, test + troubleshooting | All prerequisites detected, working commands |
| `TASKS.md` | 10 starter tasks with acceptance criteria and learning objectives | Exactly 10 tasks, 3 easy / 4 medium / 3 hard |
| `AGENTS.md` | Agent skills, MCP servers, workflows, Copilot usage guide | 1+ skill per language, microsoft-learn MCP, 1+ workflow |
| `diagram.mmd` | Mermaid component diagram | 8+ nodes, valid Mermaid syntax only |
| `VALIDATION.md` | Microsoft Learn technology validation report | Auto-generated when MS tech detected |

## Workflow

### Step 1: Scan Repository

Analyze the repository to understand:
- Programming languages used (ALL detected languages must appear in prerequisites)
- Build system (npm, dotnet, cargo, pip, etc.)
- Configuration files and patterns
- Directory structure (top-level directories become diagram components)
- Dependencies (production deps listed in ONBOARDING.md)
- Entry points (notebooks, main scripts, function apps)
- Test frameworks

### Step 2: Analyze Architecture (Local)

Use **Foundry Local** for privacy-sensitive analysis:
- Summarize key files without sending to cloud
- Extract config patterns (no secrets leaked)
- Generate dependency inventory
- Identify architecture patterns

```
# Foundry Local keeps analysis private
POST http://localhost:5273/v1/chat/completions
```

**Small Model Strategy:** When using models < 7B parameters, break the generation into separate focused requests per section rather than asking for all content in one prompt. Each request should target a single section with a strict output format.

### Step 3: Generate Documentation

Create each document with specific, actionable content. All generated content must pass the quality gates below.

#### ONBOARDING.md — Required Sections

Each section is **mandatory** and must contain repo-specific content (not generic placeholders).

| Section | Required Content | Quality Gate |
|---------|-----------------|--------------|
| **Overview** | What the project does, primary language, tech stack, dependency count | Must name actual technologies from scan |
| **Getting Started** | Copy-paste-ready setup commands for detected build system | Commands must match detected package manager |
| **Architecture** | Pattern name (monolith/microservices/notebooks/etc.), component list, interactions | Must reference actual directories from scan |
| **Key Flows** | Data flow, build flow, test flow with involved files | File paths must exist in repo |
| **Component Diagram** | Embedded Mermaid diagram | Must render without errors |
| **Key Dependencies** | Table of top production dependencies with purpose | Package names must match scanned deps |

**Output Template:**
```markdown
# {projectName} - Onboarding Guide

## Overview
{projectName} is a {primaryLanguage} project that {one-sentence-purpose}.
Languages: {langList}. Dependencies: {depCount}. Test frameworks: {testFrameworks}.

## Getting Started
1. Clone: `git clone {repoUrl}`
2. Install: `{installCommand}`
3. Run: `{runCommand}`

## Architecture
### Pattern: {patternName}
{2-3 paragraphs describing actual structure, referencing real directories}

### Components
| Component | Directory | Purpose |
|-----------|-----------|---------|
| {name} | {dir/} | {what it does} |

## Key Flows
### {flowName}
{description}
Steps: 1. ... 2. ... 3. ...
Files: `{file1}`, `{file2}`

## Component Diagram
```mermaid
{diagram — valid Mermaid only, NO prose text}
```

## Key Dependencies
| Package | Purpose | Version |
|---------|---------|---------|
```

#### RUNBOOK.md — Required Sections

| Section | Required Content | Quality Gate |
|---------|-----------------|--------------|
| **Prerequisites** | ALL detected languages/runtimes with install + verify commands | Every scanned language must have an entry |
| **Setup** | Numbered steps: clone, install deps, configure env | Must use detected package manager commands |
| **Build** | Actual build command from detected scripts | Must not say "Check project documentation" |
| **Run** | Actual run/start command | Must not say "Check project documentation" |
| **Test** | Actual test command or explicit "No tests detected" | Must match detected test framework |
| **Troubleshooting** | 3+ issues specific to detected tech stack | Must reference actual tools/frameworks |
| **Common Commands** | Table of available scripts/commands | Must list real scripts from build file |

**Fallback Rule:** When no build system is detected, the runbook MUST still list:
- All detected languages as prerequisites (e.g., Python 3.10+ for .py files)
- Notebook execution commands if .ipynb files are present (e.g., `jupyter notebook`)
- Azure CLI if Bicep/ARM files are present (e.g., `az deployment group create`)
- Any tooling implied by config files (e.g., `requirements.txt` → pip)

**Output Template:**
```markdown
# Runbook

## Prerequisites
### {Language/Tool}
{description}
**Install:** `{installCommand}`
**Verify:** `{verifyCommand}`

## Setup
### 1. Clone the repository
```bash
git clone {repoUrl}
cd {repoName}
```
### 2. Install dependencies
```bash
{installCommand}
```
### 3. Configure environment
```bash
{envSetupCommands}
```

## Build
{description}
```bash
{buildCommand}
```

## Run
{description}
```bash
{runCommand}
```

## Test
{description}
```bash
{testCommand}
```

## Troubleshooting
### Problem: {specific problem for detected stack}
**Solution:** {actionable fix}
```bash
{commands}
```

## Common Commands
| Command | Description |
|---------|-------------|
| `{cmd}` | {what it does} |
```

#### TASKS.md — Required Format

Each task MUST follow this exact structure. The LLM must generate all 10 tasks.

| Requirement | Specification |
|-------------|---------------|
| Total tasks | Exactly 10 |
| Difficulty split | Tasks 1-3: easy, Tasks 4-7: medium, Tasks 8-10: hard |
| Acceptance criteria | 2-3 specific, testable criteria per task |
| Learning objective | One sentence describing what the student will learn |
| Hints | 1-2 actionable hints referencing real files/patterns |
| Related files | At least 1 real file path from the scanned repo |
| Skills | 1-3 skill tags (e.g., documentation, testing, python, azure) |

**Output Template (per task):**
```markdown
## {emoji} Task {N}: {Specific Title}
**Difficulty:** {easy|medium|hard} | **Time:** {estimate}

{2-3 sentence description of what to do, referencing actual repo files}

### 🎯 Learning Objective
{One sentence: what skill or concept the student gains by completing this task}

### Acceptance Criteria
- [ ] {Specific testable criterion 1}
- [ ] {Specific testable criterion 2}
- [ ] {Specific testable criterion 3}

### Hints
- Look at `{real/file/path}` for {specific guidance}
- {Second actionable hint}

### Related Files
- `{real/file/path1}`
- `{real/file/path2}`

**Skills:** `{skill1}`, `{skill2}`

---
```

**Task Generation Prompt Strategy:**
To prevent truncation, generate tasks in two batches:
- Batch 1: Tasks 1-5 (easy + start of medium)
- Batch 2: Tasks 6-10 (rest of medium + hard)

Each batch should be a separate LLM call with `max_tokens: 2048`.

#### diagram.mmd — Required Format

The diagram file must contain **ONLY valid Mermaid syntax**. No prose, no explanations, no markdown fences.

| Requirement | Specification |
|-------------|---------------|
| Diagram type | `graph TD` (top-down flowchart) |
| Minimum nodes | 8 |
| Maximum nodes | 20 |
| Subgraphs | At least 2 logical groupings |
| Node IDs | Meaningful names (e.g., `DataPipeline` not `A1`) |
| Labels | Short, descriptive (e.g., `[Data Pipeline]` not `[data]`) |
| Prose text | **FORBIDDEN** — strip any non-Mermaid text |

**Post-generation validation:**
1. Strip everything outside the Mermaid syntax (markdown fences, explanatory text)
2. Verify output starts with `graph TD` or `flowchart TD`
3. Count nodes — if < 8, regenerate using fallback with scanned directory structure
4. Test render at https://mermaid.live or equivalent

**Output Template:**
```
graph TD
    subgraph {GroupName1}
        {NodeId1}[{Label1}]
        {NodeId2}[{Label2}]
    end

    subgraph {GroupName2}
        {NodeId3}[{Label3}]
        {NodeId4}[{Label4}]
    end

    {NodeId1} --> {NodeId3}
    {NodeId2} --> {NodeId4}
```

### Step 4: Post-Generation Validation

After generating all files, run these automated checks:

| Check | Action on Failure |
|-------|-------------------|
| TASKS.md has < 10 tasks | Use fallback tasks from orchestrator |
| diagram.mmd contains non-Mermaid text | Strip all lines not matching Mermaid syntax |
| diagram.mmd has < 8 nodes | Regenerate from scanned directory structure |
| RUNBOOK.md prerequisites missing detected languages | Add missing prerequisites from scan data |
| ONBOARDING.md architecture says "Monolithic" for notebook-heavy repos | Reclassify as "Notebook/Script Collection" |
| Any section contains "Check project documentation" | Replace with best-effort command from scan data |

### Step 5: Verify Microsoft Technologies

When the repository uses Microsoft technologies, the generator automatically:

1. **Detects Microsoft technologies** from dependencies, languages, and config files
2. **Generates Learn MCP validation queries** for each detected technology
3. **Appends references** to ONBOARDING.md and RUNBOOK.md
4. **Creates VALIDATION.md** with a full verification report and checklist

| Technology | Detection Method | Validation |
|------------|-----------------|------------|
| Azure SDKs (JS/TS) | `@azure/*` npm packages | `microsoft_docs_search(query="{package} getting started")` |
| Azure SDKs (.NET) | `Azure.*` NuGet packages | `microsoft_docs_search(query="{package} getting started")` |
| .NET / C# / F# | `.csproj`/`.fsproj` files, language detection | `microsoft_docs_search(query=".NET getting started")` |
| ASP.NET Core | `Microsoft.AspNetCore.*` packages | `microsoft_docs_search(query="ASP.NET Core tutorial")` |
| Azure Functions | `host.json`, function dependencies | `microsoft_docs_search(query="Azure Functions triggers bindings")` |
| Bicep / ARM | `.bicep` files, `azuredeploy.json` | `microsoft_docs_search(query="Bicep overview")` |
| Semantic Kernel | `Microsoft.SemanticKernel` / `semantic-kernel` | `microsoft_docs_search(query="Semantic Kernel plugins")` |
| Azure OpenAI | `@azure/openai` packages | `microsoft_docs_search(query="Azure OpenAI getting started")` |
| Microsoft Graph | `Microsoft.Graph` / `@microsoft/microsoft-graph` | `microsoft_docs_search(query="Microsoft Graph API")` |
| VS Code Extensions | `@types/vscode`, extension manifest | `microsoft_docs_search(query="VS Code extension API")` |
| Entity Framework | `Microsoft.EntityFrameworkCore` | `microsoft_docs_search(query="EF Core getting started")` |
| TypeScript | `.ts` files detected | `microsoft_docs_search(query="TypeScript configuration")` |

#### Creating New Skills for Detected Technologies

When the microsoft-skill-creator skill is available, agents can create dedicated skills for any Microsoft technology found in a repository:

```
# After detecting Semantic Kernel in a repo:
1. Use microsoft-skill-creator to investigate the technology
2. Generate a specialized skill following the appropriate template
3. Store the skill in .github/skills/ for future agent use
```

See [microsoft-skill-creator](../microsoft-skill-creator/SKILL.md) for the full creation workflow.

See [microsoft-tech-verification.md](references/microsoft-tech-verification.md) for detailed guidance.

## Hybrid AI Architecture

This skill uses a **hybrid approach** for optimal results:

### Foundry Local (Privacy-Sensitive)
- File content summarization
- Config/secrets pattern detection
- Dependency analysis
- Architecture inference

### Copilot SDK (Orchestration)
- Multi-step workflow coordination
- File editing and creation
- Command execution
- Cross-file analysis

```
┌─────────────────────────────────────────────────┐
│                  Orchestrator                    │
│            (Copilot SDK Session)                │
├─────────────────────────────────────────────────┤
│                                                  │
│    ┌──────────────┐     ┌──────────────┐        │
│    │ Foundry Local│     │  Cloud APIs  │        │
│    │   (Private)  │     │  (if needed) │        │
│    └──────────────┘     └──────────────┘        │
│          │                     │                 │
│    • Summarization       • MCP Doc Lookup       │
│    • Config Extraction   • Code Samples         │
│    • Dependency Map      • Best Practices       │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Prompt Engineering Guidelines

### System Prompts

All LLM prompts must include these constraints:

1. **Structural enforcement:** Tell the model the exact sections and format expected. Never ask for open-ended text.
2. **Length budgets:** Specify `max_tokens` per section to prevent truncation:
   - File summaries: 256 tokens
   - Architecture overview: 1024 tokens
   - Tasks (per batch of 5): 2048 tokens
   - Diagram: 512 tokens
3. **Anti-hallucination:** Include scanned repo data (directory names, file names, language stats) in the prompt so the model grounds its output in facts.
4. **Output-only instructions:** Tell the model "Output ONLY the requested format. Do not add explanations, commentary, or notes outside the format."

### Architecture Prompt Template

```
You are a software architect. Based on the directory structure and file summaries below, 
describe the architecture of this project.

RULES:
- Only reference directories and files that appear in the data below
- Classify the architecture pattern as one of: Monolith, Microservices, Monorepo, 
  Notebook/Script Collection, Serverless, CLI Tool, Library/SDK, Plugin/Extension
- List each top-level directory as a component with a one-line purpose
- Describe 2-3 key interactions between components
- Do NOT fabricate components, APIs, or features not evidenced in the data

Directory Structure:
{structureTree}

Key File Summaries:
{summariesText}

Output format:
### Pattern: {pattern name}
{2-3 paragraphs}

### Components
| Component | Directory | Purpose |
|-----------|-----------|---------|
```

### Tasks Prompt Template

```
You are a senior engineer creating onboarding tasks for new contributors.

PROJECT: {repoName}
LANGUAGES: {langList}
DIRECTORIES: {topDirs}
KEY FILES: {keyFiles}

Generate exactly {count} tasks in this EXACT format (no other text):

1. {Title}
Description: {What to do, referencing real files from the list above}
Difficulty: {easy|medium|hard}
Time: {estimate}
Criteria: {criterion1}; {criterion2}; {criterion3}
Hints: {hint1}; {hint2}
Files: {file1}, {file2}
Skills: {skill1}, {skill2}

2. {Title}
...
```

### Diagram Prompt Template

```
Generate a Mermaid flowchart diagram for this project. Output ONLY valid Mermaid syntax.
No markdown fences. No explanatory text. Start with "graph TD".

Components:
{componentList}

Relationships:
{relationshipList}

Requirements:
- Use subgraphs to group related components
- Use meaningful node IDs (e.g., DataPipeline not A)
- Include 8-15 nodes
- Show data flow direction with arrows
```

## Quality Checklist

Before completing, verify:

- [ ] ONBOARDING.md describes actual architecture (not generic)
- [ ] ONBOARDING.md overview names the specific technologies detected
- [ ] ONBOARDING.md architecture references real directories from the scan
- [ ] ONBOARDING.md includes "For Instructors" section with complexity and learning outcomes
- [ ] RUNBOOK.md lists every detected language/runtime as a prerequisite
- [ ] RUNBOOK.md commands are real (not "Check project documentation")
- [ ] RUNBOOK.md troubleshooting is tech-stack-specific
- [ ] TASKS.md contains exactly 10 tasks with progressive difficulty
- [ ] TASKS.md each task has a learning objective
- [ ] TASKS.md tasks reference real files from the repository
- [ ] TASKS.md acceptance criteria are specific and testable
- [ ] diagram.mmd contains ONLY valid Mermaid syntax (no prose)
- [ ] diagram.mmd has 8+ nodes reflecting actual project structure
- [ ] diagram.mmd renders without errors
- [ ] AGENTS.md skills match detected languages and build system
- [ ] AGENTS.md includes microsoft-learn MCP server
- [ ] AGENTS.md has at least one workflow (onboarding)
- [ ] AGENTS.md includes "How to Use with GitHub Copilot" section
- [ ] Microsoft tech details verified via MCP (if applicable)

See [checklist.md](references/checklist.md) for full verification steps.
See [repo-agents-pack](../repo-agents-pack/SKILL.md) for AGENTS.md-specific quality gates.

## Example Usage

### CLI Usage

```bash
# Local repository
npx onboard ./my-project

# GitHub repository
npx onboard https://github.com/microsoft/vscode

# With options
npx onboard ./my-project --verbose --output ./onboarding-docs
```

### Agent Invocation

User: "Create an onboarding pack for this repo"

Agent:
1. Scan repository structure
2. Identify key files and patterns
3. Use Foundry Local for file summaries (phi-4 or larger recommended)
4. Generate ONBOARDING.md, RUNBOOK.md, TASKS.md
5. Generate AGENTS.md (skills, MCP servers, workflows) — see [repo-agents-pack](../repo-agents-pack/SKILL.md)
6. Create Mermaid diagram
7. Validate all output against quality gates
8. If Microsoft tech detected, verify via MCP

## References

- [checklist.md](references/checklist.md) - Quality verification checklist
- [mermaid-patterns.md](references/mermaid-patterns.md) - Diagram templates
- [microsoft-tech-verification.md](references/microsoft-tech-verification.md) - MCP tool guidance
