// Hex Lock: Access Denied - Deterministic hexadecimal cipher deduction simulation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]
#![forbid(unsafe_code)]

pub const CODE_LEN: usize = 4;
pub const MAX_ATTEMPTS: usize = 6;
pub const SYMBOLS: [char; 6] = ['0', '1', '7', 'A', 'B', 'F'];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Clue {
    Exact,
    Misplaced,
    Miss,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GuessRow {
    pub guess: [char; CODE_LEN],
    pub clues: [Clue; CODE_LEN],
    pub submitted: bool,
}

impl Default for GuessRow {
    fn default() -> Self {
        Self {
            guess: ['0'; CODE_LEN],
            clues: [Clue::Miss; CODE_LEN],
            submitted: false,
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub left: bool,
    pub right: bool,
    pub next_sym: bool,
    pub prev_sym: bool,
    pub submit: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub secret: [char; CODE_LEN],
    pub attempts: [GuessRow; MAX_ATTEMPTS],
    pub current_attempt: usize,
    pub selected_slot: usize,
    pub current_guess: [char; CODE_LEN],
    pub is_unlocked: bool,
    pub is_locked_out: bool,
    pub score: u32,
    pub time_remaining: u32,
}

impl Default for GameState {
    fn default() -> Self {
        Self {
            secret: ['A', '0', 'F', '1'],
            attempts: [GuessRow::default(); MAX_ATTEMPTS],
            current_attempt: 0,
            selected_slot: 0,
            current_guess: ['0', '0', '0', '0'],
            is_unlocked: false,
            is_locked_out: false,
            score: 1000,
            time_remaining: 75 * 60,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if state.is_unlocked || state.is_locked_out {
        return;
    }

    if state.time_remaining > 0 {
        state.time_remaining -= 1;
    } else {
        state.is_locked_out = true;
        return;
    }

    // Slot selection
    if input.left && state.selected_slot > 0 {
        state.selected_slot -= 1;
    }
    if input.right && state.selected_slot + 1 < CODE_LEN {
        state.selected_slot += 1;
    }

    // Symbol cycling
    let curr_char = state.current_guess[state.selected_slot];
    let curr_idx = SYMBOLS.iter().position(|&c| c == curr_char).unwrap_or(0);

    if input.next_sym {
        let next_idx = (curr_idx + 1) % SYMBOLS.len();
        state.current_guess[state.selected_slot] = SYMBOLS[next_idx];
    } else if input.prev_sym {
        let prev_idx = if curr_idx == 0 {
            SYMBOLS.len() - 1
        } else {
            curr_idx - 1
        };
        state.current_guess[state.selected_slot] = SYMBOLS[prev_idx];
    }

    // Submission
    if input.submit {
        let clues = evaluate_clues(&state.secret, &state.current_guess);
        state.attempts[state.current_attempt] = GuessRow {
            guess: state.current_guess,
            clues,
            submitted: true,
        };

        // Check exact unlock
        let is_all_exact = clues.iter().all(|&c| c == Clue::Exact);
        if is_all_exact {
            state.is_unlocked = true;
            return;
        }

        // Penalize score for attempt
        state.score = state.score.saturating_sub(150);
        state.current_attempt += 1;

        if state.current_attempt >= MAX_ATTEMPTS {
            state.is_locked_out = true;
        }
    }
}

pub fn evaluate_clues(secret: &[char; CODE_LEN], guess: &[char; CODE_LEN]) -> [Clue; CODE_LEN] {
    let mut clues = [Clue::Miss; CODE_LEN];
    let mut secret_used = [false; CODE_LEN];
    let mut guess_used = [false; CODE_LEN];

    // First pass: exact matches
    for i in 0..CODE_LEN {
        if guess[i] == secret[i] {
            clues[i] = Clue::Exact;
            secret_used[i] = true;
            guess_used[i] = true;
        }
    }

    // Second pass: misplaced matches
    for i in 0..CODE_LEN {
        if !guess_used[i] {
            for j in 0..CODE_LEN {
                if !secret_used[j] && guess[i] == secret[j] {
                    clues[i] = Clue::Misplaced;
                    secret_used[j] = true;
                    break;
                }
            }
        }
    }

    clues
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let state = GameState::default();
        assert!(!state.is_unlocked);
        assert!(!state.is_locked_out);
        assert_eq!(state.current_attempt, 0);
    }

    #[test]
    fn test_clue_evaluation() {
        let secret = ['A', '0', 'F', '1'];
        let guess = ['A', 'F', 'B', '0'];
        let clues = evaluate_clues(&secret, &guess);

        assert_eq!(clues[0], Clue::Exact); // 'A' in pos 0
        assert_eq!(clues[1], Clue::Misplaced); // 'F' in secret
        assert_eq!(clues[2], Clue::Miss); // 'B' not in secret
        assert_eq!(clues[3], Clue::Misplaced); // '0' in secret
    }

    #[test]
    fn test_successful_unlock() {
        let mut state = GameState::default();
        state.current_guess = state.secret;
        let input = GameInput {
            left: false,
            right: false,
            next_sym: false,
            prev_sym: false,
            submit: true,
        };
        tick(&mut state, &input);
        assert!(state.is_unlocked);
    }
}
