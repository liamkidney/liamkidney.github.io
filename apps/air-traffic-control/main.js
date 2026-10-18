import { advanceGame, assignRoute, beginGame, createGame, distance, MAX_INCIDENTS, resizeGame, runwayFor, togglePause } from './engine.js';

const canvas = document.querySelector('#sky');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const landedEl = document.querySelector('#landed');
const incidentsEl = document.querySelector('#incidents');
const overlay = document.querySelector('#overlay');
const panelKicker = document.querySelector('#panel-kicker');
const panelTitle = document.querySelector('#panel-title');
const panelCopy = document.querySelector('#panel-copy');
const panelAction = document.querySelector('#panel-action');
const pauseButton = document.querySelector('#pause');
const restartButton = document.querySelector('#restart');
const toast = document.querySelector('#toast');

let game = createGame();
let activeStroke = null;
let lastTime = 0;
let lastState = null;
let toastUntil = 0;
let toastWarning = false;
let bestScore = 0;
try { bestScore = Number(localStorage.getItem('approach-best') || 0); } catch { /* Private browsing. */ }

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  resizeGame(game, width, height);
}
new ResizeObserver(resize).observe(canvas);
window.addEventListener('resize', resize);
resize();

function reset(startImmediately = false) {
  activeStroke = null;
  game = createGame({ width: game.width, height: game.height });
  if (startImmediately) beginGame(game);
  syncPanel(true);
}

function showToast(message, warning = false) {
  toast.textContent = message;
  toastWarning = warning;
  toastUntil = performance.now() + 1800;
  toast.classList.toggle('warning', warning);
  toast.classList.add('visible');
}

function consumeEvents() {
  for (const event of game.events.splice(0)) {
    if (event.type === 'landed') showToast('+100  ·  Safe landing');
    if (event.type === 'collision') showToast('Collision! Aircraft lost.', true);
    if (event.type === 'missed') showToast('Aircraft left the airspace.', true);
    if (event.type === 'route' && event.landing) showToast('Runway approach locked');
    if (event.type === 'route' && !event.landing) showToast('Route set · finish at the green marker');
    if (event.type === 'over' && game.score > bestScore) {
      bestScore = game.score;
      try { localStorage.setItem('approach-best', String(bestScore)); } catch { /* Private browsing. */ }
    }
  }
}

function syncPanel(force = false) {
  if (!force && game.state === lastState) return;
  lastState = game.state;
  pauseButton.disabled = game.state === 'ready' || game.state === 'over';
  pauseButton.textContent = game.state === 'paused' ? 'Resume' : 'Pause';
  overlay.classList.toggle('hidden', game.state === 'playing');
  if (game.state === 'ready') {
    panelKicker.textContent = 'TOWER CONTROL';
    panelTitle.textContent = 'Clear the skies.';
    panelCopy.textContent = 'Planes arrive from the radar edges. Touch an aircraft and draw a flight path to the green runway entrance. Keep aircraft apart. Three incidents end the shift.';
    panelAction.innerHTML = 'Start shift <span aria-hidden="true">↗</span>';
  } else if (game.state === 'paused') {
    panelKicker.textContent = 'SHIFT PAUSED';
    panelTitle.textContent = 'Holding pattern.';
    panelCopy.textContent = 'All aircraft are paused. Resume when you are ready to take control.';
    panelAction.innerHTML = 'Resume shift <span aria-hidden="true">↗</span>';
  } else if (game.state === 'over') {
    panelKicker.textContent = 'SHIFT COMPLETE';
    panelTitle.textContent = 'Airspace closed.';
    panelCopy.textContent = 'You landed ' + game.landed + ' aircraft and scored ' + game.score + ' points. Best score: ' + bestScore + '. Ready for another shift?';
    panelAction.innerHTML = 'Try again <span aria-hidden="true">↗</span>';
  }
}

panelAction.addEventListener('click', () => {
  if (game.state === 'over') reset(true);
  else if (game.state === 'ready') beginGame(game);
  else if (game.state === 'paused') togglePause(game);
  syncPanel(true);
});
pauseButton.addEventListener('click', () => { activeStroke = null; togglePause(game); syncPanel(true); });
restartButton.addEventListener('click', () => reset(true));
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && (game.state === 'playing' || game.state === 'paused')) {
    activeStroke = null; togglePause(game); syncPanel(true);
  }
});

function eventPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

canvas.addEventListener('pointerdown', (event) => {
  if (game.state !== 'playing' || activeStroke) return;
  const point = eventPoint(event);
  let closest = null;
  let nearest = 36;
  for (const plane of game.planes) {
    const d = distance(point, plane);
    if (d < nearest) { nearest = d; closest = plane; }
  }
  if (!closest) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  activeStroke = {
    pointerId: event.pointerId,
    planeId: closest.id,
    points: [{ x: closest.x, y: closest.y }, point],
  };
});

canvas.addEventListener('pointermove', (event) => {
  if (!activeStroke || activeStroke.pointerId !== event.pointerId) return;
  event.preventDefault();
  const point = eventPoint(event);
  if (distance(point, activeStroke.points[activeStroke.points.length - 1]) >= 4) {
    activeStroke.points.push(point);
  }
});

function endStroke(event, cancelled = false) {
  if (!activeStroke || activeStroke.pointerId !== event.pointerId) return;
  if (!cancelled && game.state === 'playing') {
    const point = eventPoint(event);
    if (distance(point, activeStroke.points[activeStroke.points.length - 1]) >= 3) {
      activeStroke.points.push(point);
    }
    if (activeStroke.points.length >= 3) {
      assignRoute(game, activeStroke.planeId, activeStroke.points);
    }
  }
  activeStroke = null;
}
canvas.addEventListener('pointerup', (event) => endStroke(event));
canvas.addEventListener('pointercancel', (event) => endStroke(event, true));
canvas.addEventListener('lostpointercapture', (event) => endStroke(event, true));

function line(points, color, width = 2, dashed = []) {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.lineWidth = width; ctx.strokeStyle = color;
  ctx.setLineDash(dashed); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(); ctx.setLineDash([]);
}

function drawRadar(w, h, now) {
  ctx.fillStyle = '#0a2430';
  ctx.fillRect(0, 0, w, h);
  const gridStep = Math.max(34, Math.min(w, h) / 8);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#153b48';
  for (let x = gridStep; x < w; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = gridStep; y < h; y += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const centerX = w * 0.5, centerY = h * 0.46;
  ctx.strokeStyle = '#1e4c55';
  for (let r = gridStep * 2; r < Math.max(w, h); r += gridStep * 2) {
    ctx.beginPath(); ctx.arc(centerX, centerY, r, 0, Math.PI * 2); ctx.stroke();
  }
  // A faint rotating radar sweep gives the static prototype graphics some life.
  const sweep = ((now / 18000) % 1) * Math.PI * 2;
  ctx.beginPath(); ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, Math.max(w, h), sweep, sweep + 0.12);
  ctx.closePath(); ctx.fillStyle = '#81dfb008'; ctx.fill();
  ctx.fillStyle = '#628a93'; ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('N ↑', 20, Math.min(72, h * 0.15));
}

function drawRunway(w, h, now) {
  const runway = runwayFor(w, h);
  const stripHeight = Math.max(19, Math.min(30, w * 0.067));
  const left = runway.left, right = runway.right;
  ctx.fillStyle = '#2d4650';
  ctx.fillRect(left, runway.y - stripHeight / 2, right - left, stripHeight);
  ctx.strokeStyle = '#adc6bd'; ctx.lineWidth = 1.1;
  ctx.strokeRect(left + 0.5, runway.y - stripHeight / 2, right - left - 1, stripHeight);
  ctx.beginPath();
  ctx.moveTo(left + 12, runway.y); ctx.lineTo(right - 11, runway.y);
  ctx.strokeStyle = '#b6d8d1'; ctx.lineWidth = 1.5;
  ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);

  ctx.strokeStyle = '#a9e5cf'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left + 6, runway.y - stripHeight / 2 + 3);
  ctx.lineTo(left + 6, runway.y + stripHeight / 2 - 3);
  ctx.stroke();

  // Guidance lights lead to the touchdown threshold, heading east.
  ctx.beginPath(); ctx.moveTo(runway.entry.x - 37, runway.y); ctx.lineTo(runway.left - 7, runway.y);
  ctx.setLineDash([3, 6]); ctx.strokeStyle = '#6cba9b'; ctx.stroke(); ctx.setLineDash([]);
  const pulse = 0.68 + 0.25 * Math.sin(now / 500);
  ctx.beginPath(); ctx.arc(runway.entry.x, runway.y, 16 + 3 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(130,229,180,' + pulse + ')'; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(runway.entry.x, runway.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#9af9c1'; ctx.fill();
  ctx.textAlign = 'center'; ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillStyle = '#9addbf';
  ctx.fillText('APPROACH', runway.entry.x, runway.y - 26);
  ctx.fillStyle = '#adcdd2'; ctx.fillText('09  →', (left + right) / 2, runway.y - stripHeight / 2 - 10);
  ctx.font = '9px ui-monospace, monospace'; ctx.fillStyle = '#527e88';
  ctx.fillText('RWY 09', (left + right) / 2, runway.y + stripHeight / 2 + 18);
}

function drawRoutes() {
  for (const plane of game.planes) {
    if (!plane.route) continue;
    const remaining = plane.route.points.slice(plane.route.index);
    line([{ x: plane.x, y: plane.y }, ...remaining], plane.route.landing ? '#85ddb4bb' : '#71bace9c', 2.6, [7, 5]);
  }
  if (activeStroke) {
    const plane = game.planes.find((item) => item.id === activeStroke.planeId);
    if (plane) {
      const points = [{ x: plane.x, y: plane.y }, ...activeStroke.points.slice(1)];
      line(points, '#a0f7d3', 3.5);
      const end = points[points.length - 1];
      ctx.beginPath(); ctx.arc(end.x, end.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#a0f7d3'; ctx.fill();
    }
  }
}

function drawPlanes(now) {
  for (const plane of game.planes) {
    const selected = activeStroke?.planeId === plane.id;
    ctx.save();
    ctx.translate(plane.x, plane.y);
    if (selected) {
      ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(now / 180) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = '#92f5c7'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // Vector silhouette is placeholder art: nose right, wings and tail.
    ctx.rotate(plane.heading);
    ctx.fillStyle = selected ? '#b7ffe2' : '#e2f0e9';
    ctx.strokeStyle = '#0a3440'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(15, 0); ctx.lineTo(2, -3);
    ctx.lineTo(-4, -11); ctx.lineTo(-9, -11); ctx.lineTo(-7, -2);
    ctx.lineTo(-13, -3.5); ctx.lineTo(-16, -3.5);
    ctx.lineTo(-14, 0); ctx.lineTo(-16, 3.5);
    ctx.lineTo(-13, 3.5); ctx.lineTo(-7, 2);
    ctx.lineTo(-9, 11); ctx.lineTo(-4, 11);
    ctx.lineTo(2, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = '#b5dfdb';
    ctx.fillText('AC' + String(plane.id).padStart(2, '0'), plane.x + 16, plane.y - 13);
  }
}

function paint(now) {
  const w = game.width, h = game.height;
  ctx.clearRect(0, 0, w, h);
  drawRadar(w, h, now);
  drawRunway(w, h, now);
  drawRoutes();
  drawPlanes(now);
}

function frame(now) {
  const seconds = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
  lastTime = now;
  advanceGame(game, seconds);
  consumeEvents();
  syncPanel();
  landedEl.textContent = String(game.landed);
  scoreEl.textContent = String(game.score).padStart(4, '0');
  incidentsEl.textContent = game.incidents + ' / ' + MAX_INCIDENTS;
  if (now > toastUntil) toast.classList.remove('visible');
  paint(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
