# AeroShield 3D — Improvement & Innovation Plan

> Generated from a full codebase audit (2026-07-16).
> Scope: finish what's broken/incomplete, then ship features that materially
> help the people who actually use this app — pilots, dispatchers, ATC, and
> aviation enthusiasts.

---

## PART A — Current State Audit

### What works
- Backend: OpenSky + AviationWeather clients, risk engine (`geo` PIP + alt band),
  trails, routes, METAR, airports index, SSE `risk-stream`, 5×5 test suite.
- Frontend: Cesium globe (dark tactical theme), FlightLayer (billboards w/ heading),
  HazardLayer, FlightTrailLayer, RouteLineLayer, FlightPredictLayer (projected path),
  AirportsLayer, FlightsPanel (virtualized), HazardPanel, HudBar, FlightDetailPanel,
  GlobeControlBar, keyboard shortcuts, follow-mode, auto-rotate, viewport bbox.
- Routes: `/`, `/flight/$id` (stub), `/airport/$icao` (METAR card).

### What's broken / incomplete (bugs first)
1. **S2.7 SSE RiskSubscriber is missing.** `routes/index.tsx:61` hardcodes
   `const risks: RiskAssessment[] = useMemo(() => [], []);` — an empty array.
   Result: **the entire risk feature is dead on the globe.** Flights never turn
   orange, `highRiskCount` is always 0, the `?risk=HIGH` filter relies on the
   backend only. This is the single highest-impact regression.
2. **`/flight/$id` is a hard-coded stub.** Shows `--` and `NONE` regardless of
   the real flight. The `index` route's `FlightDetailPanel` is the only usable
   flight view; the deep-linked route is a dead end.
3. **`HazardLayer` ignores altitude.** `backend/src/models.rs` carries `min_ft`
   / `max_ft`, and the risk engine honors them, but the frontend renders every
   SIGMET as a flat clamped polygon — no vertical extent, no altitude readout.
4. **`FlightsPanel` is offset by the HudBar** (`top-9`) but `FlightDetailPanel`
   uses `top-12` + `right-[18rem]`, while `HazardPanel` width isn't coordinated —
   on narrow screens the detail panel overlaps the hazard panel.
5. **`useViewportBbox` + bbox-flights bypass the 60s cache** — every map move
   triggers `state.flights_bbox()` which calls OpenSky directly without moka,
   burning the 400 req/day budget on pan/zoom.
6. **`smoke.ps1` doesn't check `/api/sigmets` or SSE** — only healthz + flights.
7. **Theme drift.** `README.md` still describes the old "cyber-radar" palette
   (`#12ffaa`, `#ff3358`, amber safe flights). `AGENTS.md §7` canonicalized the
   new "tactical HUD" palette (lime `#39ff14` / orange `#ff5f1f`). README is the
   first thing users read — it must match.
8. **`/api/flights/:icao/route`** calls OpenSky's `/flights/aircraft` on every
   panel open with no cache — rate-limit bait.

---

## PART B — Improvement Plan (finish the foundation)

Each item maps to one PR-sized task. Priority = impact × user-facing.

### P0 — Make risk actually appear (unblocks the whole pitch)
- **B.1 Implement `useRiskStream` SSE hook.** Subscribe to
  `/api/sse/risk-stream` via `EventSource`, parse `event: risk`, dedupe by
  `flight`, hydrate `queryClient.setQueryData(['risk-flights'], map)`. Wire
  into `index.tsx` replacing the empty `risks` array. Pass to `FlightLayer`,
  `FlightsPanel`, `HudBar`.
- **B.2 Add SSE reconnect + backoff.** `EventSource` doesn't retry on non-200.
  Wrap with manual fetch-then-ReadableStream fallback, or listen to `onerror`
  and re-init after 3s/6s/12s.
- **B.3 Drive `?risk=HIGH` filter from SSE data**, not just the 60s REST poll,
  so at-risk flights appear within seconds.

### P1 — Finish the incomplete detail views
- **B.4 Rebuild `/flight/$id`** to reuse `FlightDetailPanel` + trail + route +
  risk, pulling live data via `useFlights` + client-side find, falling back to
  `/api/flights/:icao`. Make deep-links shareable.
- **B.5 Coordinate `FlightDetailPanel` + `HazardPanel` layout.** Stack them or
  shift detail panel below hazard panel; collapse hazard panel when a flight is
  selected on small viewports.

### P2 — Altitude-aware hazard rendering
- **B.6 Render SIGMETs as extruded volumes** using `perPositionHeight` +
  `extrudedHeight` from `min_ft`/`max_ft` (meters). This is the headline 3D
  visual promised in the README and not yet shipped.
- **B.7 Dim/hide hazard volumes whose altitude band doesn't intersect the
  selected flight's altitude** — instant "does this affect me?" read.
- **B.8 Show `min_ft–max_ft` + `hazard_type` in `HazardPanel` rows and on hover.**

### P3 — Protect the OpenSky budget
- **B.9 Cache bbox fetches in moka keyed by rounded bbox tile**, TTL 30s. Round
  bbox to 1° grid so panning doesn't refetch.
- **B.10 Cache `/flights/aircraft` route lookups** for 5 min per icao24.
- **B.11 Add a "last updated" timestamp to `/api/flights`** so the frontend can
  show data freshness instead of guessing.
- **B.12 Exponential backoff on 429** (PLAN S4.1 — still open). Track
  `Retry-After`.

### P4 — Hardening (open PLAN.md items)
- **B.13 `/metrics`** via `tower-http::trace` + a `/stats` JSON (flights tracked,
  sigmets active, SSE subscribers, cache hit rate).
- **B.14 Expand `smoke.ps1`** to hit `/api/sigmets`, `/api/airports/:icao`,
  `/api/flights/:icao/route`, and assert non-empty where expected.
- **B.15 Sync README palette** to `AGENTS.md §7` (lime/orange, no cyan/amber).

---

## PART C — Innovative Features (new value for users)

These are the features that make AeroShield genuinely useful to the people
flying, dispatching, or just watching. Grouped by user, ranked by impact.

### For pilots & dispatchers (decision support)

- **C.1 Smart Reroute Advisor.** When a flight is flagged HIGH, compute 2–3
  lateral detour corridors around the SIGMET polygon (offset 50/100/150nm) and
  render them as dashed lime polylines on the globe. Show extra distance +
  ETA delta per option. This turns "you're in danger" into "here's how to get
  out." Backend: `geo` buffer/offset; frontend: `CorridorLayer`.
- **C.2 Altitude Escape Ladder.** For a HIGH-risk flight, show the nearest safe
  altitude band above/below the hazard's `max_ft`/`min_ft` as a vertical ladder
  UI in `FlightDetailPanel` — climb to FL410 / descend to FL240. Color the bands
  lime (clear) vs orange (in-hazard). Uses data the backend already has.
- **C.3 Dynamic Time-to-Impact (TTI).** The current MEDIUM rule is static
  (50km/5min). Replace with a real projection: use `velocity` + `heading` to
  compute minutes-until-polygon-intersection, render as a countdown chip on the
  flight label and in the detail panel. Hugely more actionable than a badge.
- **C.4 Multi-hazard overlay toggle.** SIGMETs carry `hazard_type` (convective,
  turbulence, icing, ash, sand). Add per-type filters in `HazardPanel` and
  distinct hatch patterns (not new colors — keep the two-neon discipline) so a
  pilot can hide everything except "ICING" for a winter briefing.
- **C.5 Route METARalongpath.** When a flight + route are selected, fetch METAR
  for the departure, arrival, and 2–3 intermediate airports along the great-
  circle path, shown as a horizontal "weather ribbon" in `FlightDetailPanel`.
  Answers "what will the weather be along my route" without leaving the app.

### For situational awareness (everyone)

- **C.6 3D Vertical Profile View.** A side-on altitude vs distance chart for
  the selected flight's route + trail, with hazard altitude bands drawn as
  orange rectangles. This is the standard pilot tool (FMS PROFILE page) but
  contextualized with live SIGMETs. Canvas/SVG overlay in a collapsible bottom
  drawer.
- **C.7 Replay / Scrub Mode.** Trails are already stored (60 points). Add a
  timeline scrubber that animates the selected flight's trail forwards/
  backwards, replaying the last ~60 min. Lets a dispatcher reconstruct what
  happened. Backend exposes `/api/flights/:icao/trail` already — just a UI task.
- **C.8 WebSocket for sub-second updates (future-proof).** SSE pushes every 5s
  today. For "watch this specific flight" mode, upgrade to a per-flight
  WebSocket that streams OpenSky's `/states/all?icao24=` subset at the 10s
  anonymous cadence — smoother tracking of the one plane you care about.
- **C.9 Critical-Alert Sound + Focus Mode.** When a flight transitions to HIGH,
  play a short tactical beep (toggleable) and auto-fly the camera to it if
  "focus mode" is on. Dispatchers can't stare at the globe 100% of the time.
- **C.10 "Impact Radius" heatmap.** For each active SIGMET, render a soft
  orange density ring showing how many live flights are within 50nm + 5min
  projected intersection. Instantly answers "which storm matters most right
  now."

### For enthusiasts & community (growth / stickiness)

- **C.11 Saved Views + Shareable Deep Links.** Encode camera position + selected
  flight + layer toggles into a URL hash (`#v=lat,lon,alt&f=icao24&l=11011`).
  One click to share "this exact view of this exact storm." Pure-frontend,
  high viral value.
- **C.12 Flight Watchlist.** Let logged-in (or localStorage) users pin a set of
  callsigns/icao24s; the panel highlights when any watchlisted flight appears
  airborne or goes HIGH. Persistent across sessions.
- **C.13 "Hottest Corridors" leaderboard.** Backend computes the top
  origin→arrival pairs currently transiting the most SIGMETs; a small panel
  shows "AKL-LAX: 3 active hazards." Fun + informative.
- **C.14 Mobile-optimized tactical layout.** Current UI assumes desktop.
  Add a bottom-sheet drawer for panels on <768px, keep the globe full-bleed.
  Lets plane-spotters use it on a phone.

### For reliability (operational)

- **C.15 Graceful "stale data" watermark.** If `/api/flights` is older than 90s
  (OpenSky lagging), show a faint "DATA STALE +Ns" banner in `HudBar` instead
  of silently showing old positions.
- **C.16 Offline airports cache file.** Bundle a gzipped `airports.json` in the
  backend binary (or `frontend/public`) so startup doesn't depend on GitHub
  raw. The current `airports::load()` fails open with an empty index — silent.
- **C.17 Configurable refresh cadence.** Env vars `OPENSKY_POLL_SECS`,
  `SIGMET_POLL_SECS` so ops can tune for their rate-limit tier.

---

## PART D — Recommended execution order

1. **B.1–B.3** (SSE risk wiring) — restores the core product promise. ~1 PR.
2. **B.6–B.8** (extruded hazards + altitude) — delivers the "3D" headline. ~1 PR.
3. **C.3 + C.1** (TTI + reroute advisor) — the features that make pilots
   *choose* this over their existing tools. ~2 PRs.
4. **B.9–B.12** (caching/backoff) — unblocks higher traffic + reliability.
5. **C.6** (vertical profile) — high perceived value, leverages existing trail
   data.
6. **C.11** (shareable deep links) — cheap, sticky, great for demos.
7. Everything else, prioritized by user feedback.

---

## PART E — Out of scope (deliberately)

- Auth / multi-tenant — not needed for a public tactical tool.
- Paid data sources — AGENTS.md §6 mandates free/no-key sources.
- New accent colors — AGENTS.md §7 forbids deviations from lime/orange.
- Replacing Cesium — too much sunk cost, not the bottleneck.
