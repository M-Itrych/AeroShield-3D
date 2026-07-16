# ADR-002: Cesium primitive collections over resium Entities

**Date**: 2026-07-16
**Status**: Accepted

## Context

The app renders up to 200 flight billboards and ~10,000 airport points
simultaneously. The initial implementation used resium `<Entity>` components
for all of these, resulting in severe lag:

- ~10,000 `AirportsLayer` entities (3 per airport) caused React to reconcile
  30,000 component trees on every render.
- 500 `FlightLayer` entities caused additional React reconciliation overhead.
- Each `<Entity>` creates a separate Cesium Entity + BillboardGraphics +
  LabelGraphics object, with no GPU batching.

## Decision

Use **Cesium primitive collections** (`BillboardCollection`,
`PointPrimitiveCollection`, `LabelCollection`) added directly to
`viewer.scene.primitives`, synced imperatively via `useEffect`.

## Rationale

- **O(1) React overhead**: A single `useEffect` syncs all data to primitives.
  No per-item JSX, no React reconciliation for high-count items.
- **GPU batching**: Cesium primitive collections are designed for thousands of
  items — they batch draw calls on the GPU.
- **Imperative control**: Direct access to `collection.add()`, `collection
  .removeAll()`, and `billboard.id` for pick resolution.
- **Same pick behavior**: `scene.pick()` returns primitives with their `.id`
  field, so click handling works identically to entities.

## Consequences

- Layers return `null` (no JSX) — slightly less declarative.
- Primitive lifecycle must be managed manually (add on mount, remove on
  unmount in the cleanup function).
- Low-count layers (SIGMETs, trails, routes: < 30 entities) still use resium
  `<Entity>` for cleaner code — the overhead is negligible at those counts.
