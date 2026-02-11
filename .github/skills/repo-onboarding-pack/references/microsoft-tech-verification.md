# Microsoft Technology Verification

When generating onboarding documentation for repositories using Microsoft technologies, use Learn MCP tools to verify technical details and fetch accurate, up-to-date information.

## Available MCP Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `microsoft_docs_search` | Search official Microsoft documentation | Discovery, finding relevant docs |
| `microsoft_docs_fetch` | Get full content of a specific doc page | Deep dive into specific topics |
| `microsoft_code_sample_search` | Find code examples | Implementation patterns |

## Technology-Specific Queries

### Azure Services

When the repo uses Azure services, verify:

```
# General Azure service info
microsoft_docs_search(query="{service-name} overview architecture")
microsoft_docs_search(query="{service-name} quickstart getting started")

# SDK usage
microsoft_docs_search(query="{service-name} SDK {language}")
microsoft_code_sample_search(query="{service-name}", language="{lang}")

# Best practices
microsoft_docs_search(query="{service-name} best practices security")
```

**Common Azure services:**
- Azure Functions: `microsoft_docs_search(query="azure functions triggers bindings")`
- Azure Storage: `microsoft_docs_search(query="azure blob storage SDK")`
- Azure Cosmos DB: `microsoft_docs_search(query="cosmos db getting started")`
- Azure App Service: `microsoft_docs_search(query="app service deployment")`
- Azure Kubernetes Service: `microsoft_docs_search(query="aks cluster management")`

### .NET Development

```
# Framework version info
microsoft_docs_search(query=".NET {version} what's new")

# Specific library
microsoft_docs_search(query="{library-name} nuget getting started")
microsoft_code_sample_search(query="{library-name}", language="csharp")

# ASP.NET Core
microsoft_docs_search(query="asp.net core minimal API")
microsoft_docs_search(query="asp.net core middleware")

# Entity Framework
microsoft_docs_search(query="entity framework core migrations")
```

### TypeScript/JavaScript

```
# TypeScript configuration
microsoft_docs_search(query="typescript configuration tsconfig")

# Node.js Azure SDK
microsoft_docs_search(query="azure sdk javascript")
microsoft_code_sample_search(query="azure sdk", language="javascript")
```

### VS Code Extensions

```
# Extension development
microsoft_docs_search(query="vscode extension API")
microsoft_code_sample_search(query="vscode extension", language="typescript")

# Specific APIs
microsoft_docs_search(query="vscode webview API")
microsoft_docs_search(query="vscode language server")
```

### AI/ML with Microsoft

```
# Azure OpenAI
microsoft_docs_search(query="azure openai getting started")
microsoft_docs_search(query="azure openai embeddings")

# Semantic Kernel
microsoft_docs_search(query="semantic kernel plugins")
microsoft_code_sample_search(query="semantic kernel", language="csharp")

# Foundry / AI Toolkit
microsoft_docs_search(query="windows ml foundry local")
```

### Microsoft Graph

```
microsoft_docs_search(query="microsoft graph API")
microsoft_docs_search(query="graph sdk {language}")
microsoft_code_sample_search(query="microsoft graph", language="{lang}")
```

## Verification Workflow

### 1. Detect Microsoft Technologies

Scan the repository for:
- `.csproj` / `.fsproj` files → .NET
- `azure-pipelines.yml` → Azure DevOps
- `azuredeploy.json` / `*.bicep` → Azure resources
- `@azure/*` npm packages → Azure SDK for JS
- `Microsoft.*` NuGet packages → .NET Azure SDK
- `.vscode/extensions.json` → VS Code extension

### 2. Fetch Relevant Documentation

```
# For each detected technology:
microsoft_docs_search(query="{technology} quickstart")

# Get specific page if URL known:
microsoft_docs_fetch(url="https://learn.microsoft.com/...")
```

### 3. Verify Generated Content

Before including in documentation:
- [ ] SDK version matches official docs
- [ ] API patterns align with current best practices
- [ ] Configuration examples are accurate
- [ ] Security recommendations are current

### 4. Include MCP References

In generated docs, include queries for further learning:

```markdown
## Learn More

For detailed Azure Functions documentation:
- Search: `microsoft_docs_search(query="azure functions triggers bindings")`
- Samples: `microsoft_code_sample_search(query="azure functions", language="csharp")`
```

## Example: .NET Web API Project

When onboarding a .NET Web API project:

```
# Step 1: Verify .NET version
microsoft_docs_search(query=".NET 8 new features")

# Step 2: Check ASP.NET patterns
microsoft_docs_search(query="asp.net core minimal APIs endpoints")
microsoft_code_sample_search(query="minimal api", language="csharp")

# Step 3: If using Entity Framework
microsoft_docs_search(query="entity framework core getting started")

# Step 4: If deploying to Azure
microsoft_docs_search(query="asp.net core azure app service deployment")
```

## Example: Azure Functions Project

```
# Step 1: Functions overview
microsoft_docs_search(query="azure functions overview")

# Step 2: Trigger types
microsoft_docs_search(query="azure functions http trigger")
microsoft_docs_search(query="azure functions timer trigger")

# Step 3: Bindings
microsoft_docs_search(query="azure functions input output bindings")

# Step 4: Local development
microsoft_docs_search(query="azure functions core tools local development")
```

## Copilot Instructions Snippet

Add this to your `copilot-instructions.md` or `.github/copilot-instructions.md`:

```markdown
## Microsoft Technology Verification

When working with Microsoft technologies:
1. Use `microsoft_docs_search` to verify technical details
2. Use `microsoft_docs_fetch` to get full documentation
3. Use `microsoft_code_sample_search` for implementation patterns

Never assume SDK versions or API patterns - always verify with Learn MCP tools.
```

## Common Patterns to Verify

| Pattern | Verification Query |
|---------|-------------------|
| Authentication | `microsoft_docs_search(query="azure authentication {service}")` |
| Configuration | `microsoft_docs_search(query="{technology} configuration options")` |
| Error handling | `microsoft_docs_search(query="{technology} error handling")` |
| Logging | `microsoft_docs_search(query="{technology} logging monitoring")` |
| Testing | `microsoft_docs_search(query="{technology} unit testing")` |
| Deployment | `microsoft_docs_search(query="{technology} deployment azure")` |
