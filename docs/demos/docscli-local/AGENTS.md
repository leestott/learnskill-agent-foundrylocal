# Azure-Samples-chat-with-your-data-solution-accelerator — Agent Configuration

Agent configuration for Azure-Samples-chat-with-your-data-solution-accelerator — a Python project with 0 dependencies.

## Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| npm-build | Build and manage the npm project | build, install dependencies, compile |
| test-runner | Run tests using pytest | run tests, test coverage, check tests |
| python-development | Develop and review Python code | write Python, review Python, refactor Python |
| typescript-development | Develop and review TypeScript code | write TypeScript, review TypeScript, refactor TypeScript |
| bicep-development | Develop and review Bicep code | write Bicep, review Bicep, refactor Bicep |

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
| Find documentation | "What does the Azure-Samples-chat-with-your-data-solution-accelerator API do?" |
| Debug an issue | "Why is this test failing?" |
| Learn a concept | "Explain how error handling works in this codebase" |

> **Tip:** Open the onboarding docs (ONBOARDING.md, RUNBOOK.md, TASKS.md) as context when chatting with Copilot for better answers.

