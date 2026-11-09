# Hex Lock: Access Denied

## Concept
A deduction puzzle arcade homage inspired by classic Mastermind and security terminal codebreakers. The Master of Mischief has locked the central vault behind a hexadecimal cipher. The lab terminal discloses clue diagnostic LEDs after each submission, requiring players to deduce the four-symbol passcode before lockout or timer expiration.

## Mechanics
- **Passcode Structure:** A 4-slot code composed of six allowable hexadecimal glyphs: `0`, `1`, `7`, `A`, `B`, `F`. Repeated symbols are permitted.
- **Diagnostic Feedback:**
  - After each guess entry, the terminal diagnostic evaluates each slot:
  - **Exact:** The glyph matches the secret code at that exact slot position (indicated by a green LED).
  - **Misplaced:** The glyph appears in the secret code, but occupies a different slot (indicated by an amber/yellow LED).
  - **Miss:** The glyph does not appear in any unused slot of the secret code (indicated by a dark grey LED).
- **Security Lockout & Scoring:**
  - Players have a maximum of 6 attempts and 75 seconds to break the cipher.
  - The security integrity score starts at 1,000 points and decreases with each submitted attempt.
  - Solving the cipher quickly yields bonus integrity points based on remaining time.
- **Victory & Failure Conditions:**
  - Access Granted: All four slots match the secret cipher exactly.
  - Access Denied: 6 incorrect attempts are exhausted or the 75-second countdown reaches zero.

## Controls
- `Left` / `Right`: Select cipher slot
- `Up` / `Down`: Cycle hexadecimal glyph
- `Space` / `Enter`: Submit cipher attempt
- `P`: Pause
- `R`: Reset / Retry cipher

## Engine Details
- Deterministic deduction rules and clue evaluation in `crates/hex-lock` with `#![no_std]` Rust.
- Canvas 2D CRT presentation in `games/hex-lock` with procedural relay and terminal acoustic feedback synthesized via `@liminal-hq/undertone`.
