# Runbook

Operational guide for building, running, and troubleshooting this project.

## Prerequisites

### Python

Python interpreter (v3.10+ recommended) — 66% of codebase

**Install:** `Download from python.org or use pyenv`

**Verify:** `python --version`

### Node.js

JavaScript runtime (v18+ recommended)

**Install:** `Download from nodejs.org or use nvm`

**Verify:** `node --version`

### Jupyter

Notebook environment for running .ipynb files

**Install:** `pip install jupyter`

**Verify:** `jupyter --version`

### Azure CLI

Azure command-line interface for deploying Bicep/ARM templates

**Install:** `Download from learn.microsoft.com/cli/azure/install-azure-cli`

**Verify:** `az --version`

### Git

Version control system

**Install:** `Download from git-scm.com`

**Verify:** `git --version`

## Setup

### 1. Clone the repository

Get the source code

```bash
git clone https://github.com/Azure-Samples/chat-with-your-data-solution-accelerator.git
cd Azure-Samples-chat-with-your-data-solution-accelerator
```

### 2. Install dependencies

Use npm to install project dependencies

```bash
npm install
```

## Build

Build the project using npm

```bash
# No build script defined
```

## Run

Start the application

```bash
node dist/index.js
```

## Test

Run the test suite

```bash
# No test script defined
```

> Test frameworks: pytest

## Troubleshooting

### Problem: node_modules issues or dependency conflicts

**Solution:** Delete node_modules and lock file, then reinstall

```bash
rm -rf node_modules
rm package-lock.json
npm install
```

### Problem: Port already in use

**Solution:** Kill the process using the port or use a different port

```bash
# Find process: lsof -i :3000
# Kill: kill -9 <PID>
```

### Problem: Environment variables not loaded

**Solution:** Ensure .env file exists and is properly configured

```bash
cp .env.example .env
# Edit .env with your values
```

## Microsoft Learn Resources

For troubleshooting and deeper understanding of the Microsoft technologies used in this project:

- **TypeScript**: `microsoft_docs_search(query="TypeScript troubleshooting")`
  - Setup: `microsoft_docs_search(query="TypeScript configuration tsconfig")`
- **Bicep**: `microsoft_docs_search(query="Bicep troubleshooting")`
  - Setup: `microsoft_docs_search(query="Bicep overview Azure resource deployment")`

