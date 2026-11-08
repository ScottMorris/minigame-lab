// Gloop Slugger — Whack-a-Mole arcade mini-game in the Cocoa Fields
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

  playPop() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  playWhack() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playBomb() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  playBonus() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.06);
    osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }
}

const sfx = new SoundFx();

enum SlugKind {
  Standard,
  King,
  ZargBomb,
  CookieMole,
}

interface Crater {
  x: number;
  y: number;
  slugKind: SlugKind;
  state: 'idle' | 'rising' | 'peeking' | 'retreating' | 'whacked';
  height: number; // 0 to 1
  timer: number;
  maxTimer: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  colour: string;
  life: number;
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

class GloopSluggerGame {
  private craters: Crater[] = [];
  private floatingTexts: FloatingText[] = [];
  private particles: Particle[] = [];
  private bubbles: { x: number; y: number; r: number; speed: number }[] = [];

  public score = 0;
  public highScore = 0;
  public timeLeft = 60;
  public streak = 0;
  public totalHits = 0;
  public gameOver = false;
  public paused = false;

  private hammerX = 400;
  private hammerY = 300;
  private hammerSwing = 0; // 0 to 1
  private stunTimer = 0;

  constructor() {
    this.highScore = Number(localStorage.getItem('minigame_gloop_slugger_hi') || '0');
    this.initCraters();
    this.initBubbles();
  }

  private initCraters() {
    this.craters = [];
    const startX = 220;
    const startY = 160;
    const gapX = 180;
    const gapY = 130;

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        this.craters.push({
          x: startX + c * gapX,
          y: startY + r * gapY,
          slugKind: SlugKind.Standard,
          state: 'idle',
          height: 0,
          timer: Math.random() * 80 + 20,
          maxTimer: 60,
        });
      }
    }
  }

  private initBubbles() {
    this.bubbles = [];
    for (let i = 0; i < 25; i++) {
      this.bubbles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 4 + 2,
        speed: Math.random() * 0.5 + 0.2,
      });
    }
  }

  public reset() {
    this.score = 0;
    this.timeLeft = 60;
    this.streak = 0;
    this.totalHits = 0;
    this.gameOver = false;
    this.stunTimer = 0;
    this.initCraters();
  }

  public setMousePos(x: number, y: number) {
    this.hammerX = x;
    this.hammerY = y;
  }

  public hitIndex(index: number) {
    if (this.gameOver || this.paused || this.stunTimer > 0) return;
    if (index >= 0 && index < this.craters.length) {
      const crater = this.craters[index];
      this.hammerX = crater.x;
      this.hammerY = crater.y - 20;
      this.hammerSwing = 1;
      this.processWhack(crater);
    }
  }

  public clickCanvas(x: number, y: number) {
    if (this.gameOver) {
      this.reset();
      return;
    }
    if (this.paused || this.stunTimer > 0) return;

    this.hammerSwing = 1;

    // Check collision with craters
    let hitAny = false;
    for (const crater of this.craters) {
      const dx = x - crater.x;
      const dy = y - (crater.y - 20);
      if (Math.hypot(dx, dy) < 55) {
        hitAny = true;
        this.processWhack(crater);
        break;
      }
    }

    if (!hitAny) {
      sfx.playWhack();
      this.streak = 0;
    }
  }

  private processWhack(crater: Crater) {
    if (crater.state === 'rising' || crater.state === 'peeking') {
      crater.state = 'whacked';
      crater.timer = 20;

      if (crater.slugKind === SlugKind.ZargBomb) {
        sfx.playBomb();
        this.score = Math.max(0, this.score - 150);
        this.streak = 0;
        this.stunTimer = 45;
        this.spawnExplosion(crater.x, crater.y - 30, EGA.lightRed, 25);
        this.floatingTexts.push({
          x: crater.x,
          y: crater.y - 50,
          text: 'STUNNED! -150',
          colour: EGA.lightRed,
          life: 40,
        });
      } else {
        sfx.playWhack();
        this.totalHits++;
        this.streak++;
        const multiplier = this.streak >= 10 ? 3 : this.streak >= 5 ? 2 : 1;

        let basePoints = 100;
        let label = `WHACK! +${100 * multiplier}`;
        let col = EGA.lightGreen;

        if (crater.slugKind === SlugKind.King) {
          basePoints = 300;
          label = `KING SPLAT! +${300 * multiplier}`;
          col = EGA.yellow;
          sfx.playBonus();
        } else if (crater.slugKind === SlugKind.CookieMole) {
          basePoints = 150;
          this.timeLeft += 5;
          label = `COOKIE MOLE! +5 SEC`;
          col = EGA.lightCyan;
          sfx.playBonus();
        }

        this.score += basePoints * multiplier;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          localStorage.setItem('minigame_gloop_slugger_hi', String(this.highScore));
        }

        this.spawnExplosion(crater.x, crater.y - 30, col, 18);
        this.floatingTexts.push({
          x: crater.x,
          y: crater.y - 50,
          text: label,
          colour: col,
          life: 35,
        });
      }
    } else {
      sfx.playWhack();
      this.streak = 0;
    }
  }

  private spawnExplosion(x: number, y: number, colour: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        colour,
        life: 20,
        size: Math.random() * 4 + 2,
      });
    }
  }

  public update() {
    if (this.paused || this.gameOver) return;

    // Timer countdown
    this.timeLeft -= 1 / 60;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.gameOver = true;
    }

    if (this.stunTimer > 0) {
      this.stunTimer--;
    }

    if (this.hammerSwing > 0) {
      this.hammerSwing = Math.max(0, this.hammerSwing - 0.15);
    }

    // Update Bubbles
    for (const b of this.bubbles) {
      b.y -= b.speed;
      if (b.y < -10) {
        b.y = canvas.height + 10;
        b.x = Math.random() * canvas.width;
      }
    }

    // Update Floating Text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.2;
      ft.life--;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update Craters and Slugs
    for (const crater of this.craters) {
      if (crater.state === 'idle') {
        crater.timer--;
        if (crater.timer <= 0) {
          crater.state = 'rising';
          crater.height = 0;
          crater.timer = 15;

          // Pick random slug type
          const rand = Math.random();
          if (rand < 0.55) {
            crater.slugKind = SlugKind.Standard;
          } else if (rand < 0.75) {
            crater.slugKind = SlugKind.King;
          } else if (rand < 0.9) {
            crater.slugKind = SlugKind.ZargBomb;
          } else {
            crater.slugKind = SlugKind.CookieMole;
          }
          sfx.playPop();
        }
      } else if (crater.state === 'rising') {
        crater.height = Math.min(1, crater.height + 0.1);
        if (crater.height >= 1) {
          crater.state = 'peeking';
          // Higher score or King slug means faster peek time
          const duration =
            crater.slugKind === SlugKind.King
              ? 35
              : Math.max(25, 60 - Math.floor(this.score / 600) * 4);
          crater.timer = duration;
        }
      } else if (crater.state === 'peeking') {
        crater.timer--;
        if (crater.timer <= 0) {
          crater.state = 'retreating';
        }
      } else if (crater.state === 'retreating') {
        crater.height = Math.max(0, crater.height - 0.1);
        if (crater.height <= 0) {
          crater.state = 'idle';
          crater.timer = Math.random() * 60 + 25;
        }
      } else if (crater.state === 'whacked') {
        crater.timer--;
        crater.height = Math.max(0, crater.height - 0.08);
        if (crater.timer <= 0) {
          crater.state = 'idle';
          crater.timer = Math.random() * 50 + 20;
        }
      }
    }
  }

  public draw() {
    // Rich Cocoa Mud Background
    ctx.fillStyle = '#18100c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chocolate River / Field Contours
    ctx.fillStyle = '#2c1910';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, 330, 380, 240, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3a2114';
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, 330, 350, 210, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cocoa Bubbles
    for (const b of this.bubbles) {
      ctx.fillStyle = EGA.brown;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = EGA.yellow;
      ctx.fillRect(b.x - b.r * 0.3, b.y - b.r * 0.3, 2, 2);
    }

    // Sort craters row by row so lower rows overlap properly
    for (const crater of this.craters) {
      this.drawCraterMound(crater.x, crater.y);
      this.drawSlug(crater);
      this.drawCraterRim(crater.x, crater.y);
    }

    // Draw Particles
    for (const p of this.particles) {
      ctx.fillStyle = p.colour;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }

    // Draw Floating Text
    for (const ft of this.floatingTexts) {
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = EGA.black;
      ctx.fillText(ft.text, ft.x + 2, ft.y + 2);
      ctx.fillStyle = ft.colour;
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    // Draw Animated Mallet
    this.drawMallet(this.hammerX, this.hammerY, this.hammerSwing, this.stunTimer > 0);

    // Draw Arcade HUD
    this.drawHUD();

    // Pause / Game Over overlays
    if (this.paused) {
      this.drawOverlay('GAME PAUSED', 'PRESS P TO RESUME', EGA.yellow);
    } else if (this.gameOver) {
      const rank =
        this.score >= 4000
          ? 'GLOOP MASTER SUPREME'
          : this.score >= 2500
            ? 'SLUGGER FIRST CLASS'
            : this.score >= 1200
              ? 'COCOA CADET'
              : 'ROOKIE SWIPER';
      this.drawOverlay(
        'TIME UP!',
        `FINAL SCORE: ${this.score}  •  RANK: ${rank}\nCLICK OR PRESS SPACE TO PLAY AGAIN`,
        EGA.lightRed,
      );
    }
  }

  private drawCraterMound(x: number, y: number) {
    // Dirt mound base
    ctx.fillStyle = '#4a2b1b';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 68, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cocoa crust
    ctx.fillStyle = '#5c3520';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 62, 32, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crater pit hole
    ctx.fillStyle = '#100a06';
    ctx.beginPath();
    ctx.ellipse(x, y, 48, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSlug(crater: Crater) {
    if (crater.height <= 0) return;

    ctx.save();
    // Clip slug so it emerges out of crater pit hole
    ctx.beginPath();
    ctx.rect(crater.x - 55, crater.y - 120, 110, 120);
    ctx.clip();

    const emergeY = crater.y - crater.height * 65;
    const isWhacked = crater.state === 'whacked';

    if (crater.slugKind === SlugKind.Standard) {
      // Green Gloop Slug
      ctx.fillStyle = isWhacked ? EGA.lightMagenta : EGA.green;
      ctx.beginPath();
      ctx.ellipse(crater.x, emergeY + 25, 34, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      // Slime highlight
      ctx.fillStyle = EGA.lightGreen;
      ctx.beginPath();
      ctx.ellipse(crater.x - 10, emergeY + 12, 12, 20, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Antennae
      ctx.strokeStyle = EGA.green;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(crater.x - 14, emergeY);
      ctx.lineTo(crater.x - 22, emergeY - 18);
      ctx.moveTo(crater.x + 14, emergeY);
      ctx.lineTo(crater.x + 22, emergeY - 18);
      ctx.stroke();

      // Eyes
      this.drawSlugEyes(crater.x, emergeY + 8, isWhacked, EGA.white, EGA.black);
    } else if (crater.slugKind === SlugKind.King) {
      // Golden King Slug
      ctx.fillStyle = isWhacked ? EGA.lightGrey : EGA.yellow;
      ctx.beginPath();
      ctx.ellipse(crater.x, emergeY + 25, 36, 42, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = EGA.white;
      ctx.beginPath();
      ctx.ellipse(crater.x - 10, emergeY + 12, 14, 22, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Sparkling Gold Crown
      ctx.fillStyle = EGA.yellow;
      ctx.beginPath();
      ctx.moveTo(crater.x - 18, emergeY - 2);
      ctx.lineTo(crater.x - 24, emergeY - 22);
      ctx.lineTo(crater.x - 10, emergeY - 12);
      ctx.lineTo(crater.x, emergeY - 26);
      ctx.lineTo(crater.x + 10, emergeY - 12);
      ctx.lineTo(crater.x + 24, emergeY - 22);
      ctx.lineTo(crater.x + 18, emergeY - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = EGA.brown;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crown Ruby
      ctx.fillStyle = EGA.lightRed;
      ctx.fillRect(crater.x - 3, emergeY - 14, 6, 6);

      this.drawSlugEyes(crater.x, emergeY + 12, isWhacked, EGA.white, EGA.blue);
    } else if (crater.slugKind === SlugKind.ZargBomb) {
      // Zarg Menace Bomb
      ctx.fillStyle = isWhacked ? EGA.red : EGA.magenta;
      ctx.beginPath();
      ctx.ellipse(crater.x, emergeY + 25, 34, 38, 0, 0, Math.PI * 2);
      ctx.fill();

      // Menacing Horns
      ctx.fillStyle = EGA.lightRed;
      ctx.beginPath();
      ctx.moveTo(crater.x - 20, emergeY + 5);
      ctx.lineTo(crater.x - 32, emergeY - 15);
      ctx.lineTo(crater.x - 12, emergeY);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(crater.x + 20, emergeY + 5);
      ctx.lineTo(crater.x + 32, emergeY - 15);
      ctx.lineTo(crater.x + 12, emergeY);
      ctx.closePath();
      ctx.fill();

      // Ticking fuse on top
      ctx.strokeStyle = EGA.yellow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(crater.x, emergeY - 6);
      ctx.quadraticCurveTo(crater.x + 10, emergeY - 22, crater.x + 18, emergeY - 20);
      ctx.stroke();

      // Spark
      ctx.fillStyle = Math.random() > 0.5 ? EGA.white : EGA.lightRed;
      ctx.fillRect(crater.x + 16, emergeY - 24, 6, 6);

      // Angry eyes
      ctx.fillStyle = EGA.yellow;
      ctx.beginPath();
      ctx.arc(crater.x - 12, emergeY + 14, 7, 0, Math.PI * 2);
      ctx.arc(crater.x + 12, emergeY + 14, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = EGA.black;
      ctx.fillRect(crater.x - 14, emergeY + 12, 5, 5);
      ctx.fillRect(crater.x + 10, emergeY + 12, 5, 5);
    } else if (crater.slugKind === SlugKind.CookieMole) {
      // Mildred's Cookie Mole
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath();
      ctx.ellipse(crater.x, emergeY + 25, 34, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      // Chocolate chips
      ctx.fillStyle = '#3a1f0d';
      ctx.fillRect(crater.x - 18, emergeY + 16, 6, 6);
      ctx.fillRect(crater.x + 12, emergeY + 22, 6, 6);
      ctx.fillRect(crater.x - 6, emergeY + 36, 6, 6);

      // Chef Hat
      ctx.fillStyle = EGA.white;
      ctx.beginPath();
      ctx.rect(crater.x - 16, emergeY - 10, 32, 10);
      ctx.arc(crater.x, emergeY - 12, 18, Math.PI, 0);
      ctx.fill();

      this.drawSlugEyes(crater.x, emergeY + 12, isWhacked, EGA.white, '#3a1f0d');
    }

    ctx.restore();
  }

  private drawSlugEyes(
    x: number,
    y: number,
    isWhacked: boolean,
    eyeColour: string,
    pupilColour: string,
  ) {
    if (isWhacked) {
      // X eyes
      ctx.strokeStyle = EGA.black;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 16, y - 6);
      ctx.lineTo(x - 6, y + 4);
      ctx.moveTo(x - 6, y - 6);
      ctx.lineTo(x - 16, y + 4);

      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x + 16, y + 4);
      ctx.moveTo(x + 16, y - 6);
      ctx.lineTo(x + 6, y + 4);
      ctx.stroke();
    } else {
      // Big cartoon eyeballs
      ctx.fillStyle = eyeColour;
      ctx.beginPath();
      ctx.arc(x - 11, y, 8, 0, Math.PI * 2);
      ctx.arc(x + 11, y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pupilColour;
      ctx.beginPath();
      ctx.arc(x - 10, y + 1, 4, 0, Math.PI * 2);
      ctx.arc(x + 10, y + 1, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = EGA.white;
      ctx.fillRect(x - 12, y - 2, 2, 2);
      ctx.fillRect(x + 8, y - 2, 2, 2);
    }
  }

  private drawCraterRim(x: number, y: number) {
    // Overlapping front rim lip
    ctx.strokeStyle = '#2b160b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 48, 20, 0, 0, Math.PI);
    ctx.stroke();
  }

  private drawMallet(x: number, y: number, swing: number, stunned: boolean) {
    ctx.save();
    ctx.translate(x, y);

    if (stunned) {
      // Stunned dizzy stars
      ctx.fillStyle = EGA.yellow;
      const angle = (Date.now() / 150) % (Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const a = angle + (i * Math.PI * 2) / 3;
        ctx.fillText('★', Math.cos(a) * 25, Math.sin(a) * 20 - 40);
      }
      ctx.restore();
      return;
    }

    const tilt = swing > 0 ? -0.4 + swing * 0.7 : -0.2;
    ctx.rotate(tilt);

    // Mallet Wooden Handle
    ctx.fillStyle = '#9c683b';
    ctx.fillRect(-6, -10, 12, 70);
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 2;
    ctx.strokeRect(-6, -10, 12, 70);

    // Mallet Head (Chunky wooden block with steel rings)
    ctx.fillStyle = '#6e4420';
    ctx.fillRect(-32, -42, 64, 34);
    ctx.strokeStyle = '#422810';
    ctx.lineWidth = 3;
    ctx.strokeRect(-32, -42, 64, 34);

    // Steel bands on ends
    ctx.fillStyle = EGA.darkGrey;
    ctx.fillRect(-32, -42, 8, 34);
    ctx.fillRect(24, -42, 8, 34);
    ctx.fillStyle = EGA.lightGrey;
    ctx.fillRect(-30, -42, 3, 34);
    ctx.fillRect(26, -42, 3, 34);

    // Gold Fizz Badge
    ctx.fillStyle = EGA.yellow;
    ctx.beginPath();
    ctx.arc(0, -25, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EGA.brown;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('F', 0, -22);

    ctx.restore();
  }

  private drawHUD() {
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = EGA.yellow;
    ctx.fillText(`SCORE: ${this.score}`, 30, 36);

    ctx.textAlign = 'center';
    const timerCol = this.timeLeft <= 10 ? EGA.lightRed : EGA.lightCyan;
    ctx.fillStyle = timerCol;
    ctx.fillText(`TIME: ${Math.ceil(this.timeLeft)}s`, canvas.width / 2, 36);

    ctx.textAlign = 'right';
    ctx.fillStyle = EGA.white;
    ctx.fillText(`HI: ${this.highScore}`, canvas.width - 30, 36);

    // Bottom Stats
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px monospace';
    const streakCol =
      this.streak >= 10 ? EGA.yellow : this.streak >= 5 ? EGA.lightCyan : EGA.lightGreen;
    ctx.fillStyle = streakCol;
    ctx.fillText(
      `STREAK: ${this.streak} ${this.streak >= 5 ? '(x' + (this.streak >= 10 ? '3' : '2') + ' COMBO!)' : ''}`,
      30,
      canvas.height - 20,
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = EGA.lightGrey;
    ctx.fillText(`HITS: ${this.totalHits}`, canvas.width - 30, canvas.height - 20);
  }

  private drawOverlay(title: string, sub: string, colour: string) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colour;
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);

    ctx.fillStyle = EGA.white;
    ctx.font = 'bold 13px monospace';
    const lines = sub.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 + 25 + idx * 22);
    });
  }
}

const game = new GloopSluggerGame();

// Mouse handling
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  game.setMousePos((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  game.clickCanvas((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
});

// Keyboard controls (1-9 or QWE/ASD/ZXC)
window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  const keyMap: Record<string, number> = {
    '7': 0,
    '8': 1,
    '9': 2,
    '4': 3,
    '5': 4,
    '6': 5,
    '1': 6,
    '2': 7,
    '3': 8,
    q: 0,
    w: 1,
    e: 2,
    a: 3,
    s: 4,
    d: 5,
    z: 6,
    x: 7,
    c: 8,
  };

  if (keyMap[key] !== undefined) {
    game.hitIndex(keyMap[key]);
    e.preventDefault();
  } else if (key === 'p') {
    game.paused = !game.paused;
  } else if (key === ' ' && game.gameOver) {
    game.reset();
  }
});

// Game loop
function loop() {
  game.update();
  game.draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
