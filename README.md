# AeroShield 3D

<p align="center">
  <em>Real-Time Aviation Hazard &amp; Routing Analyzer</em>
</p>

<p align="center">
  A web-based <strong>3D digital twin of global aviation airspace</strong> that visualizes
  live flights and overlays volumetric weather hazard zones (SIGMETs), flagging aircraft
  on a collision course with severe weather. Built with a Rust backend and React + CesiumJS frontend
  in a dark cyber-radar visual style.
</p>

<p align="center">
  <img alt="Stack" src="https://img.shields.io/badge/backend-Rust%20%2F%20Axum-dea584?style=flat" />
  <img alt="Stack" src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-61dafb?style=flat" />
  <img alt="Stack" src="https://img.shields.io/badge/3D-CesiumJS-6ab52b?style=flat" />
  <img alt="Stack" src="https://img.shields.io/badge/UI-shadcn%2Fui-000000?style=flat" />
  <img alt="Data" src="https://img.shields.io/badge/data-OpenSky%20%2F%20AviationWeather-4f9cf9?style=flat" />
</p>

---

## The Problem

Pilots and dispatchers rely on outdated, text-heavy METAR/TAF reports or flat 2D maps to avoid
sudden weather hazards — turbulence, volcanic ash, convective storms, and restricted airspace.
These tools lack real-time 3D spatial awareness, making hazard avoidance harder than it should be.

## The Solution

AeroShield 3D is a **3D digital twin** of active global airspace that:

- Renders live aircraft positions on a CesiumJS globe as 3D markers with heading orientation.
- Parses **active SIGMET polygons** from AviationWeather.gov and extrudes them as translucent
  crimson volumetric zones with min/max altitude bands.
- Runs a Rust spatial engine that flags flights **inside** a hazard polygon AND within its altitude
  band as `HIGH` risk, or projected to enter within 50 km / 5 min as `MEDIUM`.
- Streams those risk assessments to the frontend via **Server-Sent Events**, so dispatchers see
  at-risk flights glow red in real time — no manual cross-referencing required.

## Architecture

```
[OpenSky Network API]      [AviationWeather.gov SIGMET API]
            \                          /
             v                        v
   +------------------------------------------+
   |        Rust Backend (Axum)               |
   |  - Flight state ingest (moka cache 60s)  |
   |  - SIGMET polygon parser (5min refresh)  |
   |  - geo crate Point-in-Polygon + altitude |
   |  - SSE risk stream                       |
   +------------------------------------------+
                        |
                        |  Server-Sent Events
                        v
   +------------------------------------------+
   |        React + Vite Frontend            |
   |  - CesiumJS 3D globe (resium)           |
   |  - TanStack Query / Router              |
   |  - shadcn/ui dark cyber-radar theme    |
   +------------------------------------------+
```

### Backend — Rust / Axum

| Concern              | Implementation                                              |
| -------------------- | --------------------------------------------------------- |
| Live flights         | OpenSky `/states/all`, polled every 60s, cached with `moka` |
| Weather hazards      | AviationWeather.gov SIGMET fetcher, refreshed every 5 min  |
| Spatial computation  | `geo` crate Point-in-Polygon + altitude-band filter       |
| Risk scoring         | `HIGH` (inside polygon + alt band), `MEDIUM` (50km/5min projected), `NONE` |
| Streaming            | `GET /api/sse/risk-stream` — SSE per `event: risk` contract |
| HTTP                 | `GET /api/flights`, `GET /api/sigmets`, `GET /api/airports/:icao`, `GET /healthz` |

### Frontend — React + Vite + CesiumJS

- **3D globe**: CesiumJS via resium — dark imagery, no chrome, CRT scanline overlay.
- **State**: TanStack Query (60s refetch) hydrates [`flights`], [`sigmets`] caches; SSE hydrates [`risk-flights`].
- **Routing**: TanStack Router file-based — `/`, `/flight/$id`, `/airport/$icao`.
- **UI**: shadcn/ui components on the dark cyber-radar theme (near-black, cyan-green CRT glow, crimson hazards).
- **Pieces**: `CesiumGlobe`, `FlightLayer` (billboard sprites w/ heading), `HazardLayer` (extruded translucent red polygons), `RiskSubscriber` (EventSource → query cache).

## Visual Style — Dark Cyber-Radar

| Element        | Color                                             |
| -------------- | ------------------------------------------------- |
| Background     | `#05070a` — near-black radar screen               |
| Grid / accent  | `#12ffaa` — subtle cyan-green CRT glow             |
| Hazard zones   | `#ff3358` alpha 0.18 — crimson volumetric translucent |
| At-risk flights| pulsing red glow ring around sprite               |
| Safe flights   | amber/off-white plane icons                        |
| Borders        | `border-cyan-500/15` — subtle                      |
| Mono font      | `ui-monospace, "JetBrains Mono", monospace`        |

## Data Sources (Free, No-Key)

| Source              | Provider              | Endpoint base                                                  |
| ------------------- | --------------------- | -------------------------------------------------------------- |
| Live flights        | OpenSky Network       | `https://opensky-network.org/api`                              |
| Aviation weather    | AviationWeather.gov   | `https://aviationweather.gov/api/data`                         |
| Airports DB         | open-source JSON      | cached ICAO/IATA JSON dump                                      |

> OpenSky anonymous rate limit: 400 req/day, 100 req/5min. The backend polls every 60s and caches with `moka`.

## Run Locally

### Prerequisites

- **Rust** stable (1.78+) via `rustup`
- **Node.js** 20 LTS + `pnpm`
- (Optional) OpenSky account for higher rate limits (set `OPENSKY_USER` / `OPENSKY_PASS`)

### 1. Backend

```bash
cd backend
cp .env.example .env          # add OpenSky credentials if you have them
cargo run --release
# Server listening on http://localhost:8080
```

Verify with the health check:

```bash
curl http://localhost:8080/healthz   # -> ok
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm run dev
# UI on http://localhost:5173 (proxies /api -> :8080)
```

### 3. Smoke Test

```powershell
./scripts/smoke.ps1   # hits /healthz + /api/flights, exits non-zero on empty
```

## SSE Contract

Backend exposes `GET /api/sse/risk-stream` returning Server-Sent Events:

```
event: risk
data: {"flight":"4baa1f","callsign":"THY23","lat":..,"lon":..,"alt_ft":..,"risk":"HIGH","sigmet_id":"SIG_123"}
```

The frontend subscribes via `EventSource`, dedupes by flight id, and hydrates into the TanStack Query cache as `['risk-flights']`.

## Project Layout

```
AeroShield-3D/
├── backend/               # Rust (Axum) — flight + hazard ingestion, spatial checks, SSE
├── frontend/              # React + Vite + Tailwind + shadcn/ui + CesiumJS
├── packages/              # Shared types (optional TS crate bindings)
├── scripts/               # dev utilities (smoke tests)
├── docs/                  # architecture diagrams, ADRs
├── AGENTS.md              # AI agent operating rules
├── PLAN.md                # task-based build plan
├── opencode.json          # opencode config (agents, permissions)
└── README.md
```

## AI Agent Workflow

This repo is built **by AI agents** under the `opencode` runtime, in scoped stages:

| Stage | Agent           | Scope                                                   |
| ----- | --------------- | ------------------------------------------------------- |
| 0     | `setup`         | Repo bootstrap, toolchain, theme tokens                 |
| 1     | `backend-core`  | Rust data fetchers, spatial risk engine, SSE            |
| 2     | `frontend-core` | Cesium globe, layers, SSE subscriber, CRT styling       |
| 3     | `frontend-ui`   | Panels, flight/airport dashboards, HUD, shortcuts        |
| 4     | `hardening`     | Rate-limit handling, logging, smoke tests, final polish |

See [`AGENTS.md`](./AGENTS.md) for operating rules and [`PLAN.md`](./PLAN.md) for the task checklist.

### Verification commands

- Rust: `cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test`
- Frontend: `pnpm run lint && pnpm run typecheck && pnpm run build`

## License

MIT — see `LICENSE` for details.
