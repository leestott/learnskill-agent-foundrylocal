# Onboarding Pack Quality Checklist

Use this checklist to verify the generated onboarding pack meets quality standards.

## Pre-Generation Checks

- [ ] Repository is accessible (local path exists or URL is valid)
- [ ] Foundry Local is running (check with `--check-status`)
- [ ] Output directory is writable

## ONBOARDING.md Verification

### Overview Section
- [ ] Project name is correct
- [ ] Overview describes what the project actually does
- [ ] Tech stack is accurately identified
- [ ] No generic placeholder text

### Architecture Section
- [ ] Describes actual architecture pattern (MVC, microservices, etc.)
- [ ] Lists real components from the codebase
- [ ] Explains how components interact
- [ ] References specific directories/files

### Key Flows Section
- [ ] Flows reflect actual code paths
- [ ] Steps are specific to this project
- [ ] Files listed exist in the repo
- [ ] Build flow matches actual build system

### Getting Started
- [ ] Instructions are copy-paste ready
- [ ] Commands use correct package manager
- [ ] Prerequisites match actual requirements

## RUNBOOK.md Verification

### Prerequisites
- [ ] All required tools are listed
- [ ] Install commands are correct for OS
- [ ] Version requirements are accurate
- [ ] Verify commands work

### Setup Steps
- [ ] Steps are in correct order
- [ ] Clone command uses correct URL
- [ ] Install command uses correct package manager
- [ ] Environment setup matches .env.example

### Build/Run/Test Commands
- [ ] Commands execute without error
- [ ] Commands match scripts in package.json/.csproj
- [ ] Output paths are correct
- [ ] Test framework matches actual tests

### Troubleshooting
- [ ] Common issues are relevant to this stack
- [ ] Solutions actually fix the problems
- [ ] Commands are safe to run

## TASKS.md Verification

### Task Quality
- [ ] Tasks are achievable by someone new to the codebase
- [ ] Difficulty progression makes sense
- [ ] Time estimates are realistic
- [ ] Acceptance criteria are testable

### Task Content
- [ ] Related files exist in the repo
- [ ] Hints provide useful guidance
- [ ] Skills listed match actual work
- [ ] No duplicate or redundant tasks

### Coverage
- [ ] Includes documentation tasks
- [ ] Includes testing tasks
- [ ] Includes code improvement tasks
- [ ] Includes feature tasks

## diagram.mmd Verification

### Diagram Accuracy
- [ ] Components match actual directories/modules
- [ ] Relationships reflect real dependencies
- [ ] Labels are readable and accurate
- [ ] Diagram renders correctly in Mermaid

### Diagram Structure
- [ ] Uses appropriate diagram type (flowchart, graph)
- [ ] Has logical groupings (subgraphs)
- [ ] Not too complex (< 20 nodes)
- [ ] Shows key architecture clearly

## Microsoft Technology Verification

If the repo uses Microsoft tech:

- [ ] Azure service names are correct
- [ ] .NET version requirements accurate
- [ ] SDK/API patterns verified via MCP
- [ ] Best practices aligned with official docs

## Final Checks

- [ ] All files written to correct location
- [ ] No sensitive data exposed
- [ ] Documentation is actionable, not generic
- [ ] A new engineer could follow these docs

## Quick Test

```bash
# Verify files exist
ls docs/ONBOARDING.md docs/RUNBOOK.md docs/TASKS.md docs/diagram.mmd

# Test a runbook command
# (copy a build or test command and run it)

# Render the diagram
# (paste diagram.mmd into https://mermaid.live)
```
