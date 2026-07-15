# Smoke test: verify backend endpoints respond
$ErrorActionPreference = "Stop"
$base = $env:AEROSHIELD_BACKEND ?? "http://localhost:8080"

Write-Host "[smoke] GET $base/healthz"
$h = Invoke-RestMethod -Uri "$base/healthz" -TimeoutSec 5
if ($h -ne "ok") { throw "healthz failed: $h" }

Write-Host "[smoke] GET $base/api/flights"
$f = Invoke-RestMethod -Uri "$base/api/flights" -TimeoutSec 30
Write-Host "[smoke] flights count: $($f.flights.Count)"

Write-Host "[smoke] OK"
