// Fizz-Pong: Carbonation War - Deterministic paddle simulation in a pressurized soda tank
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT
#![no_std]
#![forbid(unsafe_code)]

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MatchState {
    Serving,
    InPlay,
    PointScored,
    GameOver,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameInput {
    pub left: bool,
    pub right: bool,
    pub serve: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Paddle {
    pub x: f64,
    pub width: f64,
    pub speed: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Ball {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub radius: f64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct GameState {
    pub width: f64,
    pub height: f64,
    pub player: Paddle,
    pub cpu: Paddle,
    pub ball: Ball,
    pub multiball: Option<Ball>,
    pub player_score: u32,
    pub cpu_score: u32,
    pub rally_count: u32,
    pub match_state: MatchState,
    pub point_timer: u32,
    pub current_bubble_active: bool,
}

impl Default for GameState {
    fn default() -> Self {
        let width = 320.0;
        let height = 480.0;
        let paddle_width = 54.0;
        Self {
            width,
            height,
            player: Paddle {
                x: (width - paddle_width) / 2.0,
                width: paddle_width,
                speed: 4.5,
            },
            cpu: Paddle {
                x: (width - paddle_width) / 2.0,
                width: paddle_width,
                speed: 3.5,
            },
            ball: Ball {
                x: width / 2.0,
                y: height - 40.0,
                vx: 1.2,
                vy: -4.0,
                radius: 4.0,
            },
            multiball: None,
            player_score: 0,
            cpu_score: 0,
            rally_count: 0,
            match_state: MatchState::Serving,
            point_timer: 0,
            current_bubble_active: false,
        }
    }
}

pub fn tick(state: &mut GameState, input: &GameInput) {
    match state.match_state {
        MatchState::Serving => {
            // Keep ball pinned to player paddle until served
            state.ball.x = state.player.x + (state.player.width / 2.0);
            state.ball.y = state.height - 35.0;

            if input.left {
                state.player.x = (state.player.x - state.player.speed).max(0.0);
            }
            if input.right {
                state.player.x =
                    (state.player.x + state.player.speed).min(state.width - state.player.width);
            }

            if input.serve {
                state.match_state = MatchState::InPlay;
                state.ball.vy = -4.2;
                state.ball.vx = if input.left {
                    -2.0
                } else if input.right {
                    2.0
                } else {
                    1.2
                };
            }
        }
        MatchState::PointScored => {
            if state.point_timer > 0 {
                state.point_timer -= 1;
            } else if state.player_score >= 7 || state.cpu_score >= 7 {
                state.match_state = MatchState::GameOver;
            } else {
                state.match_state = MatchState::Serving;
                state.rally_count = 0;
                state.multiball = None;
                state.current_bubble_active = false;
            }
        }
        MatchState::GameOver => {
            if input.serve {
                // Restart match
                state.player_score = 0;
                state.cpu_score = 0;
                state.rally_count = 0;
                state.multiball = None;
                state.match_state = MatchState::Serving;
            }
        }
        MatchState::InPlay => {
            // Player movement
            if input.left {
                state.player.x = (state.player.x - state.player.speed).max(0.0);
            }
            if input.right {
                state.player.x =
                    (state.player.x + state.player.speed).min(state.width - state.player.width);
            }

            // CPU drone tracking with slight inertia
            let cpu_centre = state.cpu.x + (state.cpu.width / 2.0);
            let target_x = state.ball.x;
            if target_x < cpu_centre - 4.0 {
                state.cpu.x = (state.cpu.x - state.cpu.speed).max(0.0);
            } else if target_x > cpu_centre + 4.0 {
                state.cpu.x = (state.cpu.x + state.cpu.speed).min(state.width - state.cpu.width);
            }

            // Carbonation current gently nudges ball based on vertical height
            let carbonation_drift = if state.ball.y > 100.0 && state.ball.y < 380.0 {
                0.08
            } else {
                -0.05
            };

            // Step main ball
            step_ball(
                &mut state.ball,
                carbonation_drift,
                &state.player,
                &state.cpu,
                state.width,
                state.height,
                &mut state.rally_count,
            );

            // Check main ball goals
            if state.ball.y < 0.0 {
                state.player_score += 1;
                state.match_state = MatchState::PointScored;
                state.point_timer = 60;
            } else if state.ball.y > state.height {
                state.cpu_score += 1;
                state.match_state = MatchState::PointScored;
                state.point_timer = 60;
            }

            // Step multiball if active
            if let Some(ref mut mb) = state.multiball {
                let mut dummy_rally = 0;
                step_ball(
                    mb,
                    -carbonation_drift,
                    &state.player,
                    &state.cpu,
                    state.width,
                    state.height,
                    &mut dummy_rally,
                );
            }
        }
    }
}

fn step_ball(
    ball: &mut Ball,
    drift: f64,
    player: &Paddle,
    cpu: &Paddle,
    width: f64,
    height: f64,
    rally_count: &mut u32,
) {
    ball.x += ball.vx + drift;
    ball.y += ball.vy;

    // Wall bounces
    if ball.x - ball.radius <= 0.0 {
        ball.x = ball.radius;
        ball.vx = ball.vx.abs();
    } else if ball.x + ball.radius >= width {
        ball.x = width - ball.radius;
        ball.vx = -ball.vx.abs();
    }

    // Player paddle collision at bottom (y = height - 26.0)
    let player_top = height - 28.0;
    let player_bot = height - 18.0;
    if ball.vy > 0.0
        && ball.y + ball.radius >= player_top
        && ball.y - ball.radius <= player_bot
        && ball.x >= player.x - 2.0
        && ball.x <= player.x + player.width + 2.0
    {
        ball.y = player_top - ball.radius;
        // Spin calculation based on offset from paddle centre
        let hit_offset = (ball.x - (player.x + (player.width / 2.0))) / (player.width / 2.0);
        ball.vx = hit_offset * 3.5;
        ball.vy = -4.2;
        *rally_count += 1;
    }

    // CPU paddle collision at top (y = 18.0..28.0)
    let cpu_top = 18.0;
    let cpu_bot = 28.0;
    if ball.vy < 0.0
        && ball.y - ball.radius <= cpu_bot
        && ball.y + ball.radius >= cpu_top
        && ball.x >= cpu.x - 2.0
        && ball.x <= cpu.x + cpu.width + 2.0
    {
        ball.y = cpu_bot + ball.radius;
        let hit_offset = (ball.x - (cpu.x + (cpu.width / 2.0))) / (cpu.width / 2.0);
        ball.vx = hit_offset * 3.2;
        ball.vy = 4.2;
        *rally_count += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let state = GameState::default();
        assert_eq!(state.match_state, MatchState::Serving);
        assert_eq!(state.player_score, 0);
        assert_eq!(state.cpu_score, 0);
    }

    #[test]
    fn test_serve() {
        let mut state = GameState::default();
        let input = GameInput {
            left: false,
            right: false,
            serve: true,
        };
        tick(&mut state, &input);
        assert_eq!(state.match_state, MatchState::InPlay);
        assert!(state.ball.vy < 0.0);
    }

    #[test]
    fn test_paddle_bounds() {
        let mut state = GameState {
            match_state: MatchState::InPlay,
            ..Default::default()
        };
        let input = GameInput {
            left: true,
            right: false,
            serve: false,
        };
        for _ in 0..100 {
            tick(&mut state, &input);
        }
        assert_eq!(state.player.x, 0.0);
    }
}
