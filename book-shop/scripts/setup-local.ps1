# ============================================================
#  Book Shop - local setup for Windows
#
#  NOTE: This file is intentionally ASCII-only.
#  Windows PowerShell 5.1 reads .ps1 files using the system ANSI
#  codepage, so non-ASCII characters break the parser.
#  Thai documentation lives in README.md instead.
#
#  Run:  npm.cmd run setup:win
#    or: double-click scripts\setup-local.cmd
# ============================================================
$ErrorActionPreference = 'Stop'

function Step($n, $msg) { Write-Host ""; Write-Host "[$n] $msg" -ForegroundColor Cyan }
function Ok($msg)       { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg)     { Write-Host "    $msg" -ForegroundColor Yellow }
function Die($msg) {
    Write-Host ""
    Write-Host "STOPPED: $msg" -ForegroundColor Red
    exit 1
}

Set-Location (Join-Path $PSScriptRoot '..')
Write-Host "Working directory: $(Get-Location)"

# ---------- 1. prerequisites ----------
Step 1 "Checking required tools"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Die "Node.js not found. Install the LTS build from https://nodejs.org then run this again."
}
Ok "Node.js $(node --version)"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Die "Docker not found. Install Docker Desktop from https://docker.com/products/docker-desktop"
}

docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Die "Docker is not running. Open Docker Desktop, wait until it says Running, then run this again."
}
Ok "Docker is running"

# ---------- 2. dependencies ----------
Step 2 "Installing dependencies (first run takes a few minutes)"
& npm.cmd install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Die "npm install failed" }
Ok "Dependencies installed"

# ---------- 3. supabase config ----------
Step 3 "Preparing Supabase config"
if (-not (Test-Path 'supabase\config.toml')) {
    & npx.cmd --yes supabase init
    if ($LASTEXITCODE -ne 0) { Die "supabase init failed" }
    Ok "Created supabase\config.toml"
} else {
    Ok "config.toml already exists"
}

# Supabase's analytics container needs the Docker daemon exposed on
# tcp://localhost:2375, which is off by default on Windows. When it cannot
# start, the storage and studio containers fail their health checks too and
# `supabase start` rolls the whole stack back. We do not use analytics, so
# turn it off.
$cfgPath = 'supabase\config.toml'
$cfgText = Get-Content $cfgPath -Raw
if ($cfgText -match '(?ms)\[analytics\](.*?)enabled\s*=\s*true') {
    $cfgText = $cfgText -replace '(?ms)(\[analytics\][^\[]*?enabled\s*=\s*)true', '${1}false'
    Set-Content -Path $cfgPath -Value $cfgText -NoNewline
    Ok "Disabled analytics (not needed, and it fails on Windows)"
}

# ---------- 4. start database ----------
Step 4 "Starting database in Docker (first run downloads images, 2-5 min)"
& npx.cmd --yes supabase start
if ($LASTEXITCODE -ne 0) { Die "supabase start failed - check the log above" }
Ok "Database is running"

# ---------- 5. migrations + seed ----------
Step 5 "Creating tables and loading sample data"
& npx.cmd --yes supabase db reset
if ($LASTEXITCODE -ne 0) { Die "supabase db reset failed" }
Ok "Tables and sample data ready"

# ---------- 6. write .env.local ----------
Step 6 "Writing .env.local"

# NOTE: the Supabase CLI writes progress messages to stderr even on success.
# With $ErrorActionPreference = 'Stop' PowerShell turns that into a terminating
# error, so we relax it around this one call.
$cfg = @{}
try {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $statusRaw = & npx.cmd --yes supabase status -o env 2>&1
    $ErrorActionPreference = $prevEAP

    foreach ($line in $statusRaw) {
        $text = "$line"
        if ($text -match '^([A-Z_]+)="?([^"]*)"?\s*$') {
            $cfg[$matches[1]] = $matches[2]
        }
    }
} catch {
    $ErrorActionPreference = 'Stop'
    Warn "Could not run 'supabase status'."
}

$apiUrl  = $cfg['API_URL']
$anonKey = $cfg['ANON_KEY']
$svcKey  = $cfg['SERVICE_ROLE_KEY']

# Fallback: read the keys straight off disk. The CLI writes them here when it
# starts the edge runtime container, and this path does not depend on parsing
# console output.
if ([string]::IsNullOrWhiteSpace($anonKey)) {
    $dockerEnv = Join-Path (Get-Location) 'supabase\.temp\start-secrets\supabase_edge_runtime_book-shop\env\docker.env'
    if (Test-Path $dockerEnv) {
        foreach ($line in (Get-Content $dockerEnv)) {
            if ($line -match '^SUPABASE_ANON_KEY=(.+)$')         { $anonKey = $matches[1].Trim() }
            if ($line -match '^SUPABASE_SERVICE_ROLE_KEY=(.+)$') { $svcKey  = $matches[1].Trim() }
        }
        if (-not [string]::IsNullOrWhiteSpace($anonKey)) {
            Ok "Read keys from supabase\.temp"
        }
    }
}
if ([string]::IsNullOrWhiteSpace($apiUrl)) { $apiUrl = 'http://127.0.0.1:54321' }

if ([string]::IsNullOrWhiteSpace($apiUrl) -or [string]::IsNullOrWhiteSpace($anonKey)) {
    Warn "Could not read values from 'supabase status'."
    Warn "Run 'npx supabase status' and copy API URL / anon key / service_role key"
    Warn "into .env.local manually (see .env.example for the format)."
} else {
    $lines = @(
        '# Generated by scripts\setup-local.ps1',
        '# These are LOCAL development values only.',
        '',
        "NEXT_PUBLIC_SUPABASE_URL=$apiUrl",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey",
        "SUPABASE_SERVICE_ROLE_KEY=$svcKey",
        '',
        '# ---------- fill in later ----------',
        'PROMPTPAY_ID=',
        'SHOP_NAME=',
        'SHOP_ADDRESS=',
        'LINE_CHANNEL_SECRET=',
        'LINE_CHANNEL_ACCESS_TOKEN=',
        'NEXT_PUBLIC_LIFF_ID=',
        'SLIP_VERIFY_API_KEY=',
        'FLASH_MERCHANT_ID=',
        'FLASH_API_KEY='
    )
    if (Test-Path '.env.local') {
        Copy-Item '.env.local' '.env.local.bak' -Force
        Ok "Backed up existing .env.local to .env.local.bak"
    }
    Set-Content -Path '.env.local' -Value $lines -Encoding ASCII
    Ok "Wrote .env.local"
}

# ---------- done ----------
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host " SETUP COMPLETE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Start the app:   npm.cmd run dev"
Write-Host "  Then open:       http://localhost:3000/admin"
Write-Host ""
Write-Host "  Test account"
Write-Host "    email:      owner@bookshop.local"
Write-Host "    password:   bookshop1234"
Write-Host ""
Write-Host "  Database UI:     http://localhost:54323"
Write-Host ""
Write-Host "  Stop database:   npm.cmd run db:stop"
Write-Host "  Reset data:      npm.cmd run db:reset"
Write-Host ""
