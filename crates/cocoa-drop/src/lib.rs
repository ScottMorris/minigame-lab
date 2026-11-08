// Cocoa Drop - Falling block puzzle
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub left: bool,
    pub right: bool,
    pub rotate: bool,
    pub drop: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub grid: [[u8; 10]; 20],
    pub active_piece_x: i32,
    pub active_piece_y: i32,
    pub ticks: u32,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            grid: [[0; 10]; 20],
            active_piece_x: 4,
            active_piece_y: 0,
            ticks: 0,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if input.left && state.active_piece_x > 0 {
        state.active_piece_x -= 1;
    }
    if input.right && state.active_piece_x < 9 {
        state.active_piece_x += 1;
    }
    if input.drop {
        state.active_piece_y += 1;
    }

    state.ticks += 1;
    if state.ticks >= 30 {
        state.active_piece_y += 1;
        state.ticks = 0;
    }
}
