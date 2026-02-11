# Runbook

Operational guide for building, running, and troubleshooting this project.

## Prerequisites

### Node.js

JavaScript runtime (v18+ recommended)

**Install:** `Download from nodejs.org or use nvm`

**Verify:** `node --version`

### Git

Version control system

**Install:** `Download from git-scm.com`

**Verify:** `git --version`

## Setup

### 1. Clone the repository

Get the source code

```bash
git clone https://github.com/leestott/learnskill-agent-foundrylocal.git
cd learnskill-agent-foundrylocal
```

### 2. Install dependencies

Use npm to install project dependencies

```bash
npm install
```

### 3. Configure environment

Set up environment variables

```bash
cp .env.example .env
# Edit .env with your values
```

## Build

Build the project using npm

```bash
npm run build
```

## Run

Start the application

```bash
npm start
```

## Test

Run the test suite

```bash
# No test script defined
```

> No test framework detected

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

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run build` | build |
| `npm run start` | start |
| `npm run dev` | dev |
| `npm run onboard` | onboard |
| `npm run serve` | serve |
| `npm run web` | web |
| `npm run setup` | setup |

## Microsoft Learn Resources

For troubleshooting and deeper understanding of the Microsoft technologies used in this project:

- **TypeScript**: `microsoft_docs_search(query="TypeScript troubleshooting")`
  - Setup: `microsoft_docs_search(query="TypeScript configuration tsconfig")`

