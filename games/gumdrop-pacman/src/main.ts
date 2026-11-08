// Gumdrop Pac-Man — Retro Maze Chaser in Mildred's Citadel
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

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

// Retro Web Audio SFX
class SoundFx {
  private ctx: AudioContext | null = null;
  private chompPhase = 0;

  private init() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playChomp() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const freq = this.chompPhase === 0 ? 300 : 450;
    this.chompPhase = (this.chompPhase + 1) % 2;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playPower() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(700, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playEatGhost() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  playDie() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(500, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  playFruit() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime);
    osc.frequency.setValueAtTime(880.0, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }
}

const sfx = new SoundFx();

const TILE_SIZE = 20;
const COLS = 28;
const ROWS = 28;
const MAZE_OFFSET_Y = 40;

// Tile types:
// 0 = empty / corridor (no dot)
// 1 = wall
// 2 = gumdrop (+10 pts)
// 3 = cream soda power can (+50 pts)
// 4 = ghost pen door / gate
// 5 = ghost pen interior
const MAZE_TEMPLATE: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 1],
  [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
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
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1],
  [1, 3, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 0, 0, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 3, 1],
  [1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

interface Ghost {
  name: string;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  normalColour: string;
  frightened: boolean;
  eaten: boolean;
  speed: number;
  targetTile: { x: number; y: number };
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  colour: string;
  life: number;
}

class GumdropPacmanGame {
  private grid: number[][] = [];
  public score = 0;
  public highScore = 0;
  public lives = 3;
  public wave = 1;
  public gameOver = false;
  public paused = false;

  // Ben / Player
  private playerX = 13.5 * TILE_SIZE;
  private playerY = 17 * TILE_SIZE + TILE_SIZE / 2;
  private playerDirX = 0;
  private playerDirY = 0;
  private nextDirX = 0;
  private nextDirY = 0;
  private playerSpeed = 2.2;
  private mouthAngle = 0.2;
  private mouthDir = 1;

  // Ghosts
  private ghosts: Ghost[] = [];
  private powerTimer = 0;
  private ghostsEatenStreak = 0;

  // Bonus Item (Spawns at centre)
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
    type: 'wafer',
    points: 200,
    timer: 0,
  };

  private floatingTexts: FloatingText[] = [];
  private remainingGumdrops = 0;

  constructor() {
    this.highScore = Number(localStorage.getItem('minigame_gumdrop_pacman_hi') || '0');
    this.resetMaze();
    this.resetActors();
  }

  private resetMaze() {
    this.grid = [];
    this.remainingGumdrops = 0;
    for (let r = 0; r < 24; r++) {
      const row: number[] = [];
      for (let c = 0; c < COLS; c++) {
        const val = MAZE_TEMPLATE[r][c];
        row.push(val);
        if (val === 2 || val === 3) {
          this.remainingGumdrops++;
        }
      }
      this.grid.push(row);
    }
  }

  private resetActors() {
    this.playerX = 13.5 * TILE_SIZE;
    this.playerY = 17 * TILE_SIZE + TILE_SIZE / 2;
    this.playerDirX = 0;
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
        eaten: false,
        speed: 1.8 + this.wave * 0.1,
        targetTile: { x: 0, y: 0 },
      },
      {
        name: 'Pinky',
        x: 12.5 * TILE_SIZE,
        y: 10.5 * TILE_SIZE,
        dirX: 0,
        dirY: -1,
        normalColour: EGA.lightMagenta,
        frightened: false,
        eaten: false,
        speed: 1.7 + this.wave * 0.1,
        targetTile: { x: 0, y: 0 },
      },
      {
        name: 'Inky',
        x: 13.5 * TILE_SIZE,
        y: 10.5 * TILE_SIZE,
        dirX: 0,
        dirY: -1,
        normalColour: EGA.lightCyan,
        frightened: false,
        eaten: false,
        speed: 1.6 + this.wave * 0.1,
        targetTile: { x: 0, y: 0 },
      },
      {
        name: 'Clyde',
        x: 14.5 * TILE_SIZE,
        y: 10.5 * TILE_SIZE,
        dirX: 0,
        dirY: -1,
        normalColour: EGA.yellow,
        frightened: false,
        eaten: false,
        speed: 1.5 + this.wave * 0.1,
        targetTile: { x: 0, y: 0 },
      },
    ];

    this.powerTimer = 0;
  }

  public resetGame() {
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameOver = false;
    this.resetMaze();
    this.resetActors();
  }

  public setDesiredDirection(dx: number, dy: number) {
    this.nextDirX = dx;
    this.nextDirY = dy;
  }

  private isPassable(tileX: number, tileY: number, isGhost = false): boolean {
    if (tileY < 0 || tileY >= this.grid.length) return false;
    // Wrapping tunnel rows 10, 11
    if (tileX < 0 || tileX >= COLS) return true;

    const tile = this.grid[tileY][tileX];
    if (tile === 1) return false; // Wall
    if (tile === 4) return isGhost; // Ghost door
    if (tile === 5) return isGhost; // Ghost interior
    return true;
  }

  public update() {
    if (this.paused || this.gameOver) return;

    // Power mode timer countdown
    if (this.powerTimer > 0) {
      this.powerTimer--;
      if (this.powerTimer <= 0) {
        for (const g of this.ghosts) {
          g.frightened = false;
        }
      }
    }

    // Bonus Item Timer
    if (this.bonusItem.active) {
      this.bonusItem.timer--;
      if (this.bonusItem.timer <= 0) {
        this.bonusItem.active = false;
      }
    } else if (Math.random() < 0.002 && this.remainingGumdrops < 120) {
      this.bonusItem.active = true;
      this.bonusItem.timer = 400;
      this.bonusItem.points = 300;
    }

    // Mouth animation
    this.mouthAngle += 0.05 * this.mouthDir;
    if (this.mouthAngle > 0.45) this.mouthDir = -1;
    if (this.mouthAngle < 0.05) this.mouthDir = 1;

    // Player Turning & Movement
    this.updatePlayerMovement();

    // Check Tile Collectibles at current position
    const curTileX = Math.floor(this.playerX / TILE_SIZE);
    const curTileY = Math.floor(this.playerY / TILE_SIZE);

    if (curTileY >= 0 && curTileY < this.grid.length && curTileX >= 0 && curTileX < COLS) {
      const tile = this.grid[curTileY][curTileX];
      if (tile === 2) {
        // Gumdrop
        this.grid[curTileY][curTileX] = 0;
        this.score += 10;
        this.remainingGumdrops--;
        sfx.playChomp();
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('minigame_gumdrop_pacman_hi', String(this.highScore));
        }
      } else if (tile === 3) {
        // Cream Soda Power Can
        this.grid[curTileY][curTileX] = 0;
        this.score += 50;
        this.remainingGumdrops--;
        this.powerTimer = 450; // ~7.5 seconds
        this.ghostsEatenStreak = 0;
        sfx.playPower();
        for (const g of this.ghosts) {
          if (!g.eaten) {
            g.frightened = true;
            g.dirX *= -1;
            g.dirY *= -1;
          }
        }
      }
    }

    // Check Bonus Item Collision
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

    // Level Clear condition
    if (this.remainingGumdrops <= 0) {
      this.wave++;
      this.resetMaze();
      this.resetActors();
      return;
    }

    // Update Ghosts
    for (const g of this.ghosts) {
      this.updateGhost(g);

      // Collision with Player
      const dist = Math.hypot(this.playerX - g.x, this.playerY - g.y);
      if (dist < 16) {
        if (g.frightened && !g.eaten) {
          // Eat Ghost
          g.eaten = true;
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
        } else if (!g.eaten) {
          // Player Died
          sfx.playDie();
          this.lives--;
          if (this.lives <= 0) {
            this.gameOver = true;
          } else {
            this.resetActors();
          }
          return;
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
    // Try turning if desired direction is set
    if (this.nextDirX !== 0 || this.nextDirY !== 0) {
      const tileX = Math.floor(this.playerX / TILE_SIZE);
      const tileY = Math.floor(this.playerY / TILE_SIZE);
      const centreX = tileX * TILE_SIZE + TILE_SIZE / 2;
      const centreY = tileY * TILE_SIZE + TILE_SIZE / 2;

      // Turning 180 degrees is always allowed immediately
      if (this.nextDirX === -this.playerDirX && this.nextDirY === -this.playerDirY) {
        this.playerDirX = this.nextDirX;
        this.playerDirY = this.nextDirY;
      } else if (Math.hypot(this.playerX - centreX, this.playerY - centreY) < 3) {
        // Near tile centre, check if the perpendicular corridor is clear
        if (this.isPassable(tileX + this.nextDirX, tileY + this.nextDirY)) {
          this.playerX = centreX;
          this.playerY = centreY;
          this.playerDirX = this.nextDirX;
          this.playerDirY = this.nextDirY;
        }
      }
    }

    // Move in current direction if path ahead is clear
    if (this.playerDirX !== 0 || this.playerDirY !== 0) {
      const nextX = this.playerX + this.playerDirX * this.playerSpeed;
      const nextY = this.playerY + this.playerDirY * this.playerSpeed;

      // Side Wrap Tunnel
      if (nextX < 0) {
        this.playerX = canvas.width;
      } else if (nextX > canvas.width) {
        this.playerX = 0;
      } else {
        const checkTileX = Math.floor((nextX + this.playerDirX * 8) / TILE_SIZE);
        const checkTileY = Math.floor((nextY + this.playerDirY * 8) / TILE_SIZE);

        if (this.isPassable(checkTileX, checkTileY)) {
          this.playerX = nextX;
          this.playerY = nextY;
        } else {
          // Snap to tile centre upon hitting wall
          const tileX = Math.floor(this.playerX / TILE_SIZE);
          const tileY = Math.floor(this.playerY / TILE_SIZE);
          this.playerX = tileX * TILE_SIZE + TILE_SIZE / 2;
          this.playerY = tileY * TILE_SIZE + TILE_SIZE / 2;
        }
      }
    }
  }

  private updateGhost(g: Ghost) {
    // Eaten eyes returning to ghost house
    if (g.eaten) {
      const houseX = 13.5 * TILE_SIZE;
      const houseY = 10.5 * TILE_SIZE;
      const dx = houseX - g.x;
      const dy = houseY - g.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        g.eaten = false;
        g.frightened = false;
        g.dirY = -1;
        g.dirX = 0;
      } else {
        g.x += (dx / dist) * 3.5;
        g.y += (dy / dist) * 3.5;
      }
      return;
    }

    const currentSpeed = g.frightened ? g.speed * 0.6 : g.speed;
    const tileX = Math.floor(g.x / TILE_SIZE);
    const tileY = Math.floor(g.y / TILE_SIZE);
    const centreX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const centreY = tileY * TILE_SIZE + TILE_SIZE / 2;

    // At intersection or tile centre, pick best direction
    if (Math.hypot(g.x - centreX, g.y - centreY) < currentSpeed) {
      g.x = centreX;
      g.y = centreY;

      // Available directions (forbidding immediate 180 turnaround)
      const possibleDirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ].filter((d) => {
        if (d.dx === -g.dirX && d.dy === -g.dirY) return false;
        return this.isPassable(tileX + d.dx, tileY + d.dy, true);
      });

      if (possibleDirs.length > 0) {
        if (g.frightened) {
          // Wander randomly when frightened
          const picked = possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
          g.dirX = picked.dx;
          g.dirY = picked.dy;
        } else {
          // AI targeting Ben's position
          let bestDir = possibleDirs[0];
          let bestDist = Infinity;
          for (const d of possibleDirs) {
            const nextTileX = (tileX + d.dx) * TILE_SIZE;
            const nextTileY = (tileY + d.dy) * TILE_SIZE;
            const dist = Math.hypot(nextTileX - this.playerX, nextTileY - this.playerY);
            if (dist < bestDist) {
              bestDist = dist;
              bestDir = d;
            }
          }
          g.dirX = bestDir.dx;
          g.dirY = bestDir.dy;
        }
      }
    }

    g.x += g.dirX * currentSpeed;
    g.y += g.dirY * currentSpeed;

    // Wrapping tunnel
    if (g.x < 0) g.x = canvas.width;
    if (g.x > canvas.width) g.x = 0;
  }

  public draw() {
    // Pitch Black Void background
    ctx.fillStyle = '#06040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(0, MAZE_OFFSET_Y);

    // Draw Citadel Maze Walls
    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = this.grid[r][c];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (tile === 1) {
          // Chocolate brick Citadel wall
          ctx.fillStyle = EGA.blue;
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = EGA.lightBlue;
          ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 2);
          ctx.fillRect(x + 1, y + 1, 2, TILE_SIZE - 2);
          ctx.fillStyle = '#000055';
          ctx.fillRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        } else if (tile === 4) {
          // Ghost Gate (Cyan wafer bar)
          ctx.fillStyle = EGA.lightCyan;
          ctx.fillRect(x, y + 8, TILE_SIZE, 4);
        } else if (tile === 2) {
          // Glowing Gumdrop pellet
          ctx.fillStyle = EGA.yellow;
          ctx.beginPath();
          ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (tile === 3) {
          // Giant Cream Soda Can
          const pulse = Math.sin(Date.now() / 150) * 1.5;
          ctx.fillStyle = EGA.lightCyan;
          ctx.fillRect(x + 4 - pulse / 2, y + 3 - pulse / 2, 12 + pulse, 14 + pulse);
          ctx.fillStyle = EGA.white;
          ctx.fillRect(x + 6, y + 5, 8, 3);
          ctx.fillStyle = EGA.lightRed;
          ctx.fillRect(x + 6, y + 9, 8, 4);
        }
      }
    }

    // Draw Bonus Confectionery Item
    if (this.bonusItem.active) {
      ctx.fillStyle = EGA.brown;
      ctx.fillRect(this.bonusItem.x - 8, this.bonusItem.y - 6, 16, 12);
      ctx.fillStyle = EGA.white;
      ctx.fillRect(this.bonusItem.x - 6, this.bonusItem.y - 4, 12, 3);
      ctx.fillStyle = EGA.lightRed;
      ctx.fillRect(this.bonusItem.x - 6, this.bonusItem.y, 12, 3);
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

    ctx.restore();

    // Draw Top & Bottom HUD
    this.drawHUD();

    // Pause / Game Over overlays
    if (this.paused) {
      this.drawOverlay('GAME PAUSED', 'PRESS P TO RESUME', EGA.yellow);
    } else if (this.gameOver) {
      this.drawOverlay(
        'GAME OVER',
        `SCORE: ${this.score}\nPRESS SPACE TO PLAY AGAIN`,
        EGA.lightRed,
      );
    }
  }

  private drawPlayer() {
    ctx.save();
    ctx.translate(this.playerX, this.playerY);

    let angle = 0;
    if (this.playerDirX === 1) angle = 0;
    else if (this.playerDirX === -1) angle = Math.PI;
    else if (this.playerDirY === 1) angle = Math.PI / 2;
    else if (this.playerDirY === -1) angle = -Math.PI / 2;

    ctx.rotate(angle);

    // Ben's Golden Astronaut Helmet / Pac-Mouth
    ctx.fillStyle = EGA.yellow;
    ctx.beginPath();
    ctx.arc(0, 0, 9, this.mouthAngle, Math.PI * 2 - this.mouthAngle);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Helmet rim
    ctx.strokeStyle = EGA.brown;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }

  private drawGhost(g: Ghost) {
    ctx.save();
    ctx.translate(g.x, g.y);

    if (g.eaten) {
      // Floating eyeballs returning home
      ctx.fillStyle = EGA.white;
      ctx.fillRect(-6, -4, 5, 6);
      ctx.fillRect(2, -4, 5, 6);
      ctx.fillStyle = EGA.blue;
      ctx.fillRect(-5, -2, 3, 3);
      ctx.fillRect(3, -2, 3, 3);
      ctx.restore();
      return;
    }

    // Ghost body colour
    let bodyCol = g.normalColour;
    if (g.frightened) {
      // Flashing white when power mode is expiring (<100 ticks)
      bodyCol =
        this.powerTimer < 120 && Math.floor(Date.now() / 150) % 2 === 0 ? EGA.white : EGA.blue;
    }

    ctx.fillStyle = bodyCol;
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI, 0);
    ctx.lineTo(9, 8);
    // Wobbly tentacle feet
    const wobble = Math.sin(Date.now() / 100) * 2;
    ctx.lineTo(5, 5 + wobble);
    ctx.lineTo(0, 8);
    ctx.lineTo(-5, 5 - wobble);
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
    ctx.fillText(`GUMS: ${this.remainingGumdrops}`, canvas.width - 20, canvas.height - 15);
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
  } else if (k === ' ' && game.gameOver) {
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
