# CX238 anonymous booking-flow investigation

Test date: 7 November 2026. Target: CX238, London Heathrow (LHR) to Hong Kong (HKG), business class, one way, 19 November 2026.

## Outcome

**No seat-by-seat availability was obtained.** The experiment verified that the public Cathay booking form can be automated without a reservation, but its flight-results redirect failed from GitHub Actions.

## Confirmed steps

1. The GitHub Actions runner on Ubuntu 24.04 launches headless Firefox and loads `https://flights.cathaypacific.com/en_GB.html` (HTTP 200).
2. Cathay's airport-picker UI selects London Heathrow (LHR) and Hong Kong (HKG) through genuine visible autocomplete options.
3. The UI selects One way and Business.
4. The departure calendar selects Thursday 19 November 2026.
5. The normal Search flights button is enabled and is clicked successfully.
6. Cathay navigates to `https://www.cathaypacific.com/wdsibe/IBEFacade` but Firefox renders **Secure Connection Failed**. No search results, offer ID or seat map are returned.

A separate Chromium test failed earlier with ERR_HTTP2_PROTOCOL_ERROR on the homepage; Firefox was required to load it. The booking-engine failure could be environmental, network-related, or a site access control. The test does not isolate its cause.

## API endpoints seen from the public booking page

These respond without personal booking information, but **none returned occupied/free seat numbers**:

- GET `https://api.cathaypacific.com/redibe/airport/origin/en_GB`
- GET `https://api.cathaypacific.com/ibe-od/v3.0/en_GB`
- GET `https://book.cathaypacific.com/CathayPacificV3/dyn/air/api/instant/open-search`
- GET `https://book.cathaypacific.com/CathayPacificV3/dyn/air/api/instant/histogram`

The existing one-shot test of `POST /tsp-svc/v1.0/seat-map` using only flight number and date returned HTTP 500, without a usable seat map.

## Logs

- Browser booked-flight search: https://github.com/liamkidney/liamkidney.github.io/actions/runs/42368597986
- One-shot Cathay API test: https://github.com/liamkidney/liamkidney.github.io/actions/runs/42366375720

## Scope and safety

All tests use a new anonymous browser. They do not include a booking reference, surname, account login, passenger identity or payment information. They stop before collecting or submitting passenger details. Request logs contain only hostname, path, method and status; no query strings, cookies or credentials.

The production Pages dashboard and scheduled monitor on `main` were not changed. Its Cathay award-calendar signal is not individual-seat availability.

## Next engineering option

To obtain a seat map without an existing PNR, the most plausible remaining route is a legitimate flight-offer/seat-availability flow through Cathay NDC or a supported distribution partner. This requires registration or partner access; no free, anonymous flight/date-specific seat-level endpoint has been verified. A normal interactive browser session may also clarify whether Cathay exposes a seat map before checkout.
