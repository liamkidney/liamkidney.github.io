# CX238: anonymous Cathay booking-flow investigation

Last tested: 7 November 2026. Target: CX238, London Heathrow (LHR) to Hong Kong (HKG), business, one-way, Thursday 19 November 2026.

## Simulated booking attempt (7 November 2026)

A further Firefox GitHub Actions run attempted the normal one-way LHR to HKG business-class booking for 19 November. It selected the itinerary inputs and clicked Search flights, but the navigation to `/wdsibe/IBEFacade` failed with **Secure Connection Failed** before any flight results appeared. No `CX238` flight card, seat-selection control, or live seat map was visible. The run captured a screenshot of the failure, without any passenger or booking data.

- [Simulation run](https://github.com/liamkidney/liamkidney.github.io/actions/runs/42371550795)
- [Screenshot artifact](https://github.com/liamkidney/liamkidney.github.io/actions/runs/42371550795/artifacts/13574470513)

No booking was created and no seat was selected. This does **not** establish whether Cathay would allow seat selection before payment when accessed through a normal consumer browser.

## Latest result

**We still cannot retrieve individual seat status without booking context.** The anonymous flight search now reaches Cathay's current flight-selection application in some attempts. The application, however, did not load a flight offer or seat map.

The GitHub-hosted browser testing is intermittent:
- **Firefox, successful navigation attempt:** Cathay flight-search form accepted LHR, HKG, business, 19 Nov and redirected through `/wdsibe/IBEFacade` and `/ibe/` to `https://book.cathaypacific.com/tsp/en_GB/flight-selection` (HTTP 200).
- On that page, **GET `/tsp-svc/v1.0/create-session` returned HTTP 403**. GET `/tsp-svc/v1.0/air-calendar` also returned HTTP 403, and the page displayed a generic request-processing error rather than flight offers.
- **Firefox, subsequent retry:** the same flight search hit `NS_ERROR_NET_INTERRUPT` while navigating through `/wdsibe/IBEFacade`, yielding a Secure Connection Failed page instead of flight-selection.
- **Chromium on Ubuntu 24.04:** the booking homepage `https://flights.cathaypacific.com/en_GB.html` did not load within 25 seconds; navigation was aborted. Disabling HTTP/2 did not resolve it.

These results are consistent with intermittent connectivity and/or access controls in the booking flow, but **do not establish a specific cause**. Do not infer seat occupancy from an HTTP 403 or 200 document response.

## Observed APIs

From Cathay's public booking homepage (HTTP 200):
- `GET https://api.cathaypacific.com/redibe/airport/origin/en_GB`
- `GET https://api.cathaypacific.com/ibe-od/v3.0/en_GB`
- `GET https://book.cathaypacific.com/CathayPacificV3/dyn/air/api/instant/open-search`
- `GET https://book.cathaypacific.com/CathayPacificV3/dyn/air/api/instant/histogram`

From flight-selection on the successful navigation attempt:
- `GET https://api.cathaypacific.com/tsp-svc/v1.0/acms-resources` → 200
- `GET https://api.cathaypacific.com/tsp-svc/v1.0/create-session` → 403
- `GET https://api.cathaypacific.com/tsp-svc/v1.0/air-calendar` → 403

Earlier direct experiments:
- `POST https://api.cathaypacific.com/tsp-svc/v1.0/seat-map` with only flight number/date → 500, no seat map.
- Public Cathay award-calendar API → 200, but its award-ticket indicator is **not** seat occupancy.

## GitHub Actions tests

- Firefox reached flight-selection / saw 403: https://github.com/liamkidney/liamkidney.github.io/actions/runs/42369525792
- Firefox intermittent failure and Chromium timeout on retry: https://github.com/liamkidney/liamkidney.github.io/actions/runs/42369681458
- Initial seat-map POST and award-calendar API tests: https://github.com/liamkidney/liamkidney.github.io/actions/runs/42366375720

## Boundaries

All browser tests were run in an **anonymous, newly created session** with no booking reference, surname, account, passenger data or payment. Only normal flight search and public-page actions were performed. No CAPTCHA bypassing or authentication circumvention was attempted.

This is a one-off experiment on `experiment/cx238-prebooking-browser`, not a scheduled booking bot. The production Pages monitor on `main` remains unchanged and does not report individual seats.

## Next practical option

Cathay's NDC developer/partner access application is pending. If granted, investigate documented Offer/SeatAvailability APIs using authorised credentials and a temporary shopping offer, rather than further relying on these unstable anonymous browser endpoints. Seat-map availability without a PNR has not been verified.
