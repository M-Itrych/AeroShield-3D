# AeroShield 3D

<p align="center">
  <em>Real-Time 3D Aviation Hazard Awareness &amp; Rerouting Platform</em>
</p>

<p align="center">
  A web-based <strong>3D digital twin of global aviation airspace</strong> that visualizes
  live flights, overlays volumetric SIGMET weather hazards, computes dynamic time-to-impact
  for each aircraft, and suggests reroute corridors — all in a dark tactical HUD interface.
</p>

<p align="center">
  <img alt="Backend" src="https://img.shields.io/badge/backend-Rust%20%2F%20Axum-dea584?style=flat&logo=rust" />
  <img alt="Frontend" src="https://img.shields.io/badge/frontend-React%2018%20%2B%20Vite-61dafb?style=flat&logo=react" />
  <img alt="3D" src="https://img.shields.io/badge/3D-CesiumJS-6ab52b?style=flat" />
  <img alt="UI" src="https://img.shields.io/badge/UI-shadcn%2Fui-000000?style=flat" />
  <img alt="Data" src="https://img.shields.io/badge/data-OpenSky%20%2F%20AviationWeather-39ff14?style=flat" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat" />
</p>

<p align="center">
  <a href="#features">Features</a> |
  <a href="#architecture">Architecture</a> |
  <a href="#run-locally">Run Locally</a> |
  <a href="./docs/ARCHITECTURE.md">Docs</a> |
  <a href="./docs/API.md">API</a> |
  <a href="./docs/DIAGRAMS.md">UML</a> |
  <a href="./docs/CONTRIBUTING.md">Contributing</a>
</p>

---

## The Problem

Pilots and dispatchers rely on outdated, text-heavy METAR/TAF reports or flat 2D maps to
avoid sudden weather hazards — turbulence, volcanic ash, convective storms, and restricted
airspace. These tools lack real-time 3D spatial awareness, making hazard avoidance harder
than it should be.

## The Solution

AeroShield 3D is a **3D digital twin** of active global airspace that:

- Renders **live aircraft positions** on a CesiumJS globe as heading-oriented billboards.
- Parses **active SIGMET polygons** from AviationWeather.gov and extrudes them as
  **volumetric 3D hazard zones** with min/max altitude bands.
- Runs a Rust spatial engine that flags flights **inside** a hazard polygon AND within its
  altitude band as `HIGH` risk, or **projected to enter** within 10 minutes as `MEDIUM` —
  with a real **time-to-impact countdown** computed from velocity + heading.
- Streams those risk assessments via **Server-Sent Events** (delta-only), so dispatchers see
  at-risk flights glow orange in real time.
- Suggests **smart reroute corridors** around hazards for HIGH-risk flights, with extra
  distance and time estimates per option.

---

## Features

### Core
- **Live flight tracking** — 10,000+ flights from OpenSky Network, polled every 60s
- **3D SIGMET volumes** — extruded hazard polygons with altitude bands, dimmed when they
  don't intersect the selected flight's altitude
- **Dynamic risk engine** — point-in-polygon + altitude band + ray-marched projected entry
  time (replaces the static 50km/5min heuristic)
- **Time-to-impact countdown** — `T XM` chips on flight labels and detail panels
- **SSE risk stream** — delta-only push with reconnection + exponential backoff
- **Smart reroute advisor** — LEFT/RIGHT detour corridors around SIGMET polygons with
  extra distance/time per option

### Frontend
- **Tactical HUD theme** — two-neon discipline (lime `#39ff14` / orange `#ff5f1f`),
  monospace typography, starfield background
- **Primitive collections** — GPU-batched `BillboardCollection` + `LabelCollection` for
  200 flights + 10k airports at 60fps
- **Mobile support** — dedicated `/m` route with bottom-sheet layout, auto-redirect
  based on viewport
- **Flight trails** — altitude-colored position history (60 points per flight)
- **Route visualization** — great-circle dep-to-arr line + projected path + descent profile
- **Keyboard shortcuts** — `/` search, `f` follow, `r` reset, `space` auto-rotate
- **Airport METAR** — flight category (VFR/MVFR/IFR/LIFR) with raw observation

### Backend
- **Triple-layer moka cache** — global states (60s), bbox (30s, 1-degree grid),
  route (5min)
- **429 backoff** — exponential retry on OpenSky rate limiting
- **Freshness tracking** — `updated_at` timestamps on all responses
- **Prometheus metrics** — `GET /metrics` + `GET /stats` JSON summary
- **SSE subscriber tracking** — live count of connected clients

---

## Architecture

```
[OpenSky Network]      [AviationWeather.gov]
        |                       |
        v                       v
+------------------------------------------+
|         Rust Backend (Axum :8080)         |
|  OpenSky client (moka cache 60s + bbox)  |
|  AviationWeather client (5min refresh)   |
|  Risk engine (geo PIP + projection)      |
|  Trail store (DashMap, 60 pts/flight)    |
|  SSE delta stream (changed risks only)   |
|  REST: /api/* /stats /metrics /healthz   |
+------------------------------------------+
                    |
                    | SSE (event: risk)
                    v
+------------------------------------------+
|      React + Vite Frontend (:5173)       |
|  CesiumJS 3D globe (resium)              |
|  BillboardCollection (imperative)        |
|  TanStack Query + Router                 |
|  shadcn/ui tactical HUD theme            |
|  Mobile /m route (bottom-sheet)          |
+------------------------------------------+
```

> Full architecture docs: [ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
> [DESIGN.md](./docs/DESIGN.md) |
> [TECHNICAL.md](./docs/TECHNICAL.md) |
> [DIAGRAMS.md (UML)](./docs/DIAGRAMS.md)

---

## Run Locally

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.78+ (stable) | Backend |
| Node.js | 20 LTS | Frontend |
| pnpm | 9+ | Package manager |

### 1. Backend

```bash
cd backend
cp .env.example .env          # add OpenSky credentials for higher rate limits (optional)
cargo run --release
# Server listening on http://localhost:8080
```

Verify:

```bash
curl http://localhost:8080/healthz   # -> ok
curl http://localhost:8080/stats     # -> JSON summary
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm run dev
# UI on http://localhost:5173 (proxies /api -> :8080)
```

Open `http://localhost:5173` on desktop or `http://localhost:5173/m` on mobile.

### 3. Smoke Test

```powershell
./scripts/smoke.ps1   # hits /healthz, /stats, /metrics, /api/* — exits non-zero on failure
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENSKY_BASE` | `https://opensky-network.org/api` | OpenSky API base URL |
| `OPENSKY_USER` | (none) | Optional: OpenSky username for higher rate limits |
| `OPENSKY_PASS` | (none) | Optional: OpenSky password |
| `AVIATION_WEATHER_BASE` | `https://aviationweather.gov/api/data` | AviationWeather API base |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/healthz` | Health check |
| `GET` | `/stats` | JSON system statistics |
| `GET` | `/metrics` | Prometheus-format metrics |
| `GET` | `/api/flights` | List flights (filter by `?risk=HIGH` or bbox) |
| `GET` | `/api/flights/:icao24` | Single flight detail |
| `GET` | `/api/flights/:icao24/trail` | Position history trail |
| `GET` | `/api/flights/:icao24/route` | Estimated dep/arr airports |
| `GET` | `/api/sigmets` | Active SIGMET polygons |
| `GET` | `/api/airports/:icao` | Airport info |
| `GET` | `/api/airports/:icao/metar` | Latest METAR observation |
| `GET` | `/api/sse/risk-stream` | **SSE** — delta risk stream |

> Full API docs: [docs/API.md](./docs/API.md)

### SSE Contract

```
GET /api/sse/risk-stream

event: risk
data: {
  "flight": "4baa1f",
  "callsign": "THY23",
  "lat": 41.0,
  "lon": 28.8,
  "alt_ft": 35000,
  "risk": "HIGH",
  "sigmet_id": "ZNY-A-1",
  "minutes_to_impact": 0
}
```

---

## Visual Style — Tactical HUD

| Element | Color | Usage |
|---------|-------|-------|
| Space | `#08080a` | App + globe void background |
| Charcoal | `#121315` | Globe base color |
| Lime | `#39ff14` | Safe tracks, routes, active UI states |
| Orange | `#ff5f1f` | Hazards, at-risk tracks, SIGMETs |
| Ink | `#b8c4cc` | Body text, label values |
| Dim | `#5a6770` | Captions, metadata, placeholders |

Two-neon discipline: the only saturated colors are lime and orange. No other
accent hues are permitted. See `AGENTS.md` section 7 for the full canonical palette.

---

## Data Sources

All sources are **free, no API key required**:

| Source | Provider | Rate Limit | Poll Cadence |
|--------|----------|------------|--------------|
| Live flights | [OpenSky Network](https://opensky-network.org) | 400 req/day (anon) | 60s |
| SIGMETs / METARs | [AviationWeather.gov](https://aviationweather.gov) | Unlimited | 5min / on-demand |
| Airports DB | [GitHub raw JSON](https://github.com/mwgg/Airports) | Unlimited | Startup cache |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | C4 model, data flow, deployment, NFRs |
| [Design](./docs/DESIGN.md) | Risk engine, SSE contract, rendering, reroute, mobile |
| [Technical](./docs/TECHNICAL.md) | Backend + frontend module documentation |
| [API Reference](./docs/API.md) | Full REST + SSE endpoint documentation |
| [UML Diagrams](./docs/DIAGRAMS.md) | Class, sequence, deployment, ER, state machine (Mermaid) |
| [ADRs](./docs/adr/) | 6 Architecture Decision Records |
| [Contributing](./docs/CONTRIBUTING.md) | Setup, conventions, verification checklist |
| [Changelog](./docs/CHANGELOG.md) | Version history |

---

## Project Layout

```
AeroShield-3D/
├── backend/               # Rust (Axum) — flight + hazard ingestion, spatial checks, SSE
│   └── src/
│       ├── main.rs         # Entry point
│       ├── models.rs       # Data models (serde structs)
│       ├── opensky.rs      # OpenSky client + moka caches
│       ├── aviationweather.rs # SIGMET + METAR client
│       ├── airports.rs     # Airport index (DashMap)
│       ├── risk.rs         # Spatial risk engine (PIP, projection, TTI)
│       ├── state.rs        # AppState, background tasks, trails
│       ├── routes.rs       # Axum route handlers
│       └── sse.rs          # Delta-only SSE stream
├── frontend/              # React + Vite + Tailwind + shadcn/ui + CesiumJS
│   └── src/
│       ├── routes/         # TanStack Router (/ , /m, /flight/$id, /airport/$icao)
│       ├── components/     # CesiumGlobe, FlightLayer, HazardLayer, RerouteLayer, ...
│       ├── hooks/          # useRiskStream, useFlights, useViewportBbox, ...
│       ├── lib/            # camera-utils, flight-icons, reroute-utils
│       ├── types/          # TS domain interfaces
│       └── styles/         # globals.css (Tailwind + starfield)
├── docs/                  # Architecture, design, technical, API, diagrams, ADRs
├── scripts/               # smoke.ps1, start.ps1, start.cmd
├── AGENTS.md              # AI agent operating rules
├── PLAN.md                # Task-based build plan
├── CONTRIBUTING.md        # Contribution guide
├── CHANGELOG.md           # Version history
└── README.md              # This file
```

---

## Verification Commands

```bash
# Backend (Rust)
cd backend
cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test

# Frontend (TypeScript)
cd frontend
pnpm run lint && pnpm run typecheck && pnpm run build
```

---

## AI Agent Workflow

This repo is built **by AI agents** under the `opencode` runtime, in scoped stages:

| Stage | Agent | Scope |
|-------|-------|-------|
| 0 | `setup` | Repo bootstrap, toolchain, theme tokens |
| 1 | `backend-core` | Rust data fetchers, spatial risk engine, SSE |
| 2 | `frontend-core` | Cesium globe, layers, SSE subscriber, styling |
| 3 | `frontend-ui` | Panels, flight/airport dashboards, HUD, shortcuts |
| 4 | `hardening` | Rate-limit handling, logging, smoke tests, polish |

See [`AGENTS.md`](./AGENTS.md) for operating rules and [`PLAN.md`](./PLAN.md) for the
task checklist.

---

## License

MIT — see `LICENSE` for details.
