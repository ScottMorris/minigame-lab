// Gumdrop Pac-Man — Retro Maze Chaser in Mildred's Citadel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { note, sound, stack, type Pattern, type ControlPatch } from '@liminal-hq/undertone';

function playSafe(pattern: Pattern<ControlPatch>) {
  try {
    pattern.play();
  } catch {
    // Autoplay restrictions or headless environment
  }
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// EGA 16-Colour Palette
const EGA = {
  black: '#000000',
  blue: '#0000aa',
  green: '#00aa00',
  cyan: '#00aaaa',
  red: '#aa0000',
  magenta: '#aa00aa',
  brown: '#aa5500',
  lightGrey: '#aaaaaa',
  darkGrey: '#555555',
  lightBlue: '#5555ff',
  lightGreen: '#55ff55',
  lightCyan: '#55ffff',
  lightRed: '#ff5555',
  lightMagenta: '#ff55ff',
  yellow: '#ffff55',
  white: '#ffffff',
};

// Procedural Retro Audio Synthesizer via @liminal-hq/undertone
class SoundFx {
  private chompPhase = 0;

  playChomp() {
    const pitch = this.chompPhase === 0 ? 'd4' : 'f#4';
    this.chompPhase = (this.chompPhase + 1) % 2;
    playSafe(note(pitch).sound('triangle').attack(0.005).decay(0.06).gain(0.18).slide(0.04));
  }

  playPower() {
    playSafe(
      stack(
        note('c4 e4 g4 c5').sound('sawtooth').fast(4).decay(0.12).gain(0.22).lpf(1200),
        sound('white').attack(0.001).decay(0.08).gain(0.1).lpf(3000),
      ),
    );
  }

  playEatGhost() {
    playSafe(note('g4 c5 e5 g5').sound('square').fast(4).decay(0.08).gain(0.22).slide(0.05));
  }

  playDie() {
    playSafe(
      note('c4 b3 bb3 a3 ab3 g3 gb3 f3')
        .sound('sawtooth')
        .fast(8)
        .decay(0.08)
        .gain(0.25)
        .slide(0.08),
    );
  }

  playFruit() {
    playSafe(note('e5 a5').sound('sine').attack(0.002).decay(0.12).gain(0.22));
  }

  playStart() {
    playSafe(note('c5 e5 g5 c6').sound('square').fast(4).attack(0.01).decay(0.12).gain(0.2));
  }
}

const sfx = new SoundFx();

const TILE_SIZE = 20;
const COLS = 28;
const MAZE_OFFSET_Y = 40;

// Tile types:
// 0 = corridor (empty)
// 1 = solid Citadel wall
// 2 = gumdrop (+10 pts)
// 3 = cream soda power can (+50 pts)
// 4 = ghost pen door / gate
// 5 = ghost pen interior
// 6 = cheezie snack (+20 pts)
const MAZE_TEMPLATE: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1],
  [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  [1, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 1],
  [1, 2, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1, 1, 1, 4, 4, 1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1, 5, 5, 5, 5, 5, 5, 1, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 2, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 2, 1, 1, 1, 1, 1, 1],
  [1, 6, 2, 6, 2, 6, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 6, 2, 6, 2, 6, 1],
  [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  [1, 3, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 1],
  [1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [1, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 2, 2, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 2, 6, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

interface Ghost {
  name: string;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  normalColour: string;
  frightened: boolean;
  state: 'in_house' | 'leaving_house' | 'in_maze' | 'eaten' | 'entering_house';
  leaveTimer: number;
  speed: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  colour: string;
  life: number;
}

export type GameMode = 'start' | 'ready' | 'playing' | 'dying' | 'wave_clear' | 'gameover';

class GumdropPacmanGame {
  private grid: number[][] = [];
  public score = 0;
  public highScore = 0;
  public lives = 3;
  public wave = 1;
  public gameOver = false;
  public paused = false;

  public mode: GameMode = 'start';
  public readyTimer = 0;
  public dyingTimer = 0;
  public dyingAngle = 0;
  public waveClearTimer = 0;

  // Ben / Player (tuned to authentic deliberate arcade speed)
  private playerX = 13.5 * TILE_SIZE; // 270 (centre of Tile 13)
  private playerY = 17 * TILE_SIZE + TILE_SIZE / 2; // 350 (centre of Row 17)
  private playerDirX = -1;
  private playerDirY = 0;
  private nextDirX = 0;
  private nextDirY = 0;
  private playerSpeed = 1.25; // 1.25 px/frame = 75 px/sec = 3.75 tiles/sec
  private mouthAngle = 0.2;
  private mouthDir = 1;

  // Ghosts (proportional arcade pacing)
  private ghosts: Ghost[] = [];
  private powerTimer = 0;
  private ghostsEatenStreak = 0;

  // Chocolate Bar Bonus Item (Spawns at Citadel centre)
  private bonusItem: {
    x: number;
    y: number;
    active: boolean;
    type: string;
    points: number;
    timer: number;
  } = {
    x: 13.5 * TILE_SIZE,
    y: 13 * TILE_SIZE + TILE_SIZE / 2,
    active: false,
    type: 'chocolate',
    points: 200,
    timer: 0,
  };

  private floatingTexts: FloatingText[] = [];
  private remainingSnacks = 0;

  constructor() {
    this.highScore = Number(localStorage.getItem('minigame_gumdrop_pacman_hi') || '0');
    this.resetMaze();
    this.resetActors();
  }

  private resetMaze() {
    this.grid = [];
    this.remainingSnacks = 0;
    for (let r = 0; r < MAZE_TEMPLATE.length; r++) {
      const row: number[] = [];
      for (let c = 0; c < COLS; c++) {
        const val = MAZE_TEMPLATE[r][c];
        row.push(val);
        if (val === 2 || val === 3 || val === 6) {
          this.remainingSnacks++;
        }
      }
      this.grid.push(row);
    }
  }

  private resetActors() {
    this.playerX = 13.5 * TILE_SIZE; // 270
    this.playerY = 17 * TILE_SIZE + TILE_SIZE / 2; // 350
    this.playerDirX = -1;
    this.playerDirY = 0;
    this.nextDirX = 0;
    this.nextDirY = 0;

    this.ghosts = [
      {
        name: 'Blinky',
        x: 13.5 * TILE_SIZE,
        y: 8.5 * TILE_SIZE,
        dirX: -1,
        dirY: 0,
        normalColour: EGA.lightRed,
        frightened: false,
        state: 'in_maze',
        leaveTimer: 0,
        speed: 1.15,
      },
      {
        name: 'Pinky',
        x: 13.5 * TILE_SIZE,
        y: 10.5 * TILE_SIZE,
        dirX: 0,
        dirY: -1,
        normalColour: EGA.lightMagenta,
        frightened: false,
        state: 'in_house',
        leaveTimer: 80, // ~1.3s
        speed: 1.1,
      },
      {
        name: 'Inky',
        x: 12.0 * TILE_SIZE,
        y: 10.5 * TILE_SIZE,
        dirX: 0,
        dirY: 1,
        normalColour: EGA.lightCyan,
        frightened: false,
        state: 'in_house',
        leaveTimer: 200, // ~3.3s
        speed: 1.05,
      },
      {
        name: 'Clyde',
        x: 15.0 * TILE_SIZE,
        y: 10.5 * TILE_SIZE,
        dirX: 0,
        dirY: -1,
        normalColour: EGA.yellow,
        frightened: false,
        state: 'in_house',
        leaveTimer: 340, // ~5.6s
        speed: 1.0,
      },
    ];

    this.powerTimer = 0;
  }

  public start() {
    if (this.mode === 'start') {
      this.mode = 'ready';
      this.readyTimer = 110;
      this.resetActors();
      sfx.playStart();
    }
  }

  public resetGame() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameOver = false;
    this.resetMaze();
    this.resetActors();
    this.mode = 'ready';
    this.readyTimer = 110;
    sfx.playStart();
  }

  public setDesiredDirection(dx: number, dy: number) {
    this.nextDirX = dx;
    this.nextDirY = dy;
  }

  private isPassable(tileX: number, tileY: number, canPassDoor = false): boolean {
    if (tileY < 0 || tileY >= this.grid.length) return false;
    // Wrapping tunnel rows on sides
    if (tileX < 0 || tileX >= COLS) return true;

    const tile = this.grid[tileY][tileX];
    if (tile === 1) return false; // Solid Wall
    if (tile === 4) return canPassDoor; // Door
    if (tile === 5) return canPassDoor; // Ghost house interior
    return true;
  }

  public update() {
    if (this.paused) return;

    if (this.mode === 'start') {
      return; // Waiting for player to press start
    }

    if (this.mode === 'ready') {
      this.readyTimer--;
      if (this.readyTimer <= 0) {
        this.mode = 'playing';
      }
      return;
    }

    if (this.mode === 'wave_clear') {
      this.waveClearTimer--;
      if (this.waveClearTimer <= 0) {
        this.wave++;
        this.resetMaze();
        this.resetActors();
        this.mode = 'ready';
        this.readyTimer = 110;
        sfx.playStart();
      }
      return;
    }

    if (this.mode === 'dying') {
      this.dyingTimer--;
      this.dyingAngle += 0.22;
      if (this.dyingTimer <= 0) {
        this.lives--;
        if (this.lives <= 0) {
          this.mode = 'gameover';
          this.gameOver = true;
        } else {
          this.resetActors();
          this.mode = 'ready';
          this.readyTimer = 110;
        }
      }
      return;
    }

    if (this.mode === 'gameover') {
      return;
    }

    // --- Active Playing Mode ---

    // Power mode timer countdown
    if (this.powerTimer > 0) {
      this.powerTimer--;
      if (this.powerTimer <= 0) {
        for (const g of this.ghosts) {
          g.frightened = false;
        }
      }
    }

    // Chocolate Bar Bonus Item Timer
    if (this.bonusItem.active) {
      this.bonusItem.timer--;
      if (this.bonusItem.timer <= 0) {
        this.bonusItem.active = false;
      }
    } else if (Math.random() < 0.002 && this.remainingSnacks < 130) {
      this.bonusItem.active = true;
      this.bonusItem.timer = 420;
      this.bonusItem.points = 200;
    }

    // Mouth animation while moving
    if (this.playerDirX !== 0 || this.playerDirY !== 0) {
      this.mouthAngle += 0.05 * this.mouthDir;
      if (this.mouthAngle > 0.42) this.mouthDir = -1;
      if (this.mouthAngle < 0.05) this.mouthDir = 1;
    }

    // Player Turning & Movement
    this.updatePlayerMovement();

    // Check Collectibles at current position
    const curTileX = Math.floor(this.playerX / TILE_SIZE);
    const curTileY = Math.floor(this.playerY / TILE_SIZE);

    if (curTileY >= 0 && curTileY < this.grid.length && curTileX >= 0 && curTileX < COLS) {
      const tile = this.grid[curTileY][curTileX];
      if (tile === 2) {
        // Gumdrop (+10 pts)
        this.grid[curTileY][curTileX] = 0;
        this.score += 10;
        this.remainingSnacks--;
        sfx.playChomp();
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('minigame_gumdrop_pacman_hi', String(this.highScore));
        }
      } else if (tile === 6) {
        // Cheezie (+20 pts)
        this.grid[curTileY][curTileX] = 0;
        this.score += 20;
        this.remainingSnacks--;
        sfx.playChomp();
        this.floatingTexts.push({
          x: curTileX * TILE_SIZE + 10,
          y: curTileY * TILE_SIZE + 10,
          text: '+20',
          colour: EGA.yellow,
          life: 25,
        });
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('minigame_gumdrop_pacman_hi', String(this.highScore));
        }
      } else if (tile === 3) {
        // Cream Soda Power Can (+50 pts)
        this.grid[curTileY][curTileX] = 0;
        this.score += 50;
        this.remainingSnacks--;
        this.powerTimer = 450; // ~7.5 seconds of fizzy power
        this.ghostsEatenStreak = 0;
        sfx.playPower();
        for (const g of this.ghosts) {
          if (g.state === 'in_maze') {
            g.frightened = true;
            g.dirX *= -1;
            g.dirY *= -1;
          }
        }
      }
    }

    // Check Chocolate Bar Collision
    if (this.bonusItem.active) {
      const dist = Math.hypot(this.playerX - this.bonusItem.x, this.playerY - this.bonusItem.y);
      if (dist < 14) {
        this.score += this.bonusItem.points;
        this.bonusItem.active = false;
        sfx.playFruit();
        this.floatingTexts.push({
          x: this.bonusItem.x,
          y: this.bonusItem.y,
          text: `+${this.bonusItem.points}`,
          colour: EGA.lightCyan,
          life: 35,
        });
      }
    }

    // Wave Clear condition
    if (this.remainingSnacks <= 0) {
      this.mode = 'wave_clear';
      this.waveClearTimer = 90;
      return;
    }

    // Update Ghosts & Check Collisions
    for (const g of this.ghosts) {
      this.updateGhost(g);

      if (g.state === 'in_maze') {
        const dist = Math.hypot(this.playerX - g.x, this.playerY - g.y);
        if (dist < 15) {
          if (g.frightened) {
            // Eat Zarg Phantom
            g.state = 'eaten';
            g.frightened = false;
            this.ghostsEatenStreak++;
            const pts = Math.pow(2, this.ghostsEatenStreak) * 100;
            this.score += pts;
            sfx.playEatGhost();
            this.floatingTexts.push({
              x: g.x,
              y: g.y,
              text: `+${pts}`,
              colour: EGA.lightCyan,
              life: 35,
            });
          } else {
            // Player Caught
            this.mode = 'dying';
            this.dyingTimer = 75;
            this.dyingAngle = 0;
            sfx.playDie();
            return;
          }
        }
      }
    }

    // Update Floating Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 0.8;
      ft.life--;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private updatePlayerMovement() {
    const tileX = Math.floor(this.playerX / TILE_SIZE);
    const tileY = Math.floor(this.playerY / TILE_SIZE);
    const centreX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const centreY = tileY * TILE_SIZE + TILE_SIZE / 2;

    // 1. Initial start from standstill if key pressed
    if (
      this.playerDirX === 0 &&
      this.playerDirY === 0 &&
      (this.nextDirX !== 0 || this.nextDirY !== 0)
    ) {
      if (this.isPassable(tileX + this.nextDirX, tileY + this.nextDirY)) {
        this.playerDirX = this.nextDirX;
        this.playerDirY = this.nextDirY;
        this.nextDirX = 0;
        this.nextDirY = 0;
      }
    }
    // 2. Immediate 180-degree turnaround anywhere in the corridor
    else if (
      this.nextDirX === -this.playerDirX &&
      this.nextDirY === -this.playerDirY &&
      (this.nextDirX !== 0 || this.nextDirY !== 0)
    ) {
      this.playerDirX = this.nextDirX;
      this.playerDirY = this.nextDirY;
      this.nextDirX = 0;
      this.nextDirY = 0;
    }
    // 3. Perpendicular turning near tile centre
    else if (this.playerDirY === 0 && this.nextDirY !== 0) {
      // Currently moving horizontally, wants to turn vertically
      if (
        Math.abs(this.playerX - centreX) <= this.playerSpeed &&
        this.isPassable(tileX, tileY + this.nextDirY)
      ) {
        this.playerX = centreX;
        this.playerDirX = 0;
        this.playerDirY = this.nextDirY;
        this.nextDirX = 0;
        this.nextDirY = 0;
      }
    } else if (this.playerDirX === 0 && this.nextDirX !== 0) {
      // Currently moving vertically, wants to turn horizontally
      if (
        Math.abs(this.playerY - centreY) <= this.playerSpeed &&
        this.isPassable(tileX + this.nextDirX, tileY)
      ) {
        this.playerY = centreY;
        this.playerDirX = this.nextDirX;
        this.playerDirY = 0;
        this.nextDirX = 0;
        this.nextDirY = 0;
      }
    }

    // 4. Advance in current direction (stopping cleanly at walls)
    if (this.playerDirX === -1) {
      if (!this.isPassable(tileX - 1, tileY)) {
        this.playerX = Math.max(centreX, this.playerX - this.playerSpeed);
      } else {
        this.playerX -= this.playerSpeed;
      }
    } else if (this.playerDirX === 1) {
      if (!this.isPassable(tileX + 1, tileY)) {
        this.playerX = Math.min(centreX, this.playerX + this.playerSpeed);
      } else {
        this.playerX += this.playerSpeed;
      }
    } else if (this.playerDirY === -1) {
      if (!this.isPassable(tileX, tileY - 1)) {
        this.playerY = Math.max(centreY, this.playerY - this.playerSpeed);
      } else {
        this.playerY -= this.playerSpeed;
      }
    } else if (this.playerDirY === 1) {
      if (!this.isPassable(tileX, tileY + 1)) {
        this.playerY = Math.min(centreY, this.playerY + this.playerSpeed);
      } else {
        this.playerY += this.playerSpeed;
      }
    }

    // 5. Side Wrap Tunnel
    if (this.playerX < -8) {
      this.playerX = canvas.width + 8;
    } else if (this.playerX > canvas.width + 8) {
      this.playerX = -8;
    }
  }

  private updateGhost(g: Ghost) {
    if (g.state === 'in_house') {
      g.leaveTimer--;
      if (g.leaveTimer <= 0) {
        g.state = 'leaving_house';
      } else {
        g.y += g.dirY * 0.5;
        if (g.y < 10 * TILE_SIZE + 4) g.dirY = 1;
        if (g.y > 11 * TILE_SIZE + 16) g.dirY = -1;
      }
      return;
    }

    if (g.state === 'leaving_house') {
      const exitDoorX = 13.5 * TILE_SIZE; // 270
      const exitTargetY = 8.5 * TILE_SIZE; // 170
      if (Math.abs(g.x - exitDoorX) > 1) {
        g.x += (exitDoorX > g.x ? 1 : -1) * 1.0;
      } else {
        g.x = exitDoorX;
        g.y -= 1.0;
        if (g.y <= exitTargetY) {
          g.y = exitTargetY;
          g.state = 'in_maze';
          g.dirX = Math.random() > 0.5 ? 1 : -1;
          g.dirY = 0;
        }
      }
      return;
    }

    if (g.state === 'eaten') {
      const doorX = 13.5 * TILE_SIZE;
      const doorY = 8.5 * TILE_SIZE;
      const dx = doorX - g.x;
      const dy = doorY - g.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= 3.0) {
        // Reached front door of starting box, enter the house
        g.x = doorX;
        g.y = doorY;
        g.state = 'entering_house';
      } else {
        // Flying eyeballs back to house
        g.x += (dx / dist) * 2.8;
        g.y += (dy / dist) * 2.8;
      }
      return;
    }

    if (g.state === 'entering_house') {
      const doorX = 13.5 * TILE_SIZE;
      const targetHouseY = 10.5 * TILE_SIZE;
      g.x = doorX;
      g.y += 1.5;
      if (g.y >= targetHouseY) {
        g.y = targetHouseY;
        g.frightened = false;
        g.state = 'leaving_house';
      }
      return;
    }

    // g.state === 'in_maze'
    const currentSpeed = g.frightened ? g.speed * 0.65 : g.speed;
    const tileX = Math.floor(g.x / TILE_SIZE);
    const tileY = Math.floor(g.y / TILE_SIZE);
    const centreX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const centreY = tileY * TILE_SIZE + TILE_SIZE / 2;

    let crossed = false;
    if (g.dirX === -1) {
      const nextX = g.x - currentSpeed;
      if (g.x >= centreX && nextX <= centreX) {
        g.x = centreX;
        crossed = true;
      } else {
        g.x = nextX;
      }
    } else if (g.dirX === 1) {
      const nextX = g.x + currentSpeed;
      if (g.x <= centreX && nextX >= centreX) {
        g.x = centreX;
        crossed = true;
      } else {
        g.x = nextX;
      }
    } else if (g.dirY === -1) {
      const nextY = g.y - currentSpeed;
      if (g.y >= centreY && nextY <= centreY) {
        g.y = centreY;
        crossed = true;
      } else {
        g.y = nextY;
      }
    } else if (g.dirY === 1) {
      const nextY = g.y + currentSpeed;
      if (g.y <= centreY && nextY >= centreY) {
        g.y = centreY;
        crossed = true;
      } else {
        g.y = nextY;
      }
    }

    if (crossed) {
      const curTileX = Math.floor(g.x / TILE_SIZE);
      const curTileY = Math.floor(g.y / TILE_SIZE);

      // Available directions (excluding 180 turnaround, walls, and ghost door)
      let candidates = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ].filter((d) => {
        if (d.dx === -g.dirX && d.dy === -g.dirY) return false;
        return this.isPassable(curTileX + d.dx, curTileY + d.dy, false);
      });

      // If dead end, 180 turnaround is permitted
      if (candidates.length === 0) {
        candidates = [{ dx: -g.dirX, dy: -g.dirY }];
      }

      if (g.frightened) {
        // Random choice when scared
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        g.dirX = chosen.dx;
        g.dirY = chosen.dy;
      } else {
        // Target tile calculation
        const playerTileX = Math.floor(this.playerX / TILE_SIZE);
        const playerTileY = Math.floor(this.playerY / TILE_SIZE);
        let targetX = playerTileX;
        let targetY = playerTileY;

        if (g.name === 'Pinky') {
          targetX = playerTileX + 4 * this.playerDirX;
          targetY = playerTileY + 4 * this.playerDirY;
        } else if (g.name === 'Inky') {
          targetX = playerTileX + 2 * this.playerDirX;
          targetY = playerTileY + 2 * this.playerDirY;
        } else if (g.name === 'Clyde') {
          const distToPlayer = Math.hypot(curTileX - playerTileX, curTileY - playerTileY);
          if (distToPlayer < 8) {
            targetX = 1;
            targetY = 22; // scatter corner
          }
        }

        // Pick direction minimizing distance to target
        let bestDir = candidates[0];
        let bestDist = Infinity;
        for (const d of candidates) {
          const dist = Math.hypot(curTileX + d.dx - targetX, curTileY + d.dy - targetY);
          if (dist < bestDist) {
            bestDist = dist;
            bestDir = d;
          }
        }
        g.dirX = bestDir.dx;
        g.dirY = bestDir.dy;
      }

      // Advance in chosen direction
      g.x += g.dirX * currentSpeed;
      g.y += g.dirY * currentSpeed;
    }

    // Side wrap tunnel for ghosts
    if (g.x < -8) {
      g.x = canvas.width + 8;
    } else if (g.x > canvas.width + 8) {
      g.x = -8;
    }
  }

  public draw() {
    // Pitch Black Void background
    ctx.fillStyle = '#06040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(0, MAZE_OFFSET_Y);

    // Flash maze walls on wave clear
    const wallColour =
      this.mode === 'wave_clear' && Math.floor(Date.now() / 150) % 2 === 0 ? EGA.white : EGA.blue;

    // Draw Citadel Maze Walls & Collectibles
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.grid[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (tile === 1) {
          // Chocolate brick Citadel wall
          ctx.fillStyle = wallColour;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = wallColour === EGA.white ? EGA.lightGrey : EGA.lightBlue;
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 2);
          ctx.fillRect(x + 1, y + 1, 2, TILE_SIZE - 2);
          ctx.fillStyle = wallColour === EGA.white ? EGA.darkGrey : '#000055';
          ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (tile === 4) {
          // Ghost Gate (Cyan wafer bar)
          ctx.fillStyle = EGA.lightCyan;
          ctx.fillRect(x, y + 8, TILE_SIZE, 4);
        } else if (tile === 2) {
          // Gumdrop: colourful translucent dot with highlight
          const dotColours = [
            EGA.lightRed,
            EGA.lightGreen,
            EGA.lightCyan,
            EGA.lightMagenta,
            EGA.yellow,
          ];
          const col = dotColours[(r * 7 + c) % dotColours.length];
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = EGA.white;
          ctx.fillRect(x + TILE_SIZE / 2 - 1, y + TILE_SIZE / 2 - 1, 1, 1);
        } else if (tile === 6) {
          // Cheezie: golden crunchy curl snack
          const dotX = x + TILE_SIZE / 2;
          const dotY = y + TILE_SIZE / 2;
          ctx.strokeStyle = EGA.yellow;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 3.5, 0.4, 2.8);
          ctx.stroke();
          ctx.fillStyle = EGA.brown;
          ctx.fillRect(dotX - 1, dotY, 1, 1);
        } else if (tile === 3) {
          // Sparkling Cream Soda Power Can
          const canX = x + TILE_SIZE / 2;
          const canY = y + TILE_SIZE / 2;
          const flash = Math.floor(Date.now() / 150) % 2 === 0;
          ctx.fillStyle = flash ? EGA.lightCyan : EGA.lightBlue;
          ctx.fillRect(canX - 5, canY - 7, 10, 14);
          ctx.fillStyle = EGA.white;
          ctx.fillRect(canX - 4, canY - 6, 8, 2);
          ctx.fillStyle = EGA.lightRed;
          ctx.fillRect(canX - 4, canY - 2, 8, 4);
          ctx.fillStyle = EGA.yellow;
          ctx.fillRect(canX - 1, canY - 1, 2, 2);
        }
      }
    }

    // Draw Chocolate Bar Bonus Item
    if (this.bonusItem.active) {
      ctx.save();
      ctx.translate(this.bonusItem.x, this.bonusItem.y);
      ctx.fillStyle = EGA.brown;
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#3a1f0d';
      ctx.fillRect(-8, -5, 7, 4);
      ctx.fillRect(1, -5, 7, 4);
      ctx.fillRect(-8, 1, 7, 4);
      ctx.fillRect(1, 1, 7, 4);
      ctx.fillStyle = EGA.lightGrey; // silver foil
      ctx.fillRect(-9, 3, 18, 3);
      ctx.restore();
    }

    // Draw Ben (Pac-Man)
    this.drawPlayer();

    // Draw Ghosts
    for (const g of this.ghosts) {
      this.drawGhost(g);
    }

    // Draw Floating Text
    for (const ft of this.floatingTexts) {
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.colour;
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    // Draw "READY!" banner during ready mode
    if (this.mode === 'ready') {
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = EGA.yellow;
      ctx.fillText('READY!', canvas.width / 2, 13 * TILE_SIZE + 10);
    }

    ctx.restore();

    // Draw Top & Bottom HUD
    this.drawHUD();

    // Overlays
    if (this.paused) {
      this.drawOverlay('GAME PAUSED', 'PRESS P TO RESUME', EGA.yellow);
    } else if (this.mode === 'start') {
      this.drawAttractScreen();
    } else if (this.mode === 'gameover') {
      this.drawOverlay(
        'GAME OVER',
        `FINAL SCORE: ${this.score}\n\nPRESS SPACE TO PLAY AGAIN`,
        EGA.lightRed,
      );
    }
  }

  private drawPlayer() {
    ctx.save();
    ctx.translate(this.playerX, this.playerY);

    if (this.mode === 'dying') {
      ctx.rotate(this.dyingAngle);
      const scale = Math.max(0.08, this.dyingTimer / 75);
      ctx.scale(scale, scale);
    } else {
      let angle = 0;
      if (this.playerDirX === 1) angle = 0;
      else if (this.playerDirX === -1) angle = Math.PI;
      else if (this.playerDirY === 1) angle = Math.PI / 2;
      else if (this.playerDirY === -1) angle = -Math.PI / 2;
      ctx.rotate(angle);
    }

    // Ben's Golden Astronaut Helmet / Pac-Mouth
    ctx.fillStyle = EGA.yellow;
    ctx.beginPath();
    ctx.arc(0, 0, 9, this.mouthAngle, Math.PI * 2 - this.mouthAngle);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Helmet rim
    ctx.strokeStyle = EGA.brown;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, this.mouthAngle, Math.PI * 2 - this.mouthAngle);
    ctx.stroke();

    // Astronaut Visor Gleam
    ctx.fillStyle = EGA.white;
    ctx.fillRect(1, -5, 2, 2);

    ctx.restore();
  }

  private drawGhost(g: Ghost) {
    ctx.save();
    ctx.translate(g.x, g.y);

    if (g.state === 'eaten' || g.state === 'entering_house') {
      // Disembodied floating eyeballs flying to pen
      ctx.fillStyle = EGA.white;
      ctx.fillRect(-5, -3, 4, 6);
      ctx.fillRect(1, -3, 4, 6);
      ctx.fillStyle = EGA.blue;
      ctx.fillRect(-4, -1, 2, 3);
      ctx.fillRect(2, -1, 2, 3);
      ctx.restore();
      return;
    }

    // Body Colour
    let bodyCol = g.normalColour;
    if (g.frightened) {
      bodyCol = EGA.lightBlue;
      if (this.powerTimer < 120 && Math.floor(Date.now() / 150) % 2 === 0) {
        bodyCol = EGA.white;
      }
    }

    // Dome Head
    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI, 0);
    ctx.lineTo(9, 8);
    // Wavy ghost skirt
    ctx.lineTo(6, 5);
    ctx.lineTo(3, 8);
    ctx.lineTo(0, 5);
    ctx.lineTo(-3, 8);
    ctx.lineTo(-6, 5);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();

    // Eyes
    if (g.frightened) {
      ctx.fillStyle = EGA.yellow;
      ctx.fillRect(-4, -4, 2, 2);
      ctx.fillRect(2, -4, 2, 2);
      // Wavy terrified mouth
      ctx.strokeStyle = EGA.yellow;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.lineTo(-2, 4);
      ctx.lineTo(2, 2);
      ctx.lineTo(5, 4);
      ctx.stroke();
    } else {
      ctx.fillStyle = EGA.white;
      ctx.fillRect(-6, -5, 5, 6);
      ctx.fillRect(2, -5, 5, 6);
      ctx.fillStyle = EGA.blue;
      const lookX = g.dirX * 2;
      const lookY = g.dirY * 2;
      ctx.fillRect(-5 + lookX, -4 + lookY, 3, 4);
      ctx.fillRect(3 + lookX, -4 + lookY, 3, 4);
    }

    ctx.restore();
  }

  private drawHUD() {
    // Top Bar
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = EGA.yellow;
    ctx.fillText(`SCORE: ${this.score}`, 20, 26);

    ctx.textAlign = 'center';
    ctx.fillStyle = EGA.lightCyan;
    ctx.fillText(`CITADEL WAVE ${this.wave}`, canvas.width / 2, 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = EGA.white;
    ctx.fillText(`HI: ${this.highScore}`, canvas.width - 20, 26);

    // Bottom Bar (Lives & Power Status)
    ctx.textAlign = 'left';
    ctx.fillStyle = EGA.yellow;
    ctx.fillText(`LIVES: ${'● '.repeat(Math.max(0, this.lives))}`, 20, canvas.height - 15);

    if (this.powerTimer > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = EGA.lightCyan;
      ctx.fillText(
        `FIZZY POWER: ${Math.ceil(this.powerTimer / 60)}s`,
        canvas.width / 2,
        canvas.height - 15,
      );
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = EGA.lightGrey;
    ctx.fillText(`SNACKS: ${this.remainingSnacks}`, canvas.width - 20, canvas.height - 15);
  }

  private drawAttractScreen() {
    ctx.fillStyle = 'rgba(6, 4, 10, 0.88)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title Header
    ctx.textAlign = 'center';
    ctx.fillStyle = EGA.yellow;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('★ RETRO ARCADE CLASSIC ★', canvas.width / 2, 70);

    ctx.fillStyle = EGA.lightMagenta;
    ctx.font = 'bold 28px monospace';
    ctx.fillText('GUMDROP PAC-MAN', canvas.width / 2, 105);

    ctx.fillStyle = EGA.lightCyan;
    ctx.font = 'bold 13px monospace';
    ctx.fillText("MILDRED'S CITADEL SNACK RUN", canvas.width / 2, 128);

    // Zarg Phantoms Cast
    const startY = 170;
    const ghostCast = [
      { name: 'BLINKY', desc: '"SHADOW" — ZARG COMMANDER', col: EGA.lightRed },
      { name: 'PINKY', desc: '"SPEEDY" — CITADEL SCOUT', col: EGA.lightMagenta },
      { name: 'INKY', desc: '"BASHFUL" — CAVERN PHANTOM', col: EGA.lightCyan },
      { name: 'CLYDE', desc: '"POKEY" — GUMDROP LURKER', col: EGA.yellow },
    ];

    ghostCast.forEach((g, i) => {
      const gy = startY + i * 36;
      // Mini ghost icon
      ctx.fillStyle = g.col;
      ctx.beginPath();
      ctx.arc(70, gy - 2, 8, Math.PI, 0);
      ctx.lineTo(78, gy + 7);
      ctx.lineTo(75, gy + 4);
      ctx.lineTo(72, gy + 7);
      ctx.lineTo(68, gy + 4);
      ctx.lineTo(65, gy + 7);
      ctx.lineTo(62, gy + 7);
      ctx.closePath();
      ctx.fill();

      // Mini eyes
      ctx.fillStyle = EGA.white;
      ctx.fillRect(66, gy - 4, 3, 4);
      ctx.fillRect(72, gy - 4, 3, 4);
      ctx.fillStyle = EGA.blue;
      ctx.fillRect(66, gy - 3, 2, 2);
      ctx.fillRect(72, gy - 3, 2, 2);

      // Label
      ctx.textAlign = 'left';
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = g.col;
      ctx.fillText(g.name, 95, gy + 3);
      ctx.fillStyle = EGA.lightGrey;
      ctx.font = '11px monospace';
      ctx.fillText(g.desc, 165, gy + 3);
    });

    // Snack Scoring Table
    const snackY = 330;
    ctx.strokeStyle = EGA.darkGrey;
    ctx.strokeRect(40, snackY, canvas.width - 80, 110);
    ctx.fillStyle = '#0f0c18';
    ctx.fillRect(41, snackY + 1, canvas.width - 82, 108);

    ctx.textAlign = 'center';
    ctx.fillStyle = EGA.lightCyan;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('CITADEL SNACK VALUES', canvas.width / 2, snackY + 22);

    ctx.textAlign = 'left';
    ctx.font = '12px monospace';

    // Gumdrop
    ctx.fillStyle = EGA.lightGreen;
    ctx.beginPath();
    ctx.arc(70, snackY + 45, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EGA.white;
    ctx.fillText('GUMDROP: 10 PTS', 88, snackY + 49);

    // Cheezie
    ctx.strokeStyle = EGA.yellow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(70, snackY + 70, 4, 0.4, 2.8);
    ctx.stroke();
    ctx.fillStyle = EGA.white;
    ctx.fillText('CHEEZIE: 20 PTS', 88, snackY + 74);

    // Cream Soda Can
    ctx.fillStyle = EGA.lightCyan;
    ctx.fillRect(300, snackY + 38, 8, 12);
    ctx.fillStyle = EGA.white;
    ctx.fillText('CREAM SODA CAN: 50 PTS (STUNS ZARGS)', 320, snackY + 49);

    // Chocolate Bar
    ctx.fillStyle = EGA.brown;
    ctx.fillRect(300, snackY + 63, 12, 8);
    ctx.fillStyle = EGA.white;
    ctx.fillText('CHOCOLATE BAR: 200 PTS', 320, snackY + 74);

    // Press Space / Arrow Key Prompt (Flashing)
    if (Math.floor(Date.now() / 450) % 2 === 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = EGA.yellow;
      ctx.fillText('PRESS SPACE OR ARROW TO START', canvas.width / 2, 480);
    }
  }

  private drawOverlay(title: string, sub: string, colour: string) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colour;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 14px monospace';
    const lines = sub.split('\n');
    lines.forEach((l, idx) => {
      ctx.fillText(l, canvas.width / 2, canvas.height / 2 + 25 + idx * 24);
    });
  }
}

const game = new GumdropPacmanGame();

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();

  // If in start / attract screen, any movement or action key begins the game
  if (game.mode === 'start') {
    if (
      [
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        'w',
        'a',
        's',
        'd',
        ' ',
        'enter',
      ].includes(k)
    ) {
      game.start();
      e.preventDefault();
      return;
    }
  }

  if (k === 'arrowup' || k === 'w') {
    game.setDesiredDirection(0, -1);
    e.preventDefault();
  } else if (k === 'arrowdown' || k === 's') {
    game.setDesiredDirection(0, 1);
    e.preventDefault();
  } else if (k === 'arrowleft' || k === 'a') {
    game.setDesiredDirection(-1, 0);
    e.preventDefault();
  } else if (k === 'arrowright' || k === 'd') {
    game.setDesiredDirection(1, 0);
    e.preventDefault();
  } else if (k === 'p') {
    game.paused = !game.paused;
    e.preventDefault();
  } else if (k === ' ' && game.mode === 'gameover') {
    game.resetGame();
    e.preventDefault();
  }
});

// Game loop
function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
