// Entry point for Gumdrop Pac-Man Web
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

let px = 100;
let py = 100;

function update() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw maze walls
    ctx.fillStyle = '#8b6851';
    ctx.fillRect(50, 50, 200, 20);
    ctx.fillRect(50, 50, 20, 200);

    // draw player
    ctx.fillStyle = '#ffb833';
    ctx.fillRect(px, py, 20, 20);
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);
