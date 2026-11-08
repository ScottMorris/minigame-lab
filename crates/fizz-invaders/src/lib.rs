// Fizz Invaders - Space Invaders clone
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub left: bool,
    pub right: bool,
    pub shoot: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub player_x: f64,
}

impl Default for GameState {
    fn default() -> Self {
        Self { player_x: 0.0 }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if input.left {
        state.player_x -= 1.0;
    }
    if input.right {
        state.player_x += 1.0;
    }
}
