# Approach — Air Traffic Control

An early browser/mobile-friendly arcade prototype. Incoming aircraft must be routed safely onto a single eastbound runway.

## Controls

- **Touch or click a plane**, drag a line to the **green APPROACH marker** at the left of the runway, and release.
- Once the line reaches the marker, the last segment aligns automatically to the runway.
- Planes keep flying even if they have no assigned route; rerouting an aircraft replaces its previous path.
- Earn **100 points** for every safe landing. Aircraft that collide or leave the airspace cause incidents. The shift ends after **3 incidents**.
- **Pause**, **Restart**, or press **Escape** to pause on desktop.

The plane silhouettes and runway are temporary Canvas graphics. This version intentionally has no backend, login, or external assets.

## Running locally

From `apps/air-traffic-control`:

```sh
npm test
npm run dev
```

Visit the local server URL printed by Vite. All files are vanilla ES modules; Vite is only used to run a development server and build the static site.

## Deployments

Hosted in the existing `liamkidney.github.io` website repository, to avoid interfering with the existing Numberlink game.

- Production: `https://liamkidney.github.io/air-traffic-control/` (from `main`).
- Development: `https://liamkidney.github.io/air-traffic-control/dev/` (from `dev`).
- `.github/workflows/numberlink-web.yml` is the single Pages publisher: it builds the existing Numberlink website and both air traffic environments into one Pages artifact. The workflow tests the air traffic engine before publishing.
- The dedicated ATC CI workflow runs checks on development pushes and pull requests.

Each environment has its own version-stamped HTML metadata, and relative asset paths so either URL works independently. Avoid creating a second competing GitHub Pages publisher in this repository.
