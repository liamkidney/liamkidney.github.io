"""Check Cathay public award calendar. Never report it as assigned seats."""
import json
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

FLIGHT = "CX238"
DATE = "2026-11-19"
API_URL = "https://api.cathaypacific.com/afr/search/availability/en.LHR.HKG.bus.CX.1.20261119.20261119.json"
OUT = Path(__file__).with_name("status.json")
HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; personal-CX238-monitor/1.0)",
    "Referer": "https://book.cathaypacific.com/",
}

def extract_award_code(payload, yyyymmdd="20261119"):
    if not isinstance(payload, dict):
        raise ValueError("Response is not a JSON object")
    values = payload.get("availabilities")
    if not isinstance(values, dict) or not isinstance(values.get("std"), list):
        raise ValueError("Missing availabilities.std")
    matching = [r.get("availability") for r in values["std"] if
                isinstance(r, dict) and str(r.get("date")) == yyyymmdd]
    if not matching:
        return None
    if len(matching) != 1 or not isinstance(matching[0], str):
        raise ValueError("Unexpected availability entry")
    return matching[0]

def poll(now=None):
    now = now or datetime.now(timezone.utc)
    result = {
        "flight": FLIGHT, "departure_date": DATE,
        "checked_at": now.isoformat(timespec="seconds"),
        "source": "Cathay Pacific public award calendar API",
        "source_url": API_URL, "route": "LHR-HKG", "cabin": "business",
        "state": "not_checked", "http_status": None, "award_code": None,
        "seat_map_status": "not_available_without_booking_or_offer",
        "seat_level_live": False, "seat_data": [], "error": None,
    }
    if now.date() > date.fromisoformat(DATE):
        result["state"] = "flight_departed"
        return result
    req = urllib.request.Request(API_URL, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            result["http_status"] = resp.status
            payload = json.loads(resp.read(1000000).decode("utf-8"))
        result["award_code"] = extract_award_code(payload)
        result["state"] = "award_calendar_received" if result["award_code"] is not None else "award_date_missing"
    except urllib.error.HTTPError as exc:
        result["http_status"] = exc.code
        result["state"] = "http_error"
        result["error"] = "HTTP " + str(exc.code)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        result["state"] = "network_error"
        result["error"] = type(exc).__name__ + ": " + str(exc)[:180]
    except (UnicodeError, ValueError) as exc:
        result["state"] = "invalid_response"
        result["error"] = str(exc)[:180]
    return result

def main():
    previous = {}
    if OUT.exists():
        try:
            previous = json.loads(OUT.read_text())
        except (ValueError, OSError):
            pass
    now = datetime.now(timezone.utc)
    if now.date() > date.fromisoformat(DATE) and previous.get("state") == "flight_departed":
        print("Flight departed; no new requests or writes.")
        return
    status = poll(now)
    OUT.write_text(json.dumps(status, indent=2, sort_keys=True) + "\n")
    print(json.dumps(status, indent=2))
    print("NOTE: Award availability does not indicate individual free seats.")

if __name__ == "__main__":
    main()
