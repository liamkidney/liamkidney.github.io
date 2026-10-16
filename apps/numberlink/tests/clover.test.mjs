import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isSolved } from '../src/engine.ts';
import { activeCloverCell, applyConnectedPair, cloverErrors, cloverResultText, emptyCloverScore, recordPairCompletion } from '../src/clover.ts';

const challenge = JSON.parse(readFileSync(new URL('../src/clover.json', import.meta.url), 'utf8'));
// Independently solved and checked for uniqueness off-line by a binary MILP
// with a no-good exclusion for these 56 active edges.
const solution = [
  [2,1,0,8],
  [21,29,28,27,35,34,42,50],
  [45,53,54,62,63],
  [55,47,46,38,37,36,44,52,60,61],
  [23,15,7],
  [6,5,4,3,11,10,9,17,16,24,32,40,48,56,57,58,59,51,43],
  [39,31,30],
  [22,14,13,12,20,19,18,26,25,33,41,49],
];
const order = [5,2,7,1,4,3,0,6];
test('clover preview is an 8×8 full-coverage puzzle with eight distinct non-dot targets', () => {
  assert.deepEqual(cloverErrors(challenge), []);
  assert.equal(challenge.board.width, 8);
  assert.equal(challenge.board.height, 8);
  assert.equal(challenge.board.pairs.length, 8);
  assert.equal(challenge.clovers.length, 8);
  assert.deepEqual(challenge.clovers.map(c => c.pair), order);
  const paths = Object.fromEntries(solution.map((sequence, pair) => [pair, sequence]));
  assert.equal(isSolved(challenge.board, paths), true);
  const used = solution.flat();
  assert.equal(used.length, 64);
  assert.equal(new Set(used).size, 64);
  for (const {pair,cell} of challenge.clovers) {
    assert.ok(solution[pair].includes(cell[0]*8+cell[1]));
  }
});
test('completing paths in indicated order captures all eight clovers', () => {
  let score = emptyCloverScore();
  let paths = {};
  for (const pair of order) {
    assert.equal(activeCloverCell(challenge, score), challenge.clovers[score.next].cell[0]*8+challenge.clovers[score.next].cell[1]);
    paths = { ...paths, [pair]: solution[pair] };
    score = applyConnectedPair(challenge, score, paths, pair);
  }
  assert.equal(isSolved(challenge.board, paths), true);
  assert.deepEqual({ collected: score.collected, missed: score.missed, next: score.next }, { collected:8, missed:0, next:8 });
  assert.equal(activeCloverCell(challenge, score), null);
});
test('completing a path too early permanently misses its later clover', () => {
  let score = emptyCloverScore();
  let paths = {2: solution[2]};
  score = applyConnectedPair(challenge, score, paths, 2);
  assert.equal(score.collected,0);
  assert.equal(score.next,0);
  paths = {...paths,5:solution[5]};
  score = applyConnectedPair(challenge, score, paths, 5);
  assert.equal(score.collected,1);
  assert.equal(score.missed,1);
  assert.equal(score.next,2);
  const repeated = applyConnectedPair(challenge,score,paths,2);
  assert.strictEqual(repeated, score);
  assert.strictEqual(recordPairCompletion(challenge, score, 2), score);
  const remainder = order.filter(pair => pair !== 2 && pair !== 5);
  for(const pair of remainder){
    paths = {...paths,[pair]:solution[pair]};
    score = applyConnectedPair(challenge,score,paths,pair);
  }
  assert.equal(isSolved(challenge.board,paths),true);
  assert.equal(score.collected,7);
  assert.equal(score.missed,1);
});
test('partial, erased and redrawn lines cannot farm clovers', () => {
  const partial = {5:solution[5].slice(0,-1)};
  let score = applyConnectedPair(challenge,emptyCloverScore(),partial,5);
  assert.equal(score.collected,0);
  score=applyConnectedPair(challenge,score,{5:solution[5]},5);
  assert.equal(score.collected,1);
  const erased=applyConnectedPair(challenge,score,{},5);
  assert.strictEqual(erased,score);
  assert.strictEqual(applyConnectedPair(challenge,score,{5:solution[5]},5),score);
});
test('sharing does not reveal the path order or clover locations', () => {
  const message=cloverResultText(challenge,7,102000,'https://example.test/daily');
  assert.match(message,/7\/8 clovers/);
  assert.match(message,/01:42/);
  assert.match(message,/https:\/\/example.test\/daily/);
  assert.ok(!message.includes('4,0'));
});
