# API Reference — AeroShield 3D

> Base URL: `http://localhost:8080`
> All endpoints return JSON unless noted. Timestamps are Unix epoch seconds (UTC).

---

## REST Endpoints

### `GET /healthz`

Health check.

**Response** `200 OK`
```
ok
```

---

### `GET /stats`

System statistics summary.

**Response** `200 OK`
```json
{
  "flights_tracked": 8432,
  "sigmets_active": 12,
  "risk_high": 3,
  "risk_medium": 18,
  "sse_subscribers": 2,
  "airports_indexed": 9827,
  "flights_updated_at": 1721136000,
  "sigmets_updated_at": 1721135700
}
```

---

### `GET /metrics`

Prometheus-format metrics.

**Response** `200 OK` `text/plain`
```
# HELP aeroshield_flights_tracked Number of flights currently tracked
# TYPE aeroshield_flights_tracked gauge
aeroshield_flights_tracked 8432
# HELP aeroshield_sigmets_active Number of active SIGMETs
# TYPE aeroshield_sigmets_active gauge
aeroshield_sigmets_active 12
# HELP aeroshield_risk_high Number of HIGH-risk flights
# TYPE aeroshield_risk_high gauge
aeroshield_risk_high 3
# HELP aeroshield_risk_medium Number of MEDIUM-risk flights
# TYPE aeroshield_risk_medium gauge
aeroshield_risk_medium 18
# HELP aeroshield_sse_subscribers Number of active SSE subscribers
# TYPE aeroshield_sse_subscribers gauge
aeroshield_sse_subscribers 2
# HELP aeroshield_airports_indexed Number of airports in the index
# TYPE aeroshield_airports_indexed gauge
aeroshield_airports_indexed 9827
```

---

### `GET /api/flights`

List live flights, optionally filtered by risk level or bounding box.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `risk` | string | Filter: `HIGH`, `MEDIUM`, or `NONE` (omit for all) |
| `lamin` | float | Bounding box south latitude |
| `lamax` | float | Bounding box north latitude |
| `lomin` | float | Bounding box west longitude |
| `lomax` | float | Bounding box east longitude |

**Response** `200 OK`
```json
{
  "flights": [
    {
      "icao24": "4baa1f",
      "callsign": "THY23",
      "origin_country": "Turkey",
      "longitude": 28.8,
      "latitude": 41.0,
      "baro_altitude": 10668.0,
      "velocity": 230.5,
      "heading": 270.0,
      "on_ground": false,
      "risk": "HIGH"
    }
  ],
  "updated_at": 1721136000
}
```

---

### `GET /api/flights/:icao24`

Get a single flight by ICAO 24-bit hex address.

**Path Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `icao24` | string | 6-char hex (e.g., `4baa1f`) |

**Response** `200 OK`
```json
{
  "icao24": "4baa1f",
  "callsign": "THY23",
  "origin_country": "Turkey",
  "longitude": 28.8,
  "latitude": 41.0,
  "baro_altitude": 10668.0,
  "velocity": 230.5,
  "heading": 270.0,
  "on_ground": false,
  "risk": "HIGH"
}
```

**Error** `200 OK` (not 404 — backend returns error body)
```json
{ "icao24": "abc123", "error": "not found" }
```

---

### `GET /api/flights/:icao24/trail`

Get the position history trail for a flight.

**Response** `200 OK`
```json
{
  "icao24": "4baa1f",
  "trail": [
    { "lat": 41.0, "lon": 28.8, "alt_m": 10668.0, "ts": 1721135980 },
    { "lat": 41.01, "lon": 28.81, "alt_m": 10670.0, "ts": 1721135990 }
  ]
}
```

Trail is capped at 60 points. Points are appended when a flight moves
> 0.001° lat or lon since the last point.

---

### `GET /api/flights/:icao24/route`

Get the estimated departure/arrival airports for a flight.

**Response** `200 OK`
```json
{
  "icao24": "4baa1f",
  "callsign": "THY23",
  "departure": "LTFM",
  "arrival": "EGLL",
  "first_seen": 1721112000,
  "last_seen": 1721136000,
  "departure_airport": {
    "icao": "LTFM",
    "iata": "IST",
    "name": "Istanbul Airport",
    "country": "Turkey",
    "latitude": 41.2753,
    "longitude": 28.7519
  },
  "arrival_airport": {
    "icao": "EGLL",
    "iata": "LHR",
    "name": "London Heathrow Airport",
    "country": "United Kingdom",
    "latitude": 51.4706,
    "longitude": -0.4619
  }
}
```

Routes are cached for 5 minutes per icao24.

---

### `GET /api/sigmets`

List active SIGMET hazard polygons.

**Response** `200 OK`
```json
{
  "sigmets": [
    {
      "sigmet_id": "ZNY-A-1",
      "points": [[-73.0, 42.0], [-72.0, 42.0], [-72.0, 41.0], [-73.0, 41.0], [-73.0, 42.0]],
      "min_ft": 0.0,
      "max_ft": 45000.0,
      "hazard_type": "CONVECTIVE"
    }
  ]
}
```

`points` are `[longitude, latitude]` pairs. SIGMETs are refreshed every 5 minutes.

---

### `GET /api/airports/:icao`

Get airport info by ICAO code (also resolves IATA codes).

**Response** `200 OK`
```json
{
  "icao": "KJFK",
  "iata": "JFK",
  "name": "John F Kennedy International Airport",
  "country": "United States",
  "latitude": 40.6413,
  "longitude": -73.7781
}
```

---

### `GET /api/airports/:icao/metar`

Get the latest METAR observation for an airport.

**Response** `200 OK`
```json
{
  "icao": "KJFK",
  "raw_ob": "KJFK 161200Z 22012KT 10SM FEW045 SCT250 26/19 A3002",
  "temp_c": 26.0,
  "dewpoint_c": 19.0,
  "wind_dir": 220,
  "wind_speed_kt": 12,
  "visibility_sm": 10.0,
  "flight_category": "VFR",
  "obs_time": 1721131200
}
```

`flight_category` is one of: `VFR`, `MVFR`, `IFR`, `LIFR`.

---

## SSE Endpoint

### `GET /api/sse/risk-stream`

Server-Sent Events stream of risk assessments. Only **changed** risks are pushed
(delta-only). The backend polls the risk engine every 5 seconds and compares
against the last-sent state per subscriber.

**Event Format**
```
event: risk
data: {"flight":"4baa1f","callsign":"THY23","lat":41.0,"lon":28.8,"alt_ft":35000,"risk":"HIGH","sigmet_id":"ZNY-A-1","minutes_to_impact":0}
```

**Fields**

| Field | Type | Description |
|-------|------|-------------|
| `flight` | string | ICAO 24-bit hex |
| `callsign` | string\|null | Flight callsign |
| `lat` | float | Latitude |
| `lon` | float | Longitude |
| `alt_ft` | float\|null | Altitude in feet |
| `risk` | string | `NONE`, `MEDIUM`, or `HIGH` |
| `sigmet_id` | string\|null | Associated SIGMET ID |
| `minutes_to_impact` | float\|null | Time to polygon entry (0 if inside) |

**Keep-Alive**: A `ping` comment is sent every 15 seconds when idle.

**Reconnection**: The frontend client retries with exponential backoff
(3s → 6s → 12s → 30s cap).
