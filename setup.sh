#!/usr/bin/env bash
# Repo Onboarding Pack Generator — Setup Script (Linux/macOS)
# Run: chmod +x setup.sh && ./setup.sh

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m'

step()  { printf "\n${CYAN}▶ %s${NC}\n" "$1"; }
ok()    { printf "  ${GREEN}✓ %s${NC}\n" "$1"; }
warn()  { printf "  ${YELLOW}⚠ %s${NC}\n" "$1"; }
err()   { printf "  ${RED}✗ %s${NC}\n" "$1"; }

echo ""
printf "${MAGENTA}╔══════════════════════════════════════════════════╗${NC}\n"
printf "${MAGENTA}║   Repo Onboarding Pack Generator — Setup        ║${NC}\n"
printf "${MAGENTA}╚══════════════════════════════════════════════════╝${NC}\n"

# ── 1. Check Node.js ────────────────────────────────────────
step "Checking Node.js..."
if ! command -v node &>/dev/null; then
    err "Node.js not found. Install Node.js 20+ from https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    err "Node.js $NODE_VERSION found — version 20+ required."
    exit 1
fi
ok "Node.js $NODE_VERSION"

# ── 2. Check Git ────────────────────────────────────────────
step "Checking Git..."
if ! command -v git &>/dev/null; then
    err "Git not found. Install from https://git-scm.com/"
    exit 1
fi
GIT_VERSION=$(git --version | sed 's/git version //')
ok "Git $GIT_VERSION"

# ── 3. Install npm dependencies ─────────────────────────────
step "Installing npm dependencies..."
npm install
ok "Dependencies installed"

# ── 4. TypeScript build check ───────────────────────────────
step "Verifying TypeScript compilation..."
if npx tsc --noEmit; then
    ok "TypeScript compiles cleanly"
else
    err "TypeScript compilation errors found. Run 'npx tsc --noEmit' for details."
    exit 1
fi

# ── 5. Create .env from .env.example if missing ─────────────
step "Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp ".env.example" ".env"
        ok "Created .env from .env.example — edit it with your settings"
    else
        warn ".env.example not found, skipping .env creation"
    fi
else
    ok ".env already exists"
fi

# ── 6. Check Foundry Local ──────────────────────────────────
step "Checking Foundry Local..."
if ! command -v foundry &>/dev/null; then
    warn "Foundry Local not installed."
    printf "  ${GRAY}Install with: winget install Microsoft.FoundryLocal (Windows)${NC}\n"
    printf "  ${GRAY}See https://github.com/microsoft/foundry for other platforms${NC}\n"
    printf "  ${GRAY}(Optional — you can use Microsoft Foundry cloud instead)${NC}\n"
else
    STATUS=$(foundry service status 2>&1 || true)
    if echo "$STATUS" | grep -qi "running"; then
        ok "Foundry Local is running"
    else
        warn "Foundry Local installed but not running."
        printf "  ${GRAY}Start with: foundry service start${NC}\n"
    fi
fi

# ── 7. Check cloud configuration ────────────────────────────
step "Checking Microsoft Foundry cloud configuration..."
HAS_CLOUD=false
if [ -f ".env" ]; then
    if grep -qE "^FOUNDRY_CLOUD_ENDPOINT=.+" .env && \
       ! grep -q "your-project" .env && \
       grep -qE "^FOUNDRY_CLOUD_API_KEY=.+" .env && \
       ! grep -q "your-api-key-here" .env; then
        HAS_CLOUD=true
    fi
fi
if [ "$HAS_CLOUD" = true ]; then
    ok "Cloud endpoint and API key configured in .env"
else
    warn "Cloud not configured (optional). Edit .env to add:"
    printf "  ${GRAY}FOUNDRY_CLOUD_ENDPOINT=https://your-resource.cognitiveservices.azure.com/openai/deployments/${NC}\n"
    printf "  ${GRAY}FOUNDRY_CLOUD_API_KEY=your-key${NC}\n"
    printf "  ${GRAY}FOUNDRY_CLOUD_MODEL=gpt-4o-mini${NC}\n"
fi

# ── 8. Create output directory ───────────────────────────────
step "Ensuring output directory..."
if [ ! -d "docs" ]; then
    mkdir -p docs
    ok "Created docs/ directory"
else
    ok "docs/ directory exists"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
printf "${GREEN}╔══════════════════════════════════════════════════╗${NC}\n"
printf "${GREEN}║   Setup complete!                                ║${NC}\n"
printf "${GREEN}╚══════════════════════════════════════════════════╝${NC}\n"
echo ""
printf "  Quick start:\n"
printf "  ${GRAY}npm run web              # Launch web UI at http://localhost:3000${NC}\n"
printf "  ${GRAY}npm run onboard -- <url> # Generate docs via CLI${NC}\n"
echo ""
if ! command -v foundry &>/dev/null; then
    printf "  To enable local AI:\n"
    printf "  ${GRAY}See https://github.com/microsoft/foundry for installation${NC}\n"
    printf "  ${GRAY}foundry service start${NC}\n"
    echo ""
fi
