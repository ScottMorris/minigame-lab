// Fizz Invaders — Space Invaders on Planet Zargoth
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
  playShoot() {
    playSafe(note('a5').sound('square').slide(0.06).decay(0.08).gain(0.12));
  }

  playInvaderHit() {
    playSafe(
      stack(
        sound('white').decay(0.08).gain(0.15).lpf(1200),
        note('d3').sound('sawtooth').decay(0.1).gain(0.15),
      ),
    );
  }

  playPlayerHit() {
    playSafe(
      stack(
        sound('brown').decay(0.35).gain(0.25).lpf(400),
        note('g1').sound('sawtooth').decay(0.3).gain(0.2),
      ),
    );
  }

  playMystery() {
    playSafe(note('b4 d5').sound('sine').fast(4).decay(0.1).gain(0.1));
  }
}
const sfx = new SoundFx();

interface Invader {
  x: number;
  y: number;
  row: number; // 0=Saucer, 1-2=Squid, 3-4=Crab
  alive: boolean;
  animFrame: number;
}

interface Projectile {
  x: number;
  y: number;
  vy: number;
  isPlayer: boolean;
  colour: string;
}

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

interface Bunker {
  x: number;
  y: number;
  grid: boolean[][]; // 16x12 pixel chunks
}

class FizzInvadersGame {
  private playerX = 400;
  private playerSpeed = 5;
  private playerLives = 3;
  private invaders: Invader[] = [];
  private projectiles: Projectile[] = [];
  private particles: Particle[] = [];
  private bunkers: Bunker[] = [];

  private invaderDir = 1;
  private invaderStepTimer = 0;
  private invaderStepInterval = 40;
  private invaderAnimState = 0;

  private mysterySaucer: { x: number; y: number; active: boolean; dir: number } = {
    x: -60,
    y: 55,
    active: false,
    dir: 1,
  };
  private mysteryTimer = 0;

  public score = 0;
  public highScore = 0;
  public wave = 1;
  public gameOver = false;
  public paused = false;
  private keys: Record<string, boolean> = {};

  // Starfield
  private stars: { x: number; y: number; speed: number; colour: string }[] = [];

  constructor() {
    this.highScore = Number(localStorage.getItem('minigame_fizz_invaders_hi') || '0');
    this.initStars();
    this.reset();
  }

  private initStars() {
    this.stars = [];
    const starColours = [EGA.darkGrey, EGA.lightBlue, EGA.cyan, EGA.white, EGA.yellow];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: Math.random() * 0.4 + 0.1,
        colour: starColours[Math.floor(Math.random() * starColours.length)],
      });
    }
  }

  reset() {
    this.playerX = 400;
    this.playerLives = 3;
    this.score = 0;
    this.wave = 1;
    this.gameOver = false;
    this.paused = false;
    this.projectiles = [];
    this.particles = [];
    this.initBunkers();
    this.spawnWave();
  }

  private initBunkers() {
    this.bunkers = [];
    const bunkerX = [120, 280, 440, 600];
    for (const bx of bunkerX) {
      const grid: boolean[][] = [];
      for (let r = 0; r < 12; r++) {
        grid.push([]);
        for (let c = 0; c < 16; c++) {
          // Arch notch in bottom middle
          if (r >= 8 && c >= 5 && c <= 10) {
            grid[r].push(false);
          } else {
            grid[r].push(true);
          }
        }
      }
      this.bunkers.push({ x: bx, y: 440, grid });
    }
  }

  private spawnWave() {
    this.invaders = [];
    this.invaderStepInterval = Math.max(12, 42 - (this.wave - 1) * 4);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 10; c++) {
        this.invaders.push({
          x: 140 + c * 52,
          y: 100 + r * 40,
          row: r,
          alive: true,
          animFrame: 0,
        });
      }
    }
    this.invaderDir = 1;
    this.mysterySaucer.active = false;
    this.mysteryTimer = 0;
  }

  public setKey(key: string, pressed: boolean) {
    this.keys[key] = pressed;
    if (pressed && (key === 'p' || key === 'P')) {
      this.paused = !this.paused;
    }
    if (pressed && key === ' ' && this.gameOver) {
      this.reset();
    }
  }

  private firePlayerBubble() {
    if (this.gameOver || this.paused) return;
    // Limit player active projectiles to 2
    const activePlayerShots = this.projectiles.filter((p) => p.isPlayer).length;
    if (activePlayerShots >= 2) return;

    this.projectiles.push({
      x: this.playerX + 16,
      y: 532,
      vy: -9,
      isPlayer: true,
      colour: EGA.lightCyan,
    });
    sfx.playShoot();
  }

  public update() {
    if (this.paused || this.gameOver) return;

    // Move stars
    for (const s of this.stars) {
      s.y += s.speed;
      if (s.y > canvas.height) s.y = 0;
    }

    // Player Movement
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.playerX = Math.max(30, this.playerX - this.playerSpeed);
    }
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.playerX = Math.min(canvas.width - 62, this.playerX + this.playerSpeed);
    }
    if (this.keys[' ']) {
      this.firePlayerBubble();
      this.keys[' '] = false; // fire once per keydown
    }

    // Mystery Saucer logic
    this.mysteryTimer++;
    if (this.mysteryTimer > 600 && !this.mysterySaucer.active) {
      this.mysterySaucer.active = true;
      this.mysterySaucer.dir = Math.random() > 0.5 ? 1 : -1;
      this.mysterySaucer.x = this.mysterySaucer.dir === 1 ? -50 : canvas.width + 50;
      this.mysteryTimer = 0;
    }
    if (this.mysterySaucer.active) {
      this.mysterySaucer.x += this.mysterySaucer.dir * 3.5;
      if (Math.random() < 0.05) sfx.playMystery();
      if (this.mysterySaucer.x < -60 || this.mysterySaucer.x > canvas.width + 60) {
        this.mysterySaucer.active = false;
      }
    }

    // Invader March & Descent
    this.invaderStepTimer++;
    if (this.invaderStepTimer >= this.invaderStepInterval) {
      this.invaderStepTimer = 0;
      this.invaderAnimState = 1 - this.invaderAnimState;

      // Check if army needs to reverse and descend
      let needDrop = false;
      for (const inv of this.invaders) {
        if (!inv.alive) continue;
        if (
          (this.invaderDir === 1 && inv.x >= canvas.width - 80) ||
          (this.invaderDir === -1 && inv.x <= 40)
        ) {
          needDrop = true;
          break;
        }
      }

      if (needDrop) {
        this.invaderDir *= -1;
        for (const inv of this.invaders) {
          inv.y += 18;
          if (inv.alive && inv.y >= 490) {
            // Invaders invaded!
            this.gameOver = true;
            sfx.playPlayerHit();
          }
        }
      } else {
        for (const inv of this.invaders) {
          inv.x += this.invaderDir * 12;
        }
      }

      // Random alien bomb fire
      const livingInvaders = this.invaders.filter((i) => i.alive);
      if (livingInvaders.length > 0 && Math.random() < 0.45) {
        const shooter = livingInvaders[Math.floor(Math.random() * livingInvaders.length)];
        this.projectiles.push({
          x: shooter.x + 16,
          y: shooter.y + 24,
          vy: 4.5,
          isPlayer: false,
          colour: EGA.lightGreen,
        });
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.y += p.vy;

      // Spawn effervescent bubble particle
      if (p.isPlayer && Math.random() < 0.4) {
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 4,
          y: p.y + 8,
          vx: (Math.random() - 0.5) * 0.8,
          vy: Math.random() * 0.8,
          colour: EGA.white,
          life: 10,
          maxLife: 10,
          size: 2,
        });
      }

      // Out of bounds
      if (p.y < 20 || p.y > canvas.height - 20) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Bunker Collision
      let hitBunker = false;
      for (const b of this.bunkers) {
        const bx = Math.floor((p.x - b.x) / 4);
        const by = Math.floor((p.y - b.y) / 4);
        if (bx >= 0 && bx < 16 && by >= 0 && by < 12) {
          if (b.grid[by][bx]) {
            // Chip bunker
            b.grid[by][bx] = false;
            if (by > 0) b.grid[by - 1][bx] = false;
            if (bx > 0) b.grid[by][bx - 1] = false;
            if (bx < 15) b.grid[by][bx + 1] = false;
            hitBunker = true;
            this.spawnExplosion(p.x, p.y, EGA.brown, 6);
            break;
          }
        }
      }
      if (hitBunker) {
        this.projectiles.splice(i, 1);
        continue;
      }

      // Player projectile hitting Invaders
      if (p.isPlayer) {
        let hit = false;

        // Mystery Saucer hit
        if (this.mysterySaucer.active) {
          if (
            p.x >= this.mysterySaucer.x &&
            p.x <= this.mysterySaucer.x + 44 &&
            p.y >= this.mysterySaucer.y &&
            p.y <= this.mysterySaucer.y + 24
          ) {
            this.mysterySaucer.active = false;
            const pts = 300;
            this.score += pts;
            this.spawnExplosion(p.x, p.y, EGA.lightMagenta, 24);
            sfx.playInvaderHit();
            hit = true;
          }
        }

        if (!hit) {
          for (const inv of this.invaders) {
            if (!inv.alive) continue;
            if (p.x >= inv.x && p.x <= inv.x + 36 && p.y >= inv.y && p.y <= inv.y + 28) {
              inv.alive = false;
              hit = true;
              const points = [40, 20, 20, 10, 10][inv.row];
              this.score += points;
              this.spawnExplosion(
                inv.x + 18,
                inv.y + 14,
                [EGA.lightMagenta, EGA.lightGreen, EGA.yellow][Math.floor(inv.row / 2)],
                16,
              );
              sfx.playInvaderHit();

              // Speed up march as army thins
              const remaining = this.invaders.filter((invader) => invader.alive).length;
              this.invaderStepInterval = Math.max(6, Math.floor(remaining * 0.75) + 6);
              break;
            }
          }
        }

        if (hit) {
          this.projectiles.splice(i, 1);
          if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('minigame_fizz_invaders_hi', String(this.highScore));
          }

          // Check if wave cleared
          if (this.invaders.every((invader) => !invader.alive)) {
            this.wave++;
            this.spawnWave();
          }
          continue;
        }
      } else {
        // Alien bomb hitting Player
        if (p.x >= this.playerX && p.x <= this.playerX + 36 && p.y >= 540 && p.y <= 568) {
          this.projectiles.splice(i, 1);
          this.spawnExplosion(this.playerX + 18, 550, EGA.lightRed, 30);
          sfx.playPlayerHit();
          this.playerLives--;
          if (this.playerLives <= 0) {
            this.gameOver = true;
          }
          continue;
        }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private spawnExplosion(x: number, y: number, colour: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        colour,
        life: 18,
        maxLife: 18,
        size: Math.random() * 3 + 2,
      });
    }
  }

  public draw() {
    // Clear screen (deep space)
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Starfield
    for (const s of this.stars) {
      ctx.fillStyle = s.colour;
      ctx.fillRect(s.x, s.y, 2, 2);
    }

    // Draw Destructible Chocolate Bunkers
    for (const b of this.bunkers) {
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 16; c++) {
          if (b.grid[r][c]) {
            ctx.fillStyle = (r + c) % 2 === 0 ? EGA.brown : '#7a3e00';
            ctx.fillRect(b.x + c * 4, b.y + r * 4, 4, 4);
          }
        }
      }
    }

    // Draw Mystery Saucer
    if (this.mysterySaucer.active) {
      this.drawMysterySaucer(this.mysterySaucer.x, this.mysterySaucer.y);
    }

    // Draw Invaders
    for (const inv of this.invaders) {
      if (inv.alive) {
        this.drawInvader(inv.x, inv.y, inv.row, this.invaderAnimState);
      }
    }

    // Draw Projectiles
    for (const p of this.projectiles) {
      if (p.isPlayer) {
        // Fizzy bubble
        ctx.fillStyle = EGA.lightCyan;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = EGA.white;
        ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
      } else {
        // Green acid plasma
        ctx.fillStyle = EGA.lightGreen;
        ctx.fillRect(p.x - 2, p.y - 4, 4, 8);
        ctx.fillStyle = EGA.yellow;
        ctx.fillRect(p.x - 1, p.y - 2, 2, 4);
      }
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    // Draw Player Fizz Rover
    if (!this.gameOver || this.playerLives > 0) {
      this.drawPlayer(this.playerX, 540);
    }

    // Ground line
    ctx.fillStyle = EGA.green;
    ctx.fillRect(0, 580, canvas.width, 3);

    // Draw HUD Header
    this.drawHUD();

    // Overlays
    if (this.paused) {
      this.drawOverlay('PAUSED', 'PRESS P TO RESUME', EGA.yellow);
    } else if (this.gameOver) {
      this.drawOverlay('GAME OVER', 'PRESS SPACE TO PLAY AGAIN', EGA.lightRed);
    }
  }

  private drawPlayer(x: number, y: number) {
    // Treads
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(x, y + 18, 36, 8);
    ctx.fillStyle = EGA.lightGrey;
    ctx.fillRect(x + 4, y + 20, 4, 4);
    ctx.fillRect(x + 16, y + 20, 4, 4);
    ctx.fillRect(x + 28, y + 20, 4, 4);

    // Hull (Red)
    ctx.fillStyle = EGA.red;
    ctx.fillRect(x + 4, y + 10, 28, 10);
    ctx.fillStyle = EGA.lightRed;
    ctx.fillRect(x + 6, y + 10, 24, 3);

    // Ben Helmet
    ctx.fillStyle = EGA.green;
    ctx.fillRect(x + 10, y + 2, 16, 10);
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillRect(x + 12, y + 2, 12, 4);

    // Face / Visor
    ctx.fillStyle = EGA.white;
    ctx.fillRect(x + 12, y + 6, 12, 4);
    ctx.fillStyle = EGA.blue;
    ctx.fillRect(x + 14, y + 7, 3, 3);
    ctx.fillRect(x + 19, y + 7, 3, 3);

    // Cannon Turret
    ctx.fillStyle = EGA.cyan;
    ctx.fillRect(x + 16, y - 4, 4, 8);
  }

  private drawInvader(x: number, y: number, row: number, frame: number) {
    if (row === 0) {
      // Zarg Saucer (Top Row)
      ctx.fillStyle = EGA.magenta;
      ctx.fillRect(x + 6, y + 4, 24, 10);
      ctx.fillStyle = EGA.lightMagenta;
      ctx.fillRect(x + 10, y + 2, 16, 4);
      // Animated lights
      ctx.fillStyle = frame === 0 ? EGA.yellow : EGA.lightCyan;
      ctx.fillRect(x + 8, y + 8, 4, 3);
      ctx.fillRect(x + 16, y + 8, 4, 3);
      ctx.fillRect(x + 24, y + 8, 4, 3);
      // Bottom legs
      ctx.fillStyle = EGA.white;
      if (frame === 0) {
        ctx.fillRect(x + 4, y + 14, 4, 4);
        ctx.fillRect(x + 28, y + 14, 4, 4);
      } else {
        ctx.fillRect(x + 8, y + 14, 4, 4);
        ctx.fillRect(x + 24, y + 14, 4, 4);
      }
    } else if (row === 1 || row === 2) {
      // Gloop Squid (Middle Rows)
      ctx.fillStyle = EGA.lightGreen;
      ctx.fillRect(x + 8, y + 2, 20, 12);
      ctx.fillStyle = EGA.green;
      ctx.fillRect(x + 10, y + 4, 16, 8);
      // Eyes
      ctx.fillStyle = EGA.yellow;
      ctx.fillRect(x + 11, y + 6, 4, 4);
      ctx.fillRect(x + 21, y + 6, 4, 4);
      ctx.fillStyle = EGA.black;
      ctx.fillRect(x + 13, y + 7, 2, 2);
      ctx.fillRect(x + 23, y + 7, 2, 2);
      // Animated tentacles
      ctx.fillStyle = EGA.lightGreen;
      if (frame === 0) {
        ctx.fillRect(x + 6, y + 14, 4, 8);
        ctx.fillRect(x + 16, y + 14, 4, 6);
        ctx.fillRect(x + 26, y + 14, 4, 8);
      } else {
        ctx.fillRect(x + 8, y + 14, 4, 6);
        ctx.fillRect(x + 16, y + 14, 4, 8);
        ctx.fillRect(x + 24, y + 14, 4, 6);
      }
    } else {
      // Cocoa Crab (Bottom Rows)
      ctx.fillStyle = EGA.brown;
      ctx.fillRect(x + 6, y + 6, 24, 10);
      ctx.fillStyle = EGA.yellow;
      ctx.fillRect(x + 10, y + 6, 16, 4);
      // Eyes
      ctx.fillStyle = EGA.white;
      ctx.fillRect(x + 10, y + 2, 4, 4);
      ctx.fillRect(x + 22, y + 2, 4, 4);
      ctx.fillStyle = EGA.red;
      ctx.fillRect(x + 12, y + 3, 2, 2);
      ctx.fillRect(x + 24, y + 3, 2, 2);
      // Claws
      ctx.fillStyle = EGA.brown;
      if (frame === 0) {
        ctx.fillRect(x + 2, y + 2, 4, 8);
        ctx.fillRect(x + 30, y + 2, 4, 8);
      } else {
        ctx.fillRect(x + 4, y + 8, 4, 8);
        ctx.fillRect(x + 28, y + 8, 4, 8);
      }
    }
  }

  private drawMysterySaucer(x: number, y: number) {
    ctx.fillStyle = EGA.lightRed;
    ctx.fillRect(x + 8, y + 4, 32, 10);
    ctx.fillStyle = EGA.yellow;
    ctx.fillRect(x + 14, y, 20, 6);
    ctx.fillStyle = EGA.white;
    ctx.fillRect(x + 18, y + 2, 12, 2);
    // Exhaust particles
    ctx.fillStyle = EGA.cyan;
    ctx.fillRect(x - 4, y + 8, 6, 3);
  }

  private drawHUD() {
    ctx.fillStyle = EGA.yellow;
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${this.score}`, 40, 32);

    ctx.fillStyle = EGA.lightCyan;
    ctx.textAlign = 'center';
    ctx.fillText(`HI-SCORE: ${this.highScore}`, canvas.width / 2, 32);

    ctx.fillStyle = EGA.lightGreen;
    ctx.textAlign = 'right';
    ctx.fillText(`WAVE: ${this.wave}`, canvas.width - 40, 32);

    // Lives icons
    for (let i = 0; i < this.playerLives; i++) {
      this.drawMiniHelmet(50 + i * 28, 588);
    }
    ctx.fillStyle = EGA.lightGrey;
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LIVES:', 8, 597);
  }

  private drawMiniHelmet(x: number, y: number) {
    ctx.fillStyle = EGA.green;
    ctx.fillRect(x, y, 16, 8);
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillRect(x + 2, y, 12, 3);
    ctx.fillStyle = EGA.white;
    ctx.fillRect(x + 2, y + 4, 12, 3);
  }

  private drawOverlay(title: string, sub: string, colour: string) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colour;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 25);
  }
}

const game = new FizzInvadersGame();

window.addEventListener('keydown', (e) => {
  game.setKey(e.key, true);
  if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  game.setKey(e.key, false);
});

function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
