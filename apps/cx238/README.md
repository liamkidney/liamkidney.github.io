# Cathay CX238 API monitor

URL: https://liamkidney.github.io/cx238/

Uses Cathay's own public award calendar, no account or PNR:
https://api.cathaypacific.com/afr/search/availability/en.LHR.HKG.bus.CX.1.20261119.20261119.json

On 7 Nov 2026, the GitHub runner returned HTTP 200 and code NA for 19 Nov.
This is award-ticket availability for business class on the LHR-HKG route. It is NOT the
availability of individual seats such as 11A or 12K, and is not necessarily CX238-specific.

A single anonymous POST to the Cathay Manage Booking seat-map API with only
flight/date returned HTTP 500 and no seat map. The diagnostic run is at
https://github.com/liamkidney/liamkidney.github.io/actions/runs/42366375720 .
The one-shot diagnostic is NOT part of scheduled polling.

Python standard library only. No booking reference, surname, cookies,
authentication tokens or API secrets. GitHub Actions checks every two hours
up to the departure date. Pages displays a committed JSON snapshot.
Five offline unit tests verify extraction and post-departure behavior.

An authenticated NDC provider's SeatAvailability API may accept a flight offer
instead of an existing reservation, but access requires partner onboarding.
