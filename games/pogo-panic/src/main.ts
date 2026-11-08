// Pogo Panic — Vertical Ascent Arcade Platformer
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
  playBounce() {
    playSafe(note('c3').sound('triangle').slide(0.08).decay(0.12).gain(0.2));
  }

  playSuperSpring() {
    playSafe(note('a4').sound('sine').slide(0.18).decay(0.25).gain(0.25));
  }

  playCrumble() {
    playSafe(
      stack(
        note('e2').sound('sawtooth').decay(0.1).gain(0.2),
        sound('brown').decay(0.08).gain(0.2).lpf(600),
      ),
    );
  }

  playSquash() {
    playSafe(note('c5 g5').sound('square').fast(2).decay(0.09).gain(0.2));
  }

  playFall() {
    playSafe(note('e4').sound('sawtooth').slide(0.4).decay(0.5).gain(0.25));
  }
}

const sfx = new SoundFx();

enum PlatformType {
  Standard,
  Crumbly,
  Moving,
  SuperSpring,
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  type: PlatformType;
  vx: number;
  crumblyBroken: boolean;
  hasSpring: boolean;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  animTimer: number;
  alive: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  colour: string;
  life: number;
  size: number;
}

class PogoPanicGame {
  // Player
  private px = 250;
  private py = 550;
  private pvx = 0;
  private pvy = 0;
  private facing = 1;
  private springCompression = 0; // 0 to 1

  // Camera & World
  private cameraY = 0;
  private altitude = 0;
  private highestAltitude = 0;
  public highScore = 0;
  public gameOver = false;
  public paused = false;

  private platforms: Platform[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private stars: { x: number; y: number; colour: string }[] = [];

  private keys: Record<string, boolean> = {};

  constructor() {
    this.highScore = Number(localStorage.getItem('minigame_pogo_panic_hi') || '0');
    this.initStars();
    this.reset();
  }

  private initStars() {
    this.stars = [];
    const colours = [EGA.darkGrey, EGA.green, EGA.lightGreen, EGA.lightCyan, EGA.white];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        colour: colours[Math.floor(Math.random() * colours.length)],
      });
    }
  }

  public reset() {
    this.px = 250;
    this.py = 550;
    this.pvx = 0;
    this.pvy = -14;
    this.cameraY = 0;
    this.altitude = 0;
    this.highestAltitude = 0;
    this.gameOver = false;
    this.particles = [];
    this.enemies = [];

    // Generate Initial Platforms
    this.platforms = [
      {
        x: 180,
        y: 620,
        w: 140,
        h: 16,
        type: PlatformType.Standard,
        vx: 0,
        crumblyBroken: false,
        hasSpring: false,
      },
    ];

    let currentY = 520;
    while (currentY > -1000) {
      this.spawnPlatformAt(currentY);
      currentY -= Math.floor(Math.random() * 45 + 55);
    }
  }

  private spawnPlatformAt(y: number) {
    const w = 85;
    const x = Math.random() * (canvas.width - w - 40) + 20;
    const rand = Math.random();

    let type = PlatformType.Standard;
    let vx = 0;
    let hasSpring = false;

    if (rand < 0.25) {
      type = PlatformType.Crumbly;
    } else if (rand < 0.5) {
      type = PlatformType.Moving;
      vx = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5);
    } else if (rand < 0.65) {
      type = PlatformType.SuperSpring;
      hasSpring = true;
    }

    this.platforms.push({
      x,
      y,
      w,
      h: 16,
      type,
      vx,
      crumblyBroken: false,
      hasSpring,
    });

    // Occasional Crystal Bat enemy above altitude 500
    if (this.altitude > 400 && Math.random() < 0.18) {
      this.enemies.push({
        x: Math.random() * (canvas.width - 60) + 30,
        y: y - 50,
        vx: (Math.random() > 0.5 ? 1 : -1) * 2,
        animTimer: 0,
        alive: true,
      });
    }
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

  public update() {
    if (this.paused || this.gameOver) return;

    // Horizontal Movement & Inertia
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.pvx = Math.max(-6, this.pvx - 0.7);
      this.facing = -1;
    } else if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.pvx = Math.min(6, this.pvx + 0.7);
      this.facing = 1;
    } else {
      this.pvx *= 0.88;
    }

    this.px += this.pvx;

    // Horizontal Screen Wrap
    if (this.px < -20) {
      this.px = canvas.width + 10;
    } else if (this.px > canvas.width + 20) {
      this.px = -10;
    }

    // Gravity & Vertical Motion
    this.pvy += 0.45;
    this.py += this.pvy;

    // Spring decompression animation
    if (this.springCompression > 0) {
      this.springCompression = Math.max(0, this.springCompression - 0.12);
    }

    // Platform Collisions (only when falling downwards)
    if (this.pvy > 0) {
      const pFootX = this.px;
      const pFootY = this.py + 26;

      for (const plat of this.platforms) {
        if (plat.crumblyBroken) continue;

        if (
          pFootX >= plat.x - 10 &&
          pFootX <= plat.x + plat.w + 10 &&
          pFootY >= plat.y &&
          pFootY <= plat.y + 14 &&
          this.py + 10 < plat.y
        ) {
          // Landed on platform!
          this.springCompression = 1;

          if (plat.type === PlatformType.Crumbly) {
            plat.crumblyBroken = true;
            this.pvy = -14;
            sfx.playCrumble();
            this.spawnCrumbleParticles(plat.x + plat.w / 2, plat.y);
          } else if (plat.hasSpring) {
            this.pvy = -22; // Super rocket bounce!
            sfx.playSuperSpring();
            this.spawnSparkleParticles(this.px, this.py + 20, EGA.yellow, 16);
          } else {
            this.pvy = -14.5; // Standard high bounce
            sfx.playBounce();
            this.spawnSparkleParticles(this.px, this.py + 20, EGA.lightGreen, 8);
          }
          break;
        }
      }
    }

    // Moving Platform horizontal patrol
    for (const plat of this.platforms) {
      if (plat.type === PlatformType.Moving) {
        plat.x += plat.vx;
        if (plat.x < 15 || plat.x + plat.w > canvas.width - 15) {
          plat.vx *= -1;
        }
      }
    }

    // Enemy movement & collisions
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.animTimer++;
      e.x += e.vx;
      if (e.x < 20 || e.x > canvas.width - 20) {
        e.vx *= -1;
      }

      // Check collision with player
      const dx = this.px - e.x;
      const dy = this.py - e.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 26) {
        if (this.pvy > 0 && this.py < e.y) {
          // Squashed bat from above!
          e.alive = false;
          this.pvy = -16;
          sfx.playSquash();
          this.highestAltitude += 50;
          this.spawnSparkleParticles(e.x, e.y, EGA.magenta, 18);
        } else {
          // Struck by bat!
          this.pvy = 8;
          sfx.playFall();
        }
      }
    }

    // Camera follow (scrolls up when Ben climbs past mid-screen)
    const targetCamY = canvas.height * 0.45 - this.py;
    if (targetCamY > this.cameraY) {
      const diff = targetCamY - this.cameraY;
      this.cameraY += diff;
      this.altitude = Math.floor(this.cameraY);
      if (this.altitude > this.highestAltitude) {
        this.highestAltitude = this.altitude;
        if (this.highestAltitude > this.highScore) {
          this.highScore = this.highestAltitude;
          localStorage.setItem('minigame_pogo_panic_hi', String(this.highScore));
        }
      }

      // Generate higher platforms as camera ascends
      const topPlatY = Math.min(...this.platforms.map((p) => p.y));
      if (topPlatY > -this.cameraY - 200) {
        this.spawnPlatformAt(topPlatY - Math.floor(Math.random() * 45 + 55));
      }
    }

    // Cleanup distant platforms and enemies below viewport
    this.platforms = this.platforms.filter((p) => p.y + this.cameraY < canvas.height + 150);
    this.enemies = this.enemies.filter((e) => e.y + this.cameraY < canvas.height + 150);

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Check Death (Fell below bottom of screen)
    if (this.py + this.cameraY > canvas.height + 60) {
      this.gameOver = true;
      sfx.playFall();
    }
  }

  private spawnSparkleParticles(x: number, y: number, colour: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        colour,
        life: 18,
        size: Math.random() * 3 + 2,
      });
    }
  }

  private spawnCrumbleParticles(x: number, y: number) {
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 60,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 1,
        colour: Math.random() > 0.5 ? EGA.brown : '#3e200c',
        life: 25,
        size: Math.random() * 4 + 2,
      });
    }
  }

  public draw() {
    // Verdant Deep Meadow / Night Sky Background
    ctx.fillStyle = '#050c07';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Twinkling stars / spores
    for (const s of this.stars) {
      const starScreenY = (s.y + this.cameraY * 0.2) % canvas.height;
      ctx.fillStyle = s.colour;
      ctx.fillRect(s.x, starScreenY, 2, 2);
    }

    ctx.save();
    ctx.translate(0, this.cameraY);

    // Draw Platforms
    for (const plat of this.platforms) {
      if (plat.crumblyBroken) continue;
      this.drawPlatform(plat);
    }

    // Draw Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.drawEnemy(e);
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    // Draw Ben on Pogo Stick
    if (!this.gameOver) {
      this.drawPlayer();
    }

    ctx.restore();

    // Draw Altitude Meter & HUD
    this.drawHUD();

    // Pause / Game Over overlays
    if (this.paused) {
      this.drawOverlay('GAME PAUSED', 'PRESS P TO RESUME', EGA.yellow);
    } else if (this.gameOver) {
      this.drawOverlay(
        'POGO CRASH!',
        `FINAL ALTITUDE: ${this.highestAltitude}m\nPRESS SPACE TO CLIMB AGAIN`,
        EGA.lightRed,
      );
    }
  }

  private drawPlatform(p: Platform) {
    if (p.type === PlatformType.Standard) {
      // Emerald Grass Top & Chocolate Stone base
      ctx.fillStyle = EGA.green;
      ctx.fillRect(p.x, p.y, p.w, 5);
      ctx.fillStyle = EGA.lightGreen;
      ctx.fillRect(p.x, p.y, p.w, 2);
      ctx.fillStyle = EGA.brown;
      ctx.fillRect(p.x, p.y + 5, p.w, p.h - 5);
      ctx.fillStyle = '#3a1f0d';
      ctx.fillRect(p.x, p.y + p.h - 2, p.w, 2);
    } else if (p.type === PlatformType.Crumbly) {
      // Crumbly chocolate wafer with crack lines
      ctx.fillStyle = '#7a3c10';
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = EGA.yellow;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x + 15, p.y);
      ctx.lineTo(p.x + 35, p.y + p.h);
      ctx.moveTo(p.x + 55, p.y);
      ctx.lineTo(p.x + 65, p.y + p.h);
      ctx.stroke();
    } else if (p.type === PlatformType.Moving) {
      // High-tech Cyan Conveyor platform
      ctx.fillStyle = EGA.cyan;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = EGA.lightCyan;
      ctx.fillRect(p.x, p.y, p.w, 3);
      ctx.fillStyle = EGA.blue;
      ctx.fillRect(p.x + 4, p.y + 5, p.w - 8, p.h - 8);
    }

    // Mounted Super Spring
    if (p.hasSpring) {
      const springX = p.x + p.w / 2;
      const springY = p.y - 10;
      ctx.fillStyle = EGA.yellow;
      ctx.fillRect(springX - 6, springY + 6, 12, 4);
      // Coiled spring
      ctx.strokeStyle = EGA.lightCyan;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(springX - 4, springY + 6);
      ctx.lineTo(springX + 4, springY + 3);
      ctx.lineTo(springX - 4, springY);
      ctx.lineTo(springX + 4, springY - 3);
      ctx.stroke();
    }
  }

  private drawEnemy(e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const flap = Math.sin(e.animTimer * 0.3) * 8;

    // Crystal Bat wings
    ctx.fillStyle = EGA.magenta;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, -8 + flap);
    ctx.lineTo(-6, 4);
    ctx.lineTo(0, 0);
    ctx.lineTo(14, -8 + flap);
    ctx.lineTo(6, 4);
    ctx.closePath();
    ctx.fill();

    // Body & glowing eyes
    ctx.fillStyle = EGA.lightMagenta;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EGA.lightRed;
    ctx.fillRect(-2, -2, 2, 2);
    ctx.fillRect(1, -2, 2, 2);

    ctx.restore();
  }

  private drawPlayer() {
    ctx.save();
    ctx.translate(this.px, this.py);
    ctx.scale(this.facing, 1);

    const compress = this.springCompression * 6;

    // Pogo Stick Shaft (Metallic grey)
    ctx.fillStyle = EGA.lightGrey;
    ctx.fillRect(-2, 4, 4, 18 - compress);

    // Spring Coil
    ctx.strokeStyle = EGA.yellow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, 14 - compress);
    ctx.lineTo(4, 16 - compress);
    ctx.lineTo(-4, 18 - compress);
    ctx.lineTo(4, 20 - compress);
    ctx.lineTo(0, 24 - compress);
    ctx.stroke();

    // Pogo Foot Pegs
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(-8, 12 - compress, 16, 3);

    // Pogo Handlebars
    ctx.fillStyle = EGA.lightRed;
    ctx.fillRect(-10, 2, 20, 3);

    // Ben's Golden Astronaut Helmet
    ctx.fillStyle = EGA.yellow;
    ctx.beginPath();
    ctx.arc(0, -10, 11, 0, Math.PI * 2);
    ctx.fill();

    // Cyan Bubble Visor
    ctx.fillStyle = EGA.lightCyan;
    ctx.beginPath();
    ctx.arc(4, -10, 6, -Math.PI / 2, Math.PI / 2);
    ctx.fill();

    // Visor glare
    ctx.fillStyle = EGA.white;
    ctx.fillRect(4, -13, 3, 2);

    // Ben's Suit Body & Hands
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillRect(-5, 0, 10, 8);
    ctx.fillStyle = EGA.green;
    ctx.fillRect(-7, 2, 3, 3);
    ctx.fillRect(4, 2, 3, 3);

    ctx.restore();
  }

  private drawHUD() {
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = EGA.yellow;
    ctx.fillText(`ALTITUDE: ${this.highestAltitude}m`, 25, 32);

    ctx.textAlign = 'right';
    ctx.fillStyle = EGA.white;
    ctx.fillText(`RECORD: ${this.highScore}m`, canvas.width - 25, 32);

    // Altitude Progress Ribbon along right screen edge
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(canvas.width - 10, 45, 6, canvas.height - 70);
    const ribbonH = Math.min(
      canvas.height - 70,
      (this.highestAltitude / 2000) * (canvas.height - 70),
    );
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillRect(canvas.width - 10, canvas.height - 25 - ribbonH, 6, ribbonH);
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

const game = new PogoPanicGame();

window.addEventListener('keydown', (e) => {
  game.setKey(e.key, true);
  if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});

window.addEventListener('keyup', (e) => {
  game.setKey(e.key, false);
});

// Game loop
function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
