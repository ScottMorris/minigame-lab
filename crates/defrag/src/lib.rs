// Defrag the Mainframe - Deterministic disk defragmenter puzzle simulation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]
#![forbid(unsafe_code)]

pub const GRID_COLS: usize = 16;
pub const GRID_ROWS: usize = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ClusterType {
    Empty,
    System,
    Cyan,
    Yellow,
    Red,
    Green,
    Bad,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub up: bool,
    pub down: bool,
    pub left: bool,
    pub right: bool,
    pub swap: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub grid: [[ClusterType; GRID_COLS]; GRID_ROWS],
    pub cursor_x: usize,
    pub cursor_y: usize,
    pub buffer: Option<ClusterType>,
    pub worm_x: usize,
    pub worm_y: usize,
    pub worm_timer: u32,
    pub optimized_sectors: u32,
    pub total_optimizable: u32,
    pub score: u32,
    pub time_remaining: u32,
    pub is_game_over: bool,
}

impl Default for GameState {
    #[allow(clippy::needless_range_loop)]
    fn default() -> Self {
        let mut grid = [[ClusterType::Empty; GRID_COLS]; GRID_ROWS];

        // Seed initial clusters deterministically
        let mut optimizable = 0;
        for r in 0..GRID_ROWS {
            for c in 0..GRID_COLS {
                if (r == 0 && c < 4) || (r == 7 && c > 12) {
                    grid[r][c] = ClusterType::System;
                } else if (r + c) % 5 == 0 {
                    grid[r][c] = ClusterType::Cyan;
                    optimizable += 1;
                } else if (r + c) % 5 == 1 {
                    grid[r][c] = ClusterType::Yellow;
                    optimizable += 1;
                } else if (r + c) % 5 == 2 {
                    grid[r][c] = ClusterType::Red;
                    optimizable += 1;
                } else if (r + c) % 5 == 3 {
                    grid[r][c] = ClusterType::Green;
                    optimizable += 1;
                } else {
                    grid[r][c] = ClusterType::Empty;
                }
            }
        }

        Self {
            grid,
            cursor_x: 0,
            cursor_y: 1,
            buffer: None,
            worm_x: 15,
            worm_y: 7,
            worm_timer: 90,
            optimized_sectors: 0,
            total_optimizable: optimizable,
            score: 0,
            time_remaining: 75 * 60,
            is_game_over: false,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if state.is_game_over {
        return;
    }

    // Step game timer
    if state.time_remaining > 0 {
        state.time_remaining -= 1;
    } else {
        state.is_game_over = true;
        return;
    }

    // Move cursor
    if input.up && state.cursor_y > 0 {
        state.cursor_y -= 1;
    }
    if input.down && state.cursor_y + 1 < GRID_ROWS {
        state.cursor_y += 1;
    }
    if input.left && state.cursor_x > 0 {
        state.cursor_x -= 1;
    }
    if input.right && state.cursor_x + 1 < GRID_COLS {
        state.cursor_x += 1;
    }

    // Swap cluster into buffer
    if input.swap {
        let current = state.grid[state.cursor_y][state.cursor_x];
        if current != ClusterType::System {
            match state.buffer {
                Some(buf) => {
                    state.grid[state.cursor_y][state.cursor_x] = buf;
                    state.buffer = if current == ClusterType::Empty {
                        None
                    } else {
                        Some(current)
                    };
                }
                None => {
                    if current != ClusterType::Empty {
                        state.buffer = Some(current);
                        state.grid[state.cursor_y][state.cursor_x] = ClusterType::Empty;
                    }
                }
            }
        }
    }

    // Check for contiguous runs of 4+ matching coloured blocks horizontally
    for r in 0..GRID_ROWS {
        let mut run_start = 0;
        let mut run_len = 1;
        for c in 1..GRID_COLS {
            let curr = state.grid[r][c];
            let prev = state.grid[r][c - 1];
            if is_coloured(curr) && curr == prev {
                run_len += 1;
            } else {
                if run_len >= 4 {
                    clear_run(state, r, run_start, run_len);
                }
                run_start = c;
                run_len = 1;
            }
        }
        if run_len >= 4 {
            clear_run(state, r, run_start, run_len);
        }
    }

    // Check for contiguous runs of 4+ matching coloured blocks vertically
    for c in 0..GRID_COLS {
        let mut run_start = 0;
        let mut run_len = 1;
        for r in 1..GRID_ROWS {
            let curr = state.grid[r][c];
            let prev = state.grid[r - 1][c];
            if is_coloured(curr) && curr == prev {
                run_len += 1;
            } else {
                if run_len >= 4 {
                    clear_col_run(state, c, run_start, run_len);
                }
                run_start = r;
                run_len = 1;
            }
        }
        if run_len >= 4 {
            clear_col_run(state, c, run_start, run_len);
        }
    }

    // Worm step logic
    if state.worm_timer > 0 {
        state.worm_timer -= 1;
    } else {
        state.worm_timer = 90;
        // Step worm along perimeter or towards coloured cluster
        state.worm_x = (state.worm_x + 1) % GRID_COLS;
        if state.worm_x == 0 {
            state.worm_y = (state.worm_y + 1) % GRID_ROWS;
        }
        if state.grid[state.worm_y][state.worm_x] == ClusterType::Empty {
            state.grid[state.worm_y][state.worm_x] = ClusterType::Bad;
        }
    }
}

fn is_coloured(c: ClusterType) -> bool {
    matches!(
        c,
        ClusterType::Cyan | ClusterType::Yellow | ClusterType::Red | ClusterType::Green
    )
}

fn clear_run(state: &mut GameState, row: usize, start: usize, len: usize) {
    for c in start..(start + len) {
        state.grid[row][c] = ClusterType::Empty;
        state.optimized_sectors += 1;
        state.score += 50;
    }
    // Push worm back on successful defrag
    if state.worm_x > 0 {
        state.worm_x = state.worm_x.saturating_sub(2);
    }
}

fn clear_col_run(state: &mut GameState, col: usize, start: usize, len: usize) {
    for r in start..(start + len) {
        state.grid[r][col] = ClusterType::Empty;
        state.optimized_sectors += 1;
        state.score += 60;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_grid() {
        let state = GameState::default();
        assert_eq!(state.grid[0][0], ClusterType::System);
        assert_eq!(state.cursor_x, 0);
        assert_eq!(state.cursor_y, 1);
        assert!(!state.is_game_over);
    }

    #[test]
    fn test_cursor_movement() {
        let mut state = GameState::default();
        let input = GameInput {
            up: false,
            down: true,
            left: false,
            right: true,
            swap: false,
        };
        tick(&mut state, &input);
        assert_eq!(state.cursor_x, 1);
        assert_eq!(state.cursor_y, 2);
    }

    #[test]
    fn test_cluster_swap() {
        let mut state = GameState::default();
        state.grid[1][0] = ClusterType::Cyan;
        state.cursor_x = 0;
        state.cursor_y = 1;
        let input = GameInput {
            up: false,
            down: false,
            left: false,
            right: false,
            swap: true,
        };
        tick(&mut state, &input);
        assert_eq!(state.buffer, Some(ClusterType::Cyan));
        assert_eq!(state.grid[1][0], ClusterType::Empty);
    }
}
