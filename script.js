const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const btn = document.getElementById("toggleBtn");
let running = true;
let x = 40, y = 40, vx = 3.2, vy = 2.6, size = 24;

btn.addEventListener("click", () => {
  running = !running;
  btn.textContent = running ? "Pause Animation" : "Resume Animation";
  if (running) requestAnimationFrame(loop);
});

function loop() {
  if (!running) return;
  ctx.fillStyle = "rgba(1, 4, 9, 0.25)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  x += vx;
  y += vy;
  if (x <= 0 || x + size >= canvas.width) vx *= -1;
  if (y <= 0 || y + size >= canvas.height) vy *= -1;

  ctx.fillStyle = "#58a6ff";
  ctx.fillRect(x, y, size, size);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
