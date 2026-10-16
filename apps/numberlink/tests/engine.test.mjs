import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advancePath, beginPath, boardErrors, toIndex, startPath, extendPath, isSolved, progress, sampledCells } from '../src/engine.ts';
const boards = JSON.parse(readFileSync(new URL('../src/boards.json', import.meta.url), 'utf8'));
const small = {id:'test',width:2,height:2,difficulty:'easy',pairs:[[[0,0],[0,1]],[[1,0],[1,1]]]};
test('all supplied boards have valid and non-overlapping endpoints', () => {
  assert.equal(boards.length, 4);
  assert.deepEqual(boards.map(boardErrors), boards.map(() => []));
  assert.deepEqual(boards.map(b => b.pairs.length), [6, 6, 8, 8]);
  assert.deepEqual(boards.map(b => b.id), [
    'level_000031', 'level_000032', 'level_000033', 'level_000034',
  ]);
  assert.ok(boards.every(board => board.difficulty === 'unrated'));
  // Exporter writes [x, y]; the app stores [row, column].
  assert.deepEqual(boards[0].pairs[0], [[0, 2], [1, 0]]);
  assert.deepEqual(boards[2].pairs[0], [[1, 0], [2, 8]]);
});
test('only orthogonally adjacent moves are allowed', () => {
  const p = startPath({},0,0);
  assert.deepEqual(extendPath(small,p,0,3),p);
  assert.deepEqual(extendPath(small,p,0,1)[0],[0,1]);
});
test('moving backwards truncates the path', () => {
  const board={id:'t',width:3,height:2,difficulty:'easy',pairs:[[[0,0],[1,2]]]};
  const p={0:[0,1,2]};
  assert.deepEqual(extendPath(board,p,0,1)[0],[0,1]);
});
test('other endpoints and paths are blocked', () => {
  const p = startPath({1:[2,3]},0,0);
  assert.deepEqual(extendPath(small,p,0,2),p);
  const p2 = startPath({1:[2]},0,0);
  assert.deepEqual(extendPath(small,p2,0,2),p2);
});
test('complete board requires every cell, valid pairs, and no overlap', () => {
  const valid={0:[0,1],1:[2,3]};
  assert.equal(isSolved(small,valid),true);
  assert.equal(isSolved(small,{0:[0,1]}),false);
  assert.equal(isSolved(small,{0:[0,1],1:[2,3,1]}),false);
  assert.deepEqual(progress(small,valid),{connected:2,occupied:4,totalPairs:2,totalCells:4});
});
test('pointer interpolation covers fast horizontal drags',()=>{
  const board={id:'t',width:4,height:4,difficulty:'easy',pairs:[[[0,0],[0,3]]]};
  assert.deepEqual(sampledCells(board,160,[20,20],[140,20]),[0,1,2,3]);
});
test('lifting a finger and touching the loose tip resumes the existing path', () => {
  const board = { id: 'resume', width: 4, height: 3, difficulty: 'easy', pairs: [[[0,0],[2,3]]] };
  const before = { 0: [0,1,2] };
  const begun = beginPath(board, before, 2);
  assert.equal(begun?.pair, 0);
  assert.strictEqual(begun?.paths, before);
  const extended = advancePath(board, begun.paths, begun.pair, 3);
  assert.deepEqual(extended[0], [0,1,2,3]);
  assert.deepEqual(advancePath(board, extended, 0, 7)[0], [0,1,2,3,7]);
});

test('starting from a line segment trims the tail, then permits rerouting', () => {
  const board = { id: 'reroute', width: 4, height: 3, difficulty: 'easy', pairs: [[[0,0],[2,3]]] };
  const before = { 0: [0,1,2,3] };
  const begun = beginPath(board, before, 1);
  assert.deepEqual(begun?.paths[0], [0,1]);
  assert.deepEqual(extendPath(board, begun.paths, 0, 5)[0], [0,1,5]);
  assert.deepEqual(before[0], [0,1,2,3]); // Original state not mutated.
});

test('either endpoint can redraw a line and blank cells cannot start it', () => {
  const board = { id: 'restart', width: 3, height: 3, difficulty: 'easy', pairs: [[[0,0],[2,2]]] };
  const partiallyDrawn = { 0: [0,1,2] };
  assert.deepEqual(beginPath(board, partiallyDrawn, 8)?.paths[0], [8]);
  assert.deepEqual(beginPath(board, partiallyDrawn, 0)?.paths[0], [0]);
  assert.equal(beginPath(board, partiallyDrawn, 4), null);
  const finished = { 0: [0,1,2,5,8] };
  assert.deepEqual(beginPath(board, finished, 8)?.paths[0], [8]);
});

test('diagonal touch jumps become two legal steps rather than stalling', () => {
  const board = { id: 'diagonal', width: 3, height: 3, difficulty: 'easy', pairs: [[[0,0],[2,2]]] };
  assert.deepEqual(advancePath(board, {0:[0]}, 0, 4)[0], [0,1,4]);
  assert.deepEqual(advancePath(board, {0:[0,1]}, 0, 4)[0], [0,1,4]);
});

test('diagonal smoothing never crosses another path or a foreign endpoint', () => {
  const board = { id: 'block', width: 3, height: 3, difficulty: 'easy', pairs: [[[0,0],[2,2]],[[0,1],[1,0]]] };
  const state = {0:[0],1:[1]};
  assert.strictEqual(advancePath(board, state, 0, 4), state);
});

test('crossing an earlier section of your own path does not erase it', () => {
  const board = { id: 'loop', width: 4, height: 4, difficulty: 'easy', pairs: [[[0,0],[3,3]]] };
  const state = {0:[0,1,2,6,5]};
  assert.strictEqual(extendPath(board, state, 0, 1), state);
  assert.deepEqual(extendPath(board, state, 0, 6)[0], [0,1,2,6]);
});
