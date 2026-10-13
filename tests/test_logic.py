import random
import tempfile
import unittest
from datetime import date
from pathlib import Path

from attestation import content as C
from attestation import logic as L
from attestation.db import Database


class ContentTest(unittest.TestCase):
    def test_bank_size(self):
        self.assertEqual(len(C.CLOSED), 48)
        self.assertEqual({k: len(v) for k, v in C.OPEN_SETS.items()},
                         {"aspirator": 20, "classification": 12, "U2-U3": 10, "U3-U4": 10, "U4-U5": 10})
        self.assertTrue(all(len(q["options"]) == 3 for q in C.CLOSED.values()))

    def test_keys_match_document(self):
        # ключи из таблиц раздела 2 банка вопросов
        expected = "авбавбавбавбавбаббавбавбавбавбавбавбавбавбавбавб"
        self.assertEqual("".join("абв"[C.CLOSED[f"C{i}"]["answer"]] for i in range(1, 49)), expected)

    def test_tables_parsed(self):
        self.assertEqual(len(C.COMPETENCIES), 20)
        h9 = next(c for c in C.COMPETENCIES if c["code"] == "H9")
        self.assertEqual(h9["required"], {2: 2, 3: 5, 4: 8, 5: 10})
        s4 = next(c for c in C.COMPETENCIES if c["code"] == "S4")
        self.assertEqual(s4["required"], {2: 0, 3: 1, 4: 4, 5: 4})
        self.assertEqual(len(C.SURVEY_QUESTIONS), 10)
        self.assertIn("блокирующий", C.SURVEY_QUESTIONS[C.SURVEY_BLOCKING])
        self.assertEqual(len(C.CRITERIA["U0-U1"]), 8)
        self.assertEqual(len(C.CRITERIA["U1-U2"]), 9)
        self.assertEqual({k: v["months"] for k, v in C.MIN_MONTHS.items()},
                         {"U0-U1": 1, "U1-U2": 3, "U2-U3": 12, "U3-U4": 24, "U4-U5": 36})


class AttemptTest(unittest.TestCase):
    def test_u0_u1_ticket(self):
        d = L.build_attempt("U0-U1", random.Random(1))
        self.assertEqual(len(d["closed"]), 20)
        self.assertTrue(all(C.CLOSED[q["id"]]["topic"] in {"1.1", "1.2", "1.3", "1.4", "1.5"} for q in d["closed"]))
        self.assertEqual(len(set(q["id"] for q in d["closed"])), 20)
        self.assertEqual(d["open"], ["aspirator-1", "aspirator-2", "aspirator-10", "aspirator-16",
                                     "classification-1", "classification-2", "classification-3", "classification-4"])
        self.assertIsNone(d["defense"])

    def test_u1_u2_ticket(self):
        for seed in range(20):
            d = L.build_attempt("U1-U2", random.Random(seed))
            self.assertEqual(len(d["closed"]), 30)
            self.assertEqual(len(d["open"]), 10)
            self.assertEqual(len(set(d["open"])), 10)
            for must in ("aspirator-3", "aspirator-5", "aspirator-14"):
                self.assertIn(must, d["open"])
            self.assertEqual(sorted(d["blocking"]), ["aspirator-14", "aspirator-5"])
            self.assertIsNotNone(d["defense"])

    def test_senior_tickets(self):
        for key in ("U2-U3", "U3-U4", "U4-U5"):
            d = L.build_attempt(key)
            self.assertEqual(d["closed"], [])
            self.assertTrue(d["closed_done"])
            self.assertEqual(len(d["open"]), 10)

    def test_closed_threshold(self):
        d = L.build_attempt("U0-U1", random.Random(2))
        for i, q in enumerate(d["closed"]):
            right = C.CLOSED[q["id"]]["answer"]
            d["closed_answers"][q["id"]] = right if i < 16 else (right + 1) % 3
        r = L.closed_result(d)
        self.assertEqual((r["score"], r["max"], r["passed"]), (16, 20, True))  # ровно 80 %
        d["closed_answers"][d["closed"][0]["id"]] = None
        self.assertFalse(L.closed_result(d)["passed"])

    def test_open_blocking(self):
        d = L.build_attempt("U1-U2", random.Random(3))
        d["open_scores"] = {i: 2 for i in d["open"]}
        self.assertTrue(L.open_result(d)["passed"])
        d["open_scores"]["aspirator-5"] = 0  # 18 из 20 = 90 %, но блокирующий вопрос
        r = L.open_result(d)
        self.assertEqual(r["score"], 18)
        self.assertFalse(r["passed"])
        self.assertEqual(r["blocking_failed"], ["aspirator-5"])

    def test_open_not_graded(self):
        d = L.build_attempt("U2-U3")
        self.assertFalse(L.open_result(d)["graded"])
        self.assertFalse(L.exam_passed(d))

    def test_defense_q4(self):
        d = L.build_attempt("U2-U3")
        d["defense"]["scores"] = [[2] * 10 for _ in range(3)]
        self.assertTrue(L.defense_result(d)["passed"])
        d["defense"]["scores"][1][3] = 0
        self.assertFalse(L.defense_result(d)["passed"])
        self.assertFalse(L.blocking_answered(d))

    def test_exam_passed_all_parts(self):
        d = L.build_attempt("U2-U3")
        d["open_scores"] = {i: 2 for i in d["open"]}
        d["defense"]["scores"] = [[2] * 10 for _ in range(3)]
        d["practical"]["result"] = L.PART_PASSED
        d["documentation"]["result"] = L.PART_PASSED
        self.assertTrue(L.exam_passed(d))
        d["practical"]["result"] = L.PART_FAILED
        self.assertFalse(L.exam_passed(d))


class DatesTest(unittest.TestCase):
    def test_months(self):
        self.assertEqual(L.months_between(date(2025, 1, 31), date(2025, 2, 28)), 0)
        self.assertEqual(L.months_between(date(2025, 1, 15), date(2025, 2, 15)), 1)
        self.assertEqual(L.months_between(date(2024, 10, 1), date(2025, 10, 1)), 12)

    def test_add_months(self):
        self.assertEqual(L.add_months(date(2025, 8, 31), 6), date(2026, 2, 28))
        self.assertEqual(L.add_months(date(2025, 3, 10), 6), date(2025, 9, 10))

    def test_can_lift(self):
        f = {"date": "2025-01-10"}
        self.assertFalse(L.can_lift(f, date(2025, 7, 9)))
        self.assertTrue(L.can_lift(f, date(2025, 7, 10)))


def survey(mode="С-2", interventions=0, scores=None, shelf=1, asp=0):
    return {"mode": mode, "interventions": interventions, "scores": scores or [2] * 10, "on_shelf": shelf,
            "is_aspirator": asp}


class CriteriaTest(unittest.TestCase):
    def test_u0_u1_auto(self):
        surveys = [survey(scores=[1] * 10) for _ in range(4)]
        crit = {c["num"]: c for c in L.criteria_status("U0-U1", surveys, [], {})}
        self.assertFalse(crit[6]["done"])        # 4 работы < 5
        self.assertFalse(crit[7]["done"])        # средняя 1.0 < 1.2
        surveys.append(survey(scores=[2] * 10))
        surveys.append(survey(scores=[2] * 10))
        crit = {c["num"]: c for c in L.criteria_status("U0-U1", surveys, [], {})}
        self.assertTrue(crit[6]["done"])
        self.assertTrue(crit[7]["done"])         # средняя (40 + 40) / 60 = 1.33
        self.assertFalse(crit[1]["done"])        # ручной пункт без отметки
        crit = {c["num"]: c for c in L.criteria_status("U0-U1", surveys, [], {1: {"done": True, "note": ""}})}
        self.assertTrue(crit[1]["done"])

    def test_u1_u2_auto(self):
        surveys = [survey(mode="С-1") for _ in range(10)] + [survey(mode="С-3") for _ in range(10)]
        crit = {c["num"]: c for c in L.criteria_status("U1-U2", surveys, [], {})}
        self.assertTrue(crit[3]["done"])
        self.assertTrue(crit[4]["done"])
        self.assertTrue(crit[5]["done"])
        surveys[-1] = survey(interventions=2)
        bad_q4 = [2] * 10
        bad_q4[3] = 0
        surveys[0] = survey(scores=bad_q4)
        crit = {c["num"]: c for c in L.criteria_status("U1-U2", surveys, [], {})}
        self.assertFalse(crit[4]["done"])
        self.assertFalse(crit[5]["done"])


class PromotionTest(unittest.TestCase):
    def test_u2_u3(self):
        emp = {"level": 2, "level_date": "2024-01-01"}
        comps = {c["code"]: c["required"][3] for c in C.COMPETENCIES}
        d = L.build_attempt("U2-U3")
        d["open_scores"] = {i: 2 for i in d["open"]}
        d["defense"]["scores"] = [[2] * 10 for _ in range(3)]
        d["practical"]["result"] = d["documentation"]["result"] = L.PART_PASSED
        attempts = [{"transition": "U2-U3", "status": "done", "started": "2025-06-01T10:00:00", "data": d}]
        st = L.promotion_status(emp, comps, [], attempts, [], {}, today=date(2025, 6, 2))
        self.assertTrue(st["eligible"], st)
        comps["H5"] = 1
        st = L.promotion_status(emp, comps, [], attempts, [], {}, today=date(2025, 6, 2))
        self.assertFalse(st["eligible"])
        comps["H5"] = 2
        st = L.promotion_status(emp, comps, [{"lifted_date": None}], attempts, [], {}, today=date(2025, 6, 2))
        self.assertFalse(st["eligible"])
        st = L.promotion_status(emp, comps, [], attempts, [], {}, today=date(2024, 6, 2))
        self.assertFalse(st["eligible"])  # стаж 5 мес. < 12

    def test_u3_u4_extra(self):
        emp = {"level": 3, "level_date": "2020-01-01"}
        st = L.promotion_status(emp, {}, [], [], [], {})
        self.assertIn(C.EXTRA_CONDITIONS["U3-U4"], [c[0] for c in st["conditions"]])


class DatabaseTest(unittest.TestCase):
    def test_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "t.db")
            self.assertFalse(db.has_password())
            db.set_password("1234")
            self.assertTrue(db.check_password("1234"))
            self.assertFalse(db.check_password("12345"))
            eid = db.save_employee({"full_name": "Тестов Т. Т.", "position": "Ученик", "level": 0,
                                    "level_date": "2025-01-01", "admissions": "", "next_attestation": "",
                                    "notes": "", "active": 1})
            db.save_survey({"employee_id": eid, "date": "2025-02-01", "equipment": "Отсос", "is_aspirator": 1,
                            "on_shelf": 1, "mode": "С-1", "interventions": 1, "scores": [1] * 10,
                            "mentor": "", "comment": ""})
            self.assertEqual(db.surveys(eid)[0]["scores"], [1] * 10)
            aid = db.create_attempt(eid, "U0-U1", "exam", L.build_attempt("U0-U1"))
            db.close()
            db = Database(Path(tmp) / "t.db")  # незавершённая попытка помечается прерванной
            self.assertEqual(db.attempt(aid)["status"], "interrupted")
            db.record_answer(eid, "C1", False)
            db.record_answer(eid, "C1", True)
            self.assertEqual(db.wrong_questions(eid), [])
            db.backup(Path(tmp) / "copy.db")
            self.assertTrue((Path(tmp) / "copy.db").exists())
            db.close()


if __name__ == "__main__":
    unittest.main()
