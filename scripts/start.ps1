<#
.SYNOPSIS
    AeroShield 3D - Start backend + frontend in one command.
.DESCRIPTION
    Sets up PATH (MinGW + Cargo), starts the Rust backend on :8080,
    starts the Vite dev server on :5173, and opens the browser.
.PARAMETER BackendOnly
    Skip frontend startup.
.PARAMETER FrontendOnly
    Skip backend startup.
.EXAMPLE
    .\scripts\start.ps1
    .\scripts\start.ps1 -BackendOnly
#>

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$mingwBin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin"
$cargoBin = "$env:USERPROFILE\.cargo\bin"

if ((Test-Path $mingwBin)) {
    $env:PATH = "$mingwBin;$env:PATH"
    Write-Host "[start] MinGW on PATH" -ForegroundColor DarkGreen
} else {
    Write-Host "[start] MinGW not found at expected path - assuming cargo linkers are configured" -ForegroundColor Yellow
}

if ((Test-Path $cargoBin)) {
    $env:PATH = "$cargoBin;$env:PATH"
    Write-Host "[start] Cargo on PATH" -ForegroundColor DarkGreen
} else {
    Write-Host "[start] Cargo bin not found - is rustup installed?" -ForegroundColor Red
    exit 1
}

$env:RUST_LOG = "aeroshield_backend=info,tower_http=info"

$jobs = @()

if (-not $FrontendOnly) {
    Write-Host "[start] starting backend (cargo run, port 8080)..." -ForegroundColor Cyan
    $backendJob = Start-Job -Name "aeroshield-backend" -ScriptBlock {
        param($root)
        Set-Location -LiteralPath "$root\backend"
        cargo run 2>&1
    } -ArgumentList $root
    $jobs += $backendJob

    Write-Host "[start] waiting for backend to compile + bind :8080..." -ForegroundColor DarkYellow
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Seconds 2
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:8080/healthz" -UseBasicParsing -TimeoutSec 3
            $ready = $true
            break
        } catch {}
    }
    if ($ready) {
        Write-Host "[start] backend ready - http://localhost:8080/healthz" -ForegroundColor Green
    } else {
        Write-Host "[start] backend not responding after 80s - check compile errors" -ForegroundColor Red
        Receive-Job $backendJob -ErrorAction SilentlyContinue
        exit 1
    }
}

if (-not $BackendOnly) {
    Write-Host "[start] starting frontend (pnpm dev, port 5173)..." -ForegroundColor Cyan
    $frontendJob = Start-Job -Name "aeroshield-frontend" -ScriptBlock {
        param($root)
        Set-Location -LiteralPath "$root\frontend"
        pnpm run dev 2>&1
    } -ArgumentList $root
    $jobs += $frontendJob

    Write-Host "[start] waiting for Vite to bind :5173..." -ForegroundColor DarkYellow
    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 1
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 3
            $ready = $true
            break
        } catch {}
    }
    if ($ready) {
        Write-Host "[start] frontend ready - http://localhost:5173" -ForegroundColor Green
        Start-Process "http://localhost:5173"
    } else {
        Write-Host "[start] frontend not responding - did you run pnpm install?" -ForegroundColor Red
        Receive-Job $frontendJob -ErrorAction SilentlyContinue
        if ($jobs.Count -gt 1) { Stop-Job $jobs[0] }
        exit 1
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor White
Write-Host "  AeroShield 3D is running" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor Cyan
if (-not $FrontendOnly) { Write-Host "  Backend:   http://localhost:8080" -ForegroundColor Cyan }
Write-Host "  Press Ctrl+C to stop both" -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor White
Write-Host ""

Write-Host "[start] streaming logs (backend + frontend)..." -ForegroundColor DarkGray
try {
    while ($true) {
        foreach ($job in $jobs) {
            $out = Receive-Job $job -ErrorAction SilentlyContinue
            if ($out) {
                $tag = $job.Name.Replace("aeroshield-", "").ToUpper()
                foreach ($line in ($out -split "`n")) {
                    if ($line.Trim()) {
                        Write-Host "[$tag] $line" -ForegroundColor DarkGray
                    }
                }
            }
        }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "[start] stopping jobs..." -ForegroundColor Yellow
    $jobs | Stop-Job
    $jobs | Remove-Job -Force
}
