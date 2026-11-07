"""Offline tests, run on GitHub Actions before polling."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from poll import business_seats, unwrap_map

class SeatMapTests(unittest.TestCase):
    def test_business_status(self):
        payload = {"flightNumber": "CX238", "decks": [{"seats": [
            {"number":"11A", "cabin":"business", "status":"available"},
            {"number":"11D", "cabin":"business", "status":"blocked"},
            {"number":"30B", "cabin":"economy", "status":"available"},
        ]}]}
        self.assertEqual(business_seats(payload), {"11A":"available", "11D":"blocked"})
    def test_envelope(self):
        self.assertEqual(business_seats({"data":{"decks":[{"seats":[
            {"number":"12K","cabin":"BUSINESS","status":"available"}]}]}}),
            {"12K":"available"})
    def test_mismatched_flight(self):
        with self.assertRaises(ValueError):
            business_seats({"flightNumber":"BA238", "decks":[]})
    def test_unrecognised(self):
        self.assertIsNone(business_seats({"message":"not found"}))

if __name__ == "__main__":
    unittest.main()
