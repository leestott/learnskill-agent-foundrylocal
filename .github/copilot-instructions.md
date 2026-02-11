# Copilot Instructions — Repo Onboarding Pack Generator

## Project Overview

This project generates comprehensive onboarding documentation (ONBOARDING.md, RUNBOOK.md, TASKS.md, VALIDATION.md) for any GitHub repository using local or cloud-hosted LLMs.

## Available Skills

| Skill | Purpose |
|-------|---------|
| [repo-onboarding-pack](skills/repo-onboarding-pack/SKILL.md) | Generate onboarding docs from repository analysis |
| [microsoft-skill-creator](skills/microsoft-skill-creator/SKILL.md) | Create new agent skills for Microsoft technologies |
| [microsoft-docs](skills/microsoft-docs/SKILL.md) | Query Microsoft Learn documentation |
| [microsoft-code-reference](skills/microsoft-code-reference/SKILL.md) | Look up Microsoft API references and code samples |

## Microsoft Learn Validation Workflow

When generating onboarding packs for repositories that use Microsoft technologies:

1. The orchestrator **automatically detects** Microsoft technologies from dependencies, languages, and config files
2. It generates **VALIDATION.md** containing Learn MCP queries for each detected technology
3. ONBOARDING.md and RUNBOOK.md are **enriched** with Microsoft Technology References sections

### Using Learn MCP Tools

The Microsoft Learn MCP server (`https://learn.microsoft.com/api/mcp`) provides:

- `microsoft_docs_search` — Search Microsoft Learn documentation
- `microsoft_docs_fetch` — Fetch specific documentation pages
- `microsoft_code_sample_search` — Find official code samples

After generating docs, run the validation queries from VALIDATION.md to verify accuracy.

### Creating New Skills for Detected Technologies

When the generator detects a Microsoft technology without a dedicated skill:

1. Use the **microsoft-skill-creator** skill to investigate the technology
2. Generate a skill following the appropriate template (SDK, Azure Service, Framework, or API)
3. Validate the skill content against Microsoft Learn
4. Store the new skill in `.github/skills/`

## Architecture

- `src/index.ts` — CLI entry point
- `src/server.ts` — Web UI server (Express + SSE)
- `src/orchestrator.ts` — 9-step generation pipeline with Microsoft tech validation
- `src/repoScanner.ts` — Repository structure analysis
- `src/localModelClient.ts` — LLM client (Foundry Local + Microsoft Foundry cloud)
- `src/types.ts` — Shared TypeScript interfaces
- `src/validation.ts` — Input validation

## Build & Run

```bash
npm install
npx tsc --noEmit          # Type check
npx tsx src/index.ts       # CLI mode
npx tsx src/server.ts      # Web UI mode (port 3000)
```
