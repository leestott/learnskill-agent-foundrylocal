# Microsoft Technology Validation Report

This report lists Microsoft technologies detected in the repository and provides verification queries for the [Microsoft Learn MCP Server](https://learn.microsoft.com/api/mcp).

## Setup

To validate these technologies, ensure you have the Microsoft Learn MCP Server configured:

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

## Detected Technologies (2)

| # | Technology | Category | Confidence | Evidence |
|---|------------|----------|------------|----------|
| 1 | TypeScript | typescript | high | TypeScript source files detected |
| 2 | Bicep | azure-service | high | Found .bicep files |

## Validation Queries

Run these queries to verify technical details against official Microsoft documentation.

### TypeScript

**Category:** typescript | **Detected via:** TypeScript source files detected

| Step | Tool | Query | Purpose |
|------|------|-------|--------|
| 1 | microsoft_docs_search | `microsoft_docs_search(query="TypeScript configuration tsconfig")` | Verify TypeScript setup |
| 2 | microsoft_docs_search | `microsoft_docs_search(query="TypeScript best practices")` | Review best practices |

### Bicep

**Category:** azure-service | **Detected via:** Found .bicep files

| Step | Tool | Query | Purpose |
|------|------|-------|--------|
| 1 | microsoft_docs_search | `microsoft_docs_search(query="Bicep overview Azure resource deployment")` | Understand infrastructure as code |
| 2 | microsoft_docs_search | `microsoft_docs_search(query="Bicep best practices modules")` | Review deployment best practices |

## Verification Checklist

After running the validation queries, confirm:

- [ ] All technology names match official Microsoft documentation
- [ ] SDK versions referenced are current (not deprecated)
- [ ] API patterns align with latest best practices
- [ ] Prerequisites in RUNBOOK.md include correct install/verify commands
- [ ] Configuration examples are accurate
- [ ] Security recommendations are up to date

## Additional Skills

Use these companion skills for deeper verification:

- **[microsoft-docs](../.github/skills/microsoft-docs/SKILL.md)** — Search concepts, tutorials, configuration guides
- **[microsoft-code-reference](../.github/skills/microsoft-code-reference/SKILL.md)** — API lookups, code samples, error troubleshooting
- **[microsoft-skill-creator](../.github/skills/microsoft-skill-creator/SKILL.md)** — Create new skills for detected technologies
