// Soda Snake: The Last Straw - Deterministic grid-chase survival simulation
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]
#![forbid(unsafe_code)]

pub const GRID_WIDTH: i32 = 20;
pub const GRID_HEIGHT: i32 = 14;
pub const MAX_SNAKE_LEN: usize = 128;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    Up,
    Down,
    Left,
    Right,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VentDirection {
    North,
    South,
    East,
    West,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CarbonationVent {
    pub pos: Point,
    pub dir: VentDirection,
    pub active: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub dir: Option<Direction>,
    pub brake: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub body: [Point; MAX_SNAKE_LEN],
    pub len: usize,
    pub dir: Direction,
    pub next_dir: Direction,
    pub pellet: Point,
    pub vent: CarbonationVent,
    pub score: u32,
    pub brakes_remaining: u32,
    pub is_dead: bool,
    pub step_counter: u32,
    pub step_interval: u32,
}

impl Default for GameState {
    fn default() -> Self {
        let mut body = [Point { x: 0, y: 0 }; MAX_SNAKE_LEN];
        body[0] = Point { x: 8, y: 7 };
        body[1] = Point { x: 7, y: 7 };
        body[2] = Point { x: 6, y: 7 };

        Self {
            body,
            len: 3,
            dir: Direction::Right,
            next_dir: Direction::Right,
            pellet: Point { x: 14, y: 7 },
            vent: CarbonationVent {
                pos: Point { x: 10, y: 3 },
                dir: VentDirection::South,
                active: false,
            },
            score: 0,
            brakes_remaining: 3,
            is_dead: false,
            step_counter: 0,
            step_interval: 10,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    if state.is_dead {
        return;
    }

    // Buffer directional steering (prevent immediate reverse)
    if let Some(new_dir) = input.dir {
        let is_reverse = matches!(
            (state.dir, new_dir),
            (Direction::Up, Direction::Down)
                | (Direction::Down, Direction::Up)
                | (Direction::Left, Direction::Right)
                | (Direction::Right, Direction::Left)
        );
        if !is_reverse {
            state.next_dir = new_dir;
        }
    }

    // Step counter for deterministic movement ticks
    state.step_counter += 1;
    if state.step_counter < state.step_interval {
        return;
    }
    state.step_counter = 0;

    // Check pressure brake
    if input.brake && state.brakes_remaining > 0 {
        state.brakes_remaining -= 1;
        return;
    }

    state.dir = state.next_dir;

    // Calculate new head position
    let mut head = state.body[0];
    match state.dir {
        Direction::Up => head.y -= 1,
        Direction::Down => head.y += 1,
        Direction::Left => head.x -= 1,
        Direction::Right => head.x += 1,
    }

    // Check carbonation vent displacement
    if state.vent.active && head == state.vent.pos {
        match state.vent.dir {
            VentDirection::North => head.y -= 1,
            VentDirection::South => head.y += 1,
            VentDirection::East => head.x += 1,
            VentDirection::West => head.x -= 1,
        }
    }

    // Perimeter wall collision
    if head.x < 0 || head.x >= GRID_WIDTH || head.y < 0 || head.y >= GRID_HEIGHT {
        state.is_dead = true;
        return;
    }

    // Tail self-collision
    for i in 0..state.len {
        if state.body[i] == head {
            state.is_dead = true;
            return;
        }
    }

    // Check pellet collection
    let ate_pellet = head == state.pellet;

    // Shift body segments
    for i in (1..=state.len).rev() {
        if i < MAX_SNAKE_LEN {
            state.body[i] = state.body[i - 1];
        }
    }
    state.body[0] = head;

    if ate_pellet {
        if state.len + 1 < MAX_SNAKE_LEN {
            state.len += 1;
        }
        state.score += 100;

        // Accelerate slightly
        if state.len.is_multiple_of(4) && state.step_interval > 5 {
            state.step_interval -= 1;
        }

        // Spawn next pellet pseudo-randomly
        let next_x = (head.x * 7 + 11) % GRID_WIDTH;
        let next_y = (head.y * 5 + 7) % GRID_HEIGHT;
        state.pellet = Point {
            x: next_x,
            y: next_y,
        };

        // Activate/redirect carbonation vent periodically
        if state.score.is_multiple_of(300) {
            state.vent.active = !state.vent.active;
            state.vent.pos = Point {
                x: (next_x + 3) % GRID_WIDTH,
                y: (next_y + 2) % GRID_HEIGHT,
            };
            state.brakes_remaining = (state.brakes_remaining + 1).min(5);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let state = GameState::default();
        assert_eq!(state.len, 3);
        assert!(!state.is_dead);
        assert_eq!(state.dir, Direction::Right);
    }

    #[test]
    fn test_forward_step() {
        let mut state = GameState::default();
        state.step_counter = state.step_interval - 1;
        let input = GameInput {
            dir: None,
            brake: false,
        };
        tick(&mut state, &input);
        assert_eq!(state.body[0], Point { x: 9, y: 7 });
        assert_eq!(state.body[1], Point { x: 8, y: 7 });
    }

    #[test]
    fn test_wall_crash() {
        let mut state = GameState::default();
        state.body[0] = Point {
            x: GRID_WIDTH - 1,
            y: 7,
        };
        state.step_counter = state.step_interval - 1;
        let input = GameInput {
            dir: Some(Direction::Right),
            brake: false,
        };
        tick(&mut state, &input);
        assert!(state.is_dead);
    }
}
