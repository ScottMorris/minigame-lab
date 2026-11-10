// Hex Lock: Access Denied — Retro Terminal Mastermind Cipher Arcade
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
  playSelect() {
    playSafe(note('c6').sound('square').decay(0.02).gain(0.12));
  }

  playCycle() {
    playSafe(note('e6').sound('triangle').decay(0.03).gain(0.15));
  }

  playSubmit() {
    playSafe(
      stack(
        note('g5').sound('square').decay(0.04).gain(0.15),
        note('c6').sound('square').decay(0.06).gain(0.12),
      ),
    );
  }

  playClueExact() {
    playSafe(note('c7').sound('square').decay(0.06).gain(0.15));
  }

  playClueMisplaced() {
    playSafe(note('g6').sound('triangle').decay(0.06).gain(0.12));
  }

  playAccessGranted() {
    playSafe(
      stack(
        note('c5').sound('square').decay(0.2).gain(0.2),
        note('e5').sound('square').decay(0.25).gain(0.2),
        note('g5').sound('square').decay(0.3).gain(0.22),
        note('c6').sound('square').decay(0.4).gain(0.25),
      ),
    );
  }

  playAccessDenied() {
    playSafe(
      stack(
        note('c3').sound('sawtooth').decay(0.35).gain(0.25).lpf(300),
        note('b2').sound('sawtooth').decay(0.4).gain(0.22).lpf(300),
      ),
    );
  }
}

const sfx = new SoundFx();

const CODE_LEN = 4;
const MAX_ATTEMPTS = 6;
const SYMBOLS = ['0', '1', '7', 'A', 'B', 'F'];

type Clue = 'Exact' | 'Misplaced' | 'Miss';

interface GuessRow {
  guess: string[];
  clues: Clue[];
  submitted: boolean;
}

class HexLockSimulation {
  secret: string[] = ['A', '0', 'F', '1'];
  attempts: GuessRow[] = [];
  currentAttempt = 0;
  selectedSlot = 0;
  currentGuess: string[] = ['0', '0', '0', '0'];
  isUnlocked = false;
  isLockedOut = false;
  score = 1000;
  timeRemaining = 75 * 60; // 75 seconds at 60 fps
  clueAnimationStep = -1;
  clueAnimationTimer = 0;

  constructor() {
    this.reset();
  }

  reset() {
    // Generate pseudorandom 4-character code from SYMBOLS
    this.secret = [];
    for (let i = 0; i < CODE_LEN; i++) {
      const idx = Math.floor(Math.random() * SYMBOLS.length);
      this.secret.push(SYMBOLS[idx]);
    }

    this.attempts = [];
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      this.attempts.push({
        guess: ['-', '-', '-', '-'],
        clues: ['Miss', 'Miss', 'Miss', 'Miss'],
        submitted: false,
      });
    }

    this.currentAttempt = 0;
    this.selectedSlot = 0;
    this.currentGuess = ['0', '0', '0', '0'];
    this.isUnlocked = false;
    this.isLockedOut = false;
    this.score = 1000;
    this.timeRemaining = 75 * 60;
    this.clueAnimationStep = -1;
    this.clueAnimationTimer = 0;
  }

  evaluateClues(guess: string[]): Clue[] {
    const clues: Clue[] = ['Miss', 'Miss', 'Miss', 'Miss'];
    const secretUsed: boolean[] = [false, false, false, false];
    const guessUsed: boolean[] = [false, false, false, false];

    // Pass 1: exact matches
    for (let i = 0; i < CODE_LEN; i++) {
      if (guess[i] === this.secret[i]) {
        clues[i] = 'Exact';
        secretUsed[i] = true;
        guessUsed[i] = true;
      }
    }

    // Pass 2: misplaced matches
    for (let i = 0; i < CODE_LEN; i++) {
      if (!guessUsed[i]) {
        for (let j = 0; j < CODE_LEN; j++) {
          if (!secretUsed[j] && guess[i] === this.secret[j]) {
            clues[i] = 'Misplaced';
            secretUsed[j] = true;
            break;
          }
        }
      }
    }

    return clues;
  }

  tick() {
    if (this.isUnlocked || this.isLockedOut) return;

    if (this.timeRemaining > 0) {
      this.timeRemaining--;
      if (this.timeRemaining === 0) {
        this.isLockedOut = true;
        sfx.playAccessDenied();
      }
    }

    // Process clue reveal animation
    if (this.clueAnimationStep >= 0) {
      this.clueAnimationTimer++;
      if (this.clueAnimationTimer >= 8) {
        this.clueAnimationTimer = 0;
        const row = this.attempts[this.currentAttempt];
        const clue = row.clues[this.clueAnimationStep];
        if (clue === 'Exact') {
          sfx.playClueExact();
        } else if (clue === 'Misplaced') {
          sfx.playClueMisplaced();
        }

        this.clueAnimationStep++;
        if (this.clueAnimationStep >= CODE_LEN) {
          // Finished clue animation for this row
          this.clueAnimationStep = -1;

          const isAllExact = row.clues.every((c) => c === 'Exact');
          if (isAllExact) {
            this.isUnlocked = true;
            this.score += Math.floor(this.timeRemaining / 60) * 10;
            sfx.playAccessGranted();
          } else {
            this.currentAttempt++;
            if (this.currentAttempt >= MAX_ATTEMPTS) {
              this.isLockedOut = true;
              sfx.playAccessDenied();
            }
          }
        }
      }
    }
  }

  moveSlot(delta: number) {
    if (this.clueAnimationStep >= 0 || this.isUnlocked || this.isLockedOut) return;
    this.selectedSlot = Math.max(0, Math.min(CODE_LEN - 1, this.selectedSlot + delta));
    sfx.playSelect();
  }

  cycleSymbol(delta: number) {
    if (this.clueAnimationStep >= 0 || this.isUnlocked || this.isLockedOut) return;
    const currSym = this.currentGuess[this.selectedSlot];
    let idx = SYMBOLS.indexOf(currSym);
    if (idx === -1) idx = 0;
    idx = (idx + delta + SYMBOLS.length) % SYMBOLS.length;
    this.currentGuess[this.selectedSlot] = SYMBOLS[idx];
    sfx.playCycle();
  }

  submitGuess() {
    if (this.clueAnimationStep >= 0 || this.isUnlocked || this.isLockedOut) return;
    const clues = this.evaluateClues(this.currentGuess);
    this.attempts[this.currentAttempt] = {
      guess: [...this.currentGuess],
      clues,
      submitted: true,
    };

    sfx.playSubmit();
    this.score = Math.max(0, this.score - 120);
    this.clueAnimationStep = 0;
    this.clueAnimationTimer = 0;
  }
}

const sim = new HexLockSimulation();
let isPaused = false;
let frameCount = 0;

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    sim.moveSlot(-1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    sim.moveSlot(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    sim.cycleSymbol(1);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    sim.cycleSymbol(-1);
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (sim.isUnlocked || sim.isLockedOut) {
      sim.reset();
    } else {
      sim.submitGuess();
    }
  } else if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    isPaused = !isPaused;
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    sim.reset();
  }
});

function drawCRT() {
  ctx.fillStyle = EGA.black;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Background security grid lines
  ctx.strokeStyle = '#141008';
  ctx.lineWidth = 1;
  for (let y = 0; y < canvas.height; y += 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Header terminal bar
  ctx.fillStyle = EGA.brown;
  ctx.fillRect(0, 0, canvas.width, 24);
  ctx.fillStyle = EGA.yellow;
  ctx.font = 'bold 12px monospace';
  ctx.fillText('VAULT SECURITY TERMINAL // CIPHER ENGINE 8086', 10, 16);

  const seconds = Math.ceil(sim.timeRemaining / 60);
  ctx.fillStyle = seconds <= 15 ? EGA.lightRed : EGA.white;
  ctx.fillText(`TIME: ${seconds.toString().padStart(2, '0')}s`, 320, 16);
  ctx.fillStyle = EGA.lightCyan;
  ctx.fillText(`INTEGRITY: ${sim.score}`, 400, 16);

  // Left panel: Attempt history matrix
  ctx.fillStyle = '#0a0804';
  ctx.fillRect(16, 36, 260, 264);
  ctx.strokeStyle = EGA.brown;
  ctx.strokeRect(16, 36, 260, 264);

  ctx.fillStyle = EGA.yellow;
  ctx.font = '10px monospace';
  ctx.fillText('ATTEMPT LOG', 24, 50);
  ctx.fillText('CODE', 120, 50);
  ctx.fillText('STATUS / CLUES', 180, 50);

  ctx.strokeStyle = EGA.darkGrey;
  ctx.beginPath();
  ctx.moveTo(20, 56);
  ctx.lineTo(270, 56);
  ctx.stroke();

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const rowY = 70 + i * 36;
    const isCurrent = i === sim.currentAttempt && !sim.isUnlocked && !sim.isLockedOut;
    const row = sim.attempts[i];

    // Row indicator
    ctx.fillStyle = isCurrent ? EGA.yellow : EGA.darkGrey;
    ctx.fillText(`ENTRY #${i + 1}`, 24, rowY + 14);

    // Guess boxes
    for (let s = 0; s < CODE_LEN; s++) {
      const boxX = 100 + s * 18;
      ctx.fillStyle = row.submitted ? EGA.black : '#1a1408';
      ctx.fillRect(boxX, rowY, 16, 20);
      ctx.strokeStyle = isCurrent ? EGA.yellow : EGA.darkGrey;
      ctx.strokeRect(boxX, rowY, 16, 20);

      const charToDraw = row.submitted ? row.guess[s] : isCurrent ? sim.currentGuess[s] : '-';
      ctx.fillStyle = row.submitted ? EGA.white : isCurrent ? EGA.lightGreen : EGA.darkGrey;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(charToDraw, boxX + 4, rowY + 15);
    }

    // Clue status LEDs
    for (let c = 0; c < CODE_LEN; c++) {
      const ledX = 184 + c * 18;
      const ledY = rowY + 5;
      let ledColour = EGA.darkGrey;

      if (row.submitted) {
        if (
          i < sim.currentAttempt ||
          (i === sim.currentAttempt && sim.clueAnimationStep === -1) ||
          (i === sim.currentAttempt && c < sim.clueAnimationStep)
        ) {
          if (row.clues[c] === 'Exact') {
            ledColour = EGA.lightGreen;
          } else if (row.clues[c] === 'Misplaced') {
            ledColour = EGA.yellow;
          } else {
            ledColour = EGA.darkGrey;
          }
        }
      }

      ctx.fillStyle = ledColour;
      ctx.beginPath();
      ctx.arc(ledX + 5, ledY + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = EGA.black;
      ctx.stroke();
    }
  }

  // Right panel: Active Input Terminal & Glyph Wheel
  ctx.fillStyle = '#0a0804';
  ctx.fillRect(290, 36, 174, 264);
  ctx.strokeStyle = EGA.brown;
  ctx.strokeRect(290, 36, 174, 264);

  ctx.fillStyle = EGA.lightCyan;
  ctx.font = 'bold 11px monospace';
  ctx.fillText('DIAGNOSTIC CONSOLE', 300, 52);

  ctx.fillStyle = EGA.lightGrey;
  ctx.font = '10px monospace';
  ctx.fillText('ACTIVE CIPHER SLOT:', 300, 74);

  // Large slot boxes
  for (let s = 0; s < CODE_LEN; s++) {
    const slotX = 300 + s * 38;
    const slotY = 84;
    const isSel = s === sim.selectedSlot && !sim.isUnlocked && !sim.isLockedOut;

    ctx.fillStyle = isSel ? '#241a05' : '#140f04';
    ctx.fillRect(slotX, slotY, 32, 40);
    ctx.strokeStyle = isSel
      ? Math.floor(frameCount / 15) % 2 === 0
        ? EGA.yellow
        : EGA.white
      : EGA.darkGrey;
    ctx.lineWidth = isSel ? 2 : 1;
    ctx.strokeRect(slotX, slotY, 32, 40);

    ctx.fillStyle = isSel ? EGA.yellow : EGA.white;
    ctx.font = 'bold 20px monospace';
    ctx.fillText(sim.currentGuess[s], slotX + 9, slotY + 28);

    if (isSel) {
      // Arrow indicators
      ctx.fillStyle = EGA.yellow;
      ctx.font = '8px monospace';
      ctx.fillText('▲', slotX + 12, slotY - 3);
      ctx.fillText('▼', slotX + 12, slotY + 50);
    }
  }
  ctx.lineWidth = 1;

  // Glyph Palette display
  ctx.fillStyle = EGA.lightGrey;
  ctx.font = '10px monospace';
  ctx.fillText('PERMITTED GLYPHS:', 300, 154);

  for (let g = 0; g < SYMBOLS.length; g++) {
    const symX = 300 + (g % 3) * 52;
    const symY = 166 + Math.floor(g / 3) * 24;
    const isActive = SYMBOLS[g] === sim.currentGuess[sim.selectedSlot];

    ctx.fillStyle = isActive ? EGA.brown : '#140f04';
    ctx.fillRect(symX, symY, 44, 18);
    ctx.strokeStyle = isActive ? EGA.yellow : EGA.darkGrey;
    ctx.strokeRect(symX, symY, 44, 18);

    ctx.fillStyle = isActive ? EGA.yellow : EGA.lightGrey;
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`0x${SYMBOLS[g]}`, symX + 10, symY + 13);
  }

  // Legend
  ctx.fillStyle = EGA.lightGrey;
  ctx.font = '9px monospace';
  ctx.fillText('CLUE INDICATORS:', 300, 234);

  ctx.fillStyle = EGA.lightGreen;
  ctx.beginPath();
  ctx.arc(308, 248, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('EXACT (Position & Glyph)', 318, 251);

  ctx.fillStyle = EGA.yellow;
  ctx.beginPath();
  ctx.arc(308, 264, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('MISPLACED (Wrong Slot)', 318, 267);

  ctx.fillStyle = EGA.darkGrey;
  ctx.beginPath();
  ctx.arc(308, 280, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillText('MISS (Glyph Absent)', 318, 283);

  // Status Banner / Overlay
  if (sim.isUnlocked) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(40, 110, 400, 140);
    ctx.strokeStyle = EGA.lightGreen;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 110, 400, 140);
    ctx.lineWidth = 1;

    ctx.fillStyle = EGA.lightGreen;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('*** ACCESS GRANTED ***', 110, 145);

    ctx.fillStyle = EGA.white;
    ctx.font = '12px monospace';
    ctx.fillText(`VAULT CIPHER BROKEN IN ${sim.currentAttempt + 1} ATTEMPTS!`, 100, 175);
    ctx.fillText(`INTEGRITY SCORE: ${sim.score}`, 160, 200);

    ctx.fillStyle = EGA.yellow;
    ctx.font = '11px monospace';
    ctx.fillText('PRESS [SPACE] OR [R] TO PLAY AGAIN', 125, 230);
  } else if (sim.isLockedOut) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(40, 110, 400, 140);
    ctx.strokeStyle = EGA.lightRed;
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 110, 400, 140);
    ctx.lineWidth = 1;

    ctx.fillStyle = EGA.lightRed;
    ctx.font = 'bold 20px monospace';
    ctx.fillText('*** ACCESS DENIED ***', 120, 145);

    ctx.fillStyle = EGA.white;
    ctx.font = '12px monospace';
    ctx.fillText('TERMINAL LOCKOUT ENFORCED.', 140, 175);
    ctx.fillText(`SECRET CIPHER WAS: [ ${sim.secret.join(' ')} ]`, 130, 200);

    ctx.fillStyle = EGA.yellow;
    ctx.font = '11px monospace';
    ctx.fillText('PRESS [SPACE] OR [R] TO RETRY', 140, 230);
  } else if (isPaused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(140, 140, 200, 60);
    ctx.strokeStyle = EGA.yellow;
    ctx.strokeRect(140, 140, 200, 60);

    ctx.fillStyle = EGA.yellow;
    ctx.font = 'bold 16px monospace';
    ctx.fillText('PAUSED', 210, 176);
  }

  // CRT scanlines overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillRect(0, y, canvas.width, 1);
  }
}

function gameLoop() {
  frameCount++;
  if (!isPaused) {
    sim.tick();
  }
  drawCRT();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
