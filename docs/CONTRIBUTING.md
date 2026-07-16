# Contributing to AeroShield 3D

Thank you for your interest in contributing! This guide covers everything you
need to get started.

---

## 1. Prerequisites

| Tool | Version |
|------|---------|
| Rust | 1.78+ (stable) |
| Node.js | 20 LTS |
| pnpm | 9+ |
| Git | 2.30+ |

## 2. Setup

```bash
git clone https://github.com/<your-fork>/AeroShield-3D.git
cd AeroShield-3D

# Backend
cd backend
cp .env.example .env
cargo build

# Frontend
cd ../frontend
cp .env.example .env.local
pnpm install
```

## 3. Branch & Commit Convention

### Branches

| Type | Format | Example |
|------|--------|---------|
| Feature | `feat/<scope>-<desc>` | `feat/backend-opensky-ingest` |
| Fix | `fix/<scope>-<desc>` | `fix/frontend-globe-flicker` |
| Docs | `docs/<scope>-<desc>` | `docs/api-reference` |

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(backend): parse SIGMET polygons from AviationWeather
fix(frontend): correct Cesium globe tile flair flicker
docs(api): add SSE event contract documentation
chore(repo): add gitignore + attributes
```

**Scopes**: `backend`, `frontend`, `repo`, `docs`, `plan`.

## 4. Development Workflow

```bash
# Start backend (terminal 1)
cd backend
cargo run --release

# Start frontend (terminal 2)
cd frontend
pnpm run dev

# Smoke test
./scripts/smoke.ps1
```

## 5. Verification Checklist

Before opening a PR, verify:

### Backend (Rust)
```bash
cd backend
cargo fmt
cargo clippy --all-targets -- -D warnings
cargo test
```

### Frontend (TypeScript)
```bash
cd frontend
pnpm run lint
pnpm run typecheck
pnpm run build
```

All four must pass with zero warnings/errors.

## 6. Code Style

### Rust
- Run `cargo fmt` before every commit.
- No `unwrap()` in production code — use `?` or `unwrap_or_default()`.
- No comments unless the logic is non-obvious (AGENTS.md section 3).
- Add unit tests for non-trivial logic (geo checks, parsers, risk engine).

### TypeScript
- Use `import type` for type-only imports.
- Prefer `const` over `let`.
- Use `@/` path alias for `src/` imports.
- Wrap high-count render logic in `useMemo` or use primitive collections.
- No comments unless explicitly requested.

### Visual Design
- Two-neon discipline: only `#39ff14` (lime) and `#ff5f1f` (orange) as
  saturated colors. See `AGENTS.md` section 7.
- Monospace font everywhere: `ui-monospace, "JetBrains Mono", monospace`.
- Ultra-thin borders (1px), near-square corners (`radius: 0.125rem`).

## 7. Pull Request Process

1. Create a feature branch from `main` (never push to `main` directly).
2. One task section per PR — keep scope narrow.
3. Update `PLAN.md` checkboxes if applicable.
4. Verify all checks pass (section 5).
5. Write a clear PR description with:
   - What changed
   - Why it changed
   - How to test it
6. Link any related issues.

## 8. Project Structure

```
AeroShield-3D/
├── backend/          # Rust (Axum) - flight + hazard ingestion, spatial checks, SSE
├── frontend/         # React + Vite + Tailwind + shadcn/ui + CesiumJS
├── docs/             # Architecture, design, technical, API, diagrams, ADRs
├── scripts/          # Dev utilities (smoke tests, start scripts)
├── AGENTS.md         # AI agent operating rules
├── PLAN.md           # Task-based build plan
├── CONTRIBUTING.md   # This file
├── CHANGELOG.md      # Version history
└── README.md         # Project overview
```

## 9. Data Sources

This project uses **free, no-key** data sources only (AGENTS.md section 6):

| Source | Provider | Endpoint |
|--------|----------|----------|
| Live flights | OpenSky Network | `https://opensky-network.org/api` |
| Aviation weather | AviationWeather.gov | `https://aviationweather.gov/api/data` |
| Airports DB | open-source JSON | GitHub raw (cached at startup) |

**Do not** introduce paid or API-key-required data sources.

## 10. Getting Help

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview.
- Read [TECHNICAL.md](./TECHNICAL.md) for module-level documentation.
- Read [API.md](./API.md) for endpoint reference.
- Read [DIAGRAMS.md](./DIAGRAMS.md) for UML diagrams.
- Check [ADR records](./adr/) for design decision rationale.
