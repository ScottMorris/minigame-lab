// Magnet Mayhem: Gantry 5 — Retro Precision Crane Cargo Stacker
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { note, stack, type Pattern, type ControlPatch } from '@liminal-hq/undertone';

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
  playTrolleyMove() {
    playSafe(note('d2').sound('sawtooth').decay(0.015).gain(0.05).lpf(200));
  }

  playRelease() {
    playSafe(
      stack(
        note('f2').sound('square').decay(0.05).gain(0.2),
        note('c3').sound('triangle').decay(0.08).gain(0.18),
      ),
    );
  }

  playLandClank() {
    playSafe(
      stack(
        note('e3').sound('square').decay(0.12).gain(0.25).lpf(600),
        note('b2').sound('sawtooth').decay(0.15).gain(0.2).lpf(400),
      ),
    );
  }

  playPerfectChime() {
    playSafe(
      stack(
        note('c6').sound('triangle').decay(0.25).gain(0.2),
        note('e6').sound('triangle').decay(0.3).gain(0.2),
        note('g6').sound('triangle').decay(0.35).gain(0.22),
      ),
    );
  }

  playToppleCrash() {
    playSafe(
      stack(
        note('c2').sound('sawtooth').decay(0.5).gain(0.3).lpf(300),
        note('f1').sound('sawtooth').decay(0.6).gain(0.35).lpf(200),
      ),
    );
  }

  playShiftCleared() {
    playSafe(
      stack(
        note('c5').sound('square').decay(0.2).gain(0.2),
        note('e5').sound('square').decay(0.25).gain(0.2),
        note('g5').sound('square').decay(0.3).gain(0.22),
        note('c6').sound('square').decay(0.45).gain(0.25),
      ),
    );
  }
}

const sfx = new SoundFx();

const TARGET_CONTAINERS = 6;
const CONTAINER_WIDTH = 48;
const CONTAINER_HEIGHT = 22;
const PLATFORM_WIDTH = 96;
const PLATFORM_X = 240;
const PLATFORM_Y = 320;

const SINE_TABLE = [
  0, 20, 38, 56, 71, 83, 92, 98, 100, 98, 92, 83, 71, 56, 38, 20, 0, -20, -38, -56, -71, -83, -92,
  -98, -100, -98, -92, -83, -71, -56, -38, -20,
];

interface PlacedContainer {
  x: number;
  y: number;
  kindIndex: number;
  offsetFromTarget: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  colour: string;
}

const CONTAINER_KINDS = [
  { name: 'Standard Iron', border: EGA.white, fill: EGA.darkGrey, text: 'IRON' },
  { name: 'Heavy Caps', border: EGA.yellow, fill: EGA.brown, text: 'CAPS' },
  { name: 'Pressurised Fizz', border: EGA.lightCyan, fill: EGA.cyan, text: 'FIZZ' },
];

class MagnetMayhemSimulation {
  gantryX = PLATFORM_X;
  swingPhase = 0;
  swingAmplitude = 28;
  activeCargoX = PLATFORM_X;
  activeCargoY = 56;
  activeCargoVy = 0;
  isCargoFalling = false;
  activeCargoKind = 0;
  stackedContainers: PlacedContainer[] = [];
  stackWobble = 0;
  lastRating = '';
  ratingTimer = 0;
  score = 0;
  timeRemaining = 75 * 60; // 75 seconds
  isShiftCleared = false;
  isToppled = false;
  sparks: Spark[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.gantryX = PLATFORM_X;
    this.swingPhase = 0;
    this.swingAmplitude = 28;
    this.activeCargoX = PLATFORM_X;
    this.activeCargoY = 56;
    this.activeCargoVy = 0;
    this.isCargoFalling = false;
    this.activeCargoKind = 0;
    this.stackedContainers = [];
    this.stackWobble = 0;
    this.lastRating = '';
    this.ratingTimer = 0;
    this.score = 0;
    this.timeRemaining = 75 * 60;
    this.isShiftCleared = false;
    this.isToppled = false;
    this.sparks = [];
  }

  addSparks(x: number, y: number, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15 + Math.floor(Math.random() * 15),
        colour: Math.random() > 0.5 ? EGA.yellow : EGA.lightCyan,
      });
    }
  }

  tick(keys: { left: boolean; right: boolean; drop: boolean }) {
    if (this.isShiftCleared || this.isToppled) return;

    if (this.timeRemaining > 0) {
      this.timeRemaining--;
      if (this.timeRemaining === 0) {
        this.isToppled = true;
        sfx.playToppleCrash();
        return;
      }
    }

    if (this.ratingTimer > 0) {
      this.ratingTimer--;
    }

    // Update spark particles
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life--;
      if (sp.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }

    if (!this.isCargoFalling) {
      if (keys.left && this.gantryX > 80) {
        this.gantryX -= 3;
        sfx.playTrolleyMove();
      }
      if (keys.right && this.gantryX < 400) {
        this.gantryX += 3;
        sfx.playTrolleyMove();
      }

      this.swingPhase = (this.swingPhase + 1) % SINE_TABLE.length;
      const swingOffset = Math.round((SINE_TABLE[this.swingPhase] * this.swingAmplitude) / 100);
      this.activeCargoX = this.gantryX + swingOffset;
      this.activeCargoY = 56;

      // Electromagnetic idle sparks
      if (Math.random() < 0.25) {
        this.addSparks(this.activeCargoX, 48, 2);
      }

      if (keys.drop) {
        this.isCargoFalling = true;
        this.activeCargoVy = 2;
        this.addSparks(this.activeCargoX, 48, 16);
        sfx.playRelease();
      }
    } else {
      // Falling cargo
      this.activeCargoVy += 0.8;
      this.activeCargoY += this.activeCargoVy;

      const targetY =
        this.stackedContainers.length === 0
          ? PLATFORM_Y - CONTAINER_HEIGHT
          : this.stackedContainers[this.stackedContainers.length - 1].y - CONTAINER_HEIGHT;

      const targetX =
        this.stackedContainers.length === 0
          ? PLATFORM_X
          : this.stackedContainers[this.stackedContainers.length - 1].x;

      if (this.activeCargoY >= targetY) {
        this.activeCargoY = targetY;
        this.isCargoFalling = false;

        const offset = Math.abs(this.activeCargoX - targetX);
        const maxOffset = CONTAINER_WIDTH / 2;

        if (offset <= 4) {
          this.lastRating = 'PERFECT DROP!';
          this.score += 500;
          this.ratingTimer = 60;
          this.addSparks(this.activeCargoX, targetY + CONTAINER_HEIGHT, 24);
          sfx.playPerfectChime();
        } else if (offset <= 12) {
          this.lastRating = 'GOOD PLACEMENT';
          this.score += 250;
          this.stackWobble += 2;
          this.ratingTimer = 50;
          this.addSparks(this.activeCargoX, targetY + CONTAINER_HEIGHT, 14);
          sfx.playLandClank();
        } else if (offset <= maxOffset) {
          this.lastRating = 'WOBBLY!';
          this.score += 100;
          this.stackWobble += 5;
          this.ratingTimer = 40;
          this.addSparks(this.activeCargoX, targetY + CONTAINER_HEIGHT, 8);
          sfx.playLandClank();
        } else {
          this.lastRating = 'TOPPLED!';
          this.isToppled = true;
          this.addSparks(this.activeCargoX, targetY, 30);
          sfx.playToppleCrash();
          return;
        }

        this.stackedContainers.push({
          x: this.activeCargoX,
          y: targetY,
          kindIndex: this.activeCargoKind,
          offsetFromTarget: this.activeCargoX - targetX,
        });

        if (this.stackedContainers.length >= TARGET_CONTAINERS) {
          this.isShiftCleared = true;
          const timeBonus = Math.floor(this.timeRemaining / 60) * 15;
          this.score += timeBonus;
          sfx.playShiftCleared();
        } else {
          this.activeCargoKind = this.stackedContainers.length % CONTAINER_KINDS.length;
          this.swingAmplitude = Math.min(45, 24 + this.stackWobble * 3);
          this.activeCargoVy = 0;
        }
      }
    }
  }
}

const sim = new MagnetMayhemSimulation();
let isPaused = false;
let frameCount = 0;

const keysPressed = {
  left: false,
  right: false,
  drop: false,
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    e.preventDefault();
    keysPressed.left = true;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    e.preventDefault();
    keysPressed.right = true;
  } else if (e.key === ' ') {
    e.preventDefault();
    if (sim.isShiftCleared || sim.isToppled) {
      sim.reset();
    } else {
      keysPressed.drop = true;
    }
  } else if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    isPaused = !isPaused;
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    sim.reset();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    keysPressed.left = false;
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    keysPressed.right = false;
  } else if (e.key === ' ') {
    keysPressed.drop = false;
  }
});

function drawGantryCrane() {
  ctx.fillStyle = EGA.black;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Industrial warehouse backdrop grid
  ctx.strokeStyle = '#0e1218';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 24; y < canvas.height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Top header status bar
  ctx.fillStyle = EGA.brown;
  ctx.fillRect(0, 0, canvas.width, 24);
  ctx.fillStyle = EGA.yellow;
  ctx.font = 'bold 12px monospace';
  ctx.fillText('GANTRY 5 // CARGO QUOTA DOCK', 12, 16);

  const seconds = Math.ceil(sim.timeRemaining / 60);
  ctx.fillStyle = seconds <= 15 ? EGA.lightRed : EGA.white;
  ctx.fillText(`SHIFT: ${seconds.toString().padStart(2, '0')}s`, 250, 16);
  ctx.fillStyle = EGA.lightGreen;
  ctx.fillText(`STACK: ${sim.stackedContainers.length}/${TARGET_CONTAINERS}`, 340, 16);
  ctx.fillStyle = EGA.lightCyan;
  ctx.fillText(`SCORE: ${sim.score}`, 410, 16);

  // Overhead yellow/black hazard gantry beam
  ctx.fillStyle = EGA.darkGrey;
  ctx.fillRect(0, 24, canvas.width, 14);
  for (let x = 0; x < canvas.width; x += 16) {
    ctx.fillStyle = EGA.yellow;
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x + 8, 24);
    ctx.lineTo(x, 38);
    ctx.fill();
  }

  // Trolley carriage
  const trolleyWidth = 36;
  ctx.fillStyle = EGA.lightGrey;
  ctx.fillRect(sim.gantryX - trolleyWidth / 2, 28, trolleyWidth, 10);
  ctx.strokeStyle = EGA.white;
  ctx.strokeRect(sim.gantryX - trolleyWidth / 2, 28, trolleyWidth, 10);

  // Cable hanging from trolley to active cargo
  ctx.strokeStyle = EGA.darkGrey;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sim.gantryX, 38);
  ctx.lineTo(sim.activeCargoX, sim.activeCargoY);
  ctx.stroke();
  ctx.lineWidth = 1;

  // Electromagnet head
  const magnetWidth = 24;
  ctx.fillStyle = EGA.blue;
  ctx.fillRect(sim.activeCargoX - magnetWidth / 2, sim.activeCargoY - 8, magnetWidth, 8);
  ctx.strokeStyle = EGA.lightCyan;
  ctx.strokeRect(sim.activeCargoX - magnetWidth / 2, sim.activeCargoY - 8, magnetWidth, 8);

  // Active cargo container
  const activeKind = CONTAINER_KINDS[sim.activeCargoKind];
  ctx.fillStyle = activeKind.fill;
  ctx.fillRect(
    sim.activeCargoX - CONTAINER_WIDTH / 2,
    sim.activeCargoY,
    CONTAINER_WIDTH,
    CONTAINER_HEIGHT,
  );
  ctx.strokeStyle = activeKind.border;
  ctx.strokeRect(
    sim.activeCargoX - CONTAINER_WIDTH / 2,
    sim.activeCargoY,
    CONTAINER_WIDTH,
    CONTAINER_HEIGHT,
  );

  ctx.fillStyle = EGA.white;
  ctx.font = 'bold 9px monospace';
  ctx.fillText(activeKind.text, sim.activeCargoX - 12, sim.activeCargoY + 14);

  // Sparks
  for (const sp of sim.sparks) {
    ctx.fillStyle = sp.colour;
    ctx.fillRect(sp.x - 1, sp.y - 1, 3, 3);
  }

  // Base platform
  ctx.fillStyle = EGA.darkGrey;
  ctx.fillRect(PLATFORM_X - PLATFORM_WIDTH / 2, PLATFORM_Y, PLATFORM_WIDTH, 16);
  ctx.strokeStyle = EGA.yellow;
  ctx.lineWidth = 2;
  ctx.strokeRect(PLATFORM_X - PLATFORM_WIDTH / 2, PLATFORM_Y, PLATFORM_WIDTH, 16);
  ctx.lineWidth = 1;

  // Marked landing centre marker
  ctx.fillStyle = EGA.yellow;
  ctx.fillRect(PLATFORM_X - 1, PLATFORM_Y, 2, 8);

  // Stacked containers
  const sway =
    sim.stackWobble > 0
      ? Math.sin((frameCount * 0.1) % (Math.PI * 2)) * (sim.stackWobble * 0.4)
      : 0;

  for (let i = 0; i < sim.stackedContainers.length; i++) {
    const sc = sim.stackedContainers[i];
    const kind = CONTAINER_KINDS[sc.kindIndex];
    const containerSway = sway * (i + 1);

    ctx.fillStyle = kind.fill;
    ctx.fillRect(
      sc.x - CONTAINER_WIDTH / 2 + containerSway,
      sc.y,
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );
    ctx.strokeStyle = kind.border;
    ctx.strokeRect(
      sc.x - CONTAINER_WIDTH / 2 + containerSway,
      sc.y,
      CONTAINER_WIDTH,
      CONTAINER_HEIGHT,
    );

    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 9px monospace';
    ctx.fillText(kind.text, sc.x - 12 + containerSway, sc.y + 14);
  }

  // Floating Drop Rating Banner
  if (sim.ratingTimer > 0) {
    ctx.fillStyle = sim.lastRating.includes('PERFECT')
      ? EGA.lightGreen
      : sim.lastRating.includes('GOOD')
        ? EGA.yellow
        : EGA.lightRed;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(sim.lastRating, PLATFORM_X - 60, 120);
  }

  // Shift Win / Topple Overlays
  if (sim.isShiftCleared) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(40, 110, 400, 140);
    ctx.strokeStyle = EGA.lightGreen;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 110, 400, 140);
    ctx.lineWidth = 1;

    ctx.fillStyle = EGA.lightGreen;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('*** SHIFT CLEARED! ***', 120, 145);

    ctx.fillStyle = EGA.white;
    ctx.font = '12px monospace';
    ctx.fillText(`ALL ${TARGET_CONTAINERS} CARGO CRATES STACKED SAFELY!`, 95, 175);
    ctx.fillText(`TOTAL SCORE: ${sim.score}`, 165, 200);

    ctx.fillStyle = EGA.yellow;
    ctx.font = '11px monospace';
    ctx.fillText('PRESS [SPACE] OR [R] TO STACK NEXT SHIFT', 90, 230);
  } else if (sim.isToppled) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(40, 110, 400, 140);
    ctx.strokeStyle = EGA.lightRed;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 110, 400, 140);
    ctx.lineWidth = 1;

    ctx.fillStyle = EGA.lightRed;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('*** SHIPMENT TOPPLED! ***', 95, 145);

    ctx.fillStyle = EGA.white;
    ctx.font = '12px monospace';
    ctx.fillText('CRATES OVERBALANCED AND CRASHED.', 120, 175);
    ctx.fillText(
      `CRATES STACKED: ${sim.stackedContainers.length} / ${TARGET_CONTAINERS}`,
      150,
      200,
    );

    ctx.fillStyle = EGA.yellow;
    ctx.font = '11px monospace';
    ctx.fillText('PRESS [SPACE] OR [R] TO RETRY SHIFT', 115, 230);
  } else if (isPaused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(140, 140, 200, 60);
    ctx.strokeStyle = EGA.yellow;
    ctx.strokeRect(140, 140, 200, 60);

    ctx.fillStyle = EGA.yellow;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PAUSED', 210, 176);
  }

  // CRT Scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function gameLoop() {
  frameCount++;
  if (!isPaused) {
    sim.tick(keysPressed);
    // Auto-release drop key after one consumption tick
    keysPressed.drop = false;
  }
  drawGantryCrane();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
