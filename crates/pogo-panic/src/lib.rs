// Pogo Panic - Doodle Jump clone
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub left: bool,
    pub right: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Platform {
    pub x: f64,
    pub y: f64,
    pub width: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub player_x: f64,
    pub player_y: f64,
    pub player_vy: f64,
    pub camera_y: f64,
    pub score: u32,
    pub platforms: [Platform; 10],
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            player_x: 0.0,
            player_y: 0.0,
            player_vy: 0.0,
            camera_y: 0.0,
            score: 0,
            platforms: core::array::from_fn(|_| Platform {
                x: 0.0,
                y: 0.0,
                width: 0.0,
            }),
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if input.left {
        state.player_x -= 1.0;
    }
    if input.right {
        state.player_x += 1.0;
    }

    // Gravity
    state.player_vy += 0.5;
    state.player_y += state.player_vy;

    // Pseudo-pogo logic
    if state.player_vy > 0.0 {
        for p in state.platforms.iter() {
            if state.player_y >= p.y
                && state.player_y - state.player_vy <= p.y
                && state.player_x >= p.x
                && state.player_x <= p.x + p.width
            {
                state.player_vy = -10.0;
                break;
            }
        }
    }

    // Camera scroll
    if state.player_y < state.camera_y - 100.0 {
        state.camera_y = state.player_y + 100.0;
        state.score += 1;
    }
}
