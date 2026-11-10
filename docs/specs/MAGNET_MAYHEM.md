# Magnet Mayhem: Gantry 5

## Concept
A precision crane stacking arcade challenge. A prototype industrial electromagnetic crane is piling up iron bottle-cap containers in the loading bay. As the gantry slides across the loading shaft, the suspended container sways in a pendulum arc. Players release the electromagnetic grip to drop containers onto the landing pad and build a stable stack before the shift ends.

## Mechanics
- **Crane & Cargo Dynamics:**
  - The overhead gantry moves horizontally across the loading bay track.
  - Suspended containers swing in a periodic pendulum arc controlled by a deterministic sine lookup table.
  - Three varieties of cargo containers cycle across drops: Standard Iron, Heavy Caps, and Pressurised Fizz.
- **Drop Accuracy & Stacking:**
  - Pressing `Space` cuts electromagnetic power, dropping the container vertically under gravity.
  - **Perfect Drop:** Landing within 4 pixels of the target centre earns 500 bonus points with zero added wobble.
  - **Good Placement:** Landing within 12 pixels earns 250 points with slight stack wobble.
  - **Wobbly Drop:** Landing within container half-width earns 100 points, increasing tower sway and next swing amplitude.
  - **Toppled Drop:** Exceeding container bounds topples the shipment and triggers shift failure.
- **Victory & Failure Conditions:**
  - Shift Cleared: Successfully stack 6 cargo containers before the 75-second shift countdown expires.
  - Shipment Toppled: A container misses the stack threshold, or the shift timer elapses.

## Controls
- `Left` / `A`: Move gantry left
- `Right` / `D`: Move gantry right
- `Space`: Release electromagnetic cargo drop
- `P`: Pause
- `R`: Reset / Retry shift

## Engine Details
- Deterministic crane swing and stacking collision physics in `crates/magnet-mayhem` with `#![no_std]` Rust.
- Canvas 2D industrial bay presentation in `games/magnet-mayhem` with procedural metallic landing clangs and electromagnetic hum synthesized through `@liminal-hq/undertone`.
