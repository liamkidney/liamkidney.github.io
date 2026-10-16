/** Pure Numberlink domain logic. Coordinates are [row, column]. */
export type Cell = readonly [number, number];
export type Pair = readonly [Cell, Cell];
export type Difficulty = 'easy' | 'medium' | 'hard' | 'unrated';
export type Board = {
  id: string;
  width: number;
  height: number;
  difficulty: Difficulty;
  pairs: readonly Pair[];
};
export type Paths = Record<number, number[]>;

export const toIndex = (board: Board, [row, col]: Cell): number => row * board.width + col;
export const toCell = (board: Board, index: number): Cell => [Math.floor(index / board.width), index % board.width];
export const endpoints = (board: Board): [number, number][] => board.pairs.map(([a, b]) => [toIndex(board, a), toIndex(board, b)]);
export const adjacent = (board: Board, a: number, b: number): boolean => {
  const [ar, ac] = toCell(board, a);
  const [br, bc] = toCell(board, b);
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
};

/** Returns errors instead of throwing, so generation/import pipelines can reuse validation. */
export function boardErrors(board: Board): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(board.width) || board.width < 2 || !Number.isInteger(board.height) || board.height < 2) {
    errors.push('Invalid grid dimensions');
  }
  if (!Array.isArray(board.pairs) || board.pairs.length < 1) {
    errors.push('Board must have at least one pair');
    return errors;
  }
  const seen = new Set<string>();
  board.pairs.forEach((pair, pi) => {
    if (!Array.isArray(pair) || pair.length !== 2) { errors.push(`Pair ${pi + 1}: needs two endpoints`); return; }
    pair.forEach((cell) => {
      if (!Array.isArray(cell) || cell.length !== 2 || !Number.isInteger(cell[0]) || !Number.isInteger(cell[1]) || cell[0] < 0 || cell[1] < 0 || cell[0] >= board.height || cell[1] >= board.width) {
        errors.push(`Pair ${pi + 1}: endpoint out of bounds`);
        return;
      }
      const key = `${cell[0]},${cell[1]}`;
      if (seen.has(key)) errors.push(`Pair ${pi + 1}: duplicate endpoint ${key}`);
      seen.add(key);
    });
  });
  if (board.pairs.length * 2 > board.width * board.height) errors.push('More endpoints than cells');
  return errors;
}

export function endpointPair(board: Board, cell: number): number | null {
  for (let i = 0; i < board.pairs.length; i++) {
    const [a, b] = endpoints(board)[i];
    if (cell === a || cell === b) return i;
  }
  return null;
}

/** Begin again from either endpoint. Dragging a new path clears this pair's old line only. */
export function startPath(paths: Paths, pair: number, start: number): Paths {
  return { ...paths, [pair]: [start] };
}

/**
 * Start a drag from either numbered endpoint OR any cell of an existing line.
 * The unconnected tip resumes without clearing the line. Touching an earlier
 * segment trims the tail so that segment can be redirected; either endpoint
 * can still be used to redraw a path from scratch.
 */
export function beginPath(board: Board, paths: Paths, cell: number): { pair: number; paths: Paths } | null {
  if (!Number.isInteger(cell) || cell < 0 || cell >= board.width * board.height) return null;

  let pair = endpointPair(board, cell);
  if (pair === null) {
    const entry = Object.entries(paths).find(([, path]) => path?.includes(cell));
    if (!entry) return null;
    pair = Number(entry[0]);
  }

  const path = paths[pair];
  if (!path?.length) return { pair, paths: startPath(paths, pair, cell) };

  const position = path.indexOf(cell);
  if (position < 0 || position === 0 ||
    (position === path.length - 1 && isPairConnected(board, paths, pair))) {
    // Starting from the original endpoint (or the other end of a completed
    // line) means redrawing. A different, unused endpoint also starts anew.
    return { pair, paths: startPath(paths, pair, cell) };
  }

  if (position === path.length - 1) return { pair, paths }; // Resume a loose end.
  return { pair, paths: { ...paths, [pair]: path.slice(0, position + 1) } };
}

/**
 * One orthogonal step only. Visiting your own path backtracks. Other paths and
 * endpoints are impassable; a completed path ends at the other endpoint.
 */
export function extendPath(board: Board, paths: Paths, pair: number, next: number): Paths {
  const path = paths[pair];
  if (!path?.length || !Number.isInteger(next) || next < 0 || next >= board.width * board.height) return paths;
  const last = path[path.length - 1];
  if (last === next || !adjacent(board, last, next)) return paths;
  const ownIndex = path.indexOf(next);
  // Retract one step at a time. Crossing an older part of your line should
  // not unexpectedly erase a large section while your finger is moving.
  if (ownIndex >= 0) return ownIndex === path.length - 2
    ? { ...paths, [pair]: path.slice(0, -1) } : paths;
  const [a, b] = endpoints(board)[pair];
  if (last === (path[0] === a ? b : a)) return paths; // Can't continue beyond the destination
  const occupied = Object.entries(paths).some(([p, occupiedPath]) => Number(p) !== pair && occupiedPath.includes(next));
  if (occupied) return paths;
  const otherEndpoint = endpointPair(board, next);
  if (otherEndpoint !== null && otherEndpoint !== pair) return paths;
  // The only own endpoint not yet in the line is the destination.
  return { ...paths, [pair]: [...path, next] };
}

/**
 * Follow a finger across a grid corner. Touch sampling can jump diagonally
 * from one cell to the next even when the physical drag is smooth; route the
 * corner as two legal orthogonal moves, without crossing occupied cells.
 */
export function advancePath(board: Board, paths: Paths, pair: number, next: number): Paths {
  const direct = extendPath(board, paths, pair, next);
  if (direct !== paths) return direct;

  const path = paths[pair];
  if (!path?.length || !Number.isInteger(next) || next < 0 || next >= board.width * board.height) return paths;
  const [row, col] = toCell(board, path[path.length - 1]);
  const [nextRow, nextCol] = toCell(board, next);
  if (Math.abs(row - nextRow) !== 1 || Math.abs(col - nextCol) !== 1) return paths;

  const corners = [row * board.width + nextCol, nextRow * board.width + col];
  for (const via of corners) {
    const first = extendPath(board, paths, pair, via);
    if (first === paths) continue;
    const second = extendPath(board, first, pair, next);
    if (second !== first && second[pair]?.at(-1) === next) return second;
  }
  return paths;
}

export function isPairConnected(board: Board, paths: Paths, pair: number): boolean {
  const path = paths[pair];
  if (!path || path.length < 2) return false;
  const [a, b] = endpoints(board)[pair];
  if (!((path[0] === a && path.at(-1) === b) || (path[0] === b && path.at(-1) === a))) return false;
  if (new Set(path).size !== path.length) return false;
  return path.every((cell, i) => i === 0 || adjacent(board, path[i - 1], cell));
}

export function progress(board: Board, paths: Paths) {
  const connected = board.pairs.reduce((n, _p, i) => n + Number(isPairConnected(board, paths, i)), 0);
  const occupied = new Set(Object.values(paths).flat()).size;
  return { connected, occupied, totalPairs: board.pairs.length, totalCells: board.width * board.height };
}

/** Validate a whole state, not just the UI event sequence. */
export function isSolved(board: Board, paths: Paths): boolean {
  if (Object.keys(paths).some((key) => !Number.isInteger(+key) || +key < 0 || +key >= board.pairs.length)) return false;
  if (!board.pairs.every((_, i) => isPairConnected(board, paths, i))) return false;
  const used = new Set<number>();
  for (const [key, path] of Object.entries(paths)) {
    const pair = Number(key);
    for (const cell of path) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= board.width * board.height || used.has(cell)) return false;
      const endpointOwner = endpointPair(board, cell);
      if (endpointOwner !== null && endpointOwner !== pair) return false;
      used.add(cell);
    }
  }
  return used.size === board.width * board.height;
}

/** Interpolate pointer movement so fast drags don't jump over cells. */
export function sampledCells(board: Board, size: number, from: readonly [number, number], to: readonly [number, number]): number[] {
  const cellSize = size / board.width; // rendering uses width for square cells
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(1, Math.ceil(distance / Math.max(2, cellSize / 3)));
  const result: number[] = [];
  for (let i = 1; i <= steps; i++) {
    const x = from[0] + (to[0] - from[0]) * i / steps;
    const y = from[1] + (to[1] - from[1]) * i / steps;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (row >= 0 && row < board.height && col >= 0 && col < board.width) {
      const index = row * board.width + col;
      if (result.at(-1) !== index) result.push(index);
    }
  }
  return result;
}