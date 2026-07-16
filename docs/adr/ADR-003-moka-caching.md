# ADR-003: moka caching for OpenSky API

**Date**: 2026-07-16
**Status**: Accepted

## Context

OpenSky Network's anonymous tier allows 400 requests/day and 100 requests per
5-minute window. A naive implementation polling every 60s would consume
1,440 requests/day — 3.6x over budget. Bounding-box queries (triggered by
map pan/zoom) and route lookups (triggered by flight selection) would
exhaust the budget within minutes of active use.

## Decision

Use the **moka** crate with three cache layers:

| Cache | Key | TTL | Capacity |
|-------|-----|-----|----------|
| Global states | `()` | 60s | 1 |
| Bbox states | `(i32,i32,i32,i32)` 1°-rounded | 30s | 64 |
| Route | icao24 string | 300s (5min) | 500 |

## Rationale

- **moka is purpose-built**: High-performance concurrent cache for async Rust,
  `moka::future::Cache` integrates naturally with `tokio`.
- **Bbox key rounding**: Bounding boxes are rounded to 1° grid cells so
  panning within the same cell doesn't trigger a new API call.
- **Three TTLs**: Global states (60s) match the poll cadence; bbox (30s) is
  shorter because pan-triggered calls are less critical; route (5min) is long
  because departure/arrival airports don't change during a flight.
- **429 backoff**: On HTTP 429, the client retries up to 3 times with
  exponential backoff (0.5s → 4s), returning the cached or empty result.

## Consequences

- Stale data possible: a flight may appear at its position 60s ago if OpenSky
  is slow. The `updated_at` timestamp on `/api/flights` lets the frontend show
  data age.
- Cache capacity limits: with 64 bbox slots, frequently-visited regions stay
  cached; rarely-visited regions are evicted via LRU.
