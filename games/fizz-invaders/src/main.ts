// Entry point for Fizz Invaders Web
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

let x = 400;

function update() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffb833';
    ctx.fillRect(x, 500, 32, 32);
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);
