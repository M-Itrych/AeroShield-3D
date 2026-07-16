# Design Documentation — AeroShield 3D

> Detailed design of each subsystem. For architecture overview see
> [ARCHITECTURE.md](./ARCHITECTURE.md). For UML see [DIAGRAMS.md](./DIAGRAMS.md).

---

## 1. Risk Engine

### 1.1 Risk Classification

The risk engine (`backend/src/risk.rs`) assigns one of three levels to every
flight against every active SIGMET:

| Level | Condition | TTI |
|-------|-----------|-----|
| `HIGH` | Flight is inside the SIGMET polygon **AND** within the altitude band | 0 min |
| `MEDIUM` | Flight is projected to enter the polygon within 10 min **OR** is within 50km proximity | > 0 min |
| `NONE` | Neither condition is met | — |

### 1.2 Spatial Computation

```
                    ┌─────────────────────────┐
                    │   FlightVector           │
                    │   lon, lat, alt_m,        │
                    │   velocity, heading       │
                    └────────┬────────────────┘
                             │
              ┌──────────────┼──────────────┐
              v              v              v
     ┌──────────────┐ ┌─────────────┐ ┌────────────┐
     │ Point-in-    │ │ Altitude    │ │ Projected  │
     │ Polygon      │ │ Band Check  │ │ Entry Time  │
     │ (geo crate)  │ │ (ft range)  │ │ (ray-march) │
     └──────┬───────┘ └──────┬──────┘ └──────┬─────┘
            │                │               │
            v                v               v
     inside? Y/N       in_band? Y/N    entry_min?
            │                │               │
            └───────┬────────┴───────────────┘
                    v
            ┌───────────────┐
            │ RiskAssessment │
            │ risk, tti,    │
            │ sigmet_id     │
            └───────────────┘
```

**Point-in-Polygon**: Uses `geo::Polygon::contains()` with the flight's
(lon, lat) as a `geo::Point`. The polygon ring is constructed from the SIGMET's
coordinate list.

**Altitude Band**: SIGMETs carry `min_ft` / `max_ft`. The flight's
`baro_altitude` (meters) is converted to feet and checked against the band.
If the band is unbounded on one side, only the defined bound is checked.

**Projected Entry Time**: A ray is cast from the flight's position along its
heading (from `velocity` + `heading`) for up to 15 minutes of flight distance.
The ray is sampled at 30 steps; segment-segment intersection tests against each
polygon edge determine if the flight will cross the boundary. The time to first
crossing is the TTI.

**Proximity Distance**: If no projected intersection is found, the minimum
haversine distance from the flight to the polygon boundary is computed. If
within 50km, the flight is classified MEDIUM with a TTI derived from
distance / velocity.

### 1.3 TTI (Time-to-Impact)

TTI is computed as:

```
TTI = distance_to_boundary / velocity
```

For projected entry: `TTI = ray_distance_at_crossing / velocity_ms / 60` (minutes).

TTI is rounded up to the nearest minute for display. It appears:
- As a `T XM` suffix on flight billboard labels (e.g., `UAL123 AB12 T4M`)
- As a `TIME TO IMPACT: X MIN` row in `FlightDetailPanel`
- In the SSE payload as `minutes_to_impact`

---

## 2. SSE Risk Stream

### 2.1 Contract

```
GET /api/sse/risk-stream

event: risk
data: {
  "flight": "4baa1f",
  "callsign": "THY23",
  "lat": 40.0,
  "lon": -82.5,
  "alt_ft": 35000,
  "risk": "HIGH",
  "sigmet_id": "ZNY-A-1",
  "minutes_to_impact": 0
}
```

### 2.2 Delta-Only Push

The backend maintains a per-subscriber `HashMap<flight_id, RiskAssessment>`.
On each 5-second cycle, only flights whose `risk` level or `sigmet_id` has
**changed since the last push** are sent. This reduces SSE message volume from
~10k/5s to typically 0-50/5s.

### 2.3 Frontend Batching

The `useRiskStream` hook does **not** call `setRisks()` on every SSE event.
Instead, it marks a `dirtyRef` flag and flushes to React state via a 2-second
`setInterval`. This prevents render cascades when multiple risk updates arrive
in quick succession.

```
SSE events ──> risksRef (Map) ──> dirty=true
                                    │
                    ┌───────────────┘
                    v
          setInterval(2s) ──> flush()
                    │
                    v
          setRisks(Array.from(map.values()))
          queryClient.setQueryData(['risk-flights'], next)
```

### 2.4 Reconnection

`EventSource` does not retry on non-200 responses. The hook wraps it with
manual reconnection using exponential backoff:

```
attempt 1: 3s
attempt 2: 6s
attempt 3: 12s
attempt 4+: 30s (capped)
```

The connection state (`connecting` / `open` / `reconnecting` / `error`) is
surfaced in the `HudBar` as a status indicator (LIVE / SYNC / RECON / DOWN).

---

## 3. Rendering Architecture

### 3.1 Primitive Collections vs Entities

Cesium offers two ways to render billboards/points/labels:

| Approach | React Reconciliation | GPU Batching | Count Limit |
|----------|---------------------|---------------|-------------|
| resium `<Entity>` | O(n) per render | No | ~500 max |
| Primitive collections | O(1) — imperative sync | Yes | ~50k+ |

AeroShield uses **primitive collections** for all high-count layers:

```typescript
// FlightLayer — BillboardCollection
const billboards = new BillboardCollection();
viewer.scene.primitives.add(billboards);

// Sync data imperatively (no JSX per item)
billboards.removeAll();
for (const f of prepared) {
  const bb = billboards.add({ position, image, scale, rotation });
  bb.id = f.icao24;  // for scene.pick() click resolution
}
```

| Layer | Collection Type | Max Items | Updates |
|-------|-----------------|-----------|---------|
| FlightLayer | BillboardCollection + LabelCollection | 200 | On flights/risks/bbox change |
| AirportsLayer | PointPrimitiveCollection + LabelCollection | ~10k | On airports load (once) |
| FlightLayer labels | LabelCollection | ~20 (warn+selected only) | Same as billboards |

### 3.2 Low-Count Layers (Entities)

Layers with few items still use resium `<Entity>` — the overhead is negligible
and the JSX API is cleaner:

| Layer | Entity Count | Notes |
|-------|-------------|-------|
| HazardLayer | 5-30 (active SIGMETs) | Extruded polygons with altitude |
| FlightTrailLayer | 4 (1 polyline + 3 points) | Single polyline, not per-segment |
| RouteLineLayer | 2-4 (route line + dep/arr markers) | Great-circle polylines |
| FlightPredictLayer | ~36 (24 path + 12 traveled) | Memoized via `useMemo` |
| RerouteLayer | 4-6 (2 corridors + labels) | `React.memo` wrapped |

### 3.3 Viewport Culling

`useViewportBbox` computes the camera's view rectangle as a bounding box
(debounced 600ms, 0.5° minimum delta). `FlightLayer` uses this to filter flights
to only those within the visible region before rendering.

When the visible count exceeds `MAX_FLIGHTS` (200), flights are prioritized:
HIGH risk first, then MEDIUM, then a strided sample of the rest.

---

## 4. Reroute Advisor

### 4.1 Algorithm

When a flight is HIGH risk with a known destination:

1. Compute the bearing from the flight to the destination airport.
2. Offset perpendicular (left/right) by 100nm or 150nm using destination-point
   formula (great-circle).
3. From the offset turn-point, check if the bearing to the destination still
   aims toward the SIGMET centroid (bearing diff < 30°). If so, skip that
   corridor — it doesn't actually avoid the hazard.
4. Compute extra distance: `detour_km - direct_km` (haversine).
5. Compute extra time: `extra_km * 1000 / velocity / 60` (minutes).

### 4.2 Rendering

Two corridors are rendered as dashed lime polylines (`PolylineDashMaterialProperty`)
with `+km` distance labels. Each corridor has 4 waypoints: flight position →
turn point → midpoint → arrival airport.

---

## 5. Mobile Design

### 5.1 Route Split

| Route | Layout | Target |
|-------|--------|--------|
| `/` | Desktop: left FlightsPanel + right HazardPanel + FlightDetailPanel | ≥768px |
| `/m` | Mobile: full-bleed globe + bottom-sheet with tabs | <768px |

`__root.tsx` redirects based on `window.innerWidth` in `beforeLoad`. No
responsive CSS hacks — each route has its own component tree.

### 5.2 Bottom Sheet

The mobile sheet has three height states (collapsed / half / full) cycled by
tapping the drag handle, and three tabs:

- **TRACKS** — risk-sorted flight list, touch-sized rows, TTI chips inline
- **HAZARDS** — SIGMET list, tap to fly-to
- **DETAIL** — full flight stats + risk + TTI + reroute options

---

## 6. Visual Design System

### 6.1 Palette

Two saturated accent colors only. All other colors are neutral.

| Token | Hex | Usage |
|-------|-----|-------|
| Space | `#08080a` | App + globe void background |
| Charcoal | `#121315` | Globe base color |
| Continent | `#1c1d21` | Flat muted landmasses |
| Lime | `#39ff14` | Safe tracks, routes, active UI states |
| Orange | `#ff5f1f` | Hazards, at-risk tracks, SIGMETs |
| Ink | `#b8c4cc` | Body text, label values |
| Dim | `#5a6770` | Captions, metadata, placeholders |

### 6.2 Typography

- Font: `ui-monospace, "JetBrains Mono", "Roboto Mono", monospace`
- Headings: `font-bold`, `tracking-[0.16em]` to `[0.2em]`
- Body: regular weight, normal tracking
- All numeric values use `tabular-nums`

### 6.3 Borders & Panels

- Border width: 1px
- Border color: `border-hud-grid/20` (structural) / `border-hud-warn/20` (hazard)
- Corner radius: `0.125rem` (near-square)
- Panels: `bg-hud-charcoal/95 backdrop-blur-md` — no drop shadows; depth comes
  from backdrop blur over the starfield.
