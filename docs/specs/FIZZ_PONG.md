# Fizz-Pong: Carbonation War

## Concept
A pressurized soda-tank paddle battle paying homage to classic early-90s shareware menu games (such as *Commander Keen 4*'s wrist-monitor *Paddle War*). Ben Blaze commands the bottom deflection paddle against a relentless Zarg drone in an experimental vertical carbonation chamber.

## Mechanics
- **Court:** A vertical pressurized soda tank enclosed by glass walls and measurement ticks.
- **Paddles:**
  - Player paddle slides horizontally along the bottom baseline (`Left` / `Right` or `A` / `D`).
  - Zarg CPU drone tracks the ball along the top baseline with calibrated response delay.
- **Ball & Carbonation Currents:**
  - The plasma orb bounces off the reinforced glass side walls.
  - Rising carbonation bubble currents deflect the ball horizontally as it traverses the fluid.
  - Paddle edge hits impart angular spin.
- **Fizz Bubble Bonus:**
  - Every sustained rally of 5 hits spawns a temporary Fizz Bubble in centre court.
  - Striking the bubble releases a fast multiball or triggers a $1.25\times$ speed surge.
- **Scoring:** First player to 7 points secures the match.

## Controls
- `Left` / `Right` or `A` / `D`: Slide paddle
- `Space`: Serve / restart
- `P`: Pause match
- `Esc`: Return to Hub

## Engine Details
- Deterministic rules layer implemented in `#![no_std]` Rust in `crates/fizz-pong`.
- Web presentation built with Canvas 2D and `@liminal-hq/undertone` procedural audio.
