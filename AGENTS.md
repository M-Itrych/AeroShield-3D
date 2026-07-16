# AeroShield 3D — AI Agent Operating Rules

> All agents working in this repository MUST follow these rules without exception.

## 1. Repository Structure

```
AeroShield-3D/
├── backend/               # Rust (Axum) — flight + hazard ingestion, spatial checks, SSE
├── frontend/              # React + Vite + Tailwind + shadcn/ui + CesiumJS
├── packages/             # Shared types (optional TS crate bindings)
├── scripts/              # dev utilities (data fetch smoke tests, etc.)
├── docs/                 # architecture diagrams, ADRs
├── AGENTS.md             # THIS FILE — agent rules
├── PLAN.md               # Task-based build plan for agents
├── opencode.json         # opencode config (permissions, agents, tasks)
├── .gitignore
├── .gitattributes
└── README.md
```

## 2. Branch & Commit Convention

- Default branch: `main` (protected — never push directly after setup).
- Feature branches: `feat/<scope>-<short-desc>` (e.g. `feat/backend-opensky-ingest`).
- Fix branches: `fix/<scope>-<short-desc>`.
- Commit message format (Conventional Commits):
  - `feat(backend): parse SIGMET polygons from AviationWeather`
  - `fix(frontend): correct Cesium globe tile flair flicker`
  - `chore(repo): add gitignore + attributes`
  - `docs(plan): refine frontend S1 tasks`

## 3. Don'ts (Hard Rules)

- DO NOT commit secrets, API keys, or `.env` files. Use `.env.example` only.
- DO NOT add comments to code unless explicitly requested by humans.
- DO NOT use emojis in code or commit messages.
- DO NOT create files outside your assigned scope.
- DO NOT run `git push`, `git commit --amend`, `--force`, or `-i` unless explicitly requested.
- DO NOT introduce a library until you've checked the existing `Cargo.toml` / `package.json`.
- DO NOT skip lint/typecheck. Each agent must verify its own work builds before declaring a task done.

## 4. Do's (Hard Rules)

- Read `AGENTS.md` and `PLAN.md` before any work. Check off your tasks there.
- Mimic the existing code style of the directory you're working in.
- Follow security best practices; never log secrets.
- Keep PRs scoped: one task section at a time.
- Run lint + typecheck after every change.
- For Rust: run `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo test`.
- For TS: run `pnpm run lint`, `pnpm run typecheck`, `pnpm run test` (if available).

## 5. Toolchain Versions

- Node 20 LTS via `pnpm` (frontend workspace).
- Rust stable (1.78+), via `rustup`.
- CesiumJS via `resium` + `cesium` npm packages.
- shadcn/ui components live under `frontend/src/components/ui`.

## 6. Data Sources (Free, No-Key — Do Not Swap)

| Source | Provider | Endpoint base |
|--------|----------|---------------|
| Live flights | OpenSky Network | `https://opensky-network.org/api` |
| Aviation weather / SIGMETs | AviationWeather.gov | `https://aviationweather.gov/api/data` |
| Airports DB | open-source ICAO/IATA JSON | `https://raw.githubusercontent.com/.../airports.json` (cached) |

Caching & rate limits: OpenSky anonymous = 400 req/day, 100 req/5min. Poll every 60s. Cache with `moka` crate in backend.

### MCP Tools (configured in `opencode.json` under `mcp`)
- `context7` — live docs search (Cesium/resium, TanStack Query/Router, Axum, `geo` crate, shadcn/ui). Use when unsure of an API instead of guessing.
- `gh_grep` — search real GitHub code for patterns (SIGMET polygon parsing, Cesium extruded polygons, OpenSky state-vector handling). Use when you need a concrete reference implementation.
- Invoke in prompts with `use context7` / `use gh_grep`.

## 7. Frontend Visual Style — "Tactical HUD / Cybernetic Telemetry"

The aesthetic is a dark, high-tech, military-grade tactical HUD. Strictly two
neon accent colors over a near-black charcoal space environment. No other
accent hues are permitted without explicit approval.

### Palette (canonical — do NOT deviate)

| Token | CSS Var / Hex | Usage |
|-------|---------------|-------|
| Space background | `#08080a` / `--background` | App + globe void background, star-field base |
| Globe charcoal | `#121315` / `hud.charcoal` | 3D globe base color ( minimalist sphere ) |
| Continent shapes | `#1c1d21` / `hud.continent` | Flat muted landmasses via dark imagery tiles |
| Electric lime grid | `#39ff14` / `hud.grid` / `--primary` | Safe tracks, routes, active panel states, reticle cores |
| Warning orange | `#ff5f1f` / `hud.warn` / `--accent` / `--destructive` | Hazards, at-risk tracks, SIGMETs, critical alerts |
| Ink ( primary text ) | `#b8c4cc` / `hud.ink` | Body text, label values |
| Dim ( muted text ) | `#5a6770` / `hud.dim` | Captions, metadata, placeholders |

### Hard rules

- **Two-neon discipline**: the only saturated colors are lime `#39ff14` and orange `#ff5f1f`. Do NOT introduce blue, cyan, amber, red, or any other hue for data/UI distinction. Departures were a flaw in the prior "cyber-radar" theme and have been removed.
- **Background**: deep near-black space `#08080a` with the sparse `starfield-bg` class on the root layout ( subtle pixel star-field, no gradients/atmosphere ).
- **Globe**: minimalist dark charcoal sphere ( `globe.baseColor = #121315` ), sky/sun/moon/atmosphere disabled, continents rendered as flat dark gray `#1c1d21` via CARTO dark-no-labels tiles.
- **Markers**: flight tracks are heading-rotated triangle billboards ( `BillboardGraphics` with inline SVG triangle, `rotation` = OpenSky heading in radians ) pointing in the direction of travel. Safe = lime, at-risk ( HIGH/MEDIUM ) = orange with larger scale. Airport dep/arr endpoints use reticle point markers ( departure = lime, arrival = orange ).
- **Marker labels**: small clean white sans-serif text ( `#e8eef2`, 92% alpha ) with dark background pill, placed offset right of the marker via Cesium `LabelGraphics`. Callsigns preferred ( suffixed with last-4 ICAO24 hex to disambiguate duplicates ); fall back to `SYS-<icao6>` system-point IDs.
- **Trails**: flight trails are rendered as per-segment polylines color-coded by altitude — muted lime/dim below 10k ft, bright lime 10k–25k, orange 25k–40k, bright orange above 40k. Semantic meaning: altitude read at a glance via color.
- **Typography**: everything is monospaced — `ui-monospace, "JetBrains Mono", "Roboto Mono", monospace`. Ultra-thin, sharp, tracked-out letter-spacing ( `tracking-[0.16em]` to `0.2em]` ) on labels and headings.
- **Borders**: ultra-thin ( 1px ), tinted from the neon tokens at low alpha — `border-hud-grid/20` for structural borders, `border-hud-warn/20` for hazard-region borders. No rounded corners beyond `--radius: 0.125rem` ( near-square ).
- **Panels**: `bg-hud-space/90 backdrop-blur-md` over the star-field, with thin neon-tinted borders. No drop shadows — the "depth" comes from backdrop blur and the star-field behind.
- **CRT scanlines**: removed per user request — the globe container has no scanline overlay. The `.cesium-container::after` rule has been deleted from `globals.css`. Do not reintroduce.
- **Animations**: `status-blink` ( 1.6s pulse for status dots ), `pulse-ring` ( sonar expand for system status ), `reticle-spin` ( 6s slow rotation, reserved for future targeting overlays ). Keep motion sparse and mechanical.
- shadcn/ui dark-theme tokens remain the base, overridden via CSS variables in `frontend/src/styles/globals.css`. Tailwind `hud.*` custom colors are the source of truth for tactical surfaces.

## 8. Spatial Computation Rules (Backend)

- Use the `geo` Rust crate for polygon containment (`Point-in-Polygon`).
- 3D check: hazard polygons have a min/max altitude band (ft). Aircraft altitude from OpenSky. Flight intersects iff (lat,lon inside polygon) AND (baro_altitude within [min_ft, max_ft]).
- Risk scoring: inside polygon & in altitude band => HIGH. Within 50km & 5min projected => MEDIUM. Otherwise => NONE.

## 9. SSE Contract

Backend exposes `GET /api/sse/risk-stream` returning Server-Sent Events:

```
event: risk
data: {"flight":"4baa1f","callsign":"THY23","lat":..,"lon":..,"alt_ft":..,"risk":"HIGH","sigmet_id":"SIG_123"}
```

Frontend subscribes via `EventSource`, dedupes by flight id, hydrates into TanStack Query cache as `['risk-flights']`.

## 10. Definition of Done (per task)

- Code written, formatted, lints clean.
- Type / compiler checks pass.
- Unit tests added where logic is non-trivial (geo checks, parsers).
- `PLAN.md` checkbox updated: `[x]`.
- Commit pushed to feature branch, PR opened with scope summary.
