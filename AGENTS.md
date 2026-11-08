# AGENTS.md

## Table of Contents

- [Repository Metadata](#repository-metadata)
- [Project Status](#project-status)
- [Source of Truth](#source-of-truth)
- [Localization and Spelling](#localization-and-spelling)
- [Markdown Formatting](#markdown-formatting)
- [Authoring Voice](#authoring-voice)
- [Commit Messages](#commit-messages)
- [Pull Request Titles](#pull-request-titles)
- [Pull Request Content](#pull-request-content)
- [Pull Request Labels](#pull-request-labels)
- [Git Workflow](#git-workflow)
- [Local Tooling](#local-tooling)
- [Architecture Rules](#architecture-rules)
- [Testing and CI](#testing-and-ci)
- [Documentation](#documentation)
- [Repository Layout](#repository-layout)
- [Licence and Copyright](#licence-and-copyright)
- [Agent Behaviour](#agent-behaviour)

## Repository Metadata

Applied to the GitHub repository `ScottMorris/minigame-lab`.

- **Description:** Six retro arcade mini-games and an interactive arcade Hub built on the Lieutenant Fizz 2 engine core.
- **Topics:** `arcade`, `minigames`, `lieutenant-fizz`, `rust`, `wasm`, `bun`, `vite`, `canvas`, `retro-gaming`, `liminal-hq`

## Project Status

Mini Game Lab is a monorepo featuring six retro arcade mini-games (*Fizz Invaders*, *Gloop Slugger*, *Cocoa Drop*, *Pogo Panic*, *Gumdrop Pacman*, and *Crystal Defender*) powered by the shared Lieutenant Fizz 2 engine core (`fizz-sim`, `fizz-phys`, and `fizz-view`). Each game pairs a deterministic `#![no_std]` Rust simulation compiled to WebAssembly with a TypeScript presentation layer using Canvas 2D and `@liminal-hq/undertone` audio. The games are unified by an interactive retro CRT arcade Hub (`games/hub`) bundled with Vite and deployed to GitHub Pages.

## Source of Truth

- `docs/specs/*.md` are the game specifications defining rules, scoring, and entity behaviours.
- `docs/ARCHITECTURE.md` defines the architectural layers, monorepo workspaces, and shared simulation contracts.
- `README.md` defines the repository entry point, game showcase, and developer workflows.
- If code and documentation disagree, resolve it deliberately: update the code to match the spec, or update the specification in the same branch with the design rationale.

## Localization and Spelling

**REQUIREMENT:** All UI strings, code identifiers, comments, commit messages, pull request descriptions, and documentation MUST use **Canadian English** spelling.

Examples:

- `colour` instead of `color`
- `centre` instead of `center`
- `neighbour` instead of `neighbor`
- `behaviour` instead of `behavior`
- `cancelled` instead of `canceled`
- `customise` instead of `customize`, `minimise` instead of `minimize`
- `licence` (noun) vs `license` (verb)
- `artefact` instead of `artifact`

Keep external or technical spellings where a third-party API, CSS property, crate name, or protocol strictly requires them (for example `color` in CSS, `Float32Array`, or the SPDX `license` identifier).

## Markdown Formatting

**REQUIREMENT:** Do not hard-wrap markdown prose. Write each paragraph or bullet as a single unwrapped line in the source, no matter how long, and let the renderer reflow it. This applies to markdown-rendered content: PR descriptions, documentation under `docs/`, `README.md`, and issue descriptions. Commit message bodies are the one exception: hard-wrap those (see [Commit Messages](#commit-messages)).

- Manual line breaks mid-paragraph create noisy diffs when small edits reflow entire paragraphs.
- This rule does not apply to separate list items, headings, or intentional line breaks.
- Code comments are not markdown-rendered and may wrap normally at a reasonable line length.

**Em dashes:** Use a real em dash (`—`) in prose, never `--` as a substitute. This applies across all prose (PR descriptions, documentation, README files, commit messages, and comments). Do not replace CLI flags (such as `--check`) or numeric ranges.

## Authoring Voice

**REQUIREMENT:** Ship the result, not how the conversation arrived at it. Write every outward-facing line — code comments, identifier names, documentation, PR descriptions — as the author of the artefact, for the reader who will encounter it later.

- Do not reference "this PR", "the review", a reviewer's name, or a commit SHA inside code comments or PR prose. State facts and reasoning directly, as if they had always been true.
- When comments are updated across iterations, rewrite them into a single clean explanation.
- Commit messages are the legitimate place to record why a change occurred, including debugging context.

## Commit Messages

**Format:** Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `build:`, `ci:`, `chore:`).

- Use `test:` for test-related changes, including fixes to tests themselves (do not use `fix:` unless fixing application logic).
- Every commit body explains what and why, with bold labels or flat bullets and every code-level reference in backticks.
- Hard-wrap commit bodies at roughly 72 to 100 characters.
- Write commit messages to a file and commit with `git commit -F` when backticks or multi-line prose are present.
- End every commit that an AI model helped write with a `Co-Authored-By:` trailer naming the model and its author address.

## Pull Request Titles

**REQUIREMENT:** A PR title is a human-readable summary of the change, never a Conventional Commit.

- Start with a capital letter, write in the imperative mood, and keep to roughly 70 characters.
- No `feat:`, `fix:`, or `chore:` prefixes.
- Describe the outcome, not the process.
- Keep the title style consistent across pull requests in a stack.

## Pull Request Content

**REQUIREMENT:** Use outcome-focused language and leave out internal conversation history or workflow artefacts. Open PRs ready for review unless explicitly asked for a draft.

- Use `## Summary` with flat bullets that have **bold** lead-ins:
  - `- **What changed:** ...`
  - `- **Why:** ...`
- Include a `### Documentation` subsection:
  - `- Docs updated (`docs/`, `AGENTS.md`, `README.md`), or not needed: ...`
- Use `## Test plan` as a checklist (`- [x]` / `- [ ]`) with the exact commands run.
- If anything was not verified or could not be exercised headlessly, state it plainly at the end under `Not verified:`.
- `.github/pull_request_template.md` defines the authoritative template.

## Pull Request Labels

**REQUIREMENT:** Add labels to every PR when it is created or updated.

- **Primary category** (at least one): `enhancement`, `bug`, `documentation`, `testing`, `ci`, `build`, or `chore`. Do not use `feat` or `fix`.
- **Shared operational labels:** `infrastructure`, `internal`, `release`, `blocked`, `skip-changelog`.
- **Scope labels:** technology (`rust`, `web`, `sim`, `wasm`), components (`ui`, `graphics`, `sound`, `input`, `levels`, `pages`, `performance`).
- `skip-changelog` excludes a change from GitHub's generated release notes (configured in `.github/release.yml`).

## Git Workflow

**REQUIREMENT:** Never push, force-push, tag, or merge without explicit user instruction. The default branch is `main`; never commit directly to it.

- Work on descriptive topic branches: `feat/<short-description>`, `fix/<short-description>`, `docs/<short-description>`, or `chore/<short-description>`.
- Use merge commits only; never squash or rebase-merge.
- Stage specific paths with `git add <path>`; never use `git add -A` or `git commit -a`.
- Do not commit build artefacts (`dist/`, `target/`, `node_modules/`).
- Use the `gh` CLI for pull requests, labels, and Actions runs.

## Local Tooling

- **Bun:** Bun 1.3+ is the JavaScript runtime, package manager, and test runner. Use `bun`, never npm, pnpm, or yarn.
- **Rust:** Rust is pinned in `rust-toolchain.toml` with the `wasm32-unknown-unknown` target.
- **Pre-PR gate:** `bun run validate` is the authoritative local gate, running Prettier, ESLint, TypeScript type checks, Rust formatting, Clippy, workspace tests, and site assembly.

## Architecture Rules

- **Deterministic rules layer:** The simulation core (`crates/fizz-sim`, `crates/fizz-phys`, `crates/fizz-view`) is pure `#![no_std]` plus `alloc`, forbids `unsafe`, and has no clocks, platform types, or unseeded randomness. A tick is a pure function of its previous state and inputs.
- **Web presentation layer:** Web views render via Canvas 2D using the 16-colour EGA palette and play retro audio with `@liminal-hq/undertone`. The presentation reacts to simulation state and never re-derives simulation logic.
- **Hub interface:** The central arcade Hub links to all games with relative paths (`./games/<game>/`), and each game provides a styled `← Hub` button to return to `./`.

## Testing and CI

- Continuous integration in `.github/workflows/ci.yml` runs 8 granular parallel jobs: `Rust format`, `Rust Clippy`, `Rust tests`, `Prettier format`, `ESLint`, `TypeScript type check`, `WASM build check`, and `Web site build`.
- Each CI job publishes markdown metrics directly to `$GITHUB_STEP_SUMMARY`.
- Merges to `main` trigger automated deployment to GitHub Pages via `.github/workflows/pages.yml`.

## Documentation

- Maintain documentation in parallel with implementation.
- Update `docs/ARCHITECTURE.md` when monorepo layers or contracts change, and `docs/specs/*.md` when game rules change.
- Record landing pull requests in `WORKLOG.md` and user-facing milestones in `CHANGELOG.md`.

## Repository Layout

```text
minigame-lab/
├── assets/                  # Hero banner (assets/hero.svg) and artwork
├── crates/                  # Rust workspace
│   ├── fizz-sim/            # Core deterministic simulation contracts and state hash
│   ├── fizz-phys/           # Physics, collisions, platforms, and PRNG
│   ├── fizz-view/           # Software renderer, camera, EGA palette, fonts
│   └── <game-crates>/       # Game simulation rules crates
├── games/                   # Bun web workspaces
│   ├── hub/                 # Interactive CRT arcade Hub
│   └── <game-frontends>/    # Web frontends (Vite + Canvas 2D + Undertone)
├── docs/                    # Architecture and game specifications
│   └── specs/               # Individual game specifications
├── scripts/                 # Build and assembly scripts
└── .github/workflows/       # Granular CI and Pages deployment workflows
```

## Licence and Copyright

The project is dual-licensed under Apache-2.0 OR MIT. New or substantially rewritten source files (`.rs`, `.ts`, `.js`, `.sh`, `.yml`) begin with a summary, copyright and SPDX header:

```text
// Brief one-line summary of what this file does.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
```

Use `#` for shell and YAML scripts. Do not add headers to markdown, JSON, or generated lockfiles.

## Agent Behaviour

- Read relevant specifications and documentation before implementing.
- Make requested changes cleanly without unrelated refactoring.
- State uncertainty, unverified platforms, and testing omissions plainly.
- Stay within assigned paths when collaborating in the repository.
