# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mini Game Lab (`ScottMorris/minigame-lab`) is a monorepo featuring six retro arcade mini-games (*Fizz Invaders*, *Gloop Slugger*, *Cocoa Drop*, *Pogo Panic*, *Gumdrop Pacman*, and *Crystal Defender*) powered by the Lieutenant Fizz 2 engine core (`fizz-sim`, `fizz-phys`, and `fizz-view`). Deterministic `#![no_std]` Rust simulation crates compile to WebAssembly, paired with Vite-bundled Canvas 2D Web presentations and Undertone audio (`@liminal-hq/undertone`), linked through an interactive CRT arcade Hub (`games/hub`) deployed to GitHub Pages. See `AGENTS.md` for authoritative conventions.

## Layout

Bun workspaces + Cargo workspace:

- `crates/fizz-sim`, `crates/fizz-phys`, `crates/fizz-view` — core deterministic engine crates
- `crates/<game-crates>` — simulation rules crates for each individual mini-game
- `games/hub` — retro arcade Hub interface and navigation launcher
- `games/<game-frontends>` — Canvas 2D web frontends bundled with Vite and Undertone audio
- `assets/` — animated 16-colour EGA hero banner (`assets/hero.svg`)
- `docs/` — architecture documentation and individual game specifications (`docs/specs/`)
- `scripts/` — build and collation scripts (`build-wasm.sh`, `build-site.sh`)

## Commands

```bash
bun install          # install web dependencies across workspaces
bun run dev          # run local Vite dev server
bun run build        # compile WASM and bundle production site into dist/
bun run lint         # ESLint across all TypeScript packages
bun run format:check # check Prettier formatting
bun run typecheck    # TypeScript type checks across all web packages
bun run test:rust    # run cargo test --workspace (102 tests)
bun run lint:rust    # run cargo clippy --workspace --all-targets -- -D warnings
bun run validate     # full pre-PR gate (runs format, lint, typecheck, clippy, tests, build)
```

`bun run validate` is the authoritative pre-PR gate. Use Bun, never npm, pnpm, or yarn.

## Architecture — the key things to understand

**The Rust crates own simulation; TypeScript owns presentation.** Deterministic game rules (entity physics, collision, projectile updates, scoring) live in `#![no_std]` Rust crates under `crates/` with fixed ticks and seeded PRNG. TypeScript views render sprites to Canvas 2D using the 16-colour EGA palette, trigger sound effects with `@liminal-hq/undertone`, and react to simulation state; they never re-derive simulation logic.

**Arcade Hub integration.** The Hub (`games/hub`) links to all mini-games with relative paths (`./games/<game>/`), and each game view provides reciprocal navigation via a styled `← Hub` button linking back to `./`. The production build scripts collate all workspaces into `./dist/` with a `.nojekyll` marker for GitHub Pages.

## Conventions (from AGENTS.md)

- **PR titles**: human-readable summary, imperative mood, sentence case, ~70 chars, no Conventional Commit prefix.
- **PR descriptions**: `## Summary` with flat bullets and **bold** lead-ins (`- **What changed:** ...`, `- **Why:** ...`), `### Documentation` subsection, and `## Test plan` checklist (`- [x]`) with commands run and `Not verified:`.
- **PR labels**: primary category label (`enhancement`, `bug`, etc.) plus relevant scope labels (`sim`, `web`, `rust`, `ci`, `graphics`, `ui`, `pages`).
- **Commits**: Conventional Commits with hard-wrapped markdown bodies explaining what and why. Stage exact paths with `git add <path>`, never `-A` or `-a`. End with the `Co-Authored-By:` trailer.
- **Merging**: merge commits only (never squash or rebase-merge), and only after explicit user instruction.
- **Licence headers**: summary line + `(c) Copyright 2026 Liminal HQ, Scott Morris` + `SPDX-License-Identifier: Apache-2.0 OR MIT` on source files.
- **Prose**: Canadian English spelling (`colour`, `behaviour`, `licence`, `artefact`); unwrapped markdown paragraphs; real em dashes (`—`), never `--`.
- **Authoring voice**: outward-facing lines state facts directly without referencing "this PR", reviews, or commit SHAs.
