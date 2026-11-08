// Entry point for Crystal Defender Web
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

let angle = 0;

function update() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(400, 300);
    ctx.rotate(angle);

    // draw ship
    ctx.fillStyle = '#ffb833';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  angle += 0.05;
  requestAnimationFrame(update);
}
requestAnimationFrame(update);
