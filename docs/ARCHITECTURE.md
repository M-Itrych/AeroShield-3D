# Architecture — AeroShield 3D

> System architecture documentation. For API reference see [API.md](./API.md).
> For UML diagrams see [DIAGRAMS.md](./DIAGRAMS.md).

## 1. Overview

AeroShield 3D is a **real-time 3D aviation hazard awareness platform**. It ingests
live flight positions from OpenSky Network and active SIGMET weather hazards from
AviationWeather.gov, runs a spatial risk engine in Rust, and streams risk
assessments to a CesiumJS 3D globe frontend via Server-Sent Events.

```
[OpenSky Network]      [AviationWeather.gov]
        |                       |
        v                       v
+------------------------------------------+
|         Rust Backend (Axum)              |
|  OpenSky client (moka cache, 60s)        |
|  AviationWeather client (5min refresh)   |
|  Airports index (DashMap, ~10k entries)  |
|  Risk engine (geo PIP + altitude band)   |
|  Trail store (DashMap, 60 pts/flight)   |
|  SSE delta stream (changed risks only)   |
+------------------------------------------+
                    |
                    | SSE (event: risk)
                    v
+------------------------------------------+
|         React + Vite Frontend            |
|  CesiumJS 3D globe (resium)              |
|  BillboardCollection (imperative)        |
|  TanStack Query + Router                 |
|  shadcn/ui tactical HUD theme            |
|  Mobile /m route (bottom-sheet)          |
+------------------------------------------+
```

## 2. C4 Model

### Level 1 — System Context

```mermaid
graph TB
    subgraph External
        OS[OpenSky Network API]
        AW[AviationWeather.gov API]
        APDB[Airports JSON<br/>GitHub raw]
        USER[Pilot / Dispatcher / Enthusiast]
    end

    subgraph AeroShield
        BE[Rust Backend<br/>Axum]
        FE[React Frontend<br/>CesiumJS]
    end

    OS -->|REST /states/all| BE
    AW -->|REST /sigmet /metar| BE
    APDB -->|JSON cache| BE
    BE -->|SSE + REST /api| FE
    FE -->|Browser| USER
```

### Level 2 — Container Diagram

```mermaid
graph LR
    subgraph Backend["Rust Backend (port 8080)"]
        OSKY[OpenSky Client<br/>moka cache 60s<br/>bbox cache 30s<br/>route cache 5min]
        AWCLI[AviationWeather Client<br/>SIGMET + METAR]
        APIDX[Airport Index<br/>DashMap ICAO/IATA]
        RISK[Risk Engine<br/>geo PIP + projection]
        TRAIL[Trail Store<br/>DashMap 60pts]
        SSE[SSE Handler<br/>delta-only push]
        ROUTES[Axum Routes<br/>/api/* /stats /metrics]
    end

    OSKY --> RISK
    AWCLI --> RISK
    RISK --> SSE
    OSKY --> TRAIL
    ROUTES --> OSKY
    ROUTES --> AWCLI
    ROUTES --> APIDX
    ROUTES --> RISK
    ROUTES --> SSE
```

### Level 3 — Component Diagram (Frontend)

```mermaid
graph TB
    subgraph Routes
        IDX["/ (desktop)"]
        M["/m (mobile)"]
        FLIGHT["/flight/$id"]
        AIRPORT["/airport/$icao"]
    end

    subgraph Hooks
        UF[useFlights]
        US[useSigmets]
        URS[useRiskStream<br/>SSE + batch flush]
        UTR[useFlightTrail]
        URTE[useFlightRoute]
        UVB[useViewportBbox]
        UGC[useGlobeClick]
        UKS[useKeyboardShortcuts]
    end

    subgraph Components
        CG[CesiumGlobe]
        FL[FlightLayer<br/>BillboardCollection]
        AL[AirportsLayer<br/>PointPrimitiveCollection]
        HL[HazardLayer<br/>extruded volumes]
        FTL[FlightTrailLayer]
        RLL[RouteLineLayer]
        FPL[FlightPredictLayer]
        RL[RerouteLayer]
        FP[FlightsPanel]
        HP[HazardPanel]
        FDP[FlightDetailPanel]
        HB[HudBar]
        GCB[GlobeControlBar]
    end

    UF --> FL
    URS --> FL
    US --> HL
    UVB --> FL
```

## 3. Key Architectural Decisions

| Decision | Rationale | ADR |
|----------|-----------|-----|
| SSE over WebSocket | Unidirectional risk push; no client-to-server messages needed; simpler Axum integration | [ADR-001](./adr/ADR-001-sse-over-websocket.md) |
| Cesium primitive collections over resium Entities | React reconciliation of 10k+ entities caused severe lag; GPU-batched primitives are O(1) per item | [ADR-002](./adr/ADR-002-primitive-collections.md) |
| moka cache for OpenSky | 400 req/day anonymous limit requires aggressive caching at multiple layers (global, bbox, route) | [ADR-003](./adr/ADR-003-moka-caching.md) |
| Delta-only SSE push | Pushing all risks every 5s flooded the frontend; only changed risks are now sent | [ADR-004](./adr/ADR-004-sse-delta-push.md) |
| Dedicated /m mobile route | Desktop tactical panels don't fit 375px; separate layout with bottom-sheet is cleaner than responsive overrides | [ADR-005](./adr/ADR-005-mobile-route.md) |
| geo crate for spatial | Pure-Rust point-in-polygon; no external GIS dependency; well-tested | [ADR-006](./adr/ADR-006-geo-crate.md) |

## 4. Data Flow

```mermaid
sequenceDiagram
    participant OS as OpenSky API
    participant BE as Backend (Axum)
    participant RE as Risk Engine
    participant SSE as SSE Stream
    participant FE as Frontend (CesiumJS)
    participant U as User

    loop Every 60s
        OS->>BE: GET /states/all (~10k flights)
        BE->>BE: moka cache + trail append
    end

    loop Every 5min
        OS->>BE: GET /sigmet (active hazards)
        BE->>BE: parse polygons + alt bands
    end

    loop Every 5s
        BE->>RE: assess_many(flights, sigmets)
        RE-->>BE: Vec<RiskAssessment> with TTI
        BE->>SSE: filter changed risks only
        SSE-->>FE: event: risk {flight, risk, tti, sigmet_id}
        FE->>FE: batch flush (2s) then state
        FE->>U: billboard color + label update
    end

    U->>FE: click flight
    FE->>BE: GET /api/flights/:icao/trail
    FE->>BE: GET /api/flights/:icao/route
    BE-->>FE: trail points + dep/arr airports
    FE->>U: trail polyline + route + predict + reroute
```

## 5. Deployment

```mermaid
graph LR
    subgraph Dev
        DEV[Local dev<br/>cargo run + pnpm dev<br/>:8080 + :5173]
    end
    subgraph Prod
        BIN[Backend binary<br/>aeroshield-backend]
        STATIC[Frontend dist/<br/>static files]
        CDN[Cesium ion + CARTO<br/>imagery tiles]
    end
    DEV -->|cargo build --release| BIN
    DEV -->|pnpm build| STATIC
    BIN -->|serves /api| STATIC
    STATIC -->|imagery| CDN
```

The backend serves the pre-built frontend `dist/` in production (or a reverse
proxy can split traffic). No database is required — all state is in-memory with
periodic API polling.

## 6. Non-Functional Requirements

| Requirement | Target | Implementation |
|-------------|--------|----------------|
| Flight data freshness | < 90s | 60s poll + moka cache + `updated_at` stamp |
| Risk latency | < 10s from fetch to UI | 5s SSE cycle + 2s batch flush |
| Render performance | 60fps with 200 flights + 30k airports | Primitive collections, GPU-batched |
| OpenSky rate limit | < 400 req/day | moka global+bbox+route cache, 429 backoff |
| Mobile usability | Works on 375px viewport | Dedicated /m route, touch controls |
| Uptime | Stateless restart | All state in-memory; cold start < 10s |
