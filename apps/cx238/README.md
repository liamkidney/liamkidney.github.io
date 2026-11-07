# CX238 seat watch (19 November 2026)

Public prototype at https://liamkidney.github.io/cx238/

- GitHub Actions runs a small Python poller on GitHub-hosted runners every two hours and on manual dispatch.
- GitHub Pages serves the read-only UI at /cx238/.
- The workflow commits a small status.json snapshot to main. The page reads it from raw.githubusercontent.com so the existing Pages build need not rerun after every poll.
- No personal booking reference, surname, cookies, tokens, or login details are used.
- The only free unauthenticated source currently integrated is FlightSeatmap's **cached** endpoint, GET https://flightseatmap.com/api/chatgpt/seatmap/CX238.
- Cached data is **not** live seat availability for CX238 on 2026-11-19, and may refer to a different departure date. Do not describe it as live. A proper flight/date-specific provider is still required to meet the original objective.
- Cathay's award API returns redemption-ticket availability, **not** individual seat status, and has therefore deliberately not been used.
- Unit tests are entirely offline. The live HTTP probe runs on GitHub, not in the assistant's local Python environment.
- After 19 November, automatic probes stop but the Actions schedule remains enabled until manually disabled.

To run once, open Actions > Check CX238 seat-map source > Run workflow.
Inspect the Actions logs and the published snapshot to see whether the API is usable.
