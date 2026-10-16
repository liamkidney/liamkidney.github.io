import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Modal, PanResponder, Platform, Pressable, SafeAreaView,
  ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Line, Path as SvgPath, Rect, Text as SvgText } from 'react-native-svg';
import rawBoards from './src/boards.json';
import rawClover from './src/clover.json';
import type { CloverChallenge, CloverScore } from './src/clover';
import { activeCloverCell, applyConnectedPair, cloverResultText, emptyCloverScore } from './src/clover';
import type { Board, Paths } from './src/engine';
import { advancePath, beginPath, endpoints, isPairConnected, isSolved, progress, sampledCells, toCell } from './src/engine';

const BOARDS = rawBoards as unknown as Board[];
const CLOVER = rawClover as unknown as CloverChallenge;
const CLOVER_SAVE_KEY = 'numberlink:clover-preview:v1';
const CLOVER_URL = 'https://liamkidney.github.io/numberlink/?mode=clover';
const BOARD_IDS = new Set(BOARDS.map(board => board.id));
const SAVE_KEY = 'numberlink:prototype:v1';
// Browser-only storage key used by the first standalone HTML preview.
const LEGACY_WEB_KEY = 'numberlink-preview-v1';
const INK = '#243041';
const MUTED = '#748093';
const CREAM = '#F7F5F0';
const PALETTE = [
  '#df635e', '#357fb5', '#de9a29', '#8b65b4', '#33977c',
  '#df6f9d', '#6b8e2e', '#ba7550', '#4c62b5', '#9b6671',
  '#1e9baf', '#ac743a', '#7665bc', '#62a067', '#b45486',
  '#507d7c', '#b58e36', '#ae5671', '#737cbb', '#93814a',
];

type Saved = {
  selected: number;
  selectedId?: string; // Stable across future insertions and reordering of the level library.
  completed: string[];
  pathsById: Record<string, Paths>;
};
const EMPTY: Saved = { selected: 0, selectedId: BOARDS[0].id, completed: [], pathsById: {} };

function touchPoint(event: any): [number, number] {
  return [event.nativeEvent.locationX, event.nativeEvent.locationY];
}

function PuzzleCanvas({
  board, paths, size, onChange, cloverCell = null,
}: {
  board: Board;
  paths: Paths;
  size: number;
  onChange: (next: Paths, pair: number) => void;
  cloverCell?: number | null;
}) {
  const cellSize = size / board.width;
  const height = cellSize * board.height;
  const points = endpoints(board);
  const pathsRef = useRef(paths);
  const paramsRef = useRef({ board, size, onChange });
  const activeRef = useRef<{ pair: number; previous: [number, number] } | null>(null);
  pathsRef.current = paths;
  paramsRef.current = { board, size, onChange };

  const handlers = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const { board: b, size: s, onChange: change } = paramsRef.current;
      const p = touchPoint(event);
      const col = Math.floor(p[0] / (s / b.width));
      const row = Math.floor(p[1] / (s / b.width));
      if (row < 0 || row >= b.height || col < 0 || col >= b.width) return;
      const index = row * b.width + col;
      const begun = beginPath(b, pathsRef.current, index);
      if (!begun) { activeRef.current = null; return; }
      activeRef.current = { pair: begun.pair, previous: p };
      if (begun.paths !== pathsRef.current) {
        pathsRef.current = begun.paths;
        change(begun.paths, begun.pair);
      }
    },
    onPanResponderMove: (event) => {
      const active = activeRef.current;
      if (!active) return;
      const { board: b, size: s, onChange: change } = paramsRef.current;
      const current = touchPoint(event);
      let updated = pathsRef.current;
      for (const index of sampledCells(b, s, active.previous, current)) {
        updated = advancePath(b, updated, active.pair, index);
      }
      active.previous = current;
      if (updated !== pathsRef.current) {
        pathsRef.current = updated;
        change(updated, active.pair);
      }
    },
    onPanResponderRelease: () => { activeRef.current = null; },
    onPanResponderTerminate: () => { activeRef.current = null; },
  }), []);

  const pathStroke = cellSize * 0.48;
  const endpointRadius = cellSize * 0.345;

  return (
    <View style={[styles.boardFrame, { width: size + 10, height: height + 10 }]}>
      <View style={{ margin: 5, width: size, height, overflow: 'hidden', borderRadius: 10 }}>
        <Svg width={size} height={height} viewBox={`0 0 ${size} ${height}`} pointerEvents="none">
          <Rect x={0} y={0} width={size} height={height} fill="#FCFBF8" />
          {Array.from({ length: board.width - 1 }, (_, i) => (
            <Line key={`v${i}`} x1={(i + 1) * cellSize} y1={0} x2={(i + 1) * cellSize} y2={height} stroke="#E9E6DF" strokeWidth={1} />
          ))}
          {Array.from({ length: board.height - 1 }, (_, i) => (
            <Line key={`h${i}`} x1={0} y1={(i + 1) * cellSize} x2={size} y2={(i + 1) * cellSize} stroke="#E9E6DF" strokeWidth={1} />
          ))}
          {Object.entries(paths).map(([key, sequence]) => {
            if (!sequence?.length) return null;
            const pair = Number(key);
            const d = sequence.map((index, i) => {
              const [row, col] = toCell(board, index);
              return `${i === 0 ? 'M' : 'L'}${(col + .5) * cellSize} ${(row + .5) * cellSize}`;
            }).join(' ');
            return (
              <SvgPath key={key} d={d} fill="none" stroke={PALETTE[pair % PALETTE.length]}
                strokeWidth={pathStroke} strokeLinecap="round" strokeLinejoin="round" opacity={0.90} />
            );
          })}
          {Object.entries(paths).map(([key, sequence]) => {
            const pair = Number(key);
            if (!sequence?.length || isPairConnected(board, paths, pair)) return null;
            const tip = sequence[sequence.length - 1];
            if (sequence.length < 2 || points[pair]?.includes(tip)) return null;
            const [row, col] = toCell(board, tip);
            return <Circle key={`tip-${key}`} cx={(col + .5) * cellSize} cy={(row + .5) * cellSize}
              r={cellSize * .19} fill={PALETTE[pair % PALETTE.length]} stroke="#FFFFFF" strokeWidth={cellSize * .065} />;
          })}
          {cloverCell !== null && (() => {
            const [row, col] = toCell(board, cloverCell);
            const x = (col + .5) * cellSize;
            const y = (row + .5) * cellSize;
            const d = cellSize * .145;
            const r = cellSize * .145;
            return (
              <React.Fragment key={cloverCell}>
                <Circle cx={x} cy={y} r={cellSize * .36} fill="#FCFBF8" opacity={.86} />
                {[-1, 1].flatMap(dx => [-1, 1].map(dy => (
                  <Circle key={`${dx},${dy}`} cx={x + dx * d} cy={y + dy * d}
                    r={r} fill="#47916B" stroke="#F9FBF7" strokeWidth={cellSize * .025} />
                )))}
                <Circle cx={x} cy={y} r={cellSize * .065} fill="#2E7450" />
              </React.Fragment>
            );
          })()}
          {points.flatMap(([a, b], pair) => [a, b].map((index, endpoint) => {
            const [row, col] = toCell(board, index);
            const cx = (col + .5) * cellSize;
            const cy = (row + .5) * cellSize;
            const color = PALETTE[pair % PALETTE.length];
            return (
              <React.Fragment key={`${pair}-${endpoint}`}>
                <Circle cx={cx} cy={cy} r={endpointRadius + 2} fill="#FCFBF8" />
                <Circle cx={cx} cy={cy} r={endpointRadius} fill={color} />
                <SvgText x={cx} y={cy + cellSize * .112} fill="#FFFFFF" textAnchor="middle"
                  fontFamily={Platform.OS === 'ios' ? 'System' : 'sans-serif'} fontSize={cellSize * (board.width >= 10 ? .29 : .32)} fontWeight="700">
                  {pair + 1}
                </SvgText>
              </React.Fragment>
            );
          }))}
        </Svg>
        <View {...handlers.panHandlers} style={[StyleSheet.absoluteFillObject, Platform.OS === 'web' ? ({ touchAction: 'none' } as any) : null]}
          accessible accessibilityLabel={`Numberlink puzzle. ${board.width} by ${board.height} grid.`} />
      </View>
    </View>
  );
}

function SmallButton({ label, action, disabled = false, important = false }: { label: string; action: () => void; disabled?: boolean; important?: boolean }) {
  return (
    <Pressable disabled={disabled} onPress={action}
      style={({ pressed }) => [styles.smallButton, important && styles.importantButton, disabled && { opacity: .3 }, pressed && { opacity: .65 }]}>
      <Text style={[styles.smallButtonText, important && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}


type CloverResult = { collected: number; elapsedMs: number; practice: boolean };
type CloverRun = {
  paths: Paths;
  score: CloverScore;
  startedAt: number | null;
  elapsedMs: number | null;
  practice: boolean;
  firstResult?: CloverResult;
  lastResult?: CloverResult;
};
const newCloverRun = (firstResult?: CloverResult): CloverRun => ({
  paths: {}, score: emptyCloverScore(), startedAt: null, elapsedMs: null,
  practice: Boolean(firstResult), firstResult,
});
function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function CloverPanel({ size }: { size: number }) {
  const [run, setRun] = useState<CloverRun>(() => newCloverRun());
  const [hydrated, setHydrated] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [lastEdited, setLastEdited] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(CLOVER_SAVE_KEY)
      .then(value => {
        if (!live || !value) return;
        try {
          const parsed = JSON.parse(value) as CloverRun;
          if (parsed && parsed.score && parsed.paths &&
              Array.isArray(parsed.score.completed) &&
              typeof parsed.score.next === 'number' &&
              typeof parsed.score.collected === 'number') setRun(parsed);
        } catch { /* Invalid saved preview starts afresh. */ }
      })
      .catch(() => {})
      .finally(() => { if (live) setHydrated(true); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(CLOVER_SAVE_KEY, JSON.stringify(run)).catch(() => {});
  }, [run, hydrated]);
  useEffect(() => {
    if (run.startedAt === null || run.elapsedMs !== null) return;
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [run.startedAt, run.elapsedMs]);

  const change = (paths: Paths, pair: number) => {
    if (!hydrated) return;
    setLastEdited(pair);
    setRun(previous => {
      if (previous.elapsedMs !== null) return previous;
      const startedAt = previous.startedAt ?? Date.now();
      const score = applyConnectedPair(CLOVER, previous.score, paths, pair);
      const finished = isSolved(CLOVER.board, paths);
      if (!finished) return { ...previous, paths, score, startedAt };
      const elapsedMs = Math.max(0, Date.now() - startedAt);
      const result: CloverResult = { collected: score.collected, elapsedMs, practice: previous.practice };
      return {
        ...previous, paths, score, startedAt, elapsedMs,
        lastResult: result, firstResult: previous.firstResult ?? result,
      };
    });
  };

  const reset = () => {
    setLastEdited(null);
    // Reset only the drawn lines; already attempted colours and elapsed time
    // are deliberately retained to prevent collecting the same clover again.
    setRun(previous => previous.elapsedMs !== null
      ? newCloverRun(previous.firstResult)
      : { ...previous, paths: {} });
  };
  const undo = () => {
    if (lastEdited === null || run.elapsedMs !== null) return;
    setRun(previous => {
      const paths = { ...previous.paths };
      delete paths[lastEdited];
      return { ...previous, paths };
    });
    setLastEdited(null);
  };
  const share = async () => {
    // Only the original completed attempt is shared for a fair comparison.
    const result = run.firstResult;
    if (!result) return;
    const message = cloverResultText(CLOVER, result.collected, result.elapsedMs, CLOVER_URL);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (typeof navigator.share === 'function') await navigator.share({ text: message });
        else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message);
        else await Share.share({ message });
      } else await Share.share({ message });
    } catch { /* Share-sheet cancellation is not an error. */ }
  };
  const board = CLOVER.board;
  const stats = progress(board, run.paths);
  const target = activeCloverCell(CLOVER, run.score);
  const elapsedMs = run.elapsedMs ?? (run.startedAt === null ? 0 : Math.max(0, clock - run.startedAt));
  const result = run.lastResult;
  return (
    <View style={styles.cloverPanel}>
      <View style={styles.playHeader}>
        <View>
          <Text style={styles.sectionLabel}>DAILY CLOVER · PLAYABLE PREVIEW #1</Text>
          <Text style={styles.levelTitle}>Think ahead. Collect all eight.</Text>
        </View>
        <Text style={styles.cloverSymbol}>☘</Text>
      </View>
      <Text style={styles.cloverInstructions}>
        Each clover lies on one colour's path. Work out which line crosses it,
        then complete that line to claim the clover and reveal the next.
        Lines completed too early miss their later clovers.
      </Text>
      <View style={styles.boardContainer}>
        {hydrated
          ? <PuzzleCanvas key={board.id} board={board} paths={run.paths} size={size}
              onChange={change} cloverCell={target} />
          : <Text style={styles.instruction}>Loading saved challenge…</Text>}
      </View>
      <View style={styles.cloverStats}>
        <View>
          <Text style={styles.sectionLabel}>CLOVERS</Text>
          <Text style={styles.cloverStatValue}>☘ {run.score.collected} / {CLOVER.clovers.length}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.sectionLabel}>PAIRS</Text>
          <Text style={styles.cloverStatValue}>{stats.connected} / {stats.totalPairs}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.sectionLabel}>TIME</Text>
          <Text style={styles.cloverStatValue}>{formatDuration(elapsedMs)}</Text>
        </View>
      </View>
      {result ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>{result.collected === CLOVER.clovers.length ? '☘ Perfect collection!' : '☘ Puzzle complete!'}</Text>
          <Text style={styles.successSubtitle}>
            {result.collected} of {CLOVER.clovers.length} clovers · {formatDuration(result.elapsedMs)}
            {result.practice ? ' · Practice run' : ' · First attempt'}
          </Text>
          <SmallButton label={result.practice ? "Share first result ↗" : "Share result ↗"} important action={share} />
          <SmallButton label="Try again (practice)" action={reset} />
        </View>
      ) : (
        <Text style={styles.instruction}>
          {run.practice ? 'Practice run · Your first completed result is saved.' :
            'Your first completed attempt is saved for sharing. Undo and reset cannot recapture a missed clover.'}
        </Text>
      )}
      {!result && (
        <View style={styles.controls}>
          <SmallButton label="Undo line" disabled={lastEdited === null} action={undo} />
          <SmallButton label="Reset lines" action={reset} />
        </View>
      )}
      {!result && run.firstResult && <SmallButton label="Share first result" action={share} />}
      <Text style={styles.cloverNote}>One fixed preview board for now · Daily rotation and streaks come later.</Text>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<'clover' | 'classic'>(() => {
    if (Platform.OS !== 'web') return 'clover';
    try { return new URLSearchParams(globalThis.location?.search ?? '').get('mode') === 'classic' ? 'classic' : 'clover'; }
    catch { return 'clover'; }
  });
  const [saved, setSaved] = useState<Saved>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [lastEdited, setLastEdited] = useState<number | null>(null);
  const [levelPickerOpen, setLevelPickerOpen] = useState(false);
  const [levelSearch, setLevelSearch] = useState('');

  // Rendering a virtualised list avoids squeezing hundreds of buttons into one row.
  const filteredLevels = useMemo(() => {
    const query = levelSearch.trim().toLowerCase().replace('×', 'x');
    return BOARDS.map((board, index) => ({ board, index })).filter(({ board, index }) =>
      !query || String(index + 1).startsWith(query) || board.id.toLowerCase().includes(query) ||
      `${board.width}x${board.height}`.includes(query)
    );
  }, [levelSearch]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SAVE_KEY).then(value => {
      // Preserve progress when switching from the initial HTML prototype to Expo Web.
      if (!value && Platform.OS === 'web') {
        try { value = (globalThis as any).localStorage?.getItem(LEGACY_WEB_KEY) ?? null; } catch { /* private browsing */ }
      }
      if (!mounted) return;
      if (value) {
        try {
          const data = JSON.parse(value);
          if (data && Array.isArray(data.completed) && data.pathsById) {
            const selectedIdIndex = typeof data.selectedId === 'string'
              ? BOARDS.findIndex(board => board.id === data.selectedId) : -1;
            const previousIndex = Number.isInteger(data.selected) ? data.selected : 0;
            const selected = selectedIdIndex >= 0
              ? selectedIdIndex : Math.max(0, Math.min(BOARDS.length - 1, previousIndex));
            setSaved({
              selected,
              selectedId: BOARDS[selected].id,
              completed: data.completed.filter((id: string) => BOARD_IDS.has(id)),
              pathsById: Object.fromEntries(Object.entries(data.pathsById).filter(([id]) => BOARD_IDS.has(id))) as Record<string, Paths>,
            });
          }
        } catch { /* Start with a clean game when storage is corrupt. */ }
      }
    }).catch(() => {}).finally(() => { if (mounted) setHydrated(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(SAVE_KEY, JSON.stringify(saved)).catch(() => {}); }, [saved, hydrated]);

  const level = saved.selected;
  const board = BOARDS[level];
  const paths = saved.pathsById[board.id] ?? {};
  const stats = progress(board, paths);
  const solved = isSolved(board, paths);
  const boardSize = Math.max(200, Math.min(width - 48, 440));
  const completionPct = Math.round(stats.occupied / stats.totalCells * 100);

  const chooseLevel = (next: number) => {
    if (next < 0 || next >= BOARDS.length) return;
    setLastEdited(null);
    setLevelPickerOpen(false);
    setSaved(previous => ({ ...previous, selected: next, selectedId: BOARDS[next].id }));
  };
  const changePaths = (next: Paths, pair: number) => {
    setLastEdited(pair);
    setSaved(previous => ({
      ...previous,
      completed: isSolved(board, next) && !previous.completed.includes(board.id)
        ? [...previous.completed, board.id] : previous.completed,
      pathsById: { ...previous.pathsById, [board.id]: next },
    }));
  };
  const clearLast = () => {
    if (lastEdited === null) return;
    const next = { ...paths };
    delete next[lastEdited];
    changePaths(next, lastEdited);
    setLastEdited(null);
  };
  const resetBoard = () => {
    setLastEdited(null);
    setSaved(previous => ({ ...previous, pathsById: { ...previous.pathsById, [board.id]: {} } }));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} alwaysBounceVertical={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>NUMBERLINK</Text>
            <Text style={styles.headline}>Connect the dots<Text style={{ color: '#E49C50' }}>.</Text></Text>
            <Text style={styles.subtitle}>A quiet little puzzle for your mind.</Text>
          </View>
          <View style={styles.completedCount}>
            <Text style={styles.completedNum}>{saved.completed.filter(id => BOARD_IDS.has(id)).length}<Text style={{ fontSize: 12, color: MUTED }}>/{BOARDS.length}</Text></Text>
            <Text style={styles.completedCaption}>SOLVED</Text>
          </View>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'clover' }}
            onPress={() => setMode('clover')} style={[styles.modeButton, mode === 'clover' && styles.modeSelected]}>
            <Text style={[styles.modeText, mode === 'clover' && styles.modeSelectedText]}>☘ Daily Clover</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'classic' }}
            onPress={() => setMode('classic')} style={[styles.modeButton, mode === 'classic' && styles.modeSelected]}>
            <Text style={[styles.modeText, mode === 'classic' && styles.modeSelectedText]}>Classic levels</Text>
          </Pressable>
        </View>
        {mode === 'clover' ? <CloverPanel size={boardSize - 10} /> : <>
        <View style={styles.levelsHeader}>
          <Text style={styles.sectionLabel}>CHOOSE A LEVEL</Text>
          <Text style={styles.sectionValue}>{BOARDS.length} puzzles</Text>
        </View>
        <Pressable style={styles.currentLevel} accessibilityRole="button"
          accessibilityLabel="Browse all Numberlink levels"
          onPress={() => { setLevelSearch(''); setLevelPickerOpen(true); }}>
          <View>
            <Text style={styles.currentLevelTitle}>Level {String(level + 1).padStart(2, '0')} <Text style={styles.currentLevelTotal}>of {BOARDS.length}</Text></Text>
            <Text style={styles.currentLevelDetails}>
              {board.width} × {board.height} · {board.pairs.length} pairs · {saved.completed.includes(board.id) ? 'Solved' : 'Not solved'}
            </Text>
          </View>
          <Text style={styles.currentLevelAction}>All levels  ›</Text>
        </Pressable>
        <View style={styles.playHeader}>
          <View>
            <Text style={styles.sectionLabel}>LEVEL {String(level + 1).padStart(2, '0')}</Text>
            <Text style={styles.levelTitle}>{board.difficulty === 'hard' ? 'A bigger challenge' : 'Find your flow'}</Text>
          </View>
          <View style={styles.difficultyPill}>
            <View style={[styles.difficultyDot, { backgroundColor: board.difficulty === 'hard' ? '#D48161' : '#7EAB89' }]} />
            <Text style={styles.difficultyText}>{board.difficulty.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.boardContainer}>
          <PuzzleCanvas key={board.id} board={board} paths={paths} size={boardSize - 10} onChange={changePaths} />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{stats.connected} / {stats.totalPairs} pairs connected</Text>
          <Text style={styles.progressText}>{completionPct}% filled</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completionPct}%` }]} />
        </View>

        {solved ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>✦  Beautifully solved!</Text>
            <Text style={styles.successSubtitle}>Every pair connected. Every square filled.</Text>
            {level < BOARDS.length - 1 && <SmallButton label="Next level →" important action={() => chooseLevel(level + 1)} />}
          </View>
        ) : (
          <Text style={styles.instruction}>Drag between matching dots. Lift your finger and resume from a loose end, or drag from any segment to change direction. Fill every square.</Text>
        )}

        <View style={styles.controls}>
          <SmallButton label="← Previous" disabled={level === 0} action={() => chooseLevel(level - 1)} />
          <SmallButton label="Undo line" disabled={lastEdited === null} action={clearLast} />
          <SmallButton label="Reset" action={resetBoard} />
          <SmallButton label="Next →" disabled={level === BOARDS.length - 1} action={() => chooseLevel(level + 1)} />
        </View>
        </>}
        <Text style={styles.footer}>PROTOTYPE 01  ·  ALL PROGRESS SAVED ON THIS DEVICE</Text>
      </ScrollView>
      <Modal visible={levelPickerOpen} animationType="slide" onRequestClose={() => setLevelPickerOpen(false)}>
        <SafeAreaView style={styles.pickerScreen}>
          <View style={styles.pickerHeader}>
            <View>
              <Text style={styles.sectionLabel}>NUMBERLINK LIBRARY</Text>
              <Text style={styles.pickerTitle}>Choose a level</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close level list"
              onPress={() => setLevelPickerOpen(false)} style={styles.pickerClose}>
              <Text style={styles.pickerCloseText}>Done</Text>
            </Pressable>
          </View>
          <TextInput value={levelSearch} onChangeText={setLevelSearch} autoCorrect={false}
            placeholder="Search level number or size (e.g. 10x10)"
            placeholderTextColor={MUTED} style={styles.pickerSearch}
            accessibilityLabel="Search levels" />
          <Text style={styles.pickerCount}>{filteredLevels.length} of {BOARDS.length} levels</Text>
          <FlatList
            data={filteredLevels}
            keyExtractor={item => item.board.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={18}
            maxToRenderPerBatch={24}
            windowSize={9}
            contentContainerStyle={styles.pickerList}
            ListEmptyComponent={<Text style={styles.pickerEmpty}>No matching levels.</Text>}
            renderItem={({ item }) => {
              const selected = item.index === level;
              const done = saved.completed.includes(item.board.id);
              return (
                <Pressable accessibilityRole="button"
                  accessibilityLabel={`Level ${item.index + 1}, ${item.board.width} by ${item.board.height}, ${done ? 'solved' : 'not solved'}`}
                  onPress={() => chooseLevel(item.index)}
                  style={[styles.pickerRow, selected && styles.pickerRowSelected]}>
                  <View style={styles.pickerLevelNumber}>
                    <Text style={styles.pickerNumberText}>{String(item.index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.pickerRowDetail}>
                    <Text style={styles.pickerRowTitle}>{item.board.width} × {item.board.height} · {item.board.pairs.length} pairs</Text>
                    <Text style={styles.pickerRowSubtitle}>{item.board.difficulty === 'unrated' ? 'Unrated' : item.board.difficulty} · {done ? 'Completed' : 'Not solved'}</Text>
                  </View>
                  <Text style={styles.pickerRowChevron}>{selected ? '✓' : '›'}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: CREAM },
  container: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 32 },
  header: { width: '100%', maxWidth: 480, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 },
  eyebrow: { color: '#9D805D', fontSize: 10, fontWeight: '800', letterSpacing: 2.4, marginBottom: 7 },
  headline: { color: INK, fontSize: 26, letterSpacing: -.9, fontWeight: '800' },
  subtitle: { color: MUTED, fontSize: 12, marginTop: 6 },
  completedCount: { backgroundColor: '#EDEAE3', paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, alignItems: 'center', minWidth: 62 },
  completedNum: { color: INK, fontSize: 22, fontWeight: '800' },
  completedCaption: { color: MUTED, fontSize: 8, fontWeight: '800', letterSpacing: 1.1, marginTop: 2 },
  levelsHeader: { width: '100%', maxWidth: 480, flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  sectionLabel: { color: '#8B8D91', fontSize: 10, fontWeight: '800', letterSpacing: 1.35 },
  sectionValue: { color: MUTED, fontSize: 11 },
  playHeader: { width: '100%', maxWidth: 480, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  levelTitle: { color: INK, fontWeight: '700', fontSize: 19, marginTop: 4, letterSpacing: -.3 },
  difficultyPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFEBE5', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 10 },
  difficultyDot: { height: 7, width: 7, borderRadius: 9 },
  difficultyText: { color: '#6B747E', fontSize: 9, fontWeight: '800', letterSpacing: .8 },
  boardContainer: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  boardFrame: { backgroundColor: '#E6E1D8', borderRadius: 15 },
  progressRow: { width: '100%', maxWidth: 450, flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  progressText: { color: '#7C8187', fontSize: 11, fontWeight: '600' },
  progressTrack: { height: 5, borderRadius: 5, backgroundColor: '#E4E1DA', marginTop: 8, width: '100%', maxWidth: 450, overflow: 'hidden' },
  progressFill: { backgroundColor: '#A1B497', height: 5, borderRadius: 5 },
  instruction: { textAlign: 'center', maxWidth: 390, marginTop: 20, color: '#7C818A', fontSize: 12, lineHeight: 19 },
  successCard: { marginTop: 15, padding: 18, backgroundColor: '#E7EFE4', borderRadius: 14, width: '100%', maxWidth: 450, alignItems: 'center', gap: 8 },
  successTitle: { color: '#3E714D', fontSize: 18, fontWeight: '800' },
  successSubtitle: { color: '#667D6C', fontSize: 12, marginBottom: 6 },
  controls: { flexDirection: 'row', marginTop: 23, gap: 7, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 480 },
  smallButton: { backgroundColor: '#EAE6DD', borderRadius: 9, paddingHorizontal: 13, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  importantButton: { backgroundColor: INK },
  smallButtonText: { color: '#405064', fontWeight: '700', fontSize: 11 },
  modeSwitch: { flexDirection: 'row', width: '100%', maxWidth: 480, backgroundColor: '#EBE7DE', borderRadius: 12, padding: 4, marginBottom: 22 },
  modeButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', borderRadius: 10 },
  modeSelected: { backgroundColor: '#FFFFFF' },
  modeText: { color: MUTED, fontWeight: '700', fontSize: 13 },
  modeSelectedText: { color: INK },
  cloverPanel: { width: '100%', maxWidth: 480, alignItems: 'center' },
  cloverSymbol: { fontSize: 29, color: '#47916B' },
  cloverInstructions: { color: '#717A82', fontSize: 12, lineHeight: 19, alignSelf: 'stretch', marginBottom: 16 },
  cloverStats: { width: '100%', maxWidth: 450, flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  cloverStatValue: { color: INK, fontSize: 19, fontWeight: '800', marginTop: 5 },
  cloverNote: { color: MUTED, textAlign: 'center', fontSize: 11, marginTop: 16 },
  footer: { color: '#A8A4A0', fontSize: 9, letterSpacing: 1.0, fontWeight: '700', marginTop: 25, textAlign: 'center' },
  currentLevel: { width: '100%', maxWidth: 480, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EFEBE4', borderRadius: 13, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 25 },
  currentLevelTitle: { color: INK, fontSize: 17, fontWeight: '800' },
  currentLevelTotal: { color: MUTED, fontWeight: '600', fontSize: 12 },
  currentLevelDetails: { color: MUTED, fontSize: 11, marginTop: 5 },
  currentLevelAction: { color: INK, fontSize: 12, fontWeight: '700' },
  pickerScreen: { flex: 1, backgroundColor: CREAM },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 19, paddingBottom: 20 },
  pickerTitle: { color: INK, fontSize: 25, fontWeight: '800', marginTop: 5 },
  pickerClose: { backgroundColor: '#EAE6DD', borderRadius: 9, paddingHorizontal: 16, paddingVertical: 12 },
  pickerCloseText: { color: INK, fontWeight: '700', fontSize: 13 },
  pickerSearch: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2DDD3', marginHorizontal: 20, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 11, color: INK, fontSize: 14 },
  pickerCount: { color: MUTED, marginHorizontal: 22, marginTop: 14, marginBottom: 7, fontSize: 11 },
  pickerList: { paddingHorizontal: 20, paddingBottom: 36 },
  pickerEmpty: { textAlign: 'center', marginTop: 35, color: MUTED },
  pickerRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#E5E0D7', borderRadius: 8 },
  pickerRowSelected: { backgroundColor: '#E4EBE4' },
  pickerLevelNumber: { width: 43, height: 43, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAE6DD' },
  pickerNumberText: { color: INK, fontSize: 15, fontWeight: '800' },
  pickerRowDetail: { flex: 1 },
  pickerRowTitle: { color: INK, fontSize: 15, fontWeight: '700' },
  pickerRowSubtitle: { color: MUTED, fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  pickerRowChevron: { color: '#657783', fontSize: 20, fontWeight: '700' },
});
