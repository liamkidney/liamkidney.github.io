import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceGame, assignRoute, beginGame, createGame, resizeGame, runwayFor, spawnPlane, togglePause } from '../engine.js';

function setup() {
  const game = createGame({ width: 400, height: 640, random: () => 0.4 });
  beginGame(game);
  game.nextSpawn = 1e6;
  return game;
}

test('starts ready and can be paused without updating air traffic', () => {
  const game = createGame();
  assert.equal(game.state, 'ready');
  advanceGame(game, 1);
  assert.equal(game.elapsed, 0);
  beginGame(game);
  assert.equal(togglePause(game), 'paused');
  advanceGame(game, 1);
  assert.equal(game.elapsed, 0);
  assert.equal(togglePause(game), 'playing');
});

test('a drawn route reaching the green marker acquires the runway', () => {
  const game = setup();
  const marker = runwayFor(game.width, game.height).entry;
  const aircraft = spawnPlane(game, { x: 45, y: 375, heading: -0.2, speedFactor: 1 });
  assert.equal(assignRoute(game, aircraft.id, [{ x: 45, y: 375 }, { x: 60, y: 430 }, marker]), true);
  assert.equal(aircraft.route.landing, true);
  for (let i = 0; i < 300 && game.landed === 0; i++) advanceGame(game, 0.05);
  assert.equal(game.landed, 1);
  assert.equal(game.score, 100);
  assert.equal(game.planes.length, 0);
});

test('routes drawn away from the runway do not score a landing', () => {
  const game = setup();
  const aircraft = spawnPlane(game, { x: 45, y: 375, heading: 0 });
  assignRoute(game, aircraft.id, [{ x: 45, y: 375 }, { x: 150, y: 145 }]);
  assert.equal(aircraft.route.landing, false);
  for (let i = 0; i < 90; i++) advanceGame(game, 0.05);
  assert.equal(game.landed, 0);
});

test('colliding aircraft count as one incident and are both removed', () => {
  const game = setup();
  spawnPlane(game, { x: 180, y: 170, heading: 0 });
  spawnPlane(game, { x: 190, y: 172, heading: 0 });
  advanceGame(game, 0.05);
  assert.equal(game.incidents, 1);
  assert.equal(game.planes.length, 0);
});

test('three departures from the airspace end the shift', () => {
  const game = setup();
  for (let i = 0; i < 3; i++) {
    const plane = spawnPlane(game, { x: 430, y: 200, heading: 0 });
    plane.age = 1;
    advanceGame(game, 0.05);
  }
  assert.equal(game.incidents, 3);
  assert.equal(game.state, 'over');
});

test('resizing keeps the in-flight route aligned with the screen', () => {
  const game = setup();
  const aircraft = spawnPlane(game, { x: 100, y: 100 });
  assignRoute(game, aircraft.id, [{ x: 100, y: 100 }, { x: 180, y: 200 }]);
  resizeGame(game, 800, 1280);
  assert.equal(aircraft.x, 200);
  assert.equal(aircraft.y, 200);
  assert.equal(aircraft.route.points.at(-1).x, 360);
  assert.equal(aircraft.route.points.at(-1).y, 400);
});

test('route assignment is rejected before the shift starts', () => {
  const game = createGame();
  const plane = spawnPlane(game);
  assert.equal(assignRoute(game, plane.id, [{ x: 1, y: 1 }, { x: 3, y: 3 }]), false);
});
