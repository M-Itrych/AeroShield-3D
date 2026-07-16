# Smoke test: verify backend endpoints respond
$ErrorActionPreference = "Stop"
$base = $env:AEROSHIELD_BACKEND ?? "http://localhost:8080"

Write-Host "[smoke] GET $base/healthz"
$h = Invoke-RestMethod -Uri "$base/healthz" -TimeoutSec 5
if ($h -ne "ok") { throw "healthz failed: $h" }

Write-Host "[smoke] GET $base/stats"
$s = Invoke-RestMethod -Uri "$base/stats" -TimeoutSec 10
Write-Host "[smoke] stats: flights=$($s.flights_tracked) sigmets=$($s.sigmets_active) sse=$($s.sse_subscribers)"

Write-Host "[smoke] GET $base/metrics"
$m = Invoke-RestMethod -Uri "$base/metrics" -TimeoutSec 10
if (-not $m.Contains("aeroshield_flights_tracked")) { throw "metrics missing flights_tracked" }

Write-Host "[smoke] GET $base/api/flights"
$f = Invoke-RestMethod -Uri "$base/api/flights" -TimeoutSec 30
Write-Host "[smoke] flights count: $($f.flights.Count)"

Write-Host "[smoke] GET $base/api/sigmets"
$sg = Invoke-RestMethod -Uri "$base/api/sigmets" -TimeoutSec 30
Write-Host "[smoke] sigmets count: $($sg.sigmets.Count)"

if ($f.flights.Count -gt 0) {
    $sample = $f.flights[0]
    $icao = $sample.icao24
    Write-Host "[smoke] GET $base/api/flights/$icao/trail"
    $t = Invoke-RestMethod -Uri "$base/api/flights/$icao/trail" -TimeoutSec 15
    Write-Host "[smoke] trail points: $($t.trail.Count)"

    Write-Host "[smoke] GET $base/api/flights/$icao/route"
    $r = Invoke-RestMethod -Uri "$base/api/flights/$icao/route" -TimeoutSec 15
    Write-Host "[smoke] route: dep=$($r.departure) arr=$($r.arrival)"
}

Write-Host "[smoke] GET $base/api/airports/KJFK"
$a = Invoke-RestMethod -Uri "$base/api/airports/KJFK" -TimeoutSec 15
if ($a.error) { Write-Host "[smoke] airport KJFK: $($a.error)" }
else { Write-Host "[smoke] airport KJFK: $($a.name)" }

Write-Host "[smoke] OK"
