// Crystal Defender — Asteroids-style Omnidirectional Shooter
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

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
  private ctx: AudioContext | null = null;
  private init() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playLaser() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(660, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playThrust() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.setValueAtTime(130, this.ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playExplode() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}
const sfx = new SoundFx();

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number; // 3=Large, 2=Medium, 1=Small
  radius: number;
  vertices: { x: number; y: number }[];
  colour: string;
  shineColour: string;
}

interface BatEnemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  animTimer: number;
  health: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
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

class CrystalDefenderGame {
  private ship = {
    x: 400,
    y: 300,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    shields: 100,
    thrusting: false,
    invincibleTimer: 0,
  };

  private asteroids: Asteroid[] = [];
  private bats: BatEnemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private stars: { x: number; y: number; colour: string }[] = [];

  public score = 0;
  public highScore = 0;
  public wave = 1;
  public lives = 3;
  public gameOver = false;
  public paused = false;

  private keys: Record<string, boolean> = {};

  constructor() {
    this.highScore = Number(localStorage.getItem('minigame_crystal_defender_hi') || '0');
    this.initStars();
    this.reset();
  }

  private initStars() {
    this.stars = [];
    const colours = [EGA.darkGrey, EGA.blue, EGA.magenta, EGA.cyan, EGA.white];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        colour: colours[Math.floor(Math.random() * colours.length)],
      });
    }
  }

  reset() {
    this.ship.x = 400;
    this.ship.y = 300;
    this.ship.vx = 0;
    this.ship.vy = 0;
    this.ship.angle = -Math.PI / 2;
    this.ship.shields = 100;
    this.ship.invincibleTimer = 60;
    this.lives = 3;
    this.score = 0;
    this.wave = 1;
    this.gameOver = false;
    this.paused = false;
    this.bullets = [];
    this.particles = [];
    this.bats = [];
    this.spawnWave();
  }

  private spawnWave() {
    this.asteroids = [];
    this.bats = [];
    const count = 4 + this.wave;
    for (let i = 0; i < count; i++) {
      // Spawn near edges away from ship
      let x = Math.random() * canvas.width;
      let y = Math.random() * canvas.height;
      if (Math.abs(x - this.ship.x) < 150) x = (x + 300) % canvas.width;
      if (Math.abs(y - this.ship.y) < 150) y = (y + 300) % canvas.height;
      this.spawnAsteroid(x, y, 3);
    }

    // Spawn 1 or 2 crystal bats
    for (let i = 0; i < Math.min(3, this.wave); i++) {
      this.bats.push({
        x: Math.random() > 0.5 ? -20 : canvas.width + 20,
        y: Math.random() * canvas.height,
        vx: 0,
        vy: 0,
        animTimer: 0,
        health: 2,
      });
    }
  }

  private spawnAsteroid(x: number, y: number, size: number) {
    const radius = size === 3 ? 38 : size === 2 ? 22 : 12;
    const vertices: { x: number; y: number }[] = [];
    const points = 8;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius * (0.8 + Math.random() * 0.4);
      vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    const angle = Math.random() * Math.PI * 2;
    const speed = (4 - size) * (0.7 + Math.random() * 0.5);

    const colours = [
      { colour: EGA.magenta, shine: EGA.lightMagenta },
      { colour: EGA.cyan, shine: EGA.lightCyan },
      { colour: EGA.blue, shine: EGA.lightBlue },
    ];
    const c = colours[Math.floor(Math.random() * colours.length)];

    this.asteroids.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      radius,
      vertices,
      colour: c.colour,
      shineColour: c.shine,
    });
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

  private fireLaser() {
    if (this.gameOver || this.paused) return;
    if (this.bullets.length >= 6) return;

    const speed = 10;
    this.bullets.push({
      x: this.ship.x + Math.cos(this.ship.angle) * 18,
      y: this.ship.y + Math.sin(this.ship.angle) * 18,
      vx: this.ship.vx + Math.cos(this.ship.angle) * speed,
      vy: this.ship.vy + Math.sin(this.ship.angle) * speed,
      life: 50,
    });
    sfx.playLaser();
  }

  public update() {
    if (this.paused || this.gameOver) return;

    if (this.ship.invincibleTimer > 0) this.ship.invincibleTimer--;

    // Ship Rotation
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.ship.angle -= 0.08;
    }
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.ship.angle += 0.08;
    }

    // Ship Thrust
    this.ship.thrusting = Boolean(this.keys['ArrowUp'] || this.keys['w'] || this.keys['W']);
    if (this.ship.thrusting) {
      this.ship.vx += Math.cos(this.ship.angle) * 0.22;
      this.ship.vy += Math.sin(this.ship.angle) * 0.22;
      if (Math.random() < 0.2) sfx.playThrust();

      // Exhaust flame particles
      const exAngle = this.ship.angle + Math.PI + (Math.random() - 0.5) * 0.4;
      this.particles.push({
        x: this.ship.x - Math.cos(this.ship.angle) * 14,
        y: this.ship.y - Math.sin(this.ship.angle) * 14,
        vx: Math.cos(exAngle) * 3 + this.ship.vx * 0.5,
        vy: Math.sin(exAngle) * 3 + this.ship.vy * 0.5,
        colour: Math.random() > 0.5 ? EGA.yellow : EGA.lightRed,
        life: 14,
        maxLife: 14,
        size: Math.random() * 3 + 2,
      });
    }

    // Reverse Brake
    if (this.keys['ArrowDown'] || this.keys['s'] || this.keys['S']) {
      this.ship.vx *= 0.94;
      this.ship.vy *= 0.94;
    }

    // Shoot
    if (this.keys[' ']) {
      this.fireLaser();
      this.keys[' '] = false;
    }

    // Inertia & Drag
    this.ship.vx *= 0.985;
    this.ship.vy *= 0.985;
    this.ship.x = (this.ship.x + this.ship.vx + canvas.width) % canvas.width;
    this.ship.y = (this.ship.y + this.ship.vy + canvas.height) % canvas.height;

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x = (b.x + b.vx + canvas.width) % canvas.width;
      b.y = (b.y + b.vy + canvas.height) % canvas.height;
      b.life--;
      if (b.life <= 0) {
        this.bullets.splice(i, 1);
      }
    }

    // Update Asteroids
    for (const a of this.asteroids) {
      a.x = (a.x + a.vx + canvas.width) % canvas.width;
      a.y = (a.y + a.vy + canvas.height) % canvas.height;
    }

    // Update Bats
    for (let i = this.bats.length - 1; i >= 0; i--) {
      const bat = this.bats[i];
      bat.animTimer++;
      // Home in on ship
      const dx = this.ship.x - bat.x;
      const dy = this.ship.y - bat.y;
      const dist = Math.hypot(dx, dy) || 1;
      bat.vx += (dx / dist) * 0.08;
      bat.vy += (dy / dist) * 0.08;
      bat.vx *= 0.97;
      bat.vy *= 0.97;
      bat.x += bat.vx;
      bat.y += bat.vy;

      // Bat vs Ship collision
      if (this.ship.invincibleTimer <= 0 && dist < 22) {
        this.shipHit(30);
      }
    }

    // Bullet vs Asteroid Collision
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      let bulletHit = false;

      for (let j = this.asteroids.length - 1; j >= 0; j--) {
        const a = this.asteroids[j];
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist < a.radius) {
          bulletHit = true;
          this.spawnCrystalExplosion(a.x, a.y, a.colour, a.size * 8);
          sfx.playExplode();

          const pts = a.size === 3 ? 50 : a.size === 2 ? 100 : 200;
          this.score += pts;

          // Split asteroid
          if (a.size > 1) {
            this.spawnAsteroid(a.x, a.y, a.size - 1);
            this.spawnAsteroid(a.x, a.y, a.size - 1);
          }
          this.asteroids.splice(j, 1);
          break;
        }
      }

      // Bullet vs Bat Collision
      if (!bulletHit) {
        for (let j = this.bats.length - 1; j >= 0; j--) {
          const bat = this.bats[j];
          if (Math.hypot(b.x - bat.x, b.y - bat.y) < 18) {
            bulletHit = true;
            bat.health--;
            if (bat.health <= 0) {
              this.spawnCrystalExplosion(bat.x, bat.y, EGA.lightRed, 14);
              sfx.playExplode();
              this.score += 250;
              this.bats.splice(j, 1);
            }
            break;
          }
        }
      }

      if (bulletHit) {
        this.bullets.splice(i, 1);
      }
    }

    // Ship vs Asteroid Collision
    if (this.ship.invincibleTimer <= 0) {
      for (const a of this.asteroids) {
        if (Math.hypot(this.ship.x - a.x, this.ship.y - a.y) < a.radius + 12) {
          this.shipHit(a.size * 20);
          break;
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

    // High Score tracking
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('minigame_crystal_defender_hi', String(this.highScore));
    }

    // Wave Complete
    if (this.asteroids.length === 0 && this.bats.length === 0) {
      this.wave++;
      this.spawnWave();
    }
  }

  private shipHit(damage: number) {
    this.ship.shields -= damage;
    this.spawnCrystalExplosion(this.ship.x, this.ship.y, EGA.lightRed, 20);
    sfx.playExplode();
    this.ship.invincibleTimer = 40;

    if (this.ship.shields <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.gameOver = true;
      } else {
        this.ship.shields = 100;
        this.ship.x = 400;
        this.ship.y = 300;
        this.ship.vx = 0;
        this.ship.vy = 0;
        this.ship.invincibleTimer = 80;
      }
    }
  }

  private spawnCrystalExplosion(x: number, y: number, colour: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        colour: Math.random() > 0.4 ? colour : EGA.white,
        life: 20,
        maxLife: 20,
        size: Math.random() * 3 + 2,
      });
    }
  }

  public draw() {
    // Deep Cavern Background
    ctx.fillStyle = '#06030c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing Cave Stars / Dust
    for (const s of this.stars) {
      ctx.fillStyle = s.colour;
      ctx.fillRect(s.x, s.y, 2, 2);
    }

    // Draw Asteroids
    for (const a of this.asteroids) {
      this.drawAsteroid(a);
    }

    // Draw Bats
    for (const bat of this.bats) {
      this.drawBat(bat);
    }

    // Draw Bullets
    ctx.fillStyle = EGA.lightCyan;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = EGA.white;
      ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    // Draw Ship
    if (!this.gameOver || this.lives > 0) {
      this.drawShip();
    }

    // HUD
    this.drawHUD();

    if (this.paused) {
      this.drawOverlay('PAUSED', 'PRESS P TO RESUME', EGA.yellow);
    } else if (this.gameOver) {
      this.drawOverlay('CRYSTAL SHATTERED!', 'PRESS SPACE TO DEFEND AGAIN', EGA.lightMagenta);
    }
  }

  private drawShip() {
    ctx.save();
    ctx.translate(this.ship.x, this.ship.y);
    ctx.rotate(this.ship.angle);

    // Invincibility flashing
    if (this.ship.invincibleTimer > 0 && Math.floor(this.ship.invincibleTimer / 4) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Hull (Green & Cyan)
    ctx.fillStyle = EGA.green;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -12);
    ctx.closePath();
    ctx.fill();

    // Highlighting
    ctx.strokeStyle = EGA.lightGreen;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ben's Visor Cockpit
    ctx.fillStyle = EGA.white;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EGA.blue;
    ctx.fillRect(1, -2, 3, 4);

    // Thruster flame
    if (this.ship.thrusting) {
      ctx.fillStyle = EGA.yellow;
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-22 - Math.random() * 6, 0);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
    }

    // Force shield ring
    if (this.ship.shields > 25) {
      ctx.strokeStyle = this.ship.shields > 50 ? EGA.lightCyan : EGA.yellow;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawAsteroid(a: Asteroid) {
    ctx.save();
    ctx.translate(a.x, a.y);

    // Geode body
    ctx.fillStyle = a.colour;
    ctx.beginPath();
    ctx.moveTo(a.vertices[0].x, a.vertices[0].y);
    for (let i = 1; i < a.vertices.length; i++) {
      ctx.lineTo(a.vertices[i].x, a.vertices[i].y);
    }
    ctx.closePath();
    ctx.fill();

    // Crystal edge highlights
    ctx.strokeStyle = a.shineColour;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Internal crystal facet lines
    ctx.strokeStyle = EGA.white;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(a.vertices[1].x, a.vertices[1].y);
    ctx.moveTo(0, 0);
    ctx.lineTo(a.vertices[4].x, a.vertices[4].y);
    ctx.stroke();

    ctx.restore();
  }

  private drawBat(bat: BatEnemy) {
    ctx.save();
    ctx.translate(bat.x, bat.y);
    const flap = Math.sin(bat.animTimer * 0.25) * 8;

    // Wings
    ctx.fillStyle = EGA.blue;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-16, -10 + flap);
    ctx.lineTo(-6, 4);
    ctx.lineTo(0, 0);
    ctx.lineTo(16, -10 + flap);
    ctx.lineTo(6, 4);
    ctx.closePath();
    ctx.fill();

    // Body & Eyes
    ctx.fillStyle = EGA.lightMagenta;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = EGA.lightRed;
    ctx.fillRect(-3, -2, 2, 2);
    ctx.fillRect(1, -2, 2, 2);

    ctx.restore();
  }

  private drawHUD() {
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = EGA.yellow;
    ctx.fillText(`SCORE: ${this.score}`, 30, 32);

    ctx.textAlign = 'center';
    ctx.fillStyle = EGA.lightCyan;
    ctx.fillText(`WAVE ${this.wave}`, canvas.width / 2, 32);

    ctx.textAlign = 'right';
    ctx.fillStyle = EGA.white;
    ctx.fillText(`HI: ${this.highScore}`, canvas.width - 30, 32);

    // Shields Meter
    ctx.textAlign = 'left';
    ctx.fillStyle = EGA.lightGrey;
    ctx.font = '11px monospace';
    ctx.fillText('SHIELDS:', 30, 582);

    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(95, 572, 120, 12);
    const shieldColour =
      this.ship.shields > 50 ? EGA.lightCyan : this.ship.shields > 25 ? EGA.yellow : EGA.lightRed;
    ctx.fillStyle = shieldColour;
    ctx.fillRect(95, 572, Math.max(0, (this.ship.shields / 100) * 120), 12);
    ctx.strokeStyle = EGA.white;
    ctx.lineWidth = 1;
    ctx.strokeRect(95, 572, 120, 12);

    // Lives counter
    ctx.textAlign = 'right';
    ctx.fillStyle = EGA.lightGreen;
    ctx.fillText(`LIVES: ${'▲ '.repeat(Math.max(0, this.lives))}`, canvas.width - 30, 582);
  }

  private drawOverlay(title: string, sub: string, colour: string) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colour;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 25);
  }
}

const game = new CrystalDefenderGame();

window.addEventListener('keydown', (e) => {
  game.setKey(e.key, true);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
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
