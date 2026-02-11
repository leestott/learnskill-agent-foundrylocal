---
name: repo-agents-pack
description: Generate AGENTS.md — agent configuration documentation for any repository. Detects skills, MCP servers, and workflows from repo structure, then produces an actionable agent configuration file that teaches AI agents how to work with the codebase. Use when users want to create agent-compatible documentation, configure Copilot for a repo, or set up MCP server integration.
compatibility: Works with any Git repository. Pairs with the repo-onboarding-pack skill. Uses Microsoft Learn MCP Server (https://learn.microsoft.com/api/mcp) for Microsoft technology verification. Integrates with GitHub Copilot SDK (@github/copilot-sdk).
---

# Repo Agents Pack Generator

Create AGENTS.md — a structured agent configuration document that teaches AI agents (GitHub Copilot, custom agents) how to work effectively with a repository.

## Trigger Phrases

This skill activates when users say things like:
- "Generate agents config for this repo"
- "Create AGENTS.md for this project"
- "Configure Copilot skills for this repo"
- "What MCP servers should this repo use?"
- "Set up agent workflows for this codebase"
- "Create agent onboarding docs"

## What This Skill Generates

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Skills, MCP servers, and workflows for AI agents working with this repo |

## Relationship to Other Skills

This skill is **invoked automatically** by [repo-onboarding-pack](../repo-onboarding-pack/SKILL.md) as part of the 9-step pipeline (AGENTS.md is generated in step 7: Compile). It can also be used standalone when users only need agent configuration.

| Companion Skill | How It Helps |
|-----------------|-------------|
| [repo-onboarding-pack](../repo-onboarding-pack/SKILL.md) | Provides repo metadata (languages, deps, structure) that feeds AGENTS.md generation |
| [microsoft-docs](../microsoft-docs/SKILL.md) | Validates Microsoft technology references in detected skills |
| [microsoft-code-reference](../microsoft-code-reference/SKILL.md) | Verifies SDK/API patterns referenced in agent skills |
| [microsoft-skill-creator](../microsoft-skill-creator/SKILL.md) | Creates new dedicated skills for technologies detected during scanning |

## AGENTS.md Structure

### Required Sections

| Section | Content | Minimum |
|---------|---------|---------|
| **Header** | Project name and one-line description | Must name actual project |
| **Skills** | Table of agent skills with triggers | At least 1 skill per detected language |
| **MCP Servers** | Configured MCP servers with tool lists | microsoft-learn always included |
| **Workflows** | Step-by-step workflows agents should follow | At least 1 (onboarding workflow) + code-review |
| **How to Use with GitHub Copilot** | Example prompts for using Copilot with the repo | 5+ example prompts |

### Output Template

```markdown
# {projectName} — Agent Configuration

{One-sentence description of the project and its tech stack.}

## Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| {name} | {what it does} | {comma-separated trigger phrases} |

## MCP Servers

### {server-name}

**URL:** `{server-url}`

**Tools:** `{tool1}`, `{tool2}`, `{tool3}`

## Workflows

### {workflow-name}

{Description}

1. {Step 1}
2. {Step 2}
3. {Step 3}
```

## Workflow

### Step 1: Detect Skills from Repository

Analyze the repository to identify agent skills. Each skill represents a capability an AI agent should have when working with this codebase.

#### Build System Skills

| Build File | Skill Name | Triggers |
|------------|-----------|----------|
| `package.json` (npm) | `npm-build` | build, install dependencies, compile |
| `*.csproj` (.NET) | `dotnet-build` | build, restore packages, compile |
| `Cargo.toml` (Rust) | `cargo-build` | build, compile, check |
| `go.mod` (Go) | `go-build` | build, compile, test |
| `requirements.txt` / `pyproject.toml` | `python-build` | install deps, build, package |
| `Makefile` | `make-build` | build, compile, clean |

#### Test Framework Skills

| Detection | Skill Name | Triggers |
|-----------|-----------|----------|
| Jest / Vitest / Mocha | `test-runner` | run tests, test coverage, check tests |
| pytest / unittest | `python-test` | run tests, pytest, coverage |
| xUnit / NUnit / MSTest | `dotnet-test` | run tests, dotnet test |
| Go test | `go-test` | run tests, go test |

#### Language-Specific Skills

For each detected language (top 3 by file count), generate a development skill:

```
{language-lowercase}-development
Description: Develop and review {Language} code
Triggers: write {Language}, review {Language}, refactor {Language}
```

#### Microsoft Technology Skills

When Microsoft technologies are detected, add specialized skills:

| Detection | Skill | Triggers |
|-----------|-------|----------|
| `@azure/*` packages | `azure-services` | deploy, configure Azure, manage resources |
| `.bicep` files | `infrastructure` | deploy infrastructure, Bicep, IaC |
| `host.json` (Functions) | `azure-functions` | deploy function, add trigger, test function |
| `Microsoft.SemanticKernel` | `semantic-kernel` | AI plugins, kernel, agents |
| `@microsoft/microsoft-graph` | `graph-api` | Graph queries, user data, Teams |

### Step 2: Detect MCP Servers

Identify MCP servers the repository should connect to.

#### Always Include

```markdown
### microsoft-learn

**URL:** `https://learn.microsoft.com/api/mcp`

**Tools:** `microsoft_docs_search`, `microsoft_docs_fetch`, `microsoft_code_sample_search`
```

#### Conditional MCP Servers

| Detection | MCP Server | Tools |
|-----------|-----------|-------|
| `.mcp.json` exists in repo | Parse and include all configured servers | As configured |
| Azure dependencies detected | Suggest Azure MCP if not already configured | Azure resource tools |
| GitHub Actions detected | Suggest GitHub MCP | PR, issue, workflow tools |

### Step 3: Detect Workflows

Generate step-by-step workflows that agents should follow for common tasks.

#### Required Workflow: Onboarding

Always generate this workflow:

```markdown
### onboarding

New contributor onboarding workflow

1. Clone repository
2. Install dependencies
3. Run tests
4. Read ONBOARDING.md
```

#### Conditional Workflows

| Detection | Workflow | Steps |
|-----------|---------|-------|
| Always included | `onboarding` | Clone → Install → Test → Read docs |
| Always included | `code-review` | Read PR → Review diff → Check style → Verify tests → Run tests → Give feedback |
| Build scripts present | `development` | Create branch → Make changes → Run tests → Build → Submit PR |
| CI config detected | `ci-cd` | Push to branch → CI tests → CI build → Deploy on merge |
| Docker/container files | `containerization` | Build image → Run locally → Test → Push to registry |
| `.bicep` / `azuredeploy.json` | `infrastructure` | Edit Bicep → Validate → What-if → Deploy |
| Notebook files (`.ipynb`) | `experimentation` | Create notebook → Run cells → Review output → Export results |

### Step 4: Quality Validation

After generating AGENTS.md, verify:

| Check | Pass Criteria |
|-------|--------------|
| Skills count | At least 1 per detected language + 1 for build system |
| Skill triggers | Each skill has 2+ trigger phrases |
| MCP servers | microsoft-learn is always present |
| Workflows | At least 1 workflow (onboarding) |
| File references | No fabricated file paths |
| Technology names | Match actual detected dependencies |

## Quality Checklist

Before completing, verify:

- [ ] AGENTS.md header names the actual project
- [ ] Every detected language has a corresponding skill
- [ ] Build system skill matches the actual build tool (npm, dotnet, cargo, etc.)
- [ ] Test runner skill matches detected test frameworks
- [ ] microsoft-learn MCP server is included
- [ ] Any `.mcp.json` in the repo is parsed and its servers are included
- [ ] Onboarding workflow is present
- [ ] Code-review workflow is present
- [ ] Additional workflows match repo capabilities (CI, Docker, infra)
- [ ] "How to Use with GitHub Copilot" section with example prompts
- [ ] No hallucinated technologies or tools
- [ ] Skill trigger phrases are natural language and actionable

## Example Output

For a TypeScript + Azure Functions repository:

```markdown
# my-azure-functions — Agent Configuration

Agent configuration for my-azure-functions — a TypeScript project with 24 dependencies.

## Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| npm-build | Build and manage the npm project | build, install dependencies, compile |
| test-runner | Run tests using jest | run tests, test coverage, check tests |
| typescript-development | Develop and review TypeScript code | write TypeScript, review TypeScript, refactor TypeScript |
| azure-functions | Deploy and manage Azure Functions | deploy function, add trigger, test function |

## MCP Servers

### microsoft-learn

**URL:** `https://learn.microsoft.com/api/mcp`

**Tools:** `microsoft_docs_search`, `microsoft_docs_fetch`, `microsoft_code_sample_search`

## Workflows

### onboarding

New contributor onboarding workflow

1. Clone repository
2. Install dependencies
3. Run tests
4. Read ONBOARDING.md

### development

Standard development workflow

1. Create feature branch
2. Make changes
3. Run tests
4. Build project
5. Submit PR

### ci-cd

Continuous integration and deployment

1. Push to branch
2. CI runs tests
3. CI runs build
4. Deploy on merge to main

### code-review

Structured code review workflow for learning and quality assurance

1. Open the pull request and read the description
2. Review the diff file-by-file, starting with tests
3. Check code style and naming conventions
4. Verify tests cover the changes
5. Run the test suite locally
6. Leave constructive feedback with specific suggestions

## How to Use with GitHub Copilot

This repository is configured for GitHub Copilot Agent Mode. Use these example prompts in VS Code:

| Goal | Example Prompt |
|------|---------------|
| Understand the project | "Explain the architecture of this project" |
| Start a task | "Help me work on Task 1 from TASKS.md" |
| Review code | "Review the changes in my current branch" |
| Find documentation | "What does the API do?" |
| Debug an issue | "Why is this test failing?" |
| Learn a concept | "Explain how error handling works in this codebase" |

> **Tip:** Open the onboarding docs (ONBOARDING.md, RUNBOOK.md, TASKS.md) as context when chatting with Copilot for better answers.
```

## Agent Invocation

User: "Generate agents config for this repo"

Agent:
1. Scan repository (or reuse metadata from repo-onboarding-pack)
2. Detect skills from languages, build system, test frameworks
3. Detect MCP servers from `.mcp.json` and technology analysis
4. Generate workflows from build scripts and CI config
5. Render AGENTS.md with quality validation
6. If Microsoft technologies detected, add specialized skills

## References

- [repo-onboarding-pack](../repo-onboarding-pack/SKILL.md) — Parent skill that invokes AGENTS.md generation
- [microsoft-skill-creator](../microsoft-skill-creator/SKILL.md) — Create new skills for detected technologies
- [microsoft-tech-verification.md](../repo-onboarding-pack/references/microsoft-tech-verification.md) — MCP validation guidance
