// Gumdrop Pac-Man - Maze chaser
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub up: bool,
    pub down: bool,
    pub left: bool,
    pub right: bool,
}

#[derive(Clone, Debug, PartialEq, Default)]
pub struct GameState {
    pub player_x: i32,
    pub player_y: i32,
    pub score: u32,
    pub powered_up: u32,
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if input.up {
        state.player_y -= 1;
    }
    if input.down {
        state.player_y += 1;
    }
    if input.left {
        state.player_x -= 1;
    }
    if input.right {
        state.player_x += 1;
    }

    if state.powered_up > 0 {
        state.powered_up -= 1;
    }
}
