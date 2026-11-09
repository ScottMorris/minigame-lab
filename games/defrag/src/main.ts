// Defrag the Mainframe — Retro DOS Disk Defragmenter Puzzle Arcade
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
  playHeadSeek() {
    playSafe(
      stack(
        sound('white').decay(0.012).gain(0.2).hpf(1800),
        note('c2').sound('square').decay(0.02).gain(0.18),
      ),
    );
  }

  playSwap() {
    playSafe(note('g4 c5').sound('sine').fast(6).decay(0.05).gain(0.16));
  }

  playDefragClear() {
    playSafe(note('c4 e4 g4 c5').sound('square').fast(8).decay(0.1).gain(0.18));
  }

  playWormBite() {
    playSafe(note('f2 c2').sound('sawtooth').fast(3).decay(0.15).gain(0.2));
  }

  playWin() {
    playSafe(note('c4 f4 a4 c5 f5').sound('triangle').fast(6).decay(0.15).gain(0.2));
  }
}
const sfx = new SoundFx();

const COLS = 16;
const ROWS = 8;
const CELL_W = 24;
const CELL_H = 20;
const GRID_X = 48;
const GRID_Y = 64;

type ClusterType = 'empty' | 'system' | 'cyan' | 'yellow' | 'red' | 'green' | 'bad';

class DefragGame {
  private grid: ClusterType[][] = [];
  private cursorX = 0;
  private cursorY = 1;
  private buffer: ClusterType | null = null;

  // Cluster worm
  private wormX = 15;
  private wormY = 7;
  private wormStepTimer = 90;
  private wormDir = 1;

  // Stats
  private score = 0;
  private optimizedCount = 0;
  private totalToOptimize = 40;
  private timeRemaining = 75; // seconds
  private lastSecondTick = Date.now();

  // State
  private state: 'attract' | 'playing' | 'game_over' | 'win' | 'paused' = 'attract';
  private statusMessage = 'SYSTEM READY: PRESS SPACE TO START';
  private cursorBlink = 0;

  constructor() {
    this.resetGrid();
    this.bindEvents();
    this.loop();
  }

  private resetGrid() {
    this.grid = [];
    this.optimizedCount = 0;
    this.score = 0;
    this.timeRemaining = 75;
    this.buffer = null;
    this.wormX = 15;
    this.wormY = 7;

    for (let r = 0; r < ROWS; r++) {
      const row: ClusterType[] = [];
      for (let c = 0; c < COLS; c++) {
        if ((r === 0 && c < 4) || (r === 7 && c > 12)) {
          row.push('system');
        } else if ((r + c) % 5 === 0) {
          row.push('cyan');
        } else if ((r + c) % 5 === 1) {
          row.push('yellow');
        } else if ((r + c) % 5 === 2) {
          row.push('red');
        } else if ((r + c) % 5 === 3) {
          row.push('green');
        } else {
          row.push('empty');
        }
      }
      this.grid.push(row);
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.state === 'attract') {
        if (e.code === 'Space') {
          this.state = 'playing';
          this.statusMessage = 'OPTIMIZING CYLINDERS: ALIGN 4+ MATCHING COLOURS';
          sfx.playHeadSeek();
        }
        return;
      }

      if (this.state === 'game_over' || this.state === 'win') {
        if (e.code === 'Space') {
          this.resetGrid();
          this.state = 'playing';
          this.statusMessage = 'RESTARTING DRIVE DIAGNOSTICS';
          sfx.playHeadSeek();
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
        if (this.cursorY < ROWS - 1) {
          this.cursorY++;
          moved = true;
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (this.cursorX > 0) {
          this.cursorX--;
          moved = true;
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (this.cursorX < COLS - 1) {
          this.cursorX++;
          moved = true;
        }
      } else if (e.code === 'Space') {
        this.handleSwap();
      }

      if (moved) {
        sfx.playHeadSeek();
      }
    });
  }

  private handleSwap() {
    const current = this.grid[this.cursorY][this.cursorX];
    if (current === 'system') {
      this.statusMessage = 'CANNOT MOVE SYSTEM CLUSTER: ACCESS DENIED';
      return;
    }

    if (this.buffer === null) {
      if (current !== 'empty') {
        this.buffer = current;
        this.grid[this.cursorY][this.cursorX] = 'empty';
        this.statusMessage = `SECTOR READ: BUFFER HOLDING [${this.buffer.toUpperCase()}]`;
        sfx.playSwap();
      }
    } else {
      this.grid[this.cursorY][this.cursorX] = this.buffer;
      this.buffer = current === 'empty' ? null : current;
      this.statusMessage = 'CLUSTER WRITTEN TO CYLINDER';
      sfx.playSwap();
      this.checkMatches();
    }
  }

  private checkMatches() {
    let clearedAny = false;

    // Check rows for 4+ consecutive matching colours
    for (let r = 0; r < ROWS; r++) {
      let runStart = 0;
      let runLen = 1;
      for (let c = 1; c < COLS; c++) {
        const curr = this.grid[r][c];
        const prev = this.grid[r][c - 1];
        if (this.isColoured(curr) && curr === prev) {
          runLen++;
        } else {
          if (runLen >= 4) {
            this.clearRowRun(r, runStart, runLen);
            clearedAny = true;
          }
          runStart = c;
          runLen = 1;
        }
      }
      if (runLen >= 4) {
        this.clearRowRun(r, runStart, runLen);
        clearedAny = true;
      }
    }

    // Check columns for 4+ consecutive matching colours
    for (let c = 0; c < COLS; c++) {
      let runStart = 0;
      let runLen = 1;
      for (let r = 1; r < ROWS; r++) {
        const curr = this.grid[r][c];
        const prev = this.grid[r - 1][c];
        if (this.isColoured(curr) && curr === prev) {
          runLen++;
        } else {
          if (runLen >= 4) {
            this.clearColRun(c, runStart, runLen);
            clearedAny = true;
          }
          runStart = r;
          runLen = 1;
        }
      }
      if (runLen >= 4) {
        this.clearColRun(c, runStart, runLen);
        clearedAny = true;
      }
    }

    if (clearedAny) {
      sfx.playDefragClear();
      this.statusMessage = 'CONTIGUOUS ROW OPTIMIZED! WORM REPELLED!';
      // Zap worm backwards
      this.wormX = Math.max(0, this.wormX - 3);

      if (this.optimizedCount >= this.totalToOptimize) {
        this.state = 'win';
        sfx.playWin();
      }
    }
  }

  private isColoured(c: ClusterType): boolean {
    return c === 'cyan' || c === 'yellow' || c === 'red' || c === 'green';
  }

  private clearRowRun(row: number, start: number, len: number) {
    for (let c = start; c < start + len; c++) {
      this.grid[row][c] = 'empty';
      this.optimizedCount++;
      this.score += 50;
    }
  }

  private clearColRun(col: number, start: number, len: number) {
    for (let r = start; r < start + len; r++) {
      this.grid[r][col] = 'empty';
      this.optimizedCount++;
      this.score += 60;
    }
  }

  private update() {
    this.cursorBlink += 0.05;

    if (this.state !== 'playing') return;

    // Timer countdown
    const now = Date.now();
    if (now - this.lastSecondTick >= 1000) {
      this.lastSecondTick = now;
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.state = 'game_over';
        sfx.playWormBite();
      }
    }

    // Step cluster worm
    this.wormStepTimer--;
    if (this.wormStepTimer <= 0) {
      this.wormStepTimer = 85;
      this.wormX += this.wormDir;
      if (this.wormX >= COLS) {
        this.wormX = COLS - 1;
        this.wormDir = -1;
        this.wormY = (this.wormY + 1) % ROWS;
      } else if (this.wormX < 0) {
        this.wormX = 0;
        this.wormDir = 1;
        this.wormY = (this.wormY + 1) % ROWS;
      }

      // Corrupt cluster if empty or scramble it
      const target = this.grid[this.wormY][this.wormX];
      if (target === 'empty') {
        this.grid[this.wormY][this.wormX] = 'bad';
        sfx.playWormBite();
      } else if (this.isColoured(target)) {
        // Scramble colour
        const colours: ClusterType[] = ['cyan', 'yellow', 'red', 'green'];
        this.grid[this.wormY][this.wormX] = colours[Math.floor(Math.random() * colours.length)];
      }
    }
  }

  private draw() {
    // 1. DOS DEFRAG Blue Background
    ctx.fillStyle = EGA.blue;
    ctx.fillRect(0, 0, 480, 320);

    // 2. Menu Header Bar
    ctx.fillStyle = EGA.lightGrey;
    ctx.fillRect(0, 0, 480, 16);
    ctx.fillStyle = EGA.black;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('  File   Optimize   Configure   ClusterMap   Drive C:   Help', 6, 12);

    // Title banner
    ctx.fillStyle = EGA.yellow;
    ctx.font = 'bold 12px monospace';
    ctx.fillText('MS-DOS DEFRAG V6.22 — LIEUTENANT FIZZ SECTOR OPTIMIZER', 12, 34);

    // Buffer indicator in header
    ctx.fillStyle = EGA.white;
    ctx.font = '10px monospace';
    ctx.fillText('HEAD BUFFER:', 350, 34);
    if (this.buffer) {
      this.drawClusterBlock(435, 23, this.buffer);
    } else {
      ctx.fillStyle = EGA.darkGrey;
      ctx.fillText('[EMPTY]', 435, 34);
    }

    // 3. Grid Frame
    ctx.strokeStyle = EGA.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(GRID_X - 4, GRID_Y - 4, COLS * CELL_W + 8, ROWS * CELL_H + 8);

    // 4. Cluster Matrix
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = GRID_X + c * CELL_W;
        const y = GRID_Y + r * CELL_H;
        this.drawClusterBlock(x, y, this.grid[r][c]);
      }
    }

    // 5. Cluster Worm
    const wx = GRID_X + this.wormX * CELL_W;
    const wy = GRID_Y + this.wormY * CELL_H;
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillRect(wx + 3, wy + 3, CELL_W - 6, CELL_H - 6);
    ctx.fillStyle = EGA.red;
    ctx.fillRect(wx + 5, wy + 5, 3, 3);
    ctx.fillRect(wx + CELL_W - 8, wy + 5, 3, 3);

    // 6. Read/Write Head Cursor
    const hx = GRID_X + this.cursorX * CELL_W;
    const hy = GRID_Y + this.cursorY * CELL_H;
    ctx.strokeStyle = Math.sin(this.cursorBlink * 3) > 0 ? EGA.yellow : EGA.white;
    ctx.lineWidth = 2;
    ctx.strokeRect(hx - 1, hy - 1, CELL_W + 2, CELL_H + 2);

    // 7. Legend Bar
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(GRID_X - 4, 236, COLS * CELL_W + 8, 20);
    ctx.fillStyle = EGA.white;
    ctx.font = '9px monospace';
    ctx.fillText('LEGEND: █ System  ▓ Cyan  ▓ Yellow  ▓ Red  ▓ Green  ░ Free  X Bad', GRID_X, 250);

    // 8. Optimization Progress Bar
    const pct = Math.min(100, Math.floor((this.optimizedCount / this.totalToOptimize) * 100));
    ctx.fillStyle = EGA.black;
    ctx.fillRect(GRID_X - 4, 264, COLS * CELL_W + 8, 16);
    ctx.fillStyle = EGA.green;
    const barW = Math.floor(((COLS * CELL_W + 8) * pct) / 100);
    ctx.fillRect(GRID_X - 4, 264, barW, 16);

    ctx.fillStyle = EGA.yellow;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `OPTIMIZATION: ${pct}%  |  SCORE: ${this.score}  |  TIME: ${this.timeRemaining}s`,
      240,
      276,
    );

    // 9. Status Prompt Footer
    ctx.fillStyle = EGA.black;
    ctx.fillRect(0, 296, 480, 24);
    ctx.fillStyle = EGA.lightCyan;
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`► ${this.statusMessage}`, 8, 312);

    // Overlays
    if (this.state === 'attract') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(60, 90, 360, 140);
      ctx.strokeStyle = EGA.yellow;
      ctx.strokeRect(60, 90, 360, 140);

      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DEFRAG THE MAINFRAME', 240, 120);

      ctx.fillStyle = EGA.white;
      ctx.font = '10px monospace';
      ctx.fillText('The Mischief Cluster-Worm is scrambling memory!', 240, 145);
      ctx.fillText('Align 4+ matching coloured blocks to optimize cylinders.', 240, 165);

      ctx.fillStyle = EGA.lightGreen;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('PRESS SPACE TO DEFRAG', 240, 205);
    } else if (this.state === 'game_over') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(60, 100, 360, 120);
      ctx.strokeStyle = EGA.red;
      ctx.strokeRect(60, 100, 360, 120);

      ctx.fillStyle = EGA.lightRed;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CRITICAL DISK TIMEOUT!', 240, 135);

      ctx.fillStyle = EGA.white;
      ctx.font = '11px monospace';
      ctx.fillText(`Final Optimization: ${pct}%  |  Score: ${this.score}`, 240, 165);
      ctx.fillText('PRESS SPACE TO RETRY', 240, 195);
    } else if (this.state === 'win') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(60, 100, 360, 120);
      ctx.strokeStyle = EGA.lightGreen;
      ctx.strokeRect(60, 100, 360, 120);

      ctx.fillStyle = EGA.lightGreen;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DRIVE 100% OPTIMIZED!', 240, 135);

      ctx.fillStyle = EGA.white;
      ctx.font = '11px monospace';
      ctx.fillText(`Mainframe Defrag Complete! Score: ${this.score}`, 240, 165);
      ctx.fillText('PRESS SPACE TO RESTART', 240, 195);
    } else if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(160, 120, 160, 50);
      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DEFRAG PAUSED', 240, 150);
    }
  }

  private drawClusterBlock(x: number, y: number, type: ClusterType) {
    if (type === 'empty') {
      ctx.fillStyle = EGA.black;
      ctx.fillRect(x, y, CELL_W - 2, CELL_H - 2);
      ctx.fillStyle = EGA.darkGrey;
      ctx.fillText('░', x + 6, y + 14);
      return;
    }

    if (type === 'system') {
      ctx.fillStyle = EGA.darkGrey;
      ctx.fillRect(x, y, CELL_W - 2, CELL_H - 2);
      ctx.fillStyle = EGA.lightBlue;
      ctx.fillRect(x + 1, y + 1, CELL_W - 4, CELL_H - 4);
      ctx.fillStyle = EGA.white;
      ctx.fillText('█', x + 6, y + 14);
      return;
    }

    if (type === 'bad') {
      ctx.fillStyle = EGA.red;
      ctx.fillRect(x, y, CELL_W - 2, CELL_H - 2);
      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 11px monospace';
      ctx.fillText('X', x + 7, y + 14);
      return;
    }

    let fillColour = EGA.cyan;
    let hiColour = EGA.lightCyan;
    if (type === 'yellow') {
      fillColour = EGA.brown;
      hiColour = EGA.yellow;
    } else if (type === 'red') {
      fillColour = EGA.red;
      hiColour = EGA.lightRed;
    } else if (type === 'green') {
      fillColour = EGA.green;
      hiColour = EGA.lightGreen;
    }

    ctx.fillStyle = fillColour;
    ctx.fillRect(x, y, CELL_W - 2, CELL_H - 2);
    ctx.fillStyle = hiColour;
    ctx.fillRect(x, y, CELL_W - 2, 2);
    ctx.fillRect(x, y, 2, CELL_H - 2);
    ctx.fillStyle = EGA.black;
    ctx.fillRect(x + CELL_W - 4, y, 2, CELL_H - 2);
    ctx.fillRect(x, y + CELL_H - 4, CELL_W - 2, 2);
  }

  private loop = () => {
    this.update();
    this.draw();
    requestAnimationFrame(this.loop);
  };
}

new DefragGame();
