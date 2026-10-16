/** Pure, first-completion-only scoring for the Clover Challenge. */
import { boardErrors, endpoints, isPairConnected, toIndex } from './engine';
import type { Board, Cell, Paths } from './engine';

export type CloverChallenge = {
  id: string;
  board: Board;
  clovers: readonly { pair: number; cell: Cell }[];
};

export type CloverScore = {
  completed: number[];
  collected: number;
  missed: number;
  next: number;
};

export const emptyCloverScore = (): CloverScore => ({ completed: [], collected: 0, missed: 0, next: 0 });

/** Reject malformed content before publishing, without bundling solution paths. */
export function cloverErrors(challenge: CloverChallenge): string[] {
  const errors = boardErrors(challenge.board);
  const { board, clovers } = challenge;
  if (clovers.length !== board.pairs.length) errors.push('Use one clover per pair');
  const seen = new Set<number>();
  const used = new Set<number>();
  clovers.forEach(({ pair, cell }, index) => {
    if (!Number.isInteger(pair) || pair < 0 || pair >= board.pairs.length || seen.has(pair)) {
      errors.push(`Clover ${index + 1}: invalid or repeated pair`);
    }
    seen.add(pair);
    if (!Array.isArray(cell) || cell.length !== 2 ||
        !Number.isInteger(cell[0]) || !Number.isInteger(cell[1]) ||
        cell[0] < 0 || cell[0] >= board.height || cell[1] < 0 || cell[1] >= board.width) {
      errors.push(`Clover ${index + 1}: invalid cell`);
      return;
    }
    const location = toIndex(board, cell);
    if (used.has(location)) errors.push(`Clover ${index + 1}: duplicate cell`);
    used.add(location);
    if (endpoints(board).some(([a,b]) => a === location || b === location)) {
      errors.push(`Clover ${index + 1}: cannot overlap a dot`);
    }
  });
  return errors;
}

/**
 * Called ONLY the first time a pair becomes connected. A redrawn path,
 * undo or reset never grants the same clover twice.
 *
 * Wrong-order paths remain on the board; when their clover is finally
 * revealed, it is skipped as missed, and the next collectible appears.
 */
export function recordPairCompletion(
  challenge: CloverChallenge, score: CloverScore, pair: number,
): CloverScore {
  if (!Number.isInteger(pair) || pair < 0 || pair >= challenge.board.pairs.length ||
      score.completed.includes(pair)) return score;

  const completed = [...score.completed, pair];
  let { collected, missed, next } = score;
  while (next < challenge.clovers.length && completed.includes(challenge.clovers[next].pair)) {
    if (challenge.clovers[next].pair === pair && next === score.next) collected++;
    else missed++;
    next++;
  }
  return { completed, collected, missed, next };
}

export function applyConnectedPair(
  challenge: CloverChallenge, score: CloverScore, paths: Paths, pair: number,
): CloverScore {
  return isPairConnected(challenge.board, paths, pair)
    ? recordPairCompletion(challenge, score, pair)
    : score;
}

/** The active clover disappears when all eight have been collected/missed. */
export function activeCloverCell(challenge: CloverChallenge, score: CloverScore): number | null {
  const target = challenge.clovers[score.next];
  return target ? toIndex(challenge.board, target.cell) : null;
}

export function cloverResultText(challenge: CloverChallenge, collected: number, elapsedMs: number, url: string): string {
  const total = challenge.clovers.length;
  const marks = '🍀'.repeat(collected) + '▫️'.repeat(total - collected);
  const seconds = Math.floor(elapsedMs / 1000);
  const time = `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  return `☘️ Daily Clover · Preview #1\n${marks}\n${collected}/${total} clovers${collected === total ? ' · PERFECT!' : ''}\n⏱️ ${time}\n\nTry the same puzzle: ${url}`;
}
