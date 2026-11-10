// Fizz-Pong: Carbonation War — Retro Soda-Tank Paddle Arcade
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
  playPaddleHit() {
    playSafe(note('a4').sound('square').decay(0.08).gain(0.18));
  }

  playWallBounce() {
    playSafe(note('e3').sound('square').decay(0.06).gain(0.14));
  }

  playBubblePop() {
    playSafe(
      stack(
        sound('white').decay(0.04).gain(0.12).hpf(2200),
        note('c6').sound('sine').decay(0.05).gain(0.1),
      ),
    );
  }

  playScorePlayer() {
    playSafe(note('c5 e5 g5 c6').sound('square').fast(6).decay(0.1).gain(0.15));
  }

  playScoreCpu() {
    playSafe(note('f3 c3').sound('sawtooth').fast(3).decay(0.15).gain(0.16));
  }

  playMatchWin() {
    playSafe(note('g4 c5 e5 g5 c6').sound('triangle').fast(5).decay(0.16).gain(0.2));
  }
}
const sfx = new SoundFx();

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  trail: { x: number; y: number }[];
}

interface TankBubble {
  x: number;
  y: number;
  vy: number;
  radius: number;
  alpha: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  seed: number;
}

interface FizzBonusBubble {
  x: number;
  y: number;
  radius: number;
  pulse: number;
  active: boolean;
}

class FizzPongGame {
  private width = 320;
  private height = 480;

  // Paddles
  private playerX = 133;
  private playerWidth = 54;
  private playerHeight = 10;
  private playerSpeed = 5.2;

  private cpuX = 133;
  private cpuWidth = 54;
  private cpuHeight = 10;
  private cpuSpeed = 3.6;

  // Balls
  private ball: Ball = {
    x: 160,
    y: 440,
    vx: 1.5,
    vy: -4.5,
    radius: 4,
    active: true,
    trail: [],
  };
  private multiball: Ball | null = null;
  private fizzBubble: FizzBonusBubble = {
    x: 160,
    y: 240,
    radius: 12,
    pulse: 0,
    active: false,
  };

  // Environment
  private tankBubbles: TankBubble[] = [];
  private rallyCount = 0;
  private playerScore = 0;
  private cpuScore = 0;

  // State
  private state: 'attract' | 'serving' | 'playing' | 'point_scored' | 'game_over' | 'paused' =
    'attract';
  private pointMessage = '';
  private stateTimer = 0;
  private keys: Record<string, boolean> = {};

  constructor() {
    this.initTankBubbles();
    this.bindEvents();
    this.loop();
  }

  private initTankBubbles() {
    for (let i = 0; i < 35; i++) {
      this.tankBubbles.push({
        x: Math.random() * (this.width - 24) + 12,
        y: Math.random() * this.height,
        vy: 0.8 + Math.random() * 1.6,
        radius: 1.5 + Math.random() * 3.5,
        alpha: 0.25 + Math.random() * 0.5,
        wobbleSpeed: 0.03 + Math.random() * 0.05,
        wobbleAmp: 0.5 + Math.random() * 1.5,
        seed: Math.random() * Math.PI * 2,
      });
    }
  }

  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'KeyP') {
        if (this.state === 'playing') this.state = 'paused';
        else if (this.state === 'paused') this.state = 'playing';
      }

      if (e.code === 'Space') {
        if (this.state === 'attract') {
          this.state = 'serving';
          this.playerScore = 0;
          this.cpuScore = 0;
          this.rallyCount = 0;
          this.multiball = null;
          this.resetBall(true);
        } else if (this.state === 'serving') {
          this.serveBall();
        } else if (this.state === 'game_over') {
          this.state = 'attract';
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  private resetBall(toPlayer: boolean) {
    this.ball.trail = [];
    this.ball.active = true;
    if (toPlayer) {
      this.ball.x = this.playerX + this.playerWidth / 2;
      this.ball.y = this.height - 35;
      this.ball.vy = -4.5;
      this.ball.vx = (Math.random() - 0.5) * 2.5;
    } else {
      this.ball.x = this.cpuX + this.cpuWidth / 2;
      this.ball.y = 35;
      this.ball.vy = 4.5;
      this.ball.vx = (Math.random() - 0.5) * 2.5;
    }
  }

  private serveBall() {
    this.state = 'playing';
    this.ball.vy = -4.5;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.ball.vx = -2.2;
    else if (this.keys['ArrowRight'] || this.keys['KeyD']) this.ball.vx = 2.2;
    else this.ball.vx = 1.2;
    sfx.playPaddleHit();
  }

  private update() {
    // Always update ambient carbonation bubbles
    for (const b of this.tankBubbles) {
      b.y -= b.vy;
      b.seed += b.wobbleSpeed;
      b.x += Math.sin(b.seed) * b.wobbleAmp * 0.15;
      if (b.y < -10) {
        b.y = this.height + 10;
        b.x = Math.random() * (this.width - 24) + 12;
      }
    }

    if (this.state === 'attract') {
      // Gentle attract loop movement
      this.playerX = 133 + Math.sin(Date.now() * 0.002) * 50;
      this.cpuX = 133 + Math.cos(Date.now() * 0.002) * 50;
      return;
    }

    if (this.state === 'serving') {
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
        this.playerX = Math.max(12, this.playerX - this.playerSpeed);
      }
      if (this.keys['ArrowRight'] || this.keys['KeyD']) {
        this.playerX = Math.min(
          this.width - 12 - this.playerWidth,
          this.playerX + this.playerSpeed,
        );
      }
      this.ball.x = this.playerX + this.playerWidth / 2;
      this.ball.y = this.height - 32;
      return;
    }

    if (this.state === 'point_scored') {
      this.stateTimer--;
      if (this.stateTimer <= 0) {
        if (this.playerScore >= 7 || this.cpuScore >= 7) {
          this.state = 'game_over';
        } else {
          this.state = 'serving';
          this.multiball = null;
          this.fizzBubble.active = false;
          this.resetBall(true);
        }
      }
      return;
    }

    if (this.state === 'game_over' || this.state === 'paused') {
      return;
    }

    // Player control
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
      this.playerX = Math.max(12, this.playerX - this.playerSpeed);
    }
    if (this.keys['ArrowRight'] || this.keys['KeyD']) {
      this.playerX = Math.min(this.width - 12 - this.playerWidth, this.playerX + this.playerSpeed);
    }

    // CPU Drone control
    const cpuCentre = this.cpuX + this.cpuWidth / 2;
    const trackingTarget = this.multiball ? this.multiball.x : this.ball.x;
    if (trackingTarget < cpuCentre - 6) {
      this.cpuX = Math.max(12, this.cpuX - this.cpuSpeed);
    } else if (trackingTarget > cpuCentre + 6) {
      this.cpuX = Math.min(this.width - 12 - this.cpuWidth, this.cpuX + this.cpuSpeed);
    }

    // Update Fizz Bubble spawn
    if (this.rallyCount >= 5 && !this.fizzBubble.active && !this.multiball) {
      this.fizzBubble.active = true;
      this.fizzBubble.x = 80 + Math.random() * 160;
      this.fizzBubble.y = 160 + Math.random() * 160;
      sfx.playBubblePop();
    }
    if (this.fizzBubble.active) {
      this.fizzBubble.pulse += 0.08;
    }

    // Step primary ball
    this.updateBall(this.ball);

    // Step multiball if active
    if (this.multiball) {
      this.updateBall(this.multiball);
    }

    // Check goals for primary ball
    if (this.ball.y < 4) {
      this.playerScore++;
      sfx.playScorePlayer();
      this.pointMessage = 'POINT FOR BEN!';
      this.state = 'point_scored';
      this.stateTimer = 65;
    } else if (this.ball.y > this.height - 4) {
      this.cpuScore++;
      sfx.playScoreCpu();
      this.pointMessage = 'POINT FOR ZARG DRONE!';
      this.state = 'point_scored';
      this.stateTimer = 65;
    }
  }

  private updateBall(b: Ball) {
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > 6) b.trail.pop();

    // Carbonation current gently nudges ball horizontally
    const carbonationCurrent = Math.sin(b.y * 0.025 + Date.now() * 0.003) * 0.18;
    b.x += b.vx + carbonationCurrent;
    b.y += b.vy;

    // Side wall bounces
    const minX = 14 + b.radius;
    const maxX = this.width - 14 - b.radius;
    if (b.x <= minX) {
      b.x = minX;
      b.vx = Math.abs(b.vx);
      sfx.playWallBounce();
    } else if (b.x >= maxX) {
      b.x = maxX;
      b.vx = -Math.abs(b.vx);
      sfx.playWallBounce();
    }

    // Player paddle bounce (bottom)
    const playerTop = this.height - 24;
    const playerBot = this.height - 14;
    if (
      b.vy > 0 &&
      b.y + b.radius >= playerTop &&
      b.y - b.radius <= playerBot &&
      b.x >= this.playerX - 2 &&
      b.x <= this.playerX + this.playerWidth + 2
    ) {
      b.y = playerTop - b.radius;
      const offset = (b.x - (this.playerX + this.playerWidth / 2)) / (this.playerWidth / 2);
      b.vx = offset * 3.8;
      b.vy = -Math.max(4.2, Math.abs(b.vy) * 1.02);
      this.rallyCount++;
      sfx.playPaddleHit();
    }

    // CPU paddle bounce (top)
    const cpuTop = 14;
    const cpuBot = 24;
    if (
      b.vy < 0 &&
      b.y - b.radius <= cpuBot &&
      b.y + b.radius >= cpuTop &&
      b.x >= this.cpuX - 2 &&
      b.x <= this.cpuX + this.cpuWidth + 2
    ) {
      b.y = cpuBot + b.radius;
      const offset = (b.x - (this.cpuX + this.cpuWidth / 2)) / (this.cpuWidth / 2);
      b.vx = offset * 3.6;
      b.vy = Math.max(4.2, Math.abs(b.vy) * 1.02);
      this.rallyCount++;
      sfx.playPaddleHit();
    }

    // Fizz Bubble hit check
    if (this.fizzBubble.active) {
      const dx = b.x - this.fizzBubble.x;
      const dy = b.y - this.fizzBubble.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < b.radius + this.fizzBubble.radius) {
        this.fizzBubble.active = false;
        sfx.playBubblePop();
        // Spawn multiball or speed boost
        if (!this.multiball) {
          this.multiball = {
            x: this.fizzBubble.x,
            y: this.fizzBubble.y,
            vx: -b.vx * 1.2,
            vy: -b.vy,
            radius: 4,
            active: true,
            trail: [],
          };
        } else {
          b.vx *= 1.25;
          b.vy *= 1.25;
        }
      }
    }
  }

  private draw() {
    // 1. Fluid Tank Background (Dark green / cyan dither)
    ctx.fillStyle = '#06130b';
    ctx.fillRect(0, 0, this.width, this.height);

    // Tank side glass borders
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(0, 0, 10, this.height);
    ctx.fillRect(this.width - 10, 0, 10, this.height);

    ctx.fillStyle = EGA.green;
    ctx.fillRect(10, 0, 2, this.height);
    ctx.fillRect(this.width - 12, 0, 2, this.height);

    // Measurement marks on tank sides
    for (let y = 30; y < this.height - 30; y += 30) {
      ctx.fillStyle = EGA.lightGreen;
      ctx.fillRect(4, y, 6, 2);
      ctx.fillRect(this.width - 10, y, 6, 2);
    }

    // 2. Rising carbonation bubbles
    for (const b of this.tankBubbles) {
      ctx.strokeStyle = EGA.lightCyan;
      ctx.fillStyle = EGA.lightGreen;
      ctx.globalAlpha = b.alpha;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Centre court line (carbonated net)
    ctx.strokeStyle = EGA.darkGrey;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(12, this.height / 2);
    ctx.lineTo(this.width - 12, this.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Fizz Bubble bonus
    if (this.fizzBubble.active) {
      const r = this.fizzBubble.radius + Math.sin(this.fizzBubble.pulse) * 2;
      ctx.fillStyle = EGA.lightMagenta;
      ctx.beginPath();
      ctx.arc(this.fizzBubble.x, this.fizzBubble.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = EGA.yellow;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = EGA.white;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FIZZ', this.fizzBubble.x, this.fizzBubble.y + 3);
    }

    // 4. Ball trails & balls
    this.drawBall(this.ball, EGA.lightCyan);
    if (this.multiball) {
      this.drawBall(this.multiball, EGA.yellow);
    }

    // 5. Paddles
    // CPU Drone Paddle (Top, Red / Brown)
    ctx.fillStyle = EGA.red;
    ctx.fillRect(this.cpuX, 14, this.cpuWidth, this.cpuHeight);
    ctx.fillStyle = EGA.lightRed;
    ctx.fillRect(this.cpuX + 2, 14, this.cpuWidth - 4, 2);
    ctx.fillStyle = EGA.black;
    ctx.fillRect(this.cpuX + this.cpuWidth / 2 - 4, 16, 8, 4);

    // Player Paddle (Bottom, Light Green / Cyan)
    ctx.fillStyle = EGA.green;
    ctx.fillRect(this.playerX, this.height - 24, this.playerWidth, this.playerHeight);
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillRect(this.playerX + 2, this.height - 24, this.playerWidth - 4, 2);
    ctx.fillStyle = EGA.yellow;
    ctx.fillRect(this.playerX + this.playerWidth / 2 - 4, this.height - 20, 8, 4);

    // 6. HUD: Scores & Rally
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = EGA.lightRed;
    ctx.fillText(`${this.cpuScore}`, 40, this.height / 2 - 16);
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillText(`${this.playerScore}`, 40, this.height / 2 + 30);

    ctx.font = '10px monospace';
    ctx.fillStyle = EGA.yellow;
    ctx.fillText(`RALLY: ${this.rallyCount}`, this.width / 2, this.height / 2 - 10);

    // 7. Overlay screens
    if (this.state === 'attract') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(20, 140, this.width - 40, 200);

      ctx.strokeStyle = EGA.lightGreen;
      ctx.strokeRect(20, 140, this.width - 40, 200);

      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('FIZZ-PONG', this.width / 2, 175);

      ctx.fillStyle = EGA.lightCyan;
      ctx.font = '10px monospace';
      ctx.fillText('CARBONATION WAR', this.width / 2, 195);
      ctx.fillText('First to 7 Points Wins!', this.width / 2, 220);

      ctx.fillStyle = EGA.white;
      ctx.font = 'bold 12px monospace';
      ctx.fillText('PRESS SPACE TO SERVE', this.width / 2, 270);

      ctx.fillStyle = EGA.lightGreen;
      ctx.font = '9px monospace';
      ctx.fillText('◄ / ► : Move Paddle', this.width / 2, 305);
      ctx.fillText('Edge hits apply spin', this.width / 2, 320);
    } else if (this.state === 'point_scored') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(30, 200, this.width - 60, 60);
      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 14px monospace';
      ctx.fillText(this.pointMessage, this.width / 2, 235);
    } else if (this.state === 'game_over') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(20, 160, this.width - 40, 140);
      ctx.strokeStyle = EGA.yellow;
      ctx.strokeRect(20, 160, this.width - 40, 140);

      const won = this.playerScore >= 7;
      ctx.fillStyle = won ? EGA.lightGreen : EGA.lightRed;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(won ? 'VICTORY!' : 'DEFEATED!', this.width / 2, 205);

      ctx.fillStyle = EGA.white;
      ctx.font = '12px monospace';
      ctx.fillText(won ? 'Planet Zargoth Defended' : 'Reactor Pressure Lost', this.width / 2, 235);
      ctx.fillText('PRESS SPACE TO REPLAY', this.width / 2, 275);
    } else if (this.state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(60, 210, this.width - 120, 50);
      ctx.fillStyle = EGA.yellow;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('PAUSED', this.width / 2, 240);
    }
  }

  private drawBall(b: Ball, colour: string) {
    // Draw trail
    for (let i = 0; i < b.trail.length; i++) {
      ctx.fillStyle = colour;
      ctx.globalAlpha = (1 - i / b.trail.length) * 0.35;
      ctx.beginPath();
      ctx.arc(b.trail[i].x, b.trail[i].y, b.radius * (1 - i * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw main ball
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = EGA.white;
    ctx.beginPath();
    ctx.arc(b.x - 1, b.y - 1, b.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private loop = () => {
    this.update();
    this.draw();
    requestAnimationFrame(this.loop);
  };
}

new FizzPongGame();
