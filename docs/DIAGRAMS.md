# UML Diagrams — AeroShield 3D

> All diagrams use [Mermaid](https://mermaid.js.org/) syntax.
> Render in GitHub, VS Code (Mermaid extension), or [mermaid.live](https://mermaid.live).

---

## 1. Class Diagram — Backend

```mermaid
classDiagram
    class FlightVector {
        +String icao24
        +Option~String~ callsign
        +String origin_country
        +f64 longitude
        +f64 latitude
        +Option~f64~ baro_altitude
        +Option~f64~ velocity
        +Option~f64~ heading
        +bool on_ground
    }

    class HazardPolygon {
        +String sigmet_id
        +Vec~(f64,f64)~ points
        +Option~f64~ min_ft
        +Option~f64~ max_ft
        +String hazard_type
    }

    class RiskLevel {
        <<enumeration>>
        NONE
        MEDIUM
        HIGH
        +as_str() &str
    }

    class RiskAssessment {
        +String flight
        +Option~String~ callsign
        +f64 lat
        +f64 lon
        +Option~f64~ alt_ft
        +RiskLevel risk
        +Option~String~ sigmet_id
        +Option~f64~ minutes_to_impact
    }

    class Airport {
        +String icao
        +Option~String~ iata
        +String name
        +String country
        +f64 latitude
        +f64 longitude
    }

    class FlightRoute {
        +String icao24
        +Option~String~ callsign
        +Option~String~ departure
        +Option~String~ arrival
        +Option~Airport~ departure_airport
        +Option~Airport~ arrival_airport
    }

    class MetarReport {
        +String icao
        +Option~String~ raw_ob
        +Option~f64~ temp_c
        +Option~String~ flight_category
    }

    class OpenSkyClient {
        -Cache states_cache
        -Cache bbox_cache
        -Cache route_cache
        +fetch_states() Vec~FlightVector~
        +fetch_states_bbox(bbox) Vec~FlightVector~
        +fetch_aircraft_route(icao24, begin, end) Option~FlightRoute~
    }

    class AviationWeatherClient {
        +fetch_sigmets() Vec~HazardPolygon~
        +fetch_metar(icao) Option~MetarReport~
    }

    class AirportIndex {
        -DashMap by_icao
        -DashMap by_iata
        +get(icao) Option~Airport~
        +count() usize
    }

    class RiskEngine {
        +assess(flight, sigmets) RiskAssessment
        +assess_many(flights, sigmets) Vec~RiskAssessment~
        -min_distance_to_polygon_km()
        -projected_entry_time_min()
    }

    class AppState {
        +flights() Vec~FlightVector~
        +sigmets() Vec~HazardPolygon~
        +risk_assessments() Vec~RiskAssessment~
        +trail(icao24) Vec~TrailPoint~
        +refresh_flights()
        +refresh_sigmets()
        +sse_subscribe() u64
        +sse_unsubscribe()
    }

    RiskAssessment --> RiskLevel
    FlightRoute --> Airport
    OpenSkyClient --> FlightVector
    OpenSkyClient --> FlightRoute
    AviationWeatherClient --> HazardPolygon
    AviationWeatherClient --> MetarReport
    RiskEngine --> FlightVector
    RiskEngine --> HazardPolygon
    RiskEngine --> RiskAssessment
    AppState --> OpenSkyClient
    AppState --> AviationWeatherClient
    AppState --> AirportIndex
    AppState --> RiskEngine
```

---

## 2. Class Diagram — Frontend

```mermaid
classDiagram
    class CesiumGlobe {
        +Viewer viewer
        +onReady callback
        -tuneViewer()
    }

    class FlightLayer {
        +BillboardCollection billboards
        +LabelCollection labels
        -selectFlights(flights, bbox, risks)
        -syncPrimitives(prepared)
    }

    class AirportsLayer {
        +PointPrimitiveCollection points
        +LabelCollection labels
    }

    class HazardLayer {
        +Entity[] sigmetEntities
        -altBandIntersects(sig, flightAlt)
    }

    class FlightTrailLayer {
        +Entity polyline
        +Entity originPoint
        +Entity headPoint
    }

    class FlightPredictLayer {
        -projectFlight(lon, lat, heading, vel, sec)
        -buildPathToAirport(start, dest)
        -buildColoredSegments(points)
    }

    class RerouteLayer {
        -computeRerouteOptions(flight, route, sigmets, sigId)
    }

    class useRiskStream {
        +RiskAssessment[] risks
        +RiskConnectionState connectionState
        -EventSource es
        -Map risksRef
        -setInterval flush(2s)
        -reconnect(backoff)
    }

    class useViewportBbox {
        +BboxParams bbox
        -camera.changed listener
        -debounce(600ms)
    }

    class useGlobeClick {
        -ScreenSpaceEventHandler
        -pick(position) entity
        +onPickFlight callback
        +onPickSigmet callback
    }

    CesiumGlobe <|-- FlightLayer : renders into
    CesiumGlobe <|-- AirportsLayer : renders into
    CesiumGlobe <|-- HazardLayer : renders into
    useRiskStream --> FlightLayer : risks prop
    useViewportBbox --> FlightLayer : bbox prop
    useGlobeClick --> CesiumGlobe : viewer
```

---

## 3. Sequence Diagram — Risk Assessment Flow

```mermaid
sequenceDiagram
    participant OS as OpenSky API
    participant BE as Backend
    participant RE as Risk Engine
    participant SSE as SSE Stream
    participant FE as Frontend
    participant U as User

    Note over BE: Background task: refresh_flights (60s)
    BE->>OS: GET /states/all
    OS-->>BE: ~10k FlightVectors
    BE->>BE: moka cache + trail append

    Note over BE: Background task: refresh_sigmets (5min)
    BE->>OS: GET /sigmet?format=json
    OS-->>BE: active SIGMET polygons

    Note over BE: SSE cycle (5s)
    BE->>RE: assess_many(flights, sigmets)
    RE->>RE: PIP check (geo::contains)
    RE->>RE: Altitude band check
    RE->>RE: Ray-march projection (if outside)
    RE-->>BE: Vec~RiskAssessment~ with TTI
    BE->>BE: Filter changed risks (delta)
    BE->>SSE: push changed events

    SSE-->>FE: event: risk {flight, risk, tti}
    FE->>FE: batch (2s) → setRisks()
    FE->>FE: BillboardCollection sync
    FE-->>U: Plane turns orange + TTM label
```

---

## 4. Sequence Diagram — Flight Selection

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant CG as CesiumGlobe
    participant GC as useGlobeClick
    participant BE as Backend
    participant Q as TanStack Query

    U->>CG: Click plane on globe
    CG->>GC: scene.pick(position)
    GC->>GC: Resolve entity.id → icao24
    GC->>FE: onPickFlight(icao24)

    FE->>FE: setSelectedId(icao24)
    FE->>FE: focusFlight(viewer, flight)

    par Parallel data fetch
        FE->>BE: GET /api/flights/:icao/trail
        BE-->>FE: trail points
        FE->>Q: setQueryData(['flight-trail'])
    and
        FE->>BE: GET /api/flights/:icao/route
        BE-->>FE: route (dep/arr airports)
        FE->>Q: setQueryData(['flight-route'])
    end

    FE->>FE: Render trail + route + predict
    alt Risk == HIGH
        FE->>FE: Render RerouteLayer corridors
        FE->>FE: Show reroute options in detail panel
    end
    FE-->>U: Trail + route + reroute visible
```

---

## 5. Deployment Diagram

```mermaid
graph TB
    subgraph Browser
        FE[React Frontend<br/>CesiumJS globe<br/>shadcn/ui HUD]
    end

    subgraph Server["Backend Server :8080"]
        AXUM[Axum HTTP Server]
        BG[BG Tasks<br/>flights 60s + sigmets 5min]
        CACHE[moka caches<br/>global 60s + bbox 30s + route 5min]
        TRAIL[Trail Store<br/>DashMap]
        SSE[SSE Handler<br/>delta push]
    end

    subgraph External APIs
        OS[OpenSky Network<br/>opensky-network.org]
        AW[AviationWeather<br/>aviationweather.gov]
        APDB[Airports JSON<br/>GitHub raw]
        CARTO[CARTO dark tiles<br/>basemaps.cartocdn.com]
    end

    FE -->|REST /api/*| AXUM
    FE -->|SSE /api/sse/risk-stream| SSE
    FE -->|Imagery tiles| CARTO
    AXUM --> CACHE
    AXUM --> TRAIL
    BG --> CACHE
    BG --> OS
    BG --> AW
    SSE --> CACHE
    OS -->|/states/all| BG
    AW -->|/sigmet /metar| BG
    APDB -->|startup cache| BG
```

---

## 6. Entity Relationship Diagram

```mermaid
erDiagram
    FLIGHT_VECTOR ||--o| RISK_ASSESSMENT : "assessed by"
    FLIGHT_VECTOR ||--o| TRAIL_POINT : "has"
    FLIGHT_VECTOR ||--o| FLIGHT_ROUTE : "linked to"
    FLIGHT_ROUTE ||--o| AIRPORT : "departs from"
    FLIGHT_ROUTE ||--o| AIRPORT : "arrives at"
    HAZARD_POLYGON ||--o| RISK_ASSESSMENT : "causes"
    AIRPORT ||--o| METAR_REPORT : "has latest"

    FLIGHT_VECTOR {
        string icao24 PK
        string callsign
        string origin_country
        float longitude
        float latitude
        float baro_altitude
        float velocity
        float heading
        bool on_ground
    }

    RISK_ASSESSMENT {
        string flight FK
        float lat
        float lon
        float alt_ft
        enum risk
        string sigmet_id FK
        float minutes_to_impact
    }

    TRAIL_POINT {
        float lat
        float lon
        float alt_m
        uint64 ts
    }

    HAZARD_POLYGON {
        string sigmet_id PK
        array points
        float min_ft
        float max_ft
        string hazard_type
    }

    FLIGHT_ROUTE {
        string icao24 FK
        string callsign
        string departure FK
        string arrival FK
        uint64 first_seen
        uint64 last_seen
    }

    AIRPORT {
        string icao PK
        string iata
        string name
        string country
        float latitude
        float longitude
    }

    METAR_REPORT {
        string icao FK
        string raw_ob
        float temp_c
        int wind_dir
        int wind_speed_kt
        float visibility_sm
        string flight_category
    }
```

---

## 7. State Machine — SSE Connection

```mermaid
stateDiagram-v2
    [*] --> Connecting
    Connecting --> Open : onopen
    Open --> Error : onerror
    Error --> Reconnecting : after backoff(3s)
    Reconnecting --> Open : onopen
    Reconnecting --> Error : onerror
    Error --> Reconnecting : backoff doubles (6s, 12s, 30s cap)
    Open --> Closed : component unmount
    Reconnecting --> Closed : component unmount
    Closed --> [*]
```
