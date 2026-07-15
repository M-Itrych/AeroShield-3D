# AeroShield 3D

A web-based **3D digital twin of global aviation airspace** that visualizes live flights and overlays volumetric weather hazard zones, flagging aircraft on a collision course with severe weather (SIGMETs).

## Architecture

```
[OpenSky API]      [AviationWeather.gov API]
        \                /
         v              v
   +----------------------------+
   |  Rust Backend (Axum)       | <-- geo spatial checks
   +----------------------------+
                  | Server-Sent Events
                  v
   +-----------------------------------------+
   |  React + Vite + CesiumJS (resium)       |
   |  TanStack Query / Router + shadcn/ui    |
   +-----------------------------------------+
```

### Backend (Rust / Axum)
- Fetches live flight state vectors from **OpenSky Network** (60s poll, moka cache).
- Fetches **SIGMET** polygon alerts from **AviationWeather.gov**.
- Computes 3D risk: lat/lon inside polygon AND altitude within SIGMET altitude band → `HIGH`.
- Streams risk events via SSE: `GET /api/sse/risk-stream`.

### Frontend (React + Vite + Tailwind v4 + shadcn/ui)
- 3D globe via **CesiumJS** / **resium**.
- URL-driven routes via **TanStack Router** (`/`, `/flight/$id`, `/airport/$icao`).
- Live data via **TanStack Query** + SSE hydration.
- Visual style: **Dark Cyber-Radar** (near-black, cyan-green CRT glow, crimson hazards).

## Run Locally

### Prerequisites
- Rust stable (1.78+)
- Node 20 LTS + `pnpm`
- (Optional) OpenSky account for higher rate limits

### Backend
```bash
cd backend
cp .env.example .env   # set OPENSKY_USER / OPENSKY_PASS if you have them
cargo run --release
# Server on http://localhost:8080
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm run dev
# UI on http://localhost:5173
```

## Data Sources (Free, No-Key)

| Source | Provider | Endpoint base |
|--------|----------|---------------|
| Live flights | OpenSky Network | `https://opensky-network.org/api` |
| Aviation weather / SIGMETs | AviationWeather.gov | `https://aviationweather.gov/api/data` |
| Airports DB | open-source ICAO/IATA JSON | `https://raw.githubusercontent.com/.../airports.json` (cached) |

## Agents

This repo is built by AI agents per `AGENTS.md` rules and `PLAN.md` task list. See those files before contributing.
