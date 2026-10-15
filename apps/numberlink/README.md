# Numberlink — Expo app (single source of truth)

This is the *only* implementation for the Numberlink player: iOS, Android and the deployed web app compile from `App.tsx`, `src/engine.ts` and `src/boards.json`.

## Test locally

- `npm install`
- `npm test` (pure game engine / supplied boards)
- `npm run typecheck`
- `npm run web` (interactive browser dev server)
- `npm start` (Expo Go for iPhone / Android)
- `npm run export:web` (production static site under `/numberlink/`)

## Deployment

Changing this directory on GitHub `main` triggers `.github/workflows/numberlink-web.yml`.
GitHub Actions installs packages, runs tests and typechecking, exports Expo Web and commits **only the compiled result** into `/numberlink/` in the existing Pages repository. GitHub Pages then deploys the site at https://liamkidney.github.io/numberlink/ . The existing root website is untouched.

Importantly, a failed test/build never replaces the live site. The original self-contained HTML preview is intentionally *not* maintained independently.

## Web progress migration

On its first launch, Expo Web imports saved progress from the older `numberlink-preview-v1` localStorage entry into AsyncStorage, if new-format progress does not yet exist. Existing board IDs are unchanged. Mobile and web do not yet share progress across devices.

## Prototype scope

Four supplied boards; connect matching endpoints, orthogonal drag paths, backtrack/undo/reset, full-coverage completion validation, local saves and level navigation. Supplied boards are coordinate-validated but have not been independently solver-verified for existence or uniqueness. Purchases, cloud sync and native store releases are future phases.