# Architecture

See `AGENTS.md` for operating rules and `PLAN.md` for the build plan.

## Components

```
+-------------------+        +--------------------+
|   Rust Backend    |  SSE   |   React Frontend   |
|  (Axum, geo, moka)| -----> | (Cesium, TanStack) |
+-------------------+        +--------------------+
        ^                              ^
        |                              |
  OpenSky / AviationWeather      shadcn/ui (dark cyber-radar)
```

## Decisions

- **CesiumJS over MapLibre**: aerospace-grade 3D globe, industry standard, per project brief.
- **SSE over WebSocket**: unidirectional risk push is sufficient; simpler server; fits Axum.
- **moka cache**: OpenSky rate limit (100 req/5min) requires aggressive caching.
- **geo crate**: pure-Rust point-in-polygon for risk engine (AGENTS.md §8).
