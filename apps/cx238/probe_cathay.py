"""One-shot diagnostics for Cathay APIs using only flight/date (never a PNR)."""
import json
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://api.cathaypacific.com"
OUT = Path(__file__).with_name("cathay_probe.json")
FLIGHT = "CX238"
DATE = "2026-11-19"
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; CX238-personal-seat-monitor/0.1)",
    "Referer": "https://book.cathaypacific.com/",
    "Origin": "https://book.cathaypacific.com",
}


def request(method, url, body=None):
    """One HTTP request; report only HTTP status and safe JSON structural metadata."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={**HEADERS, **({"Content-Type": "application/json"} if data else {})}
    )
    result = {"method": method, "http_status": None, "json_keys": [], "json_type": None}
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result["http_status"] = resp.status
            raw = resp.read(500000)
    except urllib.error.HTTPError as e:
        result["http_status"] = e.code
        raw = e.read(500000)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        result["error_type"] = type(e).__name__
        result["error"] = str(e)[:200]
        return result
    try:
        payload = json.loads(raw)
    except (UnicodeDecodeError, ValueError):
        result["content_type"] = "not_json"
        return result
    result["json_type"] = type(payload).__name__
    if isinstance(payload, dict):
        result["json_keys"] = sorted(payload.keys())[:45]
        result["error_codes"] = [
            str(payload[k])[:160] for k in ("code", "errorCode", "error", "message")
            if k in payload and isinstance(payload[k], (str, int))
        ][:4]
        if isinstance(payload.get("availabilities"), dict):
            items = payload["availabilities"].get("std", [])
            result["award_date_entries"] = [
                {"date": v.get("date"), "availability": v.get("availability")}
                for v in items if isinstance(v, dict) and v.get("date") == "20261119"
            ]
        # Recognise a seat-map structure without logging passenger or order data.
        for k in ("decks", "cabins", "seatMap", "seatmap", "seatMaps", "seatMapsResponse"):
            v = payload.get(k)
            if isinstance(v, list):
                result["seat_map_candidate"] = {"key": k, "list_count": len(v)}
            elif isinstance(v, dict):
                result["seat_map_candidate"] = {"key": k, "fields": sorted(v)[:25]}
    return result


def main():
    # Public Cathay award API: a flight-independent award-seat availability calendar.
    awards_url = BASE + "/afr/search/availability/en.LHR.HKG.bus.CX.1.20261119.20261119.json"
    # Booking seat-map endpoint; try only flight number/date, never any PNR or surname.
    # This diagnostic POST deliberately runs just once and is NOT scheduled.
    seat_url = BASE + "/tsp-svc/v1.0/seat-map"
    body = {"params": {"flightNumber": FLIGHT, "departureDate": DATE}}
    results = {
        "flight": FLIGHT, "departure": DATE,
        "no_booking_reference": True,
        "awards_api": request("GET", awards_url),
        "seatmap_anonymous_probe": request("POST", seat_url, body),
        "warning": "Award availability is not an individual seat map. Anonymous POST is diagnostic only."
    }
    OUT.write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
