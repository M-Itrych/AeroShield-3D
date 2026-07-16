# ADR-006: geo crate for spatial computation

**Date**: 2026-07-16
**Status**: Accepted

## Context

The risk engine needs to determine whether a flight's (longitude, latitude)
point falls inside a SIGMET polygon. This is a classic point-in-polygon (PIP)
problem. Additionally, the engine needs haversine distance calculations and
segment intersection tests for projected entry time.

Options considered:
1. **geo crate** — pure-Rust geospatial library
2. **geo-types + manual PIP** — lighter, but reinventing the wheel
3. **GDAL bindings (gdal crate)** — C library wrapper, very heavy
4. **PostGIS** — database-level spatial queries (requires a database)

## Decision

Use the **geo** crate (v0.28).

## Rationale

- **Pure Rust**: No C dependencies, no system libraries, cross-compiles easily.
  GDAL requires libgdal + GEOS + PROJ system installs.
- **Well-tested**: `geo::Polygon::contains()` uses the ray-casting algorithm,
  handles edge cases (point on boundary, holes), and is widely used.
- **Rich utilities**: `geo` provides `HaversineDistance`,
  `Point`, `Line`, `Polygon`, and related types that the risk engine uses
  for both PIP and distance/projection calculations.
- **No database**: The app is stateless by design. Adding PostGIS would require
  a PostgreSQL instance, breaking the "just run `cargo run`" simplicity.

## Consequences

- Polygon holes are not used (all SIGMET polygons are simple exteriors).
  `Polygon::new(ring, vec![])` creates a no-hole polygon.
- Antimeridian crossing: `geo`'s PIP doesn't handle polygons crossing the
  ±180° meridian specially. SIGMETs near the antimeridian may have edge cases.
  This is rare and acceptable.
- `geo` is a relatively large dependency (∼50 crates in the dependency tree),
  but compile time impact is minimal.
