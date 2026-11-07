"""Read a public cached CX238 seat map. No PNR, name, cookies or auth."""
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone, date
from pathlib import Path

FLIGHT = "CX238"
DEPARTURE = "2026-11-19"
ENDPOINT = "https://flightseatmap.com/api/chatgpt/seatmap/CX238"
OUTPUT = Path(__file__).with_name("status.json")


def unwrap_map(data):
    """Handle common API envelope shapes; don't infer seat availability."""
    for _ in range(4):
        if not isinstance(data, dict):
            return None
        if isinstance(data.get("decks"), list):
            return data
        data = next((data[k] for k in ("data", "seatmap", "seatMap", "result")
                     if isinstance(data.get(k), dict)), None)
    return None


def business_seats(data):
    seatmap = unwrap_map(data)
    if seatmap is None:
        return None
    code = str(seatmap.get("flightNumber", FLIGHT)).replace(" ", "").upper()
    if code != FLIGHT:
        raise ValueError("API returned a different flight: " + code)
    seats = {}
    for deck in seatmap["decks"]:
        if not isinstance(deck, dict):
            continue
        for item in deck.get("seats", []):
            if not isinstance(item, dict):
                continue
            cabin = str(item.get("cabin", "")).strip().lower()
            if cabin not in {"business", "business class", "j"}:
                continue
            number = str(item.get("number") or item.get("seatNumber") or "").upper()
            status = str(item.get("status", "unknown")).strip().lower()
            if re.fullmatch(r"[1-9][0-9]{0,2}[A-Z]", number):
                seats[number] = status
    return dict(sorted(seats.items(), key=lambda x: (int(x[0][:-1]), x[0][-1])))


def poll(now=None):
    now = now or datetime.now(timezone.utc)
    result = {
        "flight": FLIGHT, "departure_date": DEPARTURE,
        "checked_at": now.isoformat(timespec="seconds"),
        "source": "FlightSeatmap public cached endpoint",
        "source_url": ENDPOINT, "live": False, "date_specific": False,
        "state": "not_checked", "http_status": None,
        "business_seats": {}, "available_business_seats": [],
        "newly_available": [], "error": None,
    }
    if now.date() > date.fromisoformat(DEPARTURE):
        result["state"] = "flight_departed"
        return result
    request = urllib.request.Request(
        ENDPOINT, headers={"Accept": "application/json",
                           "User-Agent": "CX238-personal-seat-watch/0.1"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            result["http_status"] = response.status
            data = json.loads(response.read(2_000_000).decode("utf-8"))
        seats = business_seats(data)
        if seats is None:
            result["state"] = "schema_unrecognised"
            result["error"] = "JSON returned, but no recognised deck/seat structure"
            result["response_fields"] = sorted(data)[:25] if isinstance(data, dict) else []
        else:
            result["business_seats"] = seats
            result["available_business_seats"] = [s for s,v in seats.items() if v == "available"]
            result["state"] = "cached_map_received" if seats else "no_business_seats_in_response"
    except urllib.error.HTTPError as exc:
        result["http_status"] = exc.code
        result["state"] = "http_error"
        result["error"] = "HTTP " + str(exc.code)
    except (urllib.error.URLError, TimeoutError, ValueError, UnicodeError) as exc:
        result["state"] = "fetch_error"
        result["error"] = str(exc)[:300]
    return result


def main():
    previous = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text())
        except (ValueError, OSError):
            pass
    status = poll()
    if (status["state"] == "cached_map_received" and
        previous.get("state") == "cached_map_received" and
        previous.get("source") == status["source"]):
        old = set(previous.get("available_business_seats", []))
        status["newly_available"] = sorted(set(status["available_business_seats"]) - old)
    OUTPUT.write_text(json.dumps(status, indent=2, sort_keys=True) + "\n")
    print(json.dumps(status, indent=2))
    print("NOTE: Public endpoint is cached/undated, not live seat status for 19 Nov.")


if __name__ == "__main__":
    main()
