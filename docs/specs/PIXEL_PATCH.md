# Pixel Patch: Corruption Control

## Concept
A territory-recovery puzzle arcade homage inspired by *Qix* and retro screen restoration utilities. A static infection program is devouring the Fizz computer's display, converting colourful mosaic map tiles into flickering noise. Players manoeuvre a targeted repair crosshair to patch corrupted tiles and eliminate reproducing source cells before the display is overrun.

## Mechanics
- **Display Matrix:** An $8 \times 8$ mosaic board of colourful EGA pixel tiles.
- **Infection Dynamics:**
  - Corrupted cells render as animated CP437 static noise (`░▒▓█`).
  - Active infection clusters originate from **Source Cells** (`☣`).
  - Every 1.5 seconds, infection from active source roots reproduces into adjacent clean cells.
- **Restoration Protocol:**
  - Move the repair crosshair using `Arrow Keys` or `WASD`.
  - Press `Space` to apply a restoration patch to the targeted tile.
  - Patching a Source Cell permanently stops that infection cluster from spreading further.
  - Consecutive successful repairs trigger combo multipliers ($1\times, 2\times, 3\times$).
- **Victory & Failure Conditions:**
  - Win by restoring display integrity ($\ge 85\%$ clean cells or all sources neutralized).
  - Game over if the 60-second shift timer elapses or corruption breaches the entire bottom status baseline.

## Controls
- `Arrows` / `WASD`: Move repair crosshair
- `Space`: Patch targeted cell
- `P`: Pause
- `Esc`: Return to Hub

## Engine Details
- Deterministic simulation rules in `crates/pixel-patch` with `#![no_std]` Rust.
- Canvas 2D presenter in `games/pixel-patch` with procedural glitch audio synthesized through `@liminal-hq/undertone`.
