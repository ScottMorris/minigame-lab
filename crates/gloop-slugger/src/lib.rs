// Gloop Slugger - Whack-a-Mole clone
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub target_index: Option<usize>,
}

#[derive(Clone, Debug, PartialEq, Default)]
pub struct GameState {
    pub score: u32,
    pub active_gloop: Option<usize>,
    pub ticks_remaining: u32,
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if let Some(target) = input.target_index {
        #[allow(clippy::collapsible_if)]
        if state.active_gloop == Some(target) {
            state.score += 1;
            state.active_gloop = None;
            state.ticks_remaining = 0;
        }
    }

    if state.ticks_remaining > 0 {
        state.ticks_remaining -= 1;
    } else {
        // Mock random behavior for testing - in full game use rng
        state.active_gloop = Some((state.score as usize) % 9);
        state.ticks_remaining = 60;
    }
}
