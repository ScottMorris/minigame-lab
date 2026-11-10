// Pixel Patch: Corruption Control - Deterministic mosaic restoration simulation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]
#![forbid(unsafe_code)]

pub const GRID_SIZE: usize = 8;
pub const TOTAL_CELLS: usize = GRID_SIZE * GRID_SIZE;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CellState {
    Clean(u8), // Target colour index
    Corrupted,
    Source,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub up: bool,
    pub down: bool,
    pub left: bool,
    pub right: bool,
    pub patch: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub grid: [[CellState; GRID_SIZE]; GRID_SIZE],
    pub cursor_x: usize,
    pub cursor_y: usize,
    pub spread_timer: u32,
    pub time_remaining: u32,
    pub score: u32,
    pub restored_count: u32,
    pub combo: u32,
    pub is_game_over: bool,
    pub is_win: bool,
}

impl Default for GameState {
    #[allow(clippy::needless_range_loop)]
    fn default() -> Self {
        let mut grid = [[CellState::Clean(1); GRID_SIZE]; GRID_SIZE];

        // Seed an authentic 8x8 pixel-art badge scene
        for r in 0..GRID_SIZE {
            for c in 0..GRID_SIZE {
                let col = ((r * 3 + c * 2) % 6 + 1) as u8;
                grid[r][c] = CellState::Clean(col);
            }
        }

        // Seed 3 initial corruption clusters with source roots
        grid[2][2] = CellState::Source;
        grid[2][3] = CellState::Corrupted;
        grid[3][2] = CellState::Corrupted;

        grid[5][5] = CellState::Source;
        grid[5][6] = CellState::Corrupted;
        grid[6][5] = CellState::Corrupted;

        grid[1][6] = CellState::Source;
        grid[1][5] = CellState::Corrupted;

        Self {
            grid,
            cursor_x: 3,
            cursor_y: 3,
            spread_timer: 90,
            time_remaining: 60 * 60,
            score: 0,
            restored_count: 56, // 64 total - 8 corrupted
            combo: 1,
            is_game_over: false,
            is_win: false,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if state.is_game_over || state.is_win {
        return;
    }

    // Step countdown timer
    if state.time_remaining > 0 {
        state.time_remaining -= 1;
    } else {
        state.is_game_over = true;
        return;
    }

    // Cursor navigation
    if input.up && state.cursor_y > 0 {
        state.cursor_y -= 1;
    }
    if input.down && state.cursor_y + 1 < GRID_SIZE {
        state.cursor_y += 1;
    }
    if input.left && state.cursor_x > 0 {
        state.cursor_x -= 1;
    }
    if input.right && state.cursor_x + 1 < GRID_SIZE {
        state.cursor_x += 1;
    }

    // Apply patch
    if input.patch {
        let cell = state.grid[state.cursor_y][state.cursor_x];
        match cell {
            CellState::Source => {
                let orig_col = ((state.cursor_y * 3 + state.cursor_x * 2) % 6 + 1) as u8;
                state.grid[state.cursor_y][state.cursor_x] = CellState::Clean(orig_col);
                state.score += 250 * state.combo;
                state.combo += 1;
                state.restored_count += 1;
            }
            CellState::Corrupted => {
                let orig_col = ((state.cursor_y * 3 + state.cursor_x * 2) % 6 + 1) as u8;
                state.grid[state.cursor_y][state.cursor_x] = CellState::Clean(orig_col);
                state.score += 100 * state.combo;
                state.combo += 1;
                state.restored_count += 1;
            }
            CellState::Clean(_) => {
                // Reset combo on mispatch
                state.combo = 1;
            }
        }

        // Win check (if 90%+ clean or all corrupted cleared)
        let mut corrupted_remaining = 0;
        for r in 0..GRID_SIZE {
            for c in 0..GRID_SIZE {
                if matches!(state.grid[r][c], CellState::Corrupted | CellState::Source) {
                    corrupted_remaining += 1;
                }
            }
        }
        if corrupted_remaining == 0 || state.restored_count >= 58 {
            state.is_win = true;
            return;
        }
    }

    // Spread timer step
    if state.spread_timer > 0 {
        state.spread_timer -= 1;
    } else {
        state.spread_timer = 90;
        spread_corruption(state);
    }
}

#[allow(clippy::collapsible_if)]
fn spread_corruption(state: &mut GameState) {
    let mut spread_target: Option<(usize, usize)> = None;

    'outer: for r in 0..GRID_SIZE {
        for c in 0..GRID_SIZE {
            if matches!(state.grid[r][c], CellState::Source) {
                // Check 4 neighbours
                let neighbors = [
                    (r.wrapping_sub(1), c),
                    (r + 1, c),
                    (r, c.wrapping_sub(1)),
                    (r, c + 1),
                ];
                for (nr, nc) in neighbors {
                    if nr < GRID_SIZE && nc < GRID_SIZE {
                        if let CellState::Clean(_) = state.grid[nr][nc] {
                            spread_target = Some((nr, nc));
                            break 'outer;
                        }
                    }
                }
            }
        }
    }

    if let Some((tr, tc)) = spread_target {
        state.grid[tr][tc] = CellState::Corrupted;
        state.restored_count = state.restored_count.saturating_sub(1);
    }

    // Check if bottom row is fully corrupted
    let mut bottom_corrupted = true;
    for c in 0..GRID_SIZE {
        if let CellState::Clean(_) = state.grid[GRID_SIZE - 1][c] {
            bottom_corrupted = false;
            break;
        }
    }
    if bottom_corrupted {
        state.is_game_over = true;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let state = GameState::default();
        assert!(!state.is_game_over);
        assert!(!state.is_win);
        assert_eq!(state.grid[2][2], CellState::Source);
    }

    #[test]
    fn test_patch_source() {
        let mut state = GameState {
            cursor_x: 2,
            cursor_y: 2,
            ..Default::default()
        };
        let input = GameInput {
            up: false,
            down: false,
            left: false,
            right: false,
            patch: true,
        };
        tick(&mut state, &input);
        assert!(matches!(state.grid[2][2], CellState::Clean(_)));
        assert_eq!(state.score, 250);
        assert_eq!(state.combo, 2);
    }
}
