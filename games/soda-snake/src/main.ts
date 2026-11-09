// Soda Snake: The Last Straw — Retro Grid-Chase Survival Arcade
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
  playPelletEat() {
    playSafe(note('g4 c5 e5').sound('square').fast(8).decay(0.08).gain(0.16));
  }

  playVentBlow() {
    playSafe(sound('white').decay(0.12).gain(0.22).lpf(900));
  }

  playBrake() {
    playSafe(sound('pink').decay(0.08).gain(0.18).hpf(1400));
  }

  playCrash() {
    playSafe(
      stack(
        sound('brown').decay(0.25).gain(0.25).lpf(350),
        note('e1').sound('sawtooth').decay(0.22).gain(0.2),
      ),
    );
  }
}
const sfx = new SoundFx();

const COLS = 20;
const ROWS = 14;
const CELL_SIZE = 24;

interface Point {
  x: number;
  y: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

class SodaSnakeGame {
  private body: Point[] = [];
  private dir: Direction = 'right';
  private nextDir: Direction = 'right';

  private pellet: Point = { x: 14, y: 7 };
  private vent: { pos: Point; dir: Direction; active: boolean } = {
    pos: { x: 10, y: 3 },
    dir: 'down',
    active: false,
  };

  private score = 0;
  private brakesRemaining = 3;
  private maxBrakes = 5;

  private stepCounter = 0;
  private stepInterval = 9; // frame ticks per move

  private state: 'attract' | 'playing' | 'game_over' | 'paused' = 'attract';
  private pulse = 0;

  constructor() {
    this.resetGame();
    this.bindEvents();
    this.loop();
  }

  private resetGame() {
    this.body = [
      { x: 8, y: 7 },
      { x: 7, y: 7 },
      { x: 6, y: 7 },
    ];
    this.dir = 'right';
    this.nextDir = 'right';
    this.pellet = { x: 14, y: 7 };
    this.vent = {
      pos: { x: 10, y: 3 },
      dir: 'down',
      active: false,
    };
    this.score = 0;
    this.brakesRemaining = 3;
    this.stepCounter = 0;
    this.stepInterval = 9;
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.state === 'attract') {
        if (e.code === 'Space') {
          this.resetGame();
          this.state = 'playing';
          sfx.playPelletEat();
        }
        return;
      }

      if (this.state === 'game_over') {
        if (e.code === 'Space') {
          this.resetGame();
          this.state = 'playing';
          sfx.playPelletEat();
        }
        return;
      }

      if (e.code === 'KeyP') {
        this.state = this.state === 'paused' ? 'playing' : 'paused';
        return;
      }

      if (this.state !== 'playing') return;

      if ((e.code === 'ArrowUp' || e.code === 'KeyW') && this.dir !== 'down') {
        this.nextDir = 'up';
      } else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && this.dir !== 'up') {
        this.nextDir = 'down';
      } else if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && this.dir !== 'right') {
        this.nextDir = 'left';
      } else if ((e.code === 'ArrowRight' || e.code === 'KeyD') && this.dir !== 'left') {
        this.nextDir = 'right';
      } else if (e.code === 'Space') {
        // Pressure brake skips a step
        if (this.brakesRemaining > 0) {
          this.brakesRemaining--;
          this.stepCounter = 0;
          sfx.playBrake();
        }
      }
    });
  }

  private update() {
    this.pulse += 0.08;

    if (this.state !== 'playing') return;

    this.stepCounter++;
    if (this.stepCounter < this.stepInterval) {
      return;
    }
    this.stepCounter = 0;

    this.dir = this.nextDir;

    // Next head position
    const head: Point = { ...this.body[0] };
    if (this.dir === 'up') head.y--;
    else if (this.dir === 'down') head.y++;
    else if (this.dir === 'left') head.x--;
    else if (this.dir === 'right') head.x++;

    // Carbonation vent nudge
    if (this.vent.active && head.x === this.vent.pos.x && head.y === this.vent.pos.y) {
      sfx.playVentBlow();
      if (this.vent.dir === 'up') head.y--;
      else if (this.vent.dir === 'down') head.y++;
      else if (this.vent.dir === 'left') head.x--;
      else if (this.vent.dir === 'right') head.x++;
    }

    // Perimeter wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      this.state = 'game_over';
      sfx.playCrash();
      return;
    }

    // Tail self-collision
    for (const segment of this.body) {
      if (segment.x === head.x && segment.y === head.y) {
        this.state = 'game_over';
        sfx.playCrash();
        return;
      }
    }

    // Check pellet collection
    const atePellet = head.x === this.pellet.x && head.y === this.pellet.y;
    this.body.unshift(head);

    if (atePellet) {
      this.score += 100;
      sfx.playPelletEat();

      // Progressive speed acceleration
      if (this.body.length % 4 === 0 && this.stepInterval > 4) {
        this.stepInterval--;
      }

      // Spawn next pellet
      this.spawnPellet();

      // Periodically activate or re-aim vent
      if (this.score % 300 === 0) {
        this.vent.active = !this.vent.active;
        this.vent.pos = {
          x: (this.pellet.x + 3) % COLS,
          y: (this.pellet.y + 2) % ROWS,
        };
        const dirs: Direction[] = ['up', 'down', 'left', 'right'];
        this.vent.dir = dirs[Math.floor(Math.random() * dirs.length)];
        this.brakesRemaining = Math.min(this.maxBrakes, this.brakesRemaining + 1);
      }
    } else {
      this.body.pop();
    }
  }

  private spawnPellet() {
    let attempts = 0;
    while (attempts < 50) {
      const rx = Math.floor(Math.random() * COLS);
      const ry = Math.floor(Math.random() * ROWS);
      const onBody = this.body.some((s) => s.x === rx && s.y === ry);
      if (!onBody) {
        this.pellet = { x: rx, y: ry };
        break;
      }
      attempts++;
    }
  }

  private draw() {
    // 1. Industrial Shaft Checkerboard Floor
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#110e1a' : '#171224';
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

    // Shaft grid lines
    ctx.strokeStyle = '#221936';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS * CELL_SIZE; x += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ROWS * CELL_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS * CELL_SIZE; y += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(COLS * CELL_SIZE, y);
      ctx.stroke();
    }

    // 2. Carbonation Vent
    if (this.vent.active) {
      const vx = this.vent.pos.x * CELL_SIZE;
      const vy = this.vent.pos.y * CELL_SIZE;
      ctx.fillStyle = Math.sin(this.pulse * 4) > 0 ? EGA.lightCyan : EGA.cyan;
      ctx.fillRect(vx + 2, vy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      ctx.strokeStyle = EGA.yellow;
      ctx.lineWidth = 2;
      ctx.strokeRect(vx + 2, vy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      // Arrow indicator
      ctx.fillStyle = EGA.black;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      const arrow =
        this.vent.dir === 'up'
          ? '▲'
          : this.vent.dir === 'down'
            ? '▼'
            : this.vent.dir === 'left'
              ? '◄'
              : '►';
      ctx.fillText(arrow, vx + CELL_SIZE / 2, vy + 16);
    }

    // 3. Fizz Pellet
    const px = this.pellet.x * CELL_SIZE + CELL_SIZE / 2;
    const py = this.pellet.y * CELL_SIZE + CELL_SIZE / 2;
    const pr = 7 + Math.sin(this.pulse * 3) * 1.5;

    ctx.fillStyle = EGA.yellow;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = EGA.white;
    ctx.beginPath();
    ctx.arc(px - 2, py - 2, pr * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 4. Soda Straw Snake Body
    for (let i = 0; i < this.body.length; i++) {
      const seg = this.body[i];
      const sx = seg.x * CELL_SIZE;
      const sy = seg.y * CELL_SIZE;

      // Barber-pole red-and-white stripes
      const isRed = i % 2 === 0;
      ctx.fillStyle = isRed ? EGA.red : EGA.white;
      ctx.fillRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

      ctx.fillStyle = isRed ? EGA.lightRed : EGA.lightGrey;
      ctx.fillRect(sx + 4, sy + 4, CELL_SIZE - 8, 3);

      if (i === 0) {
        // Head with googly eyes
        ctx.fillStyle = EGA.black;
        ctx.fillRect(sx + 4, sy + 6, 4, 4);
        ctx.fillRect(sx + CELL_SIZE - 8, sy + 6, 4, 4);
        ctx.fillStyle = EGA.yellow;
        ctx.fillRect(sx + 5, sy + 7, 2, 2);
        ctx.fillRect(sx + CELL_SIZE - 7, sy + 7, 2, 2);
      }
    }

    // 5. Header HUD Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, 480, 24);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = EGA.yellow;
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this.score}`, 12, 16);

    ctx.fillStyle = EGA.lightGreen;
    ctx.fillText(`LENGTH: ${this.body.length}`, 140, 16);

    // Pressure brake gauge
    ctx.fillStyle = EGA.lightCyan;
    ctx.fillText('BRAKES:', 250, 16);
    for (let b = 0; b < this.maxBrakes; b++) {
      ctx.fillStyle = b < this.brakesRemaining ? EGA.lightCyan : EGA.darkGrey;
      ctx.fillRect(315 + b * 14, 7, 10, 10);
      ctx.strokeStyle = EGA.white;
      ctx.strokeRect(315 + b * 14, 7, 10, 10);
    }

    // 6. Overlays
    if (this.state === 'attract') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(60, 80, 360, 170);
      ctx.strokeStyle = EGA.lightRed;
      ctx.strokeRect(60, 80, 360, 170);

      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SODA SNAKE: THE LAST STRAW', 240, 115);

      ctx.fillStyle = EGA.white;
      ctx.font = '10px monospace';
      ctx.fillText('Slither through the maintenance shaft eating Fizz Pellets.', 240, 145);
      ctx.fillText('Watch out for blinking Carbonation Vents pushing you!', 240, 165);
      ctx.fillText('Use [SPACE] for Pressure Brake to skip a collision tick.', 240, 185);

      ctx.fillStyle = EGA.lightGreen;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('PRESS SPACE TO SLITHER', 240, 225);
    } else if (this.state === 'game_over') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(80, 100, 320, 130);
      ctx.strokeStyle = EGA.red;
      ctx.strokeRect(80, 100, 320, 130);

      ctx.fillStyle = EGA.lightRed;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STRAW RUPTURED!', 240, 135);

      ctx.fillStyle = EGA.white;
      ctx.font = '11px monospace';
      ctx.fillText(`Final Score: ${this.score}  |  Length: ${this.body.length}`, 240, 165);

      ctx.fillStyle = EGA.yellow;
      ctx.fillText('PRESS SPACE TO RETRY', 240, 200);
    } else if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(160, 140, 160, 50);
      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', 240, 170);
    }
  }

  private loop = () => {
    this.update();
    this.draw();
    requestAnimationFrame(this.loop);
  };
}

new SodaSnakeGame();
