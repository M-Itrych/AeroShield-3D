# ADR-004: Delta-only SSE push

**Date**: 2026-07-16
**Status**: Accepted

## Context

The initial SSE implementation pushed all ~10,000 risk assessments to every
subscriber every 5 seconds. This caused:
- High bandwidth usage (~2MB per subscriber per 5s cycle)
- Frontend render cascades: each SSE message triggered `setRisks()`, causing
  `FlightLayer` + `FlightsPanel` + `HudBar` to re-render hundreds of times per
  cycle

## Decision

Push only **changed** risks. The backend maintains a per-subscriber
`HashMap<flight_id, RiskAssessment>` and only sends events for flights whose
`risk` level or `sigmet_id` has changed since the last push.

Additionally, the frontend `useRiskStream` hook batches incoming SSE events
and flushes to React state at most every 2 seconds.

## Rationale

- **Bandwidth**: Typical delta is 0-50 events per 5s cycle, down from ~10,000.
- **Render stability**: The 2s batch flush coalesces multiple rapid updates
  into a single React state update, preventing render cascades.
- **No data loss**: All risk changes are eventually delivered; the batch just
  defers the state update by up to 2s.
- **Keep-alive**: A `ping` comment every 15s ensures the connection stays
  alive even when no risks change.

## Consequences

- Up to 2s latency between a risk change and its visual representation (was
  ~0s before). Acceptable for aviation situational awareness where the
  underlying data itself is 60s stale.
- Per-subscriber memory: the backend holds a `HashMap` of the last-sent state
  per SSE connection. At ~10k flights × ~100 bytes each = ~1MB per subscriber.
