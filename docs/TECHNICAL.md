# Technical Documentation — AeroShield 3D

> Module-level documentation for developers. For architecture see
> [ARCHITECTURE.md](./ARCHITECTURE.md). For API reference see [API.md](./API.md).

---

## 1. Backend — Rust / Axum

### 1.1 Module Map

```
backend/src/
├── main.rs              # Entry point: env config, startup, server bind
├── lib.rs               # Module declarations + app() factory
├── models.rs            # Data models (serde structs)
├── opensky.rs           # OpenSky API client + caching
├── aviationweather.rs   # AviationWeather.gov SIGMET + METAR client
├── airports.rs          # Airport index (DashMap, ICAO/IATA lookup)
├── risk.rs              # Spatial risk engine (PIP, projection, TTI)
├── state.rs             # AppState: shared state, background tasks, trails
├── routes.rs            # Axum route handlers (REST + /stats + /metrics)
└── sse.rs               # SSE delta stream handler
```

### 1.2 Data Models (`models.rs`)

```rust
FlightVector {
    icao24: String,           // ICAO 24-bit hex transponder address
    callsign: Option<String>,  // Flight callsign (e.g., "THY23")
    origin_country: String,
    longitude: f64,
    latitude: f64,
    baro_altitude: Option<f64>, // Barometric altitude in meters
    velocity: Option<f64>,     // m/s
    heading: Option<f64>,      // degrees (true)
    on_ground: bool,
}

HazardPolygon {
    sigmet_id: String,          // e.g., "ZNY-A-1"
    points: Vec<(f64, f64)>,    // (lon, lat) pairs
    min_ft: Option<f64>,        // Lower altitude bound (feet)
    max_ft: Option<f64>,        // Upper altitude bound (feet)
    hazard_type: String,        // CONVECTIVE, TURBULENCE, ICING, etc.
}

RiskAssessment {
    flight: String,             // icao24
    callsign: Option<String>,
    lat: f64,
    lon: f64,
    alt_ft: Option<f64>,
    risk: RiskLevel,            // NONE | MEDIUM | HIGH
    sigmet_id: Option<String>,
    minutes_to_impact: Option<f64>,  // TTI (0 = already inside)
}

Airport {
    icao: String,
    iata: Option<String>,
    name: String,
    country: String,
    latitude: f64,
    longitude: f64,
}

FlightRoute {
    icao24: String,
    callsign: Option<String>,
    departure: Option<String>,   // ICAO code
    arrival: Option<String>,
    departure_airport: Option<Airport>,
    arrival_airport: Option<Airport>,
    first_seen: Option<u64>,
    last_seen: Option<u64>,
}

MetarReport {
    icao: String,
    raw_ob: Option<String>,
    temp_c, dewpoint_c: Option<f64>,
    wind_dir: Option<i32>,       // degrees
    wind_speed_kt: Option<i32>,
    visibility_sm: Option<f64>,
    flight_category: Option<String>,  // VFR | MVFR | IFR | LIFR
    obs_time: Option<u64>,
}
```

### 1.3 OpenSky Client (`opensky.rs`)

| Cache | Key | TTL | Capacity | Purpose |
|-------|-----|-----|----------|---------|
| Global states | `()` | 60s | 1 | Dedupe `/states/all` calls |
| Bbox states | `(i32,i32,i32,i32)` rounded to 1° grid | 30s | 64 | Pan without refetch |
| Route | icao24 | 5min | 500 | Avoid repeated route lookups |

**429 Backoff**: `fetch_states()` retries up to 3 times with exponential backoff
(0.5s → 1s → 2s → 4s) on HTTP 429 or network error.

### 1.4 Risk Engine (`risk.rs`)

Public API:
```rust
pub fn assess(flight: &FlightVector, sigmets: &[HazardPolygon]) -> RiskAssessment
pub fn assess_many(flights: &[FlightVector], sigmets: &[HazardPolygon]) -> Vec<RiskAssessment>
```

Constants:
```rust
const MEDIUM_TTI_THRESHOLD_MIN: f64 = 10.0;
const MEDIUM_PROXIMITY_KM: f64 = 50.0;
const EARTH_R_M: f64 = 6_371_000.0;
```

Helper functions (private):
- `min_distance_to_polygon_km` — haversine + nearest-point-on-segment
- `projected_entry_time_min` — ray-march segment intersection
- `segment_crosses_boundary` — edge-by-edge segment intersection test
- `segments_intersect` — orientation-based segment-segment intersection
- `nearest_point_on_segment` — projects a point onto a line segment

### 1.5 AppState (`state.rs`)

Holds all shared mutable state behind `Arc<Inner>`:

```rust
struct Inner {
    opensky: OpenSkyClient,
    aviationweather: AviationWeatherClient,
    airports: AirportIndex,
    flights: RwLock<Vec<FlightVector>>,
    sigmets: RwLock<Vec<HazardPolygon>>,
    trails: DashMap<String, Vec<TrailPoint>>,        // 60 pts max
    flights_updated_at: RwLock<Option<u64>>,
    sigmets_updated_at: RwLock<Option<u64>>,
    sse_subscribers: AtomicU64,
}
```

Background tasks (spawned in `start_background_tasks`):
- Flight refresh: every 60s
- SIGMET refresh: every 300s (5 min)

### 1.6 SSE Handler (`sse.rs`)

- `SubscriberGuard` — increments subscriber count on connect, decrements on drop
  (when the client disconnects or the stream ends).
- Per-subscriber `HashMap<flight_id, RiskAssessment>` tracks the last-sent
  state; only deltas are pushed.
- Keep-alive ping every 15s.

---

## 2. Frontend — React + Vite + CesiumJS

### 2.1 Directory Structure

```
frontend/src/
├── main.tsx              # Entry: QueryClient + RouterProvider
├── routes/
│   ├── __root.tsx        # Root layout + mobile redirect
│   ├── index.tsx         # Desktop globe page (/)
│   ├── m.tsx             # Mobile globe page (/m)
│   ├── flight.$id.tsx    # Flight detail page
│   └── airport.$icao.tsx # Airport detail page (METAR)
├── components/
│   ├── CesiumGlobe.tsx       # Viewer setup, dark imagery, starfield
│   ├── FlightLayer.tsx       # BillboardCollection (imperative)
│   ├── AirportsLayer.tsx     # PointPrimitiveCollection (imperative)
│   ├── HazardLayer.tsx       # Extruded polygon entities
│   ├── FlightTrailLayer.tsx  # Single polyline trail
│   ├── RouteLineLayer.tsx    # Great-circle route + dep/arr markers
│   ├── FlightPredictLayer.tsx# Projected path + descent profile
│   ├── RerouteLayer.tsx      # Detour corridor polylines
│   ├── FlightsPanel.tsx      # Virtualized flight list (desktop)
│   ├── HazardPanel.tsx       # SIGMET list (desktop)
│   ├── FlightDetailPanel.tsx # Flight stats + risk + reroute
│   ├── HudBar.tsx            # Top HUD: stats + clock + stream status
│   ├── GlobeControlBar.tsx   # Layer toggles + view controls
│   └── ui/                   # shadcn/ui primitives
├── hooks/
│   ├── use-flights.ts        # TanStack Query: GET /api/flights (60s)
│   ├── use-sigmets.ts        # TanStack Query: GET /api/sigmets (60s)
│   ├── use-airports.ts       # TanStack Query: airport list
│   ├── use-airport.ts        # TanStack Query: single airport
│   ├── use-airport-metar.ts  # TanStack Query: METAR
│   ├── use-risk-stream.ts    # SSE EventSource + batch flush
│   ├── use-flight-trail.ts   # TanStack Query: trail
│   ├── use-flight-route.ts   # TanStack Query: route (2min stale)
│   ├── use-flight-region.ts  # Reverse geocode (country/state)
│   ├── use-viewport-bbox.ts  # Camera → bbox (600ms debounce)
│   ├── use-globe-click.ts    # ScreenSpaceEventHandler pick
│   ├── use-follow-flight.ts  # Camera lock-to-flight
│   ├── use-auto-rotate.ts    # Idle globe rotation
│   └── use-keyboard-shortcuts.ts
├── lib/
│   ├── camera-utils.ts       # flyTo helpers (reset, focusFlight, focusSigmet)
│   ├── flight-icons.ts       # Inline SVG Billboard images (base64)
│   ├── reroute-utils.ts      # Detour computation (haversine, bearing)
│   └── utils.ts              # cn() class merge
├── types/
│   └── domain.ts             # TS interfaces mirroring backend models
└── styles/
    └── globals.css          # Tailwind + starfield + Cesium overrides
```

### 2.2 Key Hooks

#### `useRiskStream`
- Subscribes to `/api/sse/risk-stream` via `EventSource`
- Parses `event: risk` messages into a `Map<flight_id, RiskAssessment>`
- Batches updates: `dirtyRef` flag + 2s `setInterval` flush to `setRisks`
- Reconnects on error with exponential backoff (3s → 30s cap)
- Hydrates TanStack Query cache at `['risk-flights']`

#### `useViewportBbox`
- Listens to `viewer.camera.changed` events
- Debounces 600ms, ignores moves < 0.5°
- Returns `{ lamin, lamax, lomin, lomax }` bbox

#### `useGlobeClick`
- `ScreenSpaceEventHandler` on `LEFT_CLICK`
- `scene.pick()` → resolves entity ID → flight icao24 or SIGMET ID
- Filters by known prefixes (`APT-`, `trail-`, `route-`, `SIGMET`)

### 2.3 State Management

```
TanStack Query Cache
├── ['flights', riskFilter]     → GET /api/flights (60s refetch)
├── ['sigmets']                 → GET /api/sigmets (60s refetch)
├── ['airports']                → GET /api/airports list
├── ['flight-trail', icao24]    → GET /api/flights/:icao/trail
├── ['flight-route', icao24]    → GET /api/flights/:icao/route (2min stale)
├── ['risk-flights']            → SSE hydrated (no refetch)
└── ['airport-metar', icao]     → GET /api/airports/:icao/metar
```

SSE data flows into the React component tree via the `useRiskStream` hook's
return value (`risks` array), passed as props to `FlightLayer`, `FlightsPanel`,
`FlightDetailPanel`, and `HudBar`.

---

## 3. Build & Run

### 3.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.78+ (stable) | Backend |
| Node.js | 20 LTS | Frontend |
| pnpm | 9+ | Package manager |
| Cargo | (with Rust) | Rust build |
| Vite | 5+ | Frontend bundler |

### 3.2 Environment Variables

#### Backend (`.env`)
```bash
OPENSKY_BASE=https://opensky-network.org/api
OPENSKY_USER=               # Optional: higher rate limits
OPENSKY_PASS=               # Optional
AVIATION_WEATHER_BASE=https://aviationweather.gov/api/data
```

#### Frontend (`.env.local`)
```bash
VITE_API_BASE=              # Defaults to same origin; set for separate backend
```

### 3.3 Commands

```bash
# Backend
cd backend
cargo run --release         # Dev server on :8080

# Frontend
cd frontend
pnpm install
pnpm run dev                # Dev server on :5173 (proxies /api -> :8080)

# Verification
cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test
pnpm run lint && pnpm run typecheck && pnpm run build

# Smoke test
./scripts/smoke.ps1          # Hits /healthz, /stats, /metrics, /api/*
```

### 3.4 Production Build

```bash
# Backend
cd backend && cargo build --release
# Binary: target/release/aeroshield-backend

# Frontend
cd frontend && pnpm run build
# Output: frontend/dist/ (static files)
```
