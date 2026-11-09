# Soda Snake: The Last Straw

## Concept
A nostalgic grid-chase survival game paying tribute to classic QBasic *Nibbles* and arcade *Snake*. In the bottling plant's high-pressure maintenance shaft, an automated cleaning hose has developed a mind of its own—forming a flexible barber-pole striped soda straw that lengthens as it devours golden Fizz Pellets.

## Mechanics
- **Shaft Grid:** A $20 \times 14$ industrial checkerboard tile floor.
- **Straw Movement:**
  - Continuous movement across tiles (`Arrow Keys` or `WASD`).
  - Speed escalates as the straw expands in length.
- **Carbonation Vents:**
  - Dynamic industrial floor vents periodically power up with blinking directional chevrons.
  - When the straw's head crosses an active vent, it is shoved one cell in the vent's blast direction on the subsequent tick.
- **Pressure Brake:**
  - Players possess up to 5 emergency pressure brakes.
  - Tapping `Space` vents pressure to skip a single movement tick, granting crucial reaction time to evade wall or tail collisions.
  - Additional brakes are earned every 300 points.
- **Hazards & Scoring:**
  - Colliding with the perimeter shaft wall or the straw's own segments causes an immediate straw rupture.
  - Each Fizz Pellet scores 100 points.

## Controls
- `Arrows` / `WASD`: Steer soda straw
- `Space`: Pressure Brake (skip one movement tick)
- `P`: Pause
- `Esc`: Return to Hub

## Engine Details
- Deterministic simulation rules in `crates/soda-snake` with `#![no_std]` Rust.
- Canvas 2D presenter in `games/soda-snake` utilizing procedural audio from `@liminal-hq/undertone`.
