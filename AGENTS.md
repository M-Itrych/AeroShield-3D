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

## 7. Frontend Visual Style — "Minimalist Tactical Telemetry"

A minimalistic dark-first interface with an optional light mode. The design
rests on restraint: a near-black canvas with neutral grays for all chrome,
and committed color appearing ONLY where data demands attention. Color is a
signal, not a style.

A dark/light theme switch with a circular-reveal transition is provided via
`ThemeToggle` (top status bar). Theme is persisted in `localStorage["theme"]`
and bootstrapped pre-React in `index.html` to avoid FOUC. The root
`<html data-theme="dark|light">` attribute drives all tokens.

### Palette (canonical — do NOT deviate)

All colors are CSS variables defined in `frontend/src/styles/globals.css` and
exposed as Tailwind `hud.*` tokens in `tailwind.config.js`. They adapt per
theme unless noted.

| Token | Dark value | Light value | Usage |
|-------|-----------|-------------|-------|
| Space background | `hud.space` / `--background` (hsl 222 10% 7%) | hsl 220 14% 98% | App + globe void background. Star-field base in dark only (suppressed in light). |
| Panel surface | `hud.charcoal` (hsl 222 8% 10%) | hsl 0 0% 100% | Panels, cards, raised surfaces |
| Raised surface | `hud.continent` (hsl 222 7% 16%) | hsl 220 12% 92% | Muted raised / continent tiles |
| Accent (emerald) | `hud.grid` (hsl 156 58% 50%) | hsl 156 60% 42% | ACTIVE/selected/safe/primary. Use SPARINGLY — only on active toggles, the selected flight, safe-status values, and the wordmark. |
| Warning (coral) | `hud.warn` (hsl 12 78% 60%) | hsl 12 80% 58% | Hazards, MEDIUM risk, at-risk data, SIGMETs |
| Critical (red) | `hud.crit` (hsl 0 70% 62%) | hsl 0 72% 51% | HIGH risk / true danger ONLY. Never decorative. |
| Neutral border | `hud.border` (hsl 220 10% 16%) | hsl 220 12% 88% | ALL structural borders, dividers, panel outlines, row separators |
| Primary text | `hud.ink` (hsl 215 16% 78%) | hsl 220 12% 14% | Body text, label values |
| Muted text | `hud.dim` (hsl 215 10% 45%) | hsl 220 8% 40% | Captions, metadata, inactive icons, placeholders |

### Hard rules

- **Minimalism discipline**: structural chrome ( borders, dividers, row separators, panel outlines, inactive icon outlines ) MUST use the neutral `hud.border` / `hud.dim` tokens — NEVER the emerald `hud.grid`. Emerald is reserved exclusively for active/selected/safe states and primary accents.
- **Three-data-color discipline**: the only saturated colors used to convey meaning are emerald `hud.grid` (safe/active), coral `hud.warn` (warning/medium), and red `hud.crit` (high/critical). Do NOT introduce blue, cyan, amber, yellow, or any other hue for data/UI distinction.
- **Background**: `hud.space` with the sparse `starfield-bg` class on the root layout in dark mode ( subtle pixel star-field with twinkle, no gradients/atmosphere ). In light mode the star-field is suppressed — a clean light canvas.
- **Globe**: minimalist charcoal sphere ( `globe.baseColor` follows `hud.charcoal` ), sky/sun/moon/atmosphere disabled, continents rendered as flat muted `hud.continent` via CARTO dark-no-labels tiles in dark mode.
- **Markers**: flight tracks are heading-rotated triangle billboards ( `BillboardGraphics` with inline SVG triangle, `rotation` = OpenSky heading in radians ) pointing in the direction of travel. Safe = emerald, MEDIUM-risk = coral, HIGH-risk = red, each with larger scale by severity. Airport dep/arr endpoints use reticle point markers ( departure = emerald, arrival = coral ).
- **Marker labels**: small clean sans-serif text ( `hud.ink`, 92% alpha ) with a dark-background pill, placed offset right of the marker via Cesium `LabelGraphics`. Callsigns preferred ( suffixed with last-4 ICAO24 hex to disambiguate duplicates ); fall back to `SYS-<icao6>` system-point IDs.
- **Trails**: flight trails are per-segment polylines color-coded by altitude — dim below 10k ft, emerald 10k–25k, coral 25k–40k, bright coral above 40k. Altitude read at a glance via color.
- **Typography**: everything is monospaced — `ui-monospace, "JetBrains Mono", "Roboto Mono", monospace`. Tracked-out letter-spacing ( `tracking-[0.14em]` to `0.2em` ) on labels and headings. Base floor for body text is 11px; never go below 10px for on-screen text.
- **Borders**: 1px, neutral `hud.border`. `--radius: 0.25rem` ( near-square, slightly softer than before ).
- **Panels**: `bg-hud-charcoal/95 backdrop-blur-md` over the background, with thin neutral `hud-border` borders. No drop shadows — depth comes from backdrop blur and the star-field behind ( dark ).
- **CRT scanlines**: removed per user request — do not reintroduce.
- **Animations**: keep motion sparse and mechanical. `status-blink` ( 1.6s pulse for status dots ), `pulse-ring` ( sonar expand for system status ), `reticle-spin` ( 6s slow rotation, reserved for targeting overlays ). User-initiated transitions must complete within 300ms ( see `12-principles-of-animation` skill ). Theme toggle uses a circular-reveal view-transition ( 280ms ) with a 200ms cross-fade fallback.
- shadcn/ui tokens remain the base, overridden via CSS variables in `frontend/src/styles/globals.css`. Tailwind `hud.*` custom colors ( mapped to the CSS vars ) are the source of truth for tactical surfaces.
- **Field guide**: a `LegendDialog` is reachable from the HudBar `GUIDE` button, explaining all telemetry terms, hazards, risk levels, color codes, and the vertical profile to non-aviation users.

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
