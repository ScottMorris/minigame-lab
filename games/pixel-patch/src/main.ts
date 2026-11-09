// Pixel Patch: Corruption Control — Retro Territory-Recovery Arcade
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { note, sound, stack, type Pattern, type ControlPatch } from '@liminal-hq/undertone';

function playSafe(pattern: Pattern<ControlPatch>) {
  try {
    pattern.play();
  } catch {
    // Audio context may be suspended before user gesture or in headless tests
  }
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

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

class SoundFx {
  playSeek() {
    playSafe(note('a5').sound('square').decay(0.015).gain(0.12));
  }

  playPatch() {
    playSafe(note('c5 g5').sound('triangle').fast(10).decay(0.06).gain(0.16));
  }

  playSourceKilled() {
    playSafe(note('e5 b5 e6').sound('square').fast(12).decay(0.12).gain(0.2));
  }

  playSpread() {
    playSafe(sound('pink').decay(0.05).gain(0.15).hpf(600));
  }

  playWin() {
    playSafe(note('g4 c5 e5 g5 c6').sound('triangle').fast(6).decay(0.15).gain(0.2));
  }

  playGameOver() {
    playSafe(
      stack(
        sound('brown').decay(0.25).gain(0.25),
        note('f2 c2 f1').sound('sawtooth').fast(3).decay(0.2).gain(0.2),
      ),
    );
  }
}
const sfx = new SoundFx();

const GRID_SIZE = 8;
const CELL_SIZE = 36;
const OFFSET_X = 96;
const OFFSET_Y = 44;

type CellType = 'clean' | 'corrupted' | 'source';

interface Cell {
  type: CellType;
  origColour: string;
  staticFrame: number;
}

const MOSAIC_PALETTE = [
  EGA.cyan,
  EGA.yellow,
  EGA.lightMagenta,
  EGA.lightGreen,
  EGA.lightBlue,
  EGA.lightRed,
];

class PixelPatchGame {
  private grid: Cell[][] = [];
  private cursorX = 3;
  private cursorY = 3;

  private score = 0;
  private combo = 1;
  private timeRemaining = 60; // seconds
  private lastSecondTick = Date.now();
  private spreadTimer = 90;

  private state: 'attract' | 'playing' | 'win' | 'game_over' | 'paused' = 'attract';
  private pulse = 0;

  constructor() {
    this.resetGrid();
    this.bindEvents();
    this.loop();
  }

  private resetGrid() {
    this.grid = [];
    this.score = 0;
    this.combo = 1;
    this.timeRemaining = 60;
    this.spreadTimer = 90;

    for (let r = 0; r < GRID_SIZE; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const colIdx = (r * 3 + c * 2) % MOSAIC_PALETTE.length;
        row.push({
          type: 'clean',
          origColour: MOSAIC_PALETTE[colIdx],
          staticFrame: Math.floor(Math.random() * 4),
        });
      }
      this.grid.push(row);
    }

    // Seed corruption roots
    this.grid[2][2].type = 'source';
    this.grid[2][3].type = 'corrupted';
    this.grid[3][2].type = 'corrupted';

    this.grid[5][5].type = 'source';
    this.grid[5][6].type = 'corrupted';
    this.grid[6][5].type = 'corrupted';

    this.grid[1][6].type = 'source';
    this.grid[1][5].type = 'corrupted';
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.state === 'attract') {
        if (e.code === 'Space') {
          this.resetGrid();
          this.state = 'playing';
          sfx.playPatch();
        }
        return;
      }

      if (this.state === 'win' || this.state === 'game_over') {
        if (e.code === 'Space') {
          this.resetGrid();
          this.state = 'playing';
          sfx.playPatch();
        }
        return;
      }

      if (e.code === 'KeyP') {
        this.state = this.state === 'paused' ? 'playing' : 'paused';
        return;
      }

      if (this.state !== 'playing') return;

      let moved = false;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (this.cursorY > 0) {
          this.cursorY--;
          moved = true;
        }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        if (this.cursorY < GRID_SIZE - 1) {
          this.cursorY++;
          moved = true;
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (this.cursorX > 0) {
          this.cursorX--;
          moved = true;
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (this.cursorX < GRID_SIZE - 1) {
          this.cursorX++;
          moved = true;
        }
      } else if (e.code === 'Space') {
        this.patchCurrentCell();
      }

      if (moved) {
        sfx.playSeek();
      }
    });
  }

  private patchCurrentCell() {
    const target = this.grid[this.cursorY][this.cursorX];
    if (target.type === 'source') {
      target.type = 'clean';
      this.score += 250 * this.combo;
      this.combo++;
      sfx.playSourceKilled();
      this.checkWinCondition();
    } else if (target.type === 'corrupted') {
      target.type = 'clean';
      this.score += 100 * this.combo;
      this.combo++;
      sfx.playPatch();
      this.checkWinCondition();
    } else {
      // Mispatch on already clean cell resets combo
      this.combo = 1;
    }
  }

  private checkWinCondition() {
    let corrupted = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c].type !== 'clean') {
          corrupted++;
        }
      }
    }
    if (corrupted === 0) {
      this.state = 'win';
      sfx.playWin();
    }
  }

  private update() {
    this.pulse += 0.08;

    // Cycle static frames
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c].type !== 'clean') {
          this.grid[r][c].staticFrame = (this.grid[r][c].staticFrame + 1) % 4;
        }
      }
    }

    if (this.state !== 'playing') return;

    // Countdown timer
    const now = Date.now();
    if (now - this.lastSecondTick >= 1000) {
      this.lastSecondTick = now;
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.state = 'game_over';
        sfx.playGameOver();
      }
    }

    // Spread step
    this.spreadTimer--;
    if (this.spreadTimer <= 0) {
      this.spreadTimer = 90;
      this.spreadCorruption();
    }
  }

  private spreadCorruption() {
    let target: { r: number; c: number } | null = null;

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c].type === 'source') {
          const neighbours = [
            { r: r - 1, c },
            { r: r + 1, c },
            { r, c: c - 1 },
            { r, c: c + 1 },
          ];
          for (const n of neighbours) {
            if (n.r >= 0 && n.r < GRID_SIZE && n.c >= 0 && n.c < GRID_SIZE) {
              if (this.grid[n.r][n.c].type === 'clean') {
                target = n;
                break;
              }
            }
          }
          if (target) break;
        }
      }
      if (target) break;
    }

    if (target) {
      this.grid[target.r][target.c].type = 'corrupted';
      sfx.playSpread();
    }

    // Check if bottom row is fully corrupted
    let bottomCorrupted = true;
    for (let c = 0; c < GRID_SIZE; c++) {
      if (this.grid[GRID_SIZE - 1][c].type === 'clean') {
        bottomCorrupted = false;
        break;
      }
    }
    if (bottomCorrupted) {
      this.state = 'game_over';
      sfx.playGameOver();
    }
  }

  private draw() {
    // 1. CRT Matrix Background
    ctx.fillStyle = '#0f0617';
    ctx.fillRect(0, 0, 480, 360);

    // Grid outer border
    ctx.strokeStyle = EGA.magenta;
    ctx.lineWidth = 3;
    ctx.strokeRect(
      OFFSET_X - 4,
      OFFSET_Y - 4,
      GRID_SIZE * CELL_SIZE + 8,
      GRID_SIZE * CELL_SIZE + 8,
    );

    // 2. Mosaic Cells
    const staticChars = ['░', '▒', '▓', '█'];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const x = OFFSET_X + c * CELL_SIZE;
        const y = OFFSET_Y + r * CELL_SIZE;
        const cell = this.grid[r][c];

        if (cell.type === 'clean') {
          // Clean mosaic block with bevel
          ctx.fillStyle = cell.origColour;
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

          ctx.fillStyle = EGA.white;
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, 2);
          ctx.fillRect(x + 1, y + 1, 2, CELL_SIZE - 2);

          ctx.fillStyle = EGA.black;
          ctx.fillRect(x + CELL_SIZE - 3, y + 1, 2, CELL_SIZE - 2);
          ctx.fillRect(x + 1, y + CELL_SIZE - 3, CELL_SIZE - 2, 2);
        } else if (cell.type === 'corrupted') {
          // Static glitch block
          ctx.fillStyle = cell.staticFrame % 2 === 0 ? EGA.darkGrey : EGA.black;
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

          ctx.fillStyle = EGA.lightGrey;
          ctx.font = 'bold 16px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(staticChars[cell.staticFrame], x + CELL_SIZE / 2, y + 24);
        } else if (cell.type === 'source') {
          // Source root block
          ctx.fillStyle = Math.sin(this.pulse * 4) > 0 ? EGA.red : EGA.lightMagenta;
          ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);

          ctx.fillStyle = EGA.yellow;
          ctx.font = 'bold 18px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('☣', x + CELL_SIZE / 2, y + 25);
        }
      }
    }

    // 3. Reticle Crosshair
    const rx = OFFSET_X + this.cursorX * CELL_SIZE;
    const ry = OFFSET_Y + this.cursorY * CELL_SIZE;

    ctx.strokeStyle = Math.sin(this.pulse * 5) > 0 ? EGA.yellow : EGA.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx - 2, ry - 2, CELL_SIZE + 4, CELL_SIZE + 4);

    // Crosshair corner brackets
    ctx.fillStyle = EGA.lightCyan;
    ctx.fillRect(rx - 4, ry - 4, 6, 2);
    ctx.fillRect(rx - 4, ry - 4, 2, 6);
    ctx.fillRect(rx + CELL_SIZE - 2, ry - 4, 6, 2);
    ctx.fillRect(rx + CELL_SIZE + 2, ry - 4, 2, 6);
    ctx.fillRect(rx - 4, ry + CELL_SIZE + 2, 6, 2);
    ctx.fillRect(rx - 4, ry + CELL_SIZE - 4, 2, 6);
    ctx.fillRect(rx + CELL_SIZE - 2, ry + CELL_SIZE + 2, 6, 2);
    ctx.fillRect(rx + CELL_SIZE + 2, ry + CELL_SIZE - 4, 2, 6);

    // 4. Header HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, 480, 28);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = EGA.yellow;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this.score}`, 16, 18);

    ctx.fillStyle = EGA.lightMagenta;
    ctx.fillText(`COMBO: ${this.combo}x`, 140, 18);

    let cleanCount = 0;
    let sourceCount = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (this.grid[r][c].type === 'clean') cleanCount++;
        else if (this.grid[r][c].type === 'source') sourceCount++;
      }
    }
    const pct = Math.floor((cleanCount / (GRID_SIZE * GRID_SIZE)) * 100);

    ctx.fillStyle = EGA.lightGreen;
    ctx.fillText(`INTEGRITY: ${pct}%`, 240, 18);

    ctx.fillStyle = sourceCount > 0 ? EGA.lightRed : EGA.lightCyan;
    ctx.fillText(`SOURCES: ${sourceCount}`, 380, 18);

    // 5. Footer Diagnostic Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 336, 480, 24);

    ctx.fillStyle = this.timeRemaining < 15 ? EGA.lightRed : EGA.white;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `TIME REMAINING: ${this.timeRemaining}s  |  PATCH SOURCE CELLS [☣] TO HALT SPREAD`,
      12,
      352,
    );

    // Overlays
    if (this.state === 'attract') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.fillRect(50, 90, 380, 180);
      ctx.strokeStyle = EGA.lightMagenta;
      ctx.strokeRect(50, 90, 380, 180);

      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PIXEL PATCH: CORRUPTION CONTROL', 240, 125);

      ctx.fillStyle = EGA.white;
      ctx.font = '10px monospace';
      ctx.fillText('A static virus is eating the picture mosaic display!', 240, 155);
      ctx.fillText('Move crosshair and press [SPACE] to restore tiles.', 240, 175);
      ctx.fillText('Prioritize Source Cells [☣] before corruption spreads.', 240, 195);

      ctx.fillStyle = EGA.lightGreen;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('PRESS SPACE TO COMMENCE REPAIR', 240, 235);
    } else if (this.state === 'win') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(60, 100, 360, 140);
      ctx.strokeStyle = EGA.lightGreen;
      ctx.strokeRect(60, 100, 360, 140);

      ctx.fillStyle = EGA.lightGreen;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MOSAIC 100% RESTORED!', 240, 140);

      ctx.fillStyle = EGA.white;
      ctx.font = '11px monospace';
      ctx.fillText(`Integrity Restored! Final Score: ${this.score}`, 240, 175);
      ctx.fillText('PRESS SPACE TO REPLAY', 240, 210);
    } else if (this.state === 'game_over') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(60, 100, 360, 140);
      ctx.strokeStyle = EGA.red;
      ctx.strokeRect(60, 100, 360, 140);

      ctx.fillStyle = EGA.lightRed;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DISPLAY OVERRUN!', 240, 140);

      ctx.fillStyle = EGA.white;
      ctx.font = '11px monospace';
      ctx.fillText(`Corruption breached diagnostic line. Score: ${this.score}`, 240, 175);
      ctx.fillText('PRESS SPACE TO RETRY', 240, 210);
    } else if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(160, 150, 160, 50);
      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', 240, 180);
    }
  }

  private loop = () => {
    this.update();
    this.draw();
    requestAnimationFrame(this.loop);
  };
}

new PixelPatchGame();
