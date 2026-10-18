export const MAX_INCIDENTS = 3;

const TAU = Math.PI * 2;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function runwayFor(width, height) {
  const y = height * 0.77;
  return {
    y,
    left: width * 0.30,
    right: width * 0.88,
    entry: { x: width * 0.265, y },
    touchdown: { x: width * 0.38, y },
  };
}

export function createGame({ width = 400, height = 640, random = Math.random } = {}) {
  return {
    width, height, random,
    state: 'ready', planes: [], nextId: 1, elapsed: 0,
    nextSpawn: 1.4, landed: 0, incidents: 0, score: 0, events: [],
  };
}

export function beginGame(game) {
  game.state = 'playing';
}

export function togglePause(game) {
  if (game.state === 'playing') game.state = 'paused';
  else if (game.state === 'paused') game.state = 'playing';
  return game.state;
}

function randomRange(game, low, high) {
  return low + game.random() * (high - low);
}

export function spawnPlane(game, overrides = {}) {
  // Aircraft enter from one of the three non-runway edges, facing the airfield.
  const side = Math.floor(game.random() * 3);
  let x, y;
  if (side === 0) {
    x = -15; y = randomRange(game, game.height * 0.12, game.height * 0.66);
  } else if (side === 1) {
    x = game.width + 15; y = randomRange(game, game.height * 0.12, game.height * 0.66);
  } else {
    x = randomRange(game, game.width * 0.12, game.width * 0.88); y = -15;
  }
  const target = {
    x: randomRange(game, game.width * 0.30, game.width * 0.70),
    y: randomRange(game, game.height * 0.24, game.height * 0.50),
  };
  const plane = {
    id: game.nextId++,
    x: overrides.x ?? x, y: overrides.y ?? y,
    heading: overrides.heading ?? Math.atan2(target.y - y, target.x - x),
    speedFactor: overrides.speedFactor ?? randomRange(game, 0.87, 1.12),
    age: 0, route: null,
  };
  game.planes.push(plane);
  game.events.push({ type: 'spawn', id: plane.id });
  return plane;
}

export function assignRoute(game, id, drawnPoints) {
  if (game.state !== 'playing' || !Array.isArray(drawnPoints) || drawnPoints.length < 2) return false;
  const plane = game.planes.find((item) => item.id === id);
  if (!plane) return false;
  const points = [{ x: plane.x, y: plane.y }];
  for (const point of drawnPoints.slice(1)) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const next = { x: clamp(point.x, 0, game.width), y: clamp(point.y, 0, game.height) };
    if (distance(points[points.length - 1], next) >= 5) points.push(next);
  }
  if (points.length < 2) return false;
  const runway = runwayFor(game.width, game.height);
  const last = points[points.length - 1];
  const landing = distance(last, runway.entry) <= Math.max(42, Math.min(game.width, game.height) * 0.14);
  if (landing) {
    // The final centreline approach is automatic once the player reaches the entry marker.
    points.push({ ...runway.entry });
    points.push({ ...runway.touchdown });
    points.push({ x: runway.right, y: runway.y });
  }
  plane.route = { points, index: 1, landing };
  game.events.push({ type: 'route', id, landing });
  return true;
}

export function resizeGame(game, width, height) {
  if (!(width > 0 && height > 0)) return;
  const sx = width / game.width, sy = height / game.height;
  for (const plane of game.planes) {
    plane.x *= sx; plane.y *= sy;
    if (plane.route) {
      for (const point of plane.route.points) {
        point.x *= sx; point.y *= sy;
      }
    }
  }
  game.width = width;
  game.height = height;
}

function fly(plane, game, dt) {
  const speed = Math.min(game.width, game.height) * 0.145 * plane.speedFactor;
  let remaining = speed * dt;
  while (plane.route && remaining > 0 && plane.route.index < plane.route.points.length) {
    const target = plane.route.points[plane.route.index];
    const length = distance(plane, target);
    if (length < 0.001) { plane.route.index++; continue; }
    const move = Math.min(remaining, length);
    plane.heading = Math.atan2(target.y - plane.y, target.x - plane.x);
    plane.x += (target.x - plane.x) * move / length;
    plane.y += (target.y - plane.y) * move / length;
    remaining -= move;
    if (move >= length - 0.001) plane.route.index++;
  }
  if (plane.route && plane.route.index >= plane.route.points.length) plane.route = null;
  if (remaining > 0) {
    plane.x += Math.cos(plane.heading) * remaining;
    plane.y += Math.sin(plane.heading) * remaining;
  }
  plane.heading = ((plane.heading % TAU) + TAU) % TAU;
}

function addIncident(game, type, ids) {
  game.incidents++;
  game.events.push({ type, ids, incidents: game.incidents });
  if (game.incidents >= MAX_INCIDENTS) {
    game.state = 'over';
    game.events.push({ type: 'over', score: game.score });
  }
}

export function advanceGame(game, seconds) {
  if (game.state !== 'playing') return;
  const dt = clamp(seconds, 0, 0.1);
  game.elapsed += dt;
  game.nextSpawn -= dt;
  if (game.nextSpawn <= 0) {
    spawnPlane(game);
    // Traffic increases gradually without overwhelming the initial round.
    const interval = Math.max(2.8, 6.3 - game.elapsed / 70);
    game.nextSpawn = randomRange(game, interval * 0.72, interval * 1.18);
  }

  const landed = new Set();
  const escaped = new Set();
  const runway = runwayFor(game.width, game.height);
  for (const plane of game.planes) {
    plane.age += dt;
    const approaching = plane.route?.landing;
    fly(plane, game, dt);
    if (approaching && plane.x >= runway.touchdown.x &&
        plane.x <= runway.right && Math.abs(plane.y - runway.y) <= 14) {
      landed.add(plane.id);
    } else if (plane.age > 0.4 &&
        (plane.x < -32 || plane.x > game.width + 32 ||
         plane.y < -32 || plane.y > game.height + 32)) {
      escaped.add(plane.id);
    }
  }

  const collided = new Set();
  for (let i = 0; i < game.planes.length; i++) {
    const a = game.planes[i];
    if (landed.has(a.id) || escaped.has(a.id) || collided.has(a.id)) continue;
    for (let j = i + 1; j < game.planes.length; j++) {
      const b = game.planes[j];
      if (landed.has(b.id) || escaped.has(b.id) || collided.has(b.id)) continue;
      if (distance(a, b) < 21) {
        collided.add(a.id); collided.add(b.id);
        break;
      }
    }
  }

  game.planes = game.planes.filter((plane) =>
    !landed.has(plane.id) && !escaped.has(plane.id) && !collided.has(plane.id));
  for (const id of landed) {
    game.landed++; game.score += 100;
    game.events.push({ type: 'landed', id, score: game.score });
  }
  if (collided.size) addIncident(game, 'collision', [...collided]);
  for (const id of escaped) {
    if (game.state !== 'playing') break;
    addIncident(game, 'missed', [id]);
  }
}
