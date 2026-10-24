'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Paletas 1-indexadas: el slot 0 es null porque 0 = celda vacia.
const PALETTES = {
  dark: [
    null,
    '#4dd0e1', // I - cyan
    '#ffd54f', // O - yellow
    '#ba68c8', // T - purple
    '#81c784', // S - green
    '#e57373', // Z - red
    '#90caf9', // J - pale blue
    '#ffb74d', // L - orange
    '#f06292', // + - rosa
    '#4db6ac', // U - verde azulado
    '#dce775', // Y - lima
    '#eceff1', // 1x1 - blanco (premio)
    '#a1887f', // 3x3 hueca - marron (reto)
    '#ef5350', // bomba
    '#fff176', // rayo
    '#ce93d8', // tinte
    '#80cbc4', // gravedad
    '#64b5f6', // congelar
    '#fafafa', // comodin
  ],
  light: [
    null,
    '#0097a7', // I - cyan
    '#e6a700', // O - yellow
    '#8e24aa', // T - purple
    '#388e3c', // S - green
    '#c62828', // Z - red
    '#3949ab', // J - indigo
    '#ef6c00', // L - orange
    '#d81b60', // + - rosa
    '#00796b', // U - verde azulado
    '#9e9d24', // Y - lima
    '#455a64', // 1x1 - pizarra (premio)
    '#6d4c41', // 3x3 hueca - marron (reto)
    '#d32f2f', // bomba
    '#f9a825', // rayo
    '#8e24aa', // tinte
    '#00897b', // gravedad
    '#1565c0', // congelar
    '#90a4ae', // comodin
  ],
};

const THEME_CHROME = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#d7dcea', highlight: 'rgba(255,255,255,0.35)' },
};

const THEME_KEY = 'tetris-theme';

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // +
  [[9,0,9],[9,0,9],[9,9,9]],                  // U
  [[10,0,10],[0,10,0],[0,10,0]],              // Y
  [[11]],                                     // 1x1 - premio por tetris
  [[12,12,12],[12,0,12],[12,12,12]],          // 3x3 hueca - reto
  [[13]],                                     // bomba
  [[14]],                                     // rayo
  [[15]],                                     // tinte
  [[16]],                                     // gravedad
  [[17]],                                     // congelar
  null,                                       // 18 = comodin: valor de celda, nunca una pieza
];

// La 1x1 no entra en el sorteo: solo se gana haciendo un tetris.
const REWARD_PIECE = 11;
const CHALLENGE_PIECE = 12;
const CHALLENGE_CHANCE = 0.05;
const NORMAL_PIECES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CHALLENGE_BONUS = 300;

// Piezas especiales: tampoco entran en el sorteo, aparecen cada SPECIAL_EVERY lineas.
// Son 1x1, nunca se fusionan con el tablero: al aterrizar se consumen y lanzan su efecto.
const SPECIAL_PIECES = [13, 14, 15, 16, 17];
const WILDCARD = 18;
const SPECIAL_EVERY = 5;
const FREEZE_MS = 5000;
const SPECIAL_SCORE = 10; // por bloque eliminado, x nivel

const SPECIAL_NAMES = {
  13: 'BOMBA',
  14: 'RAYO',
  15: 'TINTE',
  16: 'GRAVEDAD',
  17: 'CONGELAR',
};

const GLYPHS = {
  13: '\u{1F4A3}',
  14: '\u26A1',
  15: '\u{1F3A8}',
  16: '\u2B07',
  17: '\u2744',
  18: '\u2605',
};

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-btn');
const themeLabel = document.getElementById('theme-label');
const specialEl = document.getElementById('special-status');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let rewardPending, specialPending, nextSpecialAt, freezeRemaining;
let theme, COLORS, themeChrome;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  if (Math.random() < CHALLENGE_CHANCE) return makePiece(CHALLENGE_PIECE);
  return makePiece(NORMAL_PIECES[Math.floor(Math.random() * NORMAL_PIECES.length)]);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    // Los comodines son fragiles: cualquier linea limpiada los borra a todos.
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c] === WILDCARD) board[r][c] = 0;
    // Un tetris (4 lineas de golpe) regala la pieza 1x1 como siguiente.
    if (cleared === 4) rewardPending = true;
    // Una sola jugada puede cruzar mas de un umbral, de ahi el while.
    while (lines >= nextSpecialAt) {
      specialPending = true;
      nextSpecialAt += SPECIAL_EVERY;
    }
    updateHUD();
  }
  return cleared;
}

function randomSpecial() {
  return makePiece(SPECIAL_PIECES[Math.floor(Math.random() * SPECIAL_PIECES.length)]);
}

// Bomba: arrasa el 3x3 centrado en la celda. Deja los bloques de arriba flotando;
// recompactarlos es justo el trabajo de la pieza gravedad.
function blastArea(x, y) {
  let hits = 0;
  for (let r = y - 1; r <= y + 1; r++) {
    for (let c = x - 1; c <= x + 1; c++) {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (board[r][c]) { board[r][c] = 0; hits++; }
    }
  }
  return hits;
}

// Rayo: fila y columna completas de la celda.
function blastCross(x, y) {
  let hits = 0;
  for (let c = 0; c < COLS; c++) if (board[y][c]) { board[y][c] = 0; hits++; }
  for (let r = 0; r < ROWS; r++) if (board[r][x]) { board[r][x] = 0; hits++; }
  return hits;
}

// Tinte: el color mas abundante del tablero pasa a comodin.
function tintColor() {
  const count = new Map();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (!v || v === WILDCARD) continue;
      count.set(v, (count.get(v) || 0) + 1);
    }
  }
  let best = 0, bestN = 0;
  for (const [v, n] of count) if (n > bestN) { best = v; bestN = n; }
  if (!best) return 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c] === best) board[r][c] = WILDCARD;
  return bestN;
}

// Gravedad: cada columna cae y se come sus huecos.
function applyGravity() {
  let moved = 0;
  for (let c = 0; c < COLS; c++) {
    const stack = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c]) stack.push(board[r][c]);
    for (let r = ROWS - 1, i = stack.length - 1; r >= 0; r--, i--) {
      const v = i >= 0 ? stack[i] : 0;
      if (board[r][c] !== v) moved++;
      board[r][c] = v;
    }
  }
  return moved;
}

function applySpecial(type, x, y) {
  let hits = 0;
  switch (type) {
    case 13: hits = blastArea(x, y); break;
    case 14: hits = blastCross(x, y); break;
    case 15: hits = tintColor(); break;
    case 16: hits = applyGravity(); break;
    case 17: freezeRemaining = FREEZE_MS; break;
  }
  score += SPECIAL_SCORE * hits * level;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const lockedType = current.type;
  // Las especiales no se fusionan: se consumen al aterrizar.
  if (SPECIAL_NAMES[lockedType]) { applySpecial(lockedType, current.x, current.y); updateHUD(); }
  else merge();
  const cleared = clearLines();
  if (lockedType === CHALLENGE_PIECE && cleared) {
    score += CHALLENGE_BONUS * cleared * level;
    updateHUD();
  }
  spawn();
}

function spawn() {
  current = next;
  // El premio por tetris tiene prioridad; la especial queda pendiente, no se pierde.
  if (rewardPending) { next = makePiece(REWARD_PIECE); rewardPending = false; }
  else if (specialPending) { next = randomSpecial(); specialPending = false; }
  else next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  updateSpecialHUD();
}

function updateSpecialHUD() {
  let text;
  if (freezeRemaining > 0) text = `${GLYPHS[17]} ${(freezeRemaining / 1000).toFixed(1)}s`;
  else if (next && SPECIAL_NAMES[next.type]) text = `\u00a1${SPECIAL_NAMES[next.type]}!`;
  else text = `en ${Math.max(0, nextSpecialAt - lines)} l\u00edneas`;
  if (specialEl.textContent !== text) specialEl.textContent = text;
  specialEl.classList.toggle('frozen', freezeRemaining > 0);
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = themeChrome.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  const glyph = GLYPHS[colorIndex];
  if (glyph) {
    context.font = `${Math.floor(size * 0.55)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = themeChrome.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  // Congelar solo detiene la caida automatica; mover y rotar siguen activos.
  // La pausa cancela el frame, asi que el contador tampoco corre en PAUSA.
  if (freezeRemaining > 0) {
    freezeRemaining = Math.max(0, freezeRemaining - dt);
    dropAccum = 0;
    updateSpecialHUD();
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
        // lockPiece puede terminar la partida: endGame ya cancelo el frame,
        // asi que no hay que volver a agendar uno ni seguir dibujando piezas.
        if (gameOver) return;
      }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function applyTheme(name) {
  theme = name;
  COLORS = PALETTES[theme];
  themeChrome = THEME_CHROME[theme];
  document.documentElement.dataset.theme = theme;
  themeBtn.setAttribute('aria-pressed', String(theme === 'light'));
  themeLabel.textContent = theme === 'light' ? 'Claro' : 'Oscuro';
  // El loop esta detenido en PAUSA y GAME OVER, hay que repintar a mano.
  if (board) { draw(); drawNext(); }
}

function storedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
}

function toggleTheme() {
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
  try { localStorage.setItem(THEME_KEY, nextTheme); } catch (e) {}
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  rewardPending = false;
  specialPending = false;
  nextSpecialAt = SPECIAL_EVERY;
  freezeRemaining = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyT') { toggleTheme(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeBtn.addEventListener('click', toggleTheme);

// Sin eleccion guardada, el juego sigue el tema del sistema.
matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
  const stored = storedTheme();
  if (stored !== 'light' && stored !== 'dark') applyTheme(e.matches ? 'light' : 'dark');
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
init();
