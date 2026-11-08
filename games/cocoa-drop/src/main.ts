// Entry point for Cocoa Drop Web
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

let active_piece_y = 0;

function update() {
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // draw board bounds
    ctx.strokeStyle = '#8b6851';
    ctx.strokeRect(50, 50, 300, 600);

    // draw active piece
    ctx.fillStyle = '#ffb833';
    ctx.fillRect(150, 50 + active_piece_y, 30, 30);
  }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);

setInterval(() => {
  active_piece_y = (active_piece_y + 30) % 600;
}, 500);
