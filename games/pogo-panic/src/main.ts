// Entry point for Pogo Panic Web
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

let player_y = 700;
let player_vy = 0;

function update() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw platforms
    ctx.fillStyle = '#8b6851';
    ctx.fillRect(100, 750, 100, 20);
    ctx.fillRect(200, 600, 100, 20);
    ctx.fillRect(50, 450, 100, 20);

    // draw player
    ctx.fillStyle = '#ffb833';
    ctx.fillRect(150, player_y, 30, 30);
  }

  player_vy += 0.5;
  player_y += player_vy;

  if (player_y > 800) {
    player_y = 700;
    player_vy = -12;
  }

  requestAnimationFrame(update);
}
requestAnimationFrame(update);
