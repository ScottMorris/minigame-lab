// Entry point for Gloop Slugger Web
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

let active_gloop = 0;

function update() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw grid
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        ctx.fillStyle = '#8b6851';
        ctx.fillRect(x * 100 + 150, y * 100 + 150, 90, 90);

        if (active_gloop === y * 3 + x) {
          ctx.fillStyle = '#ffb833';
          ctx.beginPath();
          ctx.arc(x * 100 + 195, y * 100 + 195, 30, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);

setInterval(() => {
  active_gloop = (active_gloop + 1) % 9;
}, 1000);
