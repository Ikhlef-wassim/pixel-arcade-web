const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("statusText");
const actionBtn = document.getElementById("actionBtn");
const muteBtn = document.getElementById("muteBtn");

const W = canvas.width, H = canvas.height;
const COLS = 8, PAD = 8, TOP_OFFSET = 38, SIDE_OFFSET = 22;
const BRICK_W = (W - SIDE_OFFSET * 2 - PAD * (COLS - 1)) / COLS;
const BRICK_H = 18;
const COLORS = ["#ff7b72", "#ffa657", "#d29922", "#3fb950", "#58a6ff"];
const PADDLE_Y = H - 20, PADDLE_W = 86, WIDE_W = 130;
const BASE_SPEED = 3.4;

// Digits are brick hit points, "." is empty. Levels repeat (faster) after the last one.
const LEVELS = [
  ["11111111", "11111111", "11111111", "11111111"],
  ["22222222", "11111111", "11111111", "11111111", "11111111"],
  ["12121212", "21212121", "12121212", "21212121", "12121212"],
  ["...33...", "..2222..", ".222222.", "11111111", "1..11..1"],
  ["33333333", "2.2..2.2", "22222222", "1.1111.1", "11111111"]
];

const POWERUPS = {
  W: { color: "#3fb950", label: "Wide paddle!" },
  M: { color: "#a371f7", label: "Multi-ball!" },
  S: { color: "#58a6ff", label: "Slow ball!" }
};

let state = "title"; // title | playing | paused | over
let score = 0, lives = 3, level = 1, speed = BASE_SPEED;
let best = Number(localStorage.getItem("pixel_brick_best") || 0);
let wideTicks = 0, slowTicks = 0, banner = 0, bannerText = "";
let bricks = [], balls = [], drops = [];
const paddle = { w: PADDLE_W, h: 12, x: (W - PADDLE_W) / 2, speed: 6.5 };
const keys = { left: false, right: false };

/* ---------- Sound (generated in code, no audio files) ---------- */
let audio = null;
let muted = localStorage.getItem("pixel_brick_muted") === "1";

function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch (e) {}
}

function tone(freq, dur = 0.08, type = "square", vol = 0.05, delay = 0) {
  if (muted || !audio) return;
  try {
    const t = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch (e) {}
}

function toggleMute() {
  muted = !muted;
  localStorage.setItem("pixel_brick_muted", muted ? "1" : "0");
  muteBtn.textContent = muted ? "Sound: Off" : "Sound: On";
}

/* ---------- HUD helpers ---------- */
function setStatus(text) { statusEl.textContent = text; }

function syncHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  livesEl.textContent = lives;
  levelEl.textContent = level;
}

function addScore(n) {
  score += n;
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem("pixel_brick_best", best);
  }
}

/* ---------- Setup ---------- */
function newBall(vx) { return { x: W / 2, y: H - 32, r: 7, vx, vy: -speed }; }

function resetBalls() {
  balls = [newBall(speed * (Math.random() > 0.5 ? 1 : -1))];
}

function clampPaddle() {
  paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
}

function setPaddleWidth(w) {
  const center = paddle.x + paddle.w / 2;
  paddle.w = w;
  paddle.x = center - w / 2;
  clampPaddle();
}

function loadLevel(n) {
  speed = Math.min(BASE_SPEED * (1 + 0.08 * (n - 1)), BASE_SPEED * 1.8);
  bricks = [];
  LEVELS[(n - 1) % LEVELS.length].forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      bricks.push({
        x: SIDE_OFFSET + c * (BRICK_W + PAD),
        y: TOP_OFFSET + r * (BRICK_H + PAD),
        hp: Number(ch),
        color: COLORS[r % COLORS.length],
        pts: (5 - (r % 5)) * 10
      });
    });
  });
  drops = [];
  resetBalls();
}

function startNewGame() {
  score = 0; lives = 3; level = 1;
  wideTicks = 0; slowTicks = 0;
  setPaddleWidth(PADDLE_W);
  paddle.x = (W - paddle.w) / 2;
  loadLevel(level);
  banner = 90; bannerText = "Level 1";
  state = "playing";
  syncHud();
  setStatus("Playing...");
}

function togglePause() {
  if (state === "playing") {
    state = "paused";
    setStatus("Paused. Press P or Space to resume");
  } else if (state === "paused") {
    state = "playing";
    setStatus("Playing...");
  }
}

function nextLevel() {
  level++;
  addScore(100);
  loadLevel(level);
  banner = 90; bannerText = "Level " + level;
  levelEl.textContent = level;
  setStatus("Level cleared! +100");
  tone(523, 0.1, "triangle", 0.06);
  tone(659, 0.1, "triangle", 0.06, 0.1);
  tone(784, 0.18, "triangle", 0.06, 0.2);
}

function loseLife() {
  lives--;
  livesEl.textContent = lives;
  tone(150, 0.35, "sawtooth", 0.06);
  if (lives <= 0) {
    state = "over";
    setStatus("Game Over! Press Space or Restart");
  } else {
    resetBalls();
    drops = [];
    banner = 45; bannerText = "Get ready";
  }
}

/* ---------- Power-ups ---------- */
function maybeDrop(br) {
  if (Math.random() >= 0.16) return;
  const type = ["W", "M", "S"][Math.floor(Math.random() * 3)];
  drops.push({ x: br.x + BRICK_W / 2 - 11, y: br.y, type });
}

function applyPower(type) {
  tone(660, 0.08, "triangle", 0.06);
  tone(880, 0.1, "triangle", 0.06, 0.08);
  addScore(25);
  if (type === "W") { wideTicks = 600; setPaddleWidth(WIDE_W); }
  if (type === "S") slowTicks = 480;
  if (type === "M") {
    const extra = [];
    for (const b of balls.slice(0, 3)) {
      extra.push({ ...b, vx: b.vx + 1.2 }, { ...b, vx: b.vx - 1.2 });
    }
    balls = balls.concat(extra).slice(0, 7);
  }
  setStatus(POWERUPS[type].label);
}

/* ---------- Game step ---------- */
function stepBall(b, k) {
  b.x += b.vx * k;
  b.y += b.vy * k;

  if (b.x - b.r <= 0) { b.x = b.r; b.vx = Math.abs(b.vx); tone(300, 0.04); }
  else if (b.x + b.r >= W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); tone(300, 0.04); }
  if (b.y - b.r <= 0) { b.y = b.r; b.vy = Math.abs(b.vy); tone(300, 0.04); }

  if (
    b.vy > 0 &&
    b.y + b.r >= PADDLE_Y &&
    b.y - b.r <= PADDLE_Y + paddle.h &&
    b.x >= paddle.x &&
    b.x <= paddle.x + paddle.w
  ) {
    const offset = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
    b.vx = offset * speed * 1.3;
    if (Math.abs(b.vx) < 0.8) b.vx = b.vx < 0 ? -0.8 : 0.8;
    b.vy = -speed;
    b.y = PADDLE_Y - b.r;
    tone(380, 0.06);
  }

  for (const br of bricks) {
    if (
      br.hp > 0 &&
      b.x + b.r > br.x && b.x - b.r < br.x + BRICK_W &&
      b.y + b.r > br.y && b.y - b.r < br.y + BRICK_H
    ) {
      const ox = Math.min(b.x + b.r - br.x, br.x + BRICK_W - (b.x - b.r));
      const oy = Math.min(b.y + b.r - br.y, br.y + BRICK_H - (b.y - b.r));
      if (ox < oy) {
        b.vx = b.x < br.x + BRICK_W / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
      } else {
        b.vy = b.y < br.y + BRICK_H / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
      }
      br.hp--;
      if (br.hp <= 0) {
        addScore(br.pts);
        tone(520 + br.pts * 4, 0.07, "triangle");
        maybeDrop(br);
      } else {
        addScore(5);
        tone(260, 0.05);
      }
      break;
    }
  }
}

function update() {
  if (state !== "playing") return;

  if (keys.left) paddle.x -= paddle.speed;
  if (keys.right) paddle.x += paddle.speed;
  clampPaddle();

  const hadEffect = wideTicks > 0 || slowTicks > 0;
  if (wideTicks > 0 && --wideTicks === 0) setPaddleWidth(PADDLE_W);
  if (slowTicks > 0) slowTicks--;
  if (hadEffect && wideTicks === 0 && slowTicks === 0) setStatus("Playing...");

  if (banner > 0) { banner--; return; }

  const k = slowTicks > 0 ? 0.7 : 1;
  for (const b of balls) stepBall(b, k);

  for (const d of drops) {
    d.y += 2;
    if (d.y + 14 >= PADDLE_Y && d.y <= PADDLE_Y + paddle.h && d.x + 22 >= paddle.x && d.x <= paddle.x + paddle.w) {
      applyPower(d.type);
      d.dead = true;
    } else if (d.y > H) {
      d.dead = true;
    }
  }
  drops = drops.filter((d) => !d.dead);

  bricks = bricks.filter((b) => b.hp > 0);
  if (bricks.length === 0) { nextLevel(); return; }

  balls = balls.filter((b) => b.y - b.r <= H);
  if (balls.length === 0) loseLife();
}

/* ---------- Drawing ---------- */
function overlay(title, lines) {
  ctx.fillStyle = "rgba(1, 4, 9, 0.78)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e6edf3";
  ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(title, W / 2, H / 2 - 30);
  ctx.fillStyle = "#8b949e";
  ctx.font = "14px monospace";
  lines.forEach((t, i) => ctx.fillText(t, W / 2, H / 2 + 6 + i * 22));
}

function draw() {
  ctx.fillStyle = "#010409";
  ctx.fillRect(0, 0, W, H);

  for (const b of bricks) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
    if (b.hp > 1) {
      ctx.strokeStyle = "#e6edf3";
      ctx.lineWidth = b.hp - 1;
      ctx.strokeRect(b.x + 2, b.y + 2, BRICK_W - 4, BRICK_H - 4);
    }
  }

  ctx.textAlign = "center";
  ctx.font = "bold 11px monospace";
  for (const d of drops) {
    ctx.fillStyle = POWERUPS[d.type].color;
    ctx.fillRect(d.x, d.y, 22, 14);
    ctx.fillStyle = "#010409";
    ctx.fillText(d.type, d.x + 11, d.y + 11);
  }

  ctx.fillStyle = wideTicks > 0 ? "#3fb950" : "#e6edf3";
  ctx.fillRect(paddle.x, PADDLE_Y, paddle.w, paddle.h);

  for (const b of balls) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = "#79c0ff";
    ctx.fill();
  }

  if (state === "playing" && banner > 0) {
    ctx.fillStyle = "#58a6ff";
    ctx.font = "bold 24px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(bannerText, W / 2, H / 2 + 40);
  }

  if (state === "title") {
    overlay("Pixel Brick Breaker", [
      "Press Space or tap to start",
      "W wide paddle  M multi-ball  S slow ball",
      "Best: " + best
    ]);
  } else if (state === "paused") {
    overlay("Paused", ["Press P or Space to resume"]);
  } else if (state === "over") {
    overlay("Game Over", ["Score: " + score + "   Best: " + best, "Press Space or tap to play again"]);
  }
}

/* ---------- Input ---------- */
document.addEventListener("keydown", (e) => {
  unlockAudio();
  const k = e.key;
  if (k === "ArrowLeft" || k === "a" || k === "A") { keys.left = true; e.preventDefault(); }
  if (k === "ArrowRight" || k === "d" || k === "D") { keys.right = true; e.preventDefault(); }
  if (e.repeat) return;
  if (e.code === "Space") {
    e.preventDefault();
    if (state === "title" || state === "over") startNewGame();
    else if (state === "paused") togglePause();
  }
  if (k === "p" || k === "P" || k === "Escape") togglePause();
  if (k === "m" || k === "M") toggleMute();
});

document.addEventListener("keyup", (e) => {
  const k = e.key;
  if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
  if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
});

function pointerToPaddle(e) {
  const rect = canvas.getBoundingClientRect();
  paddle.x = ((e.clientX - rect.left) / rect.width) * W - paddle.w / 2;
  clampPaddle();
}

canvas.addEventListener("pointermove", pointerToPaddle);
canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  pointerToPaddle(e);
  if (state === "title" || state === "over") startNewGame();
  else if (state === "paused") togglePause();
});

actionBtn.addEventListener("click", () => {
  unlockAudio();
  startNewGame();
  actionBtn.blur();
});
muteBtn.addEventListener("click", () => { toggleMute(); muteBtn.blur(); });

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state === "playing") togglePause();
});

/* ---------- Main loop (fixed 60 updates/sec on any screen) ---------- */
const STEP = 1000 / 60;
let last = 0, acc = 0;

function loop(ts) {
  acc += Math.min(ts - last, 100);
  last = ts;
  while (acc >= STEP) { update(); acc -= STEP; }
  draw();
  requestAnimationFrame(loop);
}

loadLevel(1);
syncHud();
muteBtn.textContent = muted ? "Sound: Off" : "Sound: On";
setStatus("Press Space or tap to start");
requestAnimationFrame((ts) => { last = ts; loop(ts); });
