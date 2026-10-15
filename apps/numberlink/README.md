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

Four user-supplied boards; path-drawing, strict full-coverage completion validation, undo, reset, navigation and saved progress. Board endpoints are structurally validated but **solvability and uniqueness have not been independently proved**. Purchases, authentication, and store builds are later steps.
