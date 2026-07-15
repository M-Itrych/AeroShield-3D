# AeroShield 3D — Build Plan (Task-Based for AI Agents)

Legend:
- `[ ]` pending · `[~]` in-progress · `[x]` done
- Each task block is the work of ONE agent's PR. Do not cross scopes.

---

## STAGE 0 — Repo Bootstrap (Agent: `setup`)

- [x] S0.1 Create `.gitignore` (Rust target/, node_modules/, dist/, .env, cesium tokens)
- [x] S0.2 Create `.gitattributes` (`* text=auto eol=lf`, `*.rs text`, `*.svg binary`)
- [x] S0.3 Create `README.md` with project overview + run instructions
- [x] S0.4 Create `opencode.json` (permissions, agent definitions, task list)
- [x] S0.5 Scaffold `backend/` Cargo workspace skeleton (Axum, tokio, geo, moka, reqwest)
- [x] S0.6 Scaffold `frontend/` via Vite React-TS + install pnpm deps (tailwind, tanstack query, tanstack router, resium, cesium, shadcn init)
- [x] S0.7 Establish dark cyber-radar Tailwind theme tokens in `frontend/src/styles/globals.css`
- [x] S0.8 Initial commit `chore(repo): monorepo bootstrap` on `main`

---

## STAGE 1 — Backend Foundation (Agent: `backend-core`)

- [ ] S1.1 Define Rust data models: `FlightVector`, `Sigmet`, `HazardPolygon`, `RiskAssessment`
- [ ] S1.2 Implement OpenSky client (`opensky::fetch_states`) with rate-limit-aware scheduler (60s poll, moka cache)
- [ ] S1.3 Implement AviationWeather.gov SIGMET fetcher (`aviationweather::fetch_sigmets`) parsing raw polygon strings into `Vec<HazardPolygon>` (handle text polygon format like `4100 N 07300 W - 4200 N 07000 W - ...`)
- [ ] S1.4 Implement airports DB loader (ICAO/IATA JSON cache, in-memory `DashMap`)
- [ ] S1.5 Implement spatial engine `risk::assess(flight, &sigmets) -> RiskAssessment` using `geo::contains`
- [ ] S1.6 Implement altitude-band filter (SIGMET min/max ft)
- [ ] S1.7 Wire Axum routes:
  - `GET /api/flights` (JSON list, optional `?risk=HIGH`)
  - `GET /api/sigmets` (JSON list)
  - `GET /api/airports/:icao`
  - `GET /api/sse/risk-stream` (SSE, repush every 60s or on risk change)
- [ ] S1.8 Unit tests: polygon containment, SIGMET parser, risk classifier
- [ ] S1.9 `cargo fmt && cargo clippy --all-targets -- -D warnings && cargo test`

---

## STAGE 2 — Frontend Foundation (Agent: `frontend-core`)

- [ ] S2.1 Configure TanStack Router file-based routes: `/`, `/flight/$id`, `/airport/$icao`
- [ ] S2.2 Configure TanStack Query client w/ 60s refetch for `['flights']`, `['sigmets']`
- [ ] S2.3 shadcn/ui init — install: `button`, `card`, `badge`, `dialog`, `scrollarea`, `separator`, `tabs`, `tooltip`, `skeleton`
- [ ] S2.4 Build `CesiumGlobe` component (resium `Viewer`, dark imagery provider, terrain disabled, no UI chrome, credit container hidden)
- [ ] S2.5 Build `FlightLayer` rendering plane sprites w/ heading rotation (entity billboard)
- [ ] S2.6 Build `HazardLayer` rendering `geojson` sigmet polygons as translucent red `Entity` w/ `extrudedHeight`
- [ ] S2.7 Build `RiskSubscriber` hook consuming `/api/sse/risk-stream` via `EventSource`, hydrating into query cache
- [ ] S2.8 Apply CRT scanline overlay + radar grid background to globe container only
- [ ] S2.9 `pnpm run lint && pnpm run typecheck`

---

## STAGE 3 — Integration UI (Agent: `frontend-ui`)

- [ ] S3.1 Left sidebar `FlightsPanel` (scrollable list, monospace, risk badge color)
- [ ] S3.2 Right sidebar `HazardPanel` (active SIGMETs list — click to fly-to + highlight on globe)
- [ ] S3.3 `/flight/$id` detail dashboard: callsign, origin/dest, alt/speed/heading, risk reasons
- [ ] S3.4 `/airport/$icao` detail: traffic count, current hazard overlays
- [ ] S3.5 Top HUD bar (clock UTC, flights tracked, sigmets active, system status pulse)
- [ ] S3.6 Click plane → camera flyTo + zoom; selected flight glows
- [ ] S3.7 Keyboard shortcuts (`f` filter at-risk, `r` reset camera, `space` toggle scanlines)
- [ ] S3.8 Loading / error / empty states with shadcn `Skeleton` + `Card`

---

## STAGE 4 — Polish & Hardening (Agent: `hardening`)

- [ ] S4.1 Backend: graceful OpenSky 429 handling w/ exponential backoff
- [ ] S4.2 Backend: Cron-ish refresh of SIGMETs every 5 min (different cadence than flights 60s)
- [ ] S4.3 Backend: structured logging via `tracing` (JSON), `/healthz`, `/metrics` via `tower-http::trace`
- [ ] S4.4 Frontend: add `cesium` token-less offline imagery fallback (World Imagery)
- [ ] S4.5 E2E smoke: scripts/smoke.ps1 — hits `/healthz`, `/api/flights`, then exits non-zero on empty
- [ ] S4.6 Write `README.md` "Run Locally" section with proper env examples
- [ ] S4.7 Final `cargo test && pnpm test && pnpm build` green

---

## Notes for Agents

- Always update checkboxes in `PLAN.md` as you go.
- Cross-stage dependencies: Frontend S2.7 needs Backend S1.7 SSE route. Block on it.
- Visual style: revisit `AGENTS.md §7` before any color/layout work.
