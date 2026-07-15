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

## 7. Frontend Visual Style — "Dark Cyber-Radar"

- Background: near-black radar screen (`#05070a` / `oklch(15% 0.02 240)`).
- Primary grid: subtle cyan-green CRT glow (`#12ffaa` / `oklch(85% 0.18 160)`).
- Hazard zones: crimson volumetric translucent red (`#ff3358` / `oklch(65% 0.22 25)`, alpha 0.18).
- At-risk flights: pulsing red glow ring around sprite.
- Safe flights: amber/off-white plane icons.
- Use shadcn/ui dark theme tokens as the base, override with Tailwind v4 CSS variables in `frontend/src/styles/globals.css`.
- All borders: `border-cyan-500/15`. Monospace font: `ui-monospace, "JetBrains Mono", monospace`.
- Apply CRT scanline overlay (very subtle 4% opacity) on the globe container only.

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
