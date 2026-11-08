// Crystal Defender - Asteroids clone
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub left: bool,
    pub right: bool,
    pub thrust: bool,
    pub shoot: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub player_x: f64,
    pub player_y: f64,
    pub player_vx: f64,
    pub player_vy: f64,
    pub player_angle: f64,
    pub score: u32,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            player_x: 0.0,
            player_y: 0.0,
            player_vx: 0.0,
            player_vy: 0.0,
            player_angle: 0.0,
            score: 0,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if input.left {
        state.player_angle -= 0.1;
    }
    if input.right {
        state.player_angle += 0.1;
    }

    // In actual implementation use libm for sin/cos
    if input.thrust {
        // state.player_vx += cos(state.player_angle) * 0.1;
        // state.player_vy += sin(state.player_angle) * 0.1;
    }

    state.player_x += state.player_vx;
    state.player_y += state.player_vy;
}
