const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
const statusEl = document.getElementById("statusText");
const actionBtn = document.getElementById("actionBtn");

const ROWS = 5, COLS = 8, PAD = 8, TOP_OFFSET = 38, SIDE_OFFSET = 22;
const BRICK_W = (canvas.width - SIDE_OFFSET * 2 - PAD * (COLS - 1)) / COLS;
const BRICK_H = 18;
const COLORS = ["#ff7b72", "#ffa657", "#d29922", "#3fb950", "#58a6ff"];

let score = 0, lives = 3, running = false, gameOver = false;
let best = Number(localStorage.getItem("pixel_brick_best") || 0);
bestEl.textContent = best;

const paddle = { w: 86, h: 12, x: (canvas.width - 86) / 2, speed: 6.5 };
const ball = { x: canvas.width / 2, y: canvas.height - 32, r: 7, vx: 3.4, vy: -3.4 };
let keys = { left: false, right: false };
let bricks = [];

function initBricks() {
  bricks = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bricks.push({
        x: SIDE_OFFSET + c * (BRICK_W + PAD),
        y: TOP_OFFSET + r * (BRICK_H + PAD),
        alive: true,
        color: COLORS[r % COLORS.length],
        pts: (ROWS - r) * 10
      });
    }
  }
}

function resetBall() {
  ball.x = canvas.width / 2;
  ball.y = canvas.height - 32;
  ball.vx = 3.4 * (Math.random() > 0.5 ? 1 : -1);
  ball.vy = -3.4;
}

function startNewGame() {
  score = 0;
  lives = 3;
  gameOver = false;
  running = true;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  statusEl.textContent = "Playing...";
  paddle.x = (canvas.width - paddle.w) / 2;
  initBricks();
  resetBall();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
  if (e.code === "Space" && (!running || gameOver)) startNewGame();
});
document.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});
actionBtn.addEventListener("click", startNewGame);

function update() {
  if (!running) return;
  if (keys.left) paddle.x = Math.max(0, paddle.x - paddle.speed);
  if (keys.right) paddle.x = Math.min(canvas.width - paddle.w, paddle.x + paddle.speed);

  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x - ball.r <= 0 || ball.x + ball.r >= canvas.width) ball.vx *= -1;
  if (ball.y - ball.r <= 0) ball.vy *= -1;

  if (
    ball.vy > 0 &&
    ball.y + ball.r >= canvas.height - 20 &&
    ball.y - ball.r <= canvas.height - 20 + paddle.h &&
    ball.x >= paddle.x &&
    ball.x <= paddle.x + paddle.w
  ) {
    const hitOffset = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    ball.vx = hitOffset * 4.5;
    ball.vy = -Math.abs(ball.vy);
  }

  let remaining = 0;
  for (const b of bricks) {
    if (!b.alive) continue;
    remaining++;
    if (
      ball.x + ball.r > b.x &&
      ball.x - ball.r < b.x + BRICK_W &&
      ball.y + ball.r > b.y &&
      ball.y - ball.r < b.y + BRICK_H
    ) {
      b.alive = false;
      remaining--;
      ball.vy *= -1;
      score += b.pts;
      scoreEl.textContent = score;
      if (score > best) {
        best = score;
        bestEl.textContent = best;
        localStorage.setItem("pixel_brick_best", best);
      }
      break;
    }
  }

  if (remaining === 0) {
    statusEl.textContent = "Stage Cleared! Next Wave...";
    initBricks();
    resetBall();
    ball.vx *= 1.1;
    ball.vy *= 1.1;
  }

  if (ball.y - ball.r > canvas.height) {
    lives--;
    livesEl.textContent = lives;
    if (lives <= 0) {
      running = false;
      gameOver = true;
      statusEl.textContent = "Game Over! Press Space or Restart";
    } else {
      resetBall();
    }
  }
}

function draw() {
  ctx.fillStyle = "#010409";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const b of bricks) {
    if (!b.alive) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
  }

  ctx.fillStyle = "#e6edf3";
  ctx.fillRect(paddle.x, canvas.height - 20, paddle.w, paddle.h);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#79c0ff";
  ctx.fill();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

initBricks();
requestAnimationFrame(loop);
