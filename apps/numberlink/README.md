# Numberlink — Expo app (single source of truth)

This is the **only maintained** implementation of Numberlink for web, iOS and Android. The shared game UI and rules live in `App.tsx`, `src/engine.ts` and `src/boards.json`.

## Local development

- `npm install`
- `npm test` — puzzle engine and supplied boards
- `npm run typecheck` — React Native/TypeScript types
- `npm run web` — interactive browser server
- `npm start` — Expo Go on iOS or Android
- `npm run export:web` — production export for `/numberlink/`

## Production deployment

The repository workflow `.github/workflows/numberlink-web.yml` runs whenever files here change on `main`. It checks the rules and types, exports Expo Web, combines the web bundle with the existing website homepage and other root assets, and deploys the combined artifact via the official GitHub Pages deploy action.

- Live game: https://liamkidney.github.io/numberlink/
- No manually maintained standalone browser implementation; generated web assets come from Expo.
- A failed build does not replace the live deployment.
- No local machine is needed: GitHub Actions builds the website.

## Browser progress migration

On first load, the Expo Web implementation reads any saved progress from the old standalone `numberlink-preview-v1` localStorage key before saving it to AsyncStorage; board IDs are unchanged. Progress does not yet sync across devices.

## Prototype limitations

Four current iteration-5 boards (levels 000031–000034) generated offline and previously checked for full-grid uniqueness and no premature completion; path-drawing, strict full-coverage validation, undo, reset, level navigation and saved progress. The app contains no in-browser SMT solver; verification is performed before importing boards.

## Level library

- New boards are stored in `src/boards.json`, an array of `{ id, width, height, difficulty, pairs }`.
- Coordinates in the **app** are `[row, column]`; generator export JSON uses `[x, y]` and must be transposed before import.
- The **All levels** control opens a virtualised, searchable list suitable for large board catalogues. Search by level number or board size such as `10x10`.
- Saved progress is keyed by board ID, and current selection is saved by ID (with migration from the older numeric selection). Removed levels are excluded from progress counts.
- Difficulty remains `unrated` until playtesting validates a grading model.
- Completing a puzzle still requires connecting all pairs **and** filling every square. Purchases, authentication and synchronisation across devices remain later steps. Purchases, authentication, and store builds are later steps.
