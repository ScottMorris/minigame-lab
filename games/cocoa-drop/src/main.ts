// Cocoa Drop — Confectionery Foundry Falling Block Puzzle
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
  playMove() {
    playSafe(note('a3').sound('square').attack(0.001).decay(0.04).gain(0.1).lpf(800));
  }

  playRotate() {
    playSafe(note('e4').sound('triangle').slide(0.05).decay(0.06).gain(0.12));
  }

  playDrop() {
    playSafe(
      stack(
        note('c2').sound('triangle').decay(0.08).gain(0.2),
        sound('brown').decay(0.06).gain(0.15).lpf(400),
      ),
    );
  }

  playClear(lines: number) {
    const chord = lines > 2 ? 'a4 c#5 e5 a5' : lines === 2 ? 'a4 c#5 e5' : 'a4 e5';
    playSafe(
      note(chord)
        .sound('square')
        .fast(lines > 2 ? 4 : 2)
        .decay(0.09)
        .gain(0.18),
    );
  }

  playGameOver() {
    playSafe(note('e3').sound('sawtooth').slide(0.35).decay(0.4).gain(0.2));
  }
}
const sfx = new SoundFx();

// Grid constants
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 28;
const BOARD_X = 160;
const BOARD_Y = 40;

// Confectionery Block Definitions
interface BlockStyle {
  name: string;
  base: string;
  light: string;
  dark: string;
  detail: string;
}

const BLOCK_STYLES: BlockStyle[] = [
  { name: 'empty', base: '#000000', light: '#000000', dark: '#000000', detail: '#000000' },
  {
    name: 'Milk Chocolate',
    base: EGA.brown,
    light: EGA.yellow,
    dark: EGA.darkGrey,
    detail: '#7a3e00',
  },
  {
    name: 'Dark Cocoa',
    base: EGA.darkGrey,
    light: EGA.lightGrey,
    dark: EGA.black,
    detail: '#333333',
  },
  {
    name: 'White Vanilla',
    base: EGA.white,
    light: EGA.lightCyan,
    dark: EGA.lightGrey,
    detail: '#dedede',
  },
  {
    name: 'Ruby Crystal',
    base: EGA.lightMagenta,
    light: EGA.white,
    dark: EGA.magenta,
    detail: EGA.red,
  },
  { name: 'Fizz Cyan', base: EGA.lightCyan, light: EGA.white, dark: EGA.cyan, detail: EGA.blue },
  {
    name: 'Golden Caramel',
    base: EGA.yellow,
    light: EGA.white,
    dark: EGA.brown,
    detail: '#e69900',
  },
  {
    name: 'Mint Wafer',
    base: EGA.lightGreen,
    light: EGA.white,
    dark: EGA.green,
    detail: '#22bb22',
  },
];

// Tetromino shapes
const SHAPES = [
  // I
  {
    type: 5,
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  // O
  {
    type: 6,
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  // T
  {
    type: 4,
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  // S
  {
    type: 7,
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  // Z
  {
    type: 1,
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
  // J
  {
    type: 2,
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  // L
  {
    type: 3,
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colour: string;
  life: number;
  maxLife: number;
  size: number;
}

class CocoaDropGame {
  private grid: number[][] = [];
  private currentPiece: { type: number; matrix: number[][]; x: number; y: number } | null = null;
  private nextPiece: { type: number; matrix: number[][] } = SHAPES[0];
  private holdPiece: { type: number; matrix: number[][] } | null = null;
  private canHold = true;

  public score = 0;
  public highScore = 0;
  public level = 1;
  public lines = 0;
  public combo = 0;
  public gameOver = false;
  public paused = false;

  private dropCounter = 0;
  private dropInterval = 45; // frames per drop
  private particles: Particle[] = [];
  private screenShake = 0;
  private clearFlashRows: number[] = [];
  private clearFlashTimer = 0;

  constructor() {
    this.highScore = Number(localStorage.getItem('minigame_cocoa_drop_hi') || '0');
    this.reset();
  }

  reset() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = 0;
    this.gameOver = false;
    this.paused = false;
    this.holdPiece = null;
    this.canHold = true;
    this.dropInterval = 45;
    this.particles = [];
    this.nextPiece = this.randomPiece();
    this.spawnPiece();
  }

  private randomPiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return {
      type: shape.type,
      matrix: shape.matrix.map((row) => [...row]),
    };
  }

  private spawnPiece() {
    const p = this.nextPiece;
    this.nextPiece = this.randomPiece();
    this.currentPiece = {
      type: p.type,
      matrix: p.matrix,
      x: Math.floor((COLS - p.matrix[0].length) / 2),
      y: 0,
    };
    this.canHold = true;

    if (this.collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
      this.gameOver = true;
      sfx.playGameOver();
    }
  }

  private collides(matrix: number[][], offsetX: number, offsetY: number): boolean {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const x = offsetX + c;
          const y = offsetY + r;
          if (x < 0 || x >= COLS || y >= ROWS) return true;
          if (y >= 0 && this.grid[y][x] !== 0) return true;
        }
      }
    }
    return false;
  }

  public move(dir: number) {
    if (this.gameOver || this.paused || !this.currentPiece) return;
    if (!this.collides(this.currentPiece.matrix, this.currentPiece.x + dir, this.currentPiece.y)) {
      this.currentPiece.x += dir;
      sfx.playMove();
    }
  }

  public rotate(dir: number = 1) {
    if (this.gameOver || this.paused || !this.currentPiece) return;
    const m = this.currentPiece.matrix;
    const rotated: number[][] = [];
    for (let i = 0; i < m[0].length; i++) {
      rotated.push([]);
      for (let j = 0; j < m.length; j++) {
        rotated[i].push(dir > 0 ? m[m.length - 1 - j][i] : m[j][m[0].length - 1 - i]);
      }
    }

    // Wall kick attempts
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collides(rotated, this.currentPiece.x + kick, this.currentPiece.y)) {
        this.currentPiece.matrix = rotated;
        this.currentPiece.x += kick;
        sfx.playRotate();
        return;
      }
    }
  }

  public softDrop() {
    if (this.gameOver || this.paused || !this.currentPiece) return;
    if (!this.collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y += 1;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  public hardDrop() {
    if (this.gameOver || this.paused || !this.currentPiece) return;
    let dropped = 0;
    while (!this.collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
      this.currentPiece.y += 1;
      dropped += 1;
    }
    this.score += dropped * 2;
    this.screenShake = 6;
    this.spawnImpactParticles();
    sfx.playDrop();
    this.lockPiece();
  }

  public hold() {
    if (this.gameOver || this.paused || !this.currentPiece || !this.canHold) return;
    sfx.playRotate();
    const currentType = this.currentPiece.type;
    const currentShape = SHAPES.find((s) => s.type === currentType) || SHAPES[0];

    if (!this.holdPiece) {
      this.holdPiece = { type: currentType, matrix: currentShape.matrix.map((row) => [...row]) };
      this.spawnPiece();
    } else {
      const temp = this.holdPiece;
      this.holdPiece = { type: currentType, matrix: currentShape.matrix.map((row) => [...row]) };
      this.currentPiece = {
        type: temp.type,
        matrix: temp.matrix.map((row) => [...row]),
        x: Math.floor((COLS - temp.matrix[0].length) / 2),
        y: 0,
      };
    }
    this.canHold = false;
  }

  private lockPiece() {
    if (!this.currentPiece) return;
    for (let r = 0; r < this.currentPiece.matrix.length; r++) {
      for (let c = 0; c < this.currentPiece.matrix[r].length; c++) {
        if (this.currentPiece.matrix[r][c] !== 0) {
          const x = this.currentPiece.x + c;
          const y = this.currentPiece.y + r;
          if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
            this.grid[y][x] = this.currentPiece.type;
          }
        }
      }
    }

    this.checkLines();
    this.spawnPiece();
  }

  private checkLines() {
    const fullRows: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.grid[r].every((cell) => cell !== 0)) {
        fullRows.push(r);
      }
    }

    if (fullRows.length > 0) {
      this.clearFlashRows = fullRows;
      this.clearFlashTimer = 8;
      this.combo += 1;
      const count = fullRows.length;
      const points = [0, 100, 300, 500, 1000][count] * this.level * (1 + this.combo * 0.1);
      this.score += Math.round(points);
      this.lines += count;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(10, 45 - (this.level - 1) * 3);
      sfx.playClear(count);

      // Spawn clearing candy particles
      for (const r of fullRows) {
        for (let c = 0; c < COLS; c++) {
          const colour = BLOCK_STYLES[this.grid[r][c]]?.base || EGA.yellow;
          for (let p = 0; p < 4; p++) {
            this.particles.push({
              x: BOARD_X + c * CELL_SIZE + CELL_SIZE / 2,
              y: BOARD_Y + r * CELL_SIZE + CELL_SIZE / 2,
              vx: (Math.random() - 0.5) * 6,
              vy: (Math.random() - 0.7) * 7,
              colour,
              life: 25,
              maxLife: 25,
              size: Math.random() * 4 + 2,
            });
          }
        }
      }

      // Remove lines
      for (const r of fullRows) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(0));
      }
    } else {
      this.combo = 0;
    }

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('minigame_cocoa_drop_hi', String(this.highScore));
    }
  }

  private spawnImpactParticles() {
    if (!this.currentPiece) return;
    const y = this.currentPiece.y + this.currentPiece.matrix.length;
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x:
          BOARD_X +
          (this.currentPiece.x + Math.random() * this.currentPiece.matrix[0].length) * CELL_SIZE,
        y: BOARD_Y + y * CELL_SIZE,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3,
        colour: EGA.lightGrey,
        life: 15,
        maxLife: 15,
        size: 3,
      });
    }
  }

  private getGhostY(): number {
    if (!this.currentPiece) return 0;
    let ghostY = this.currentPiece.y;
    while (!this.collides(this.currentPiece.matrix, this.currentPiece.x, ghostY + 1)) {
      ghostY++;
    }
    return ghostY;
  }

  public update() {
    if (this.paused || this.gameOver) return;

    if (this.screenShake > 0) this.screenShake--;
    if (this.clearFlashTimer > 0) this.clearFlashTimer--;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Drop piece
    this.dropCounter++;
    if (this.dropCounter >= this.dropInterval) {
      this.dropCounter = 0;
      if (this.currentPiece) {
        if (
          !this.collides(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)
        ) {
          this.currentPiece.y++;
        } else {
          this.lockPiece();
        }
      }
    }
  }

  public draw() {
    ctx.save();
    if (this.screenShake > 0) {
      const ox = (Math.random() - 0.5) * this.screenShake * 2;
      const oy = (Math.random() - 0.5) * this.screenShake * 2;
      ctx.translate(ox, oy);
    }

    // Background: Factory interior
    ctx.fillStyle = '#0a0812';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Factory pipe decorations on sides
    this.drawFactoryPipes();

    // Board Frame & Background
    ctx.fillStyle = '#140f20';
    ctx.fillRect(BOARD_X, BOARD_Y, COLS * CELL_SIZE, ROWS * CELL_SIZE);

    // Grid checker pattern (subtle 50% chocolate dither)
    ctx.fillStyle = '#181226';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((r + c) % 2 === 0) {
          ctx.fillRect(BOARD_X + c * CELL_SIZE, BOARD_Y + r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // Board Bevel Border
    ctx.strokeStyle = EGA.brown;
    ctx.lineWidth = 4;
    ctx.strokeRect(BOARD_X - 2, BOARD_Y - 2, COLS * CELL_SIZE + 4, ROWS * CELL_SIZE + 4);

    // Draw Locked Blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = this.grid[r][c];
        if (type > 0) {
          this.drawCandyBlock(BOARD_X + c * CELL_SIZE, BOARD_Y + r * CELL_SIZE, type);
        }
      }
    }

    // Flash cleared lines
    if (this.clearFlashTimer > 0) {
      ctx.fillStyle = EGA.white;
      for (const r of this.clearFlashRows) {
        ctx.fillRect(BOARD_X, BOARD_Y + r * CELL_SIZE, COLS * CELL_SIZE, CELL_SIZE);
      }
    }

    // Draw Ghost Piece
    if (this.currentPiece && !this.gameOver) {
      const ghostY = this.getGhostY();
      if (ghostY !== this.currentPiece.y) {
        this.drawPiece(
          this.currentPiece.matrix,
          this.currentPiece.x,
          ghostY,
          this.currentPiece.type,
          0.35,
        );
      }
    }

    // Draw Active Piece
    if (this.currentPiece && !this.gameOver) {
      this.drawPiece(
        this.currentPiece.matrix,
        this.currentPiece.x,
        this.currentPiece.y,
        this.currentPiece.type,
        1.0,
      );
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    // Draw Left and Right HUDs
    this.drawHUD();

    // Overlays
    if (this.paused) {
      this.drawOverlay('PAUSED', 'PRESS P TO RESUME', EGA.yellow);
    } else if (this.gameOver) {
      this.drawOverlay('CRUNCHED!', 'PRESS SPACE TO RESTART', EGA.lightRed);
    }

    ctx.restore();
  }

  private drawPiece(
    matrix: number[][],
    offsetX: number,
    offsetY: number,
    type: number,
    alpha: number,
  ) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          this.drawCandyBlock(
            BOARD_X + (offsetX + c) * CELL_SIZE,
            BOARD_Y + (offsetY + r) * CELL_SIZE,
            type,
          );
        }
      }
    }
    ctx.restore();
  }

  private drawCandyBlock(x: number, y: number, type: number) {
    const s = BLOCK_STYLES[type] || BLOCK_STYLES[1];
    const size = CELL_SIZE;

    // Main base
    ctx.fillStyle = s.base;
    ctx.fillRect(x, y, size, size);

    // Bevel highlights (Top & Left)
    ctx.fillStyle = s.light;
    ctx.fillRect(x, y, size, 3);
    ctx.fillRect(x, y, 3, size);

    // Bevel shadow (Bottom & Right)
    ctx.fillStyle = s.dark;
    ctx.fillRect(x, y + size - 3, size, 3);
    ctx.fillRect(x + size - 3, y, 3, size);

    // Confectionery texture / centre imprint
    ctx.fillStyle = s.detail;
    ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
    ctx.fillStyle = s.light;
    ctx.fillRect(x + 7, y + 7, 2, 2);
  }

  private drawFactoryPipes() {
    // Left factory conduit
    ctx.fillStyle = EGA.brown;
    ctx.fillRect(20, 0, 16, canvas.height);
    ctx.fillStyle = EGA.yellow;
    ctx.fillRect(20, 0, 3, canvas.height);
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(33, 0, 3, canvas.height);

    // Pipe joints / rivets
    for (let y = 30; y < canvas.height; y += 80) {
      ctx.fillStyle = EGA.lightGrey;
      ctx.fillRect(16, y, 24, 8);
      ctx.fillStyle = EGA.white;
      ctx.fillRect(18, y + 2, 4, 4);
    }

    // Right factory conduit
    const rx = canvas.width - 36;
    ctx.fillStyle = EGA.brown;
    ctx.fillRect(rx, 0, 16, canvas.height);
    ctx.fillStyle = EGA.yellow;
    ctx.fillRect(rx, 0, 3, canvas.height);
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(rx + 13, 0, 3, canvas.height);

    for (let y = 50; y < canvas.height; y += 80) {
      ctx.fillStyle = EGA.lightGrey;
      ctx.fillRect(rx - 4, y, 24, 8);
      ctx.fillStyle = EGA.white;
      ctx.fillRect(rx - 2, y + 2, 4, 4);
    }
  }

  private drawHUD() {
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';

    // LEFT HUD: HOLD & STATS
    this.drawBox(48, 40, 96, 96, 'HELD', EGA.cyan);
    if (this.holdPiece) {
      this.drawMiniPiece(this.holdPiece.matrix, this.holdPiece.type, 54, 68);
    }

    this.drawBox(48, 150, 96, 60, 'LEVEL', EGA.yellow);
    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.level}`, 62, 190);

    this.drawBox(48, 224, 96, 60, 'LINES', EGA.lightGreen);
    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${this.lines}`, 62, 264);

    if (this.combo > 1) {
      this.drawBox(48, 298, 96, 48, 'COMBO', EGA.lightMagenta);
      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`${this.combo}x!`, 68, 332);
    }

    // RIGHT HUD: NEXT & SCORE
    const rx = BOARD_X + COLS * CELL_SIZE + 16;
    this.drawBox(rx, 40, 96, 96, 'NEXT', EGA.magenta);
    this.drawMiniPiece(this.nextPiece.matrix, this.nextPiece.type, rx + 6, 68);

    this.drawBox(rx, 150, 120, 68, 'SCORE', EGA.yellow);
    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${this.score}`, rx + 12, 192);

    this.drawBox(rx, 230, 120, 68, 'HIGH', EGA.lightCyan);
    ctx.fillStyle = EGA.yellow;
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`${this.highScore}`, rx + 12, 272);

    // Legend
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(rx, 330, 120, 160);
    ctx.strokeStyle = EGA.brown;
    ctx.strokeRect(rx, 330, 120, 160);
    ctx.fillStyle = EGA.yellow;
    ctx.font = '10px monospace';
    ctx.fillText('CONFECTIONS:', rx + 8, 350);

    const labels = ['Milk Choc', 'Dark Cocoa', 'Vanilla', 'Ruby Gem', 'Fizz Soda', 'Caramel'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = BLOCK_STYLES[i + 1].base;
      ctx.fillRect(rx + 8, 362 + i * 18, 12, 12);
      ctx.fillStyle = EGA.lightGrey;
      ctx.font = '9px monospace';
      ctx.fillText(labels[i], rx + 26, 372 + i * 18);
    }
  }

  private drawBox(x: number, y: number, w: number, h: number, title: string, colour: string) {
    ctx.fillStyle = '#140f20';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = colour;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(title, x + 8, y + 16);
  }

  private drawMiniPiece(matrix: number[][], type: number, x: number, y: number) {
    const miniSize = 16;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          ctx.fillStyle = BLOCK_STYLES[type].base;
          ctx.fillRect(x + c * miniSize, y + r * miniSize, miniSize, miniSize);
          ctx.fillStyle = BLOCK_STYLES[type].light;
          ctx.fillRect(x + c * miniSize, y + r * miniSize, miniSize, 2);
          ctx.fillRect(x + c * miniSize, y + r * miniSize, 2, miniSize);
        }
      }
    }
  }

  private drawOverlay(title: string, sub: string, colour: string) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(BOARD_X, BOARD_Y, COLS * CELL_SIZE, ROWS * CELL_SIZE);

    ctx.fillStyle = colour;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, BOARD_X + (COLS * CELL_SIZE) / 2, BOARD_Y + (ROWS * CELL_SIZE) / 2 - 20);

    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 12px monospace';
    ctx.fillText(sub, BOARD_X + (COLS * CELL_SIZE) / 2, BOARD_Y + (ROWS * CELL_SIZE) / 2 + 20);
  }
}

const game = new CocoaDropGame();

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    game.move(-1);
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    game.move(1);
    e.preventDefault();
  } else if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') {
    game.rotate(1);
    e.preventDefault();
  } else if (e.key === 'z' || e.key === 'Z') {
    game.rotate(-1);
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    game.softDrop();
    e.preventDefault();
  } else if (e.key === ' ') {
    if (game.gameOver) {
      game.reset();
    } else {
      game.hardDrop();
    }
    e.preventDefault();
  } else if (e.key === 'c' || e.key === 'C') {
    game.hold();
    e.preventDefault();
  } else if (e.key === 'p' || e.key === 'P') {
    game.paused = !game.paused;
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
