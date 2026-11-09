// Magnet Mayhem: Gantry 5 - Deterministic crane cargo stacking simulation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]
#![forbid(unsafe_code)]

pub const TARGET_CONTAINERS: usize = 6;
pub const CONTAINER_WIDTH: i32 = 48;
pub const CONTAINER_HEIGHT: i32 = 24;
pub const PLATFORM_WIDTH: i32 = 80;
pub const PLATFORM_X: i32 = 240;
pub const PLATFORM_Y: i32 = 320;
pub const SHIFT_DURATION_TICKS: u32 = 75 * 60; // 75 seconds at 60Hz

// Scaled sine lookup table for swing dynamics (-100 to 100)
pub const SINE_TABLE: [i32; 32] = [
    0, 20, 38, 56, 71, 83, 92, 98, 100, 98, 92, 83, 71, 56, 38, 20, 0, -20, -38, -56, -71, -83,
    -92, -98, -100, -98, -92, -83, -71, -56, -38, -20,
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ContainerKind {
    StandardIron,
    HeavyCaps,
    CarbonatedPressurised,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PlacedContainer {
    pub x: i32,
    pub y: i32,
    pub kind: ContainerKind,
    pub offset_from_target: i32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub left: bool,
    pub right: bool,
    pub drop_cargo: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DropRating {
    None,
    Perfect,
    Good,
    Wobbly,
    Toppled,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub gantry_x: i32,
    pub swing_phase: usize,
    pub swing_amplitude: i32,
    pub active_cargo_x: i32,
    pub active_cargo_y: i32,
    pub active_cargo_vy: i32,
    pub is_cargo_falling: bool,
    pub active_cargo_kind: ContainerKind,
    pub stacked_containers: [Option<PlacedContainer>; TARGET_CONTAINERS],
    pub stacked_count: usize,
    pub stack_wobble: i32,
    pub last_rating: DropRating,
    pub score: u32,
    pub time_remaining: u32,
    pub is_shift_cleared: bool,
    pub is_toppled: bool,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            gantry_x: PLATFORM_X,
            swing_phase: 0,
            swing_amplitude: 28,
            active_cargo_x: PLATFORM_X,
            active_cargo_y: 60,
            active_cargo_vy: 0,
            is_cargo_falling: false,
            active_cargo_kind: ContainerKind::StandardIron,
            stacked_containers: [None; TARGET_CONTAINERS],
            stacked_count: 0,
            stack_wobble: 0,
            last_rating: DropRating::None,
            score: 0,
            time_remaining: SHIFT_DURATION_TICKS,
            is_shift_cleared: false,
            is_toppled: false,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if state.is_shift_cleared || state.is_toppled {
        return;
    }

    if state.time_remaining > 0 {
        state.time_remaining -= 1;
        if state.time_remaining == 0 {
            state.is_toppled = true;
            return;
        }
    }

    // Move gantry left / right
    if !state.is_cargo_falling {
        if input.left && state.gantry_x > 80 {
            state.gantry_x -= 3;
        }
        if input.right && state.gantry_x < 400 {
            state.gantry_x += 3;
        }

        // Advance swing phase
        state.swing_phase = (state.swing_phase + 1) % SINE_TABLE.len();
        let swing_offset = (SINE_TABLE[state.swing_phase] * state.swing_amplitude) / 100;
        state.active_cargo_x = state.gantry_x + swing_offset;
        state.active_cargo_y = 60;

        // Trigger cargo drop
        if input.drop_cargo {
            state.is_cargo_falling = true;
            state.active_cargo_vy = 2;
        }
    } else {
        // Cargo falling with gravity
        state.active_cargo_vy += 1;
        state.active_cargo_y += state.active_cargo_vy;

        // Determine target landing y and target x
        let (target_y, target_x) = if state.stacked_count == 0 {
            (PLATFORM_Y - CONTAINER_HEIGHT, PLATFORM_X)
        } else {
            let top_container = state.stacked_containers[state.stacked_count - 1].unwrap();
            (top_container.y - CONTAINER_HEIGHT, top_container.x)
        };

        if state.active_cargo_y >= target_y {
            state.active_cargo_y = target_y;
            state.is_cargo_falling = false;

            // Check alignment offset from target centre
            let offset = (state.active_cargo_x - target_x).abs();
            let max_allowed_offset = CONTAINER_WIDTH / 2;

            if offset <= 4 {
                state.last_rating = DropRating::Perfect;
                state.score += 500;
            } else if offset <= 12 {
                state.last_rating = DropRating::Good;
                state.score += 250;
                state.stack_wobble += 2;
            } else if offset <= max_allowed_offset {
                state.last_rating = DropRating::Wobbly;
                state.score += 100;
                state.stack_wobble += 5;
            } else {
                state.last_rating = DropRating::Toppled;
                state.is_toppled = true;
                return;
            }

            // Place container onto stack
            state.stacked_containers[state.stacked_count] = Some(PlacedContainer {
                x: state.active_cargo_x,
                y: target_y,
                kind: state.active_cargo_kind,
                offset_from_target: state.active_cargo_x - target_x,
            });
            state.stacked_count += 1;

            if state.stacked_count >= TARGET_CONTAINERS {
                state.is_shift_cleared = true;
                let time_bonus = (state.time_remaining / 60) * 15;
                state.score += time_bonus;
            } else {
                // Next cargo ready
                state.active_cargo_kind = match state.stacked_count % 3 {
                    0 => ContainerKind::StandardIron,
                    1 => ContainerKind::HeavyCaps,
                    _ => ContainerKind::CarbonatedPressurised,
                };
                state.swing_amplitude = 24 + (state.stack_wobble * 2).min(20);
                state.active_cargo_vy = 0;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let state = GameState::default();
        assert_eq!(state.stacked_count, 0);
        assert!(!state.is_shift_cleared);
        assert!(!state.is_toppled);
        assert_eq!(state.gantry_x, PLATFORM_X);
    }

    #[test]
    fn test_perfect_landing() {
        let mut state = GameState {
            active_cargo_x: PLATFORM_X,
            is_cargo_falling: true,
            active_cargo_vy: 4,
            active_cargo_y: PLATFORM_Y - CONTAINER_HEIGHT - 2,
            ..Default::default()
        };

        let input = GameInput {
            left: false,
            right: false,
            drop_cargo: false,
        };
        tick(&mut state, &input);

        assert_eq!(state.stacked_count, 1);
        assert_eq!(state.last_rating, DropRating::Perfect);
        assert_eq!(state.score, 500);
    }

    #[test]
    fn test_topple_on_wide_miss() {
        let mut state = GameState {
            active_cargo_x: PLATFORM_X + 45,
            is_cargo_falling: true,
            active_cargo_vy: 4,
            active_cargo_y: PLATFORM_Y - CONTAINER_HEIGHT - 2,
            ..Default::default()
        };

        let input = GameInput {
            left: false,
            right: false,
            drop_cargo: false,
        };
        tick(&mut state, &input);

        assert!(state.is_toppled);
    }
}
