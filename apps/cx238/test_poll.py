import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from poll import extract_award_code, poll

class CathayTests(unittest.TestCase):
    def test_date_code(self):
        data = {"availabilities":{"std":[
            {"date":"20261118","availability":"H"},
            {"date":"20261119","availability":"NA"}]}}
        self.assertEqual(extract_award_code(data), "NA")
    def test_missing_date(self):
        self.assertIsNone(extract_award_code({"availabilities":{"std":[]}}))
    def test_not_seat_data(self):
        self.assertEqual(extract_award_code({"availabilities":{"std":[
            {"date":"20261119","availability":"L","seat":"11A"}]}}), "L")
    def test_malformed(self):
        with self.assertRaises(ValueError):
            extract_award_code({"seats":[{"number":"11A"}]})
    def test_after_departure_no_http(self):
        result = poll(datetime(2026, 11, 20, tzinfo=timezone.utc))
        self.assertEqual(result["state"], "flight_departed")
        self.assertFalse(result["seat_level_live"])

if __name__ == "__main__":
    unittest.main()
