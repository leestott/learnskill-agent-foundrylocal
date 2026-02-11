# Repo Onboarding Pack Generator - Setup Script (Windows)
# Run: .\setup.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "====================================================" -ForegroundColor Magenta
Write-Host "   Repo Onboarding Pack Generator - Setup           " -ForegroundColor Magenta
Write-Host "====================================================" -ForegroundColor Magenta

# -- 1. Check Node.js -----------------------------------------
Write-Step "Checking Node.js..."
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Err "Node.js not found. Install Node.js 20+ from https://nodejs.org/"
    exit 1
}
$nodeVersion = (node --version) -replace '^v', ''
$major = [int]($nodeVersion -split '\.')[0]
if ($major -lt 20) {
    Write-Err "Node.js $nodeVersion found - version 20+ required."
    exit 1
}
Write-Ok "Node.js $nodeVersion"

# -- 2. Check Git ----------------------------------------------
Write-Step "Checking Git..."
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Err "Git not found. Install from https://git-scm.com/"
    exit 1
}
$gitVersion = (git --version) -replace 'git version ', ''
Write-Ok "Git $gitVersion"

# -- 3. Install npm dependencies --------------------------------
Write-Step "Installing npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Err "npm install failed."
    exit 1
}
Write-Ok "Dependencies installed"

# -- 4. TypeScript build check ----------------------------------
Write-Step "Verifying TypeScript compilation..."
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Err "TypeScript compilation errors found. Run 'npx tsc --noEmit' for details."
    exit 1
}
Write-Ok "TypeScript compiles cleanly"

# -- 5. Create .env from .env.example if missing -----------------
Write-Step "Checking environment configuration..."
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Ok "Created .env from .env.example - edit it with your settings"
    } else {
        Write-Warn ".env.example not found, skipping .env creation"
    }
} else {
    Write-Ok ".env already exists"
}

# -- 6. Check Foundry Local ------------------------------------
Write-Step "Checking Foundry Local..."
$foundry = Get-Command foundry -ErrorAction SilentlyContinue
if (-not $foundry) {
    Write-Warn "Foundry Local not installed."
    Write-Host "         Install with: winget install Microsoft.FoundryLocal" -ForegroundColor Gray
    Write-Host "         (Optional - you can use Microsoft Foundry cloud instead)" -ForegroundColor Gray
} else {
    $status = foundry service status 2>&1
    if ($status -match "running") {
        Write-Ok "Foundry Local is running"
        $models = foundry model list 2>&1
        $cachedCount = ($models | Select-String "cached" | Measure-Object).Count
        if ($cachedCount -gt 0) {
            Write-Ok "$cachedCount models available"
        }
    } else {
        Write-Warn "Foundry Local installed but not running."
        Write-Host "         Start with: foundry service start" -ForegroundColor Gray
    }
}

# -- 7. Check cloud configuration --------------------------------
Write-Step "Checking Microsoft Foundry cloud configuration..."
$envContent = if (Test-Path ".env") { Get-Content ".env" -Raw } else { "" }
$hasEndpoint = $envContent -match "FOUNDRY_CLOUD_ENDPOINT=(?!https://your-project)" -and $envContent -match "FOUNDRY_CLOUD_ENDPOINT=\S+"
$hasKey = $envContent -match "FOUNDRY_CLOUD_API_KEY=(?!your-api-key-here)" -and $envContent -match "FOUNDRY_CLOUD_API_KEY=\S+"

if ($hasEndpoint -and $hasKey) {
    Write-Ok "Cloud endpoint and API key configured in .env"
} else {
    Write-Warn "Cloud not configured (optional). Edit .env to add:"
    Write-Host "         FOUNDRY_CLOUD_ENDPOINT=https://your-project.services.foundry.microsoft.com" -ForegroundColor Gray
    Write-Host "         FOUNDRY_CLOUD_API_KEY=your-key" -ForegroundColor Gray
    Write-Host "         FOUNDRY_CLOUD_MODEL=gpt-4o-mini" -ForegroundColor Gray
}

# -- 8. Create output directory ----------------------------------
Write-Step "Ensuring output directory..."
if (-not (Test-Path "docs")) {
    New-Item -ItemType Directory -Path "docs" | Out-Null
    Write-Ok "Created docs/ directory"
} else {
    Write-Ok "docs/ directory exists"
}

# -- Summary -----------------------------------------------------
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "   Setup complete!                                   " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick start:" -ForegroundColor White
Write-Host "    npm run web              # Launch web UI at http://localhost:3000" -ForegroundColor Gray
Write-Host "    npm run onboard -- <url> # Generate docs via CLI" -ForegroundColor Gray
Write-Host ""
if (-not $foundry) {
    Write-Host "  To enable local AI:" -ForegroundColor White
    Write-Host "    winget install Microsoft.FoundryLocal" -ForegroundColor Gray
    Write-Host "    foundry service start" -ForegroundColor Gray
    Write-Host ""
}
