# Changelog

All notable changes to AeroShield 3D are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- Improvement plan (`docs/IMPROVEMENT-PLAN.md`) with audit findings + feature roadmap

## [0.2.0] — 2026-07-16

### Added — Risk Stream & Decision Support
- **SSE risk stream** (`useRiskStream` hook): subscribes to `/api/sse/risk-stream`,
  parses `event: risk` payloads, dedupes by flight ID, hydrates TanStack Query cache.
  Exponential backoff reconnection (3s -> 30s cap). Closes PLAN.md S2.7.
- **Stream status indicator**: HudBar shows LIVE / SYNC / RECON / DOWN based on
  SSE connection state.
- **Dynamic Time-to-Impact (TTI)**: replaced static 50km/5min heuristic with
  real projected entry time via velocity + heading ray-march against polygon
  edges. `minutes_to_impact` field in SSE + REST payload. Countdown chips on
  flight labels and detail panel.
- **Smart Reroute Advisor**: for HIGH-risk flights, computes 2 detour corridors
  (LEFT/RIGHT, 100/150nm offset) around the SIGMET polygon. Renders dashed lime
  polylines with +km labels on the globe, plus summary block in detail panel.

### Added — 3D Hazard Rendering
- **Extruded SIGMET volumes**: hazard polygons now render as true 3D extruded
  volumes using `min_ft` / `max_ft` (height + extrudedHeight). Hazards whose
  altitude band doesn't intersect the selected flight are dimmed.

### Added — Mobile Support
- **Dedicated `/m` mobile route**: phone-optimized layout with full-bleed globe,
  compact top HUD, floating controls, and draggable bottom sheet with 3 tabs
  (TRACKS / HAZARDS / DETAIL) at collapsed/half/full heights. Auto-redirect
  between `/` and `/m` based on viewport width (< 768px).

### Added — Backend Hardening
- **moka bbox cache** (30s TTL, keyed by 1-degree-rounded bbox): pan without
  burning the OpenSky 400 req/day budget.
- **Route cache** (5min TTL per icao24).
- **429 retry with exponential backoff** (3 attempts, 0.5s -> 4s).
- **Freshness timestamps**: `flights_updated_at` + `sigmets_updated_at` on
  `/api/flights` and `/stats`.
- **SSE subscriber tracking**: atomic counter with subscribe/unsubscribe.
- **`GET /stats`**: JSON summary (flights, sigmets, risk counts, SSE subs,
  airports indexed, timestamps).
- **`GET /metrics`**: Prometheus text-format gauges.
- **Delta-only SSE push**: backend only sends changed risks (risk level or
  sigmet_id delta), not all risks every 5s.
- **Expanded `smoke.ps1`**: now hits /stats, /metrics, /api/sigmets,
  /api/airports, /api/flights/:icao/trail + /route.

### Added — Documentation
- `docs/ARCHITECTURE.md`: C4 model, data flow, deployment, NFRs.
- `docs/DESIGN.md`: risk engine, SSE contract, rendering architecture, reroute
  algorithm, mobile design, visual design system.
- `docs/TECHNICAL.md`: backend + frontend module documentation.
- `docs/API.md`: full REST + SSE API reference.
- `docs/DIAGRAMS.md`: UML class, sequence, deployment, ER, state machine
  diagrams (Mermaid).
- `docs/adr/`: 6 Architecture Decision Records.
- `docs/CONTRIBUTING.md`: contribution guide.
- `docs/CHANGELOG.md`: this file.

### Changed
- **README palette synced** to AGENTS.md section 7 tactical HUD standard
  (lime `#39ff14` / orange `#ff5f1f`, removed cyan/amber references).
- **`HazardPanel`** already displayed altitude bands; no change needed.

### Performance Fixes
- **useRiskStream**: batch SSE events, flush to state at most every 2s instead
  of on every message (was triggering full re-render cascade).
- **FlightTrailLayer**: collapsed 60 per-segment Entity polylines into 1
  single polyline + 3 point entities (63 -> 4 entities per selected flight).
- **FlightPredictLayer**: wrapped in `useMemo`, reduced segments 80->24 (path)
  and 32->12 (traveled) => ~92 entities -> ~36.
- **RerouteLayer**: memoized entity computation + wrapped in `React.memo`.
- **HazardLayer**: wrapped in `React.memo`.
- **AirportsLayer**: rewritten to use `PointPrimitiveCollection` +
  `LabelCollection` (imperative). Eliminated ~30,000 resium Entity components.
- **FlightLayer**: rewritten to use `BillboardCollection` + `LabelCollection`
  (imperative). MAX_FLIGHTS lowered 500 -> 200. Zero React reconciliation
  per flight.

## [0.1.0] — Initial Build

### Added
- Rust backend (Axum): OpenSky client, AviationWeather SIGMET + METAR client,
  airport index, risk engine (geo PIP + altitude band), trail store, SSE
  stream, REST routes.
- React frontend (Vite + CesiumJS): CesiumGlobe, FlightLayer, HazardLayer,
  FlightTrailLayer, RouteLineLayer, FlightPredictLayer, AirportsLayer,
  FlightsPanel (virtualized), HazardPanel, FlightDetailPanel, HudBar,
  GlobeControlBar.
- TanStack Query + Router integration with 60s refetch.
- shadcn/ui tactical HUD theme (dark, monospace, two-neon discipline).
- Keyboard shortcuts, follow-mode, auto-rotate, viewport bbox culling.
- TanStack Router routes: `/`, `/flight/$id`, `/airport/$icao`.
- 7 backend unit tests (polygon containment, SIGMET parser, risk classifier).
- `scripts/smoke.ps1`, `scripts/start.ps1`, `scripts/start.cmd`.
- `AGENTS.md`, `PLAN.md`, `opencode.json`.
