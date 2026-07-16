# ADR-005: Dedicated /m mobile route

**Date**: 2026-07-16
**Status**: Accepted

## Context

The desktop layout uses absolutely-positioned side panels (FlightsPanel left,
HazardPanel right, FlightDetailPanel center-right) over a full-screen globe.
On a 375px mobile viewport, these panels overlap, cover the globe entirely,
and have touch targets too small for fingers.

Options considered:
1. **Responsive CSS overrides** — hide/collapse panels with media queries
2. **Dedicated `/m` route** — separate component tree optimized for phones
3. **Shared layout with conditional rendering** — one component, different JSX
   based on viewport

## Decision

Use a **dedicated `/m` route** with a mobile-optimized component tree.

## Rationale

- **Clean separation**: Desktop and mobile have fundamentally different
  interaction models (hover vs tap, abundant vs scarce screen space). Sharing
  components leads to `isMobile` conditionals polluting every component.
- **Bottom-sheet pattern**: Mobile uses a draggable bottom sheet with tabs
  (TRACKS / HAZARDS / DETAIL) — a pattern that doesn't exist on desktop and
  would be awkward to conditionally render.
- **Auto-redirect**: `__root.tsx` detects viewport width in `beforeLoad` and
  redirects `/` → `/m` (and vice versa). Users always get the right layout.
- **Bundle isolation**: Mobile-only components (MobileSheet, MobileHudBar,
  etc.) are route-split by the bundler — desktop users don't download them.

## Consequences

- Two route files to maintain for the globe page (`index.tsx` + `m.tsx`).
- Shared hooks (useFlights, useSigmets, useRiskStream, etc.) are reused
  across both routes — no logic duplication.
- The redirect is client-side only (requires JS); SSR would need a
  user-agent or cookie-based check.
