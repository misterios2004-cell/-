"""Правила системы: состав билета, подсчёт баллов, критерии перехода, право на повышение.

Модуль не зависит от интерфейса, поэтому покрыт тестами (tests/test_logic.py).
"""
import random
from datetime import date

from . import content as C

PART_PASSED = "сдано"
PART_FAILED = "не сдано"
PART_NA = "не предусмотрено"


# ---------- состав билета ----------

def build_attempt(transition, rng=None):
    rng = rng or random.Random()
    cfg = C.TRANSITIONS[transition]
    pool = [q["id"] for q in C.CLOSED.values() if q["topic"] in cfg["closed_topics"]]
    closed_ids = rng.sample(pool, cfg["closed_count"]) if cfg["closed_count"] else []
    closed = []
    for qid in closed_ids:
        perm = list(range(len(C.CLOSED[qid]["options"])))
        rng.shuffle(perm)  # порядок вариантов перемешивается, чтобы ответ не угадывался по букве
        closed.append({"id": qid, "perm": perm})

    open_ids = list(cfg["open_fixed"])
    if cfg["open_random"]:
        set_key, count = cfg["open_random"]
        rest = [q["id"] for q in C.OPEN_SETS[set_key] if q["id"] not in open_ids]
        open_ids += rng.sample(rest, count)
        open_ids.sort(key=lambda i: C.OPEN[i]["num"])

    return {
        "transition": transition,
        "closed": closed,
        "closed_answers": {},
        "closed_done": not closed,
        "open": open_ids,
        "open_answers": {},
        "open_done": False,
        "open_scores": {},
        "blocking": [i for i in open_ids if i in C.DEFAULT_BLOCKING],
        "defense": {"works": ["", "", ""], "scores": [[None] * 10 for _ in range(3)]} if cfg["defense"] else None,
        "practical": {"result": "", "comment": ""},
        "documentation": {"result": "", "comment": ""},
        "decision": "",
        "repeat_date": "",
        "remarks": "",
        "needs": ["", "", ""],
        "commission": "",
        "date": "",
    }


# ---------- подсчёт ----------

def closed_result(data):
    """Закрытая часть: 1 балл за верный ответ, порог 80 %."""
    total = len(data["closed"])
    if not total:
        return None
    score = sum(1 for q in data["closed"]
                if data["closed_answers"].get(q["id"]) == C.CLOSED[q["id"]]["answer"])
    return {"score": score, "max": total, "passed": score >= C.PASS_RATIO * total}


def open_result(data):
    """Открытая часть: 0/1/2 за вопрос, порог 80 %, «0» по блокирующему вопросу — несдача."""
    ids = data["open"]
    scores = data.get("open_scores", {})
    graded = all(scores.get(i) is not None for i in ids)
    score = sum(scores.get(i) or 0 for i in ids)
    maximum = 2 * len(ids)
    blocking_failed = [i for i in data.get("blocking", []) if i in ids and scores.get(i) == 0]
    return {
        "score": score,
        "max": maximum,
        "graded": graded,
        "blocking_failed": blocking_failed,
        "passed": graded and score >= C.PASS_RATIO * maximum and not blocking_failed,
    }


def defense_result(data):
    """Защита трёх работ по форме опроса (10 вопросов по 0/1/2); «0» по вопросу 4 — работа не принимается."""
    d = data.get("defense")
    if not d:
        return None
    flat = [s for work in d["scores"] for s in work]
    graded = all(s is not None for s in flat)
    score = sum(s or 0 for s in flat)
    maximum = 2 * len(flat)
    q4_zero = any(work[C.SURVEY_BLOCKING] == 0 for work in d["scores"])
    return {"score": score, "max": maximum, "graded": graded, "q4_zero": q4_zero,
            "passed": graded and score >= C.PASS_RATIO * maximum and not q4_zero}


def parts_summary(data):
    """Строки таблицы протокола: (часть, максимум, набрано, результат)."""
    rows = []
    cr = closed_result(data)
    if cr:
        rows.append(("Закрытая часть (тест)", cr["max"], cr["score"], PART_PASSED if cr["passed"] else PART_FAILED))
    else:
        rows.append(("Закрытая часть (тест)", "—", "—", PART_NA))
    orr = open_result(data)
    rows.append(("Открытая часть (опросник)", orr["max"], orr["score"] if orr["graded"] else "—",
                 (PART_PASSED if orr["passed"] else PART_FAILED) if orr["graded"] else "не проверено"))
    dr = defense_result(data)
    if dr:
        rows.append(("Защита работ из журнала", dr["max"], dr["score"] if dr["graded"] else "—",
                     (PART_PASSED if dr["passed"] else PART_FAILED) if dr["graded"] else "не проверено"))
    else:
        rows.append(("Защита работ из журнала", "—", "—", PART_NA))
    rows.append(("Практическое задание", "—", "—", data["practical"]["result"] or "не оценено"))
    rows.append(("Оформление документации", "—", "—", data["documentation"]["result"] or "не оценено"))
    return rows


def exam_passed(data):
    return all(r[3] in (PART_PASSED, PART_NA) for r in parts_summary(data))


def blocking_answered(data):
    """«Блокирующие вопросы отвечены: да / нет» для протокола."""
    orr = open_result(data)
    dr = defense_result(data)
    return not orr["blocking_failed"] and not (dr and dr["q4_zero"])


# ---------- даты ----------

def parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def months_between(start, end):
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(months, 0)


def add_months(d, months):
    y, m = divmod(d.month - 1 + months, 12)
    y += d.year
    m += 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(y, m, day)
        except ValueError:
            continue


# ---------- журнал опросов ----------

def survey_average(surveys):
    scores = [s for sv in surveys for s in sv["scores"] if s is not None]
    return sum(scores) / len(scores) if scores else None


def survey_accepted(survey):
    return survey["scores"][C.SURVEY_BLOCKING] != 0


# ---------- блокирующие факторы ----------

def active_blocking(factors):
    """Блокирующий фактор действует, пока не снят комиссией (снять можно не ранее чем через 6 месяцев)."""
    return [f for f in factors if not f.get("lifted_date")]


def can_lift(factor, today=None):
    today = today or date.today()
    start = parse_date(factor["date"])
    return start is None or today >= add_months(start, C.BLOCKING_FACTOR_MONTHS)


# ---------- критерии перехода У0→У1, У1→У2 ----------

def latest_exam(attempts, transition):
    done = [a for a in attempts if a["transition"] == transition and a["status"] == "done"]
    return max(done, key=lambda a: a["started"]) if done else None


def criteria_status(transition, surveys, attempts, marks):
    if transition not in C.CRITERIA:
        return []
    avg = survey_average(surveys)
    avg_text = f"{avg:.2f}" if avg is not None else "нет записей"
    exam = latest_exam(attempts, transition)
    cr = closed_result(exam["data"]) if exam else None
    test_hint = f"тест последней аттестации: {cr['score']} из {cr['max']}" if cr else "аттестация ещё не проводилась"
    shelf = sum(1 for s in surveys if s["on_shelf"])
    asp = sum(1 for s in surveys if s["is_aspirator"])
    c2plus = sum(1 for s in surveys if s["mode"] in ("С-2", "С-3", "С-4"))
    last5 = surveys[-5:]
    q4_zero = sum(1 for s in surveys if not survey_accepted(s))

    auto = {}
    if transition == "U0-U1":
        auto[2] = (cr["passed"] if cr else None, test_hint)
        auto[6] = (shelf >= 5, f"работ на фонде «полки» в журнале: {shelf}")
        auto[7] = (avg is not None and avg >= 1.2, f"средняя оценка опроса: {avg_text}")
    else:
        auto[1] = (None, test_hint)
        auto[2] = (None, f"записей в журнале: {len(surveys)}, из них по отсосам: {asp}")
        auto[3] = (len(surveys) >= 20 and c2plus >= 10, f"всего работ: {len(surveys)}, в режиме С-2 и выше: {c2plus}")
        auto[4] = (len(last5) == 5 and all(s["interventions"] <= 1 for s in last5),
                   "вмешательства в последних 5 работах: " + (", ".join(str(s["interventions"]) for s in last5) or "—"))
        auto[5] = (avg is not None and avg >= 1.5 and q4_zero == 0,
                   f"средняя оценка: {avg_text}; «0» по вопросу 4: {q4_zero}")

    result = []
    for crit in C.CRITERIA[transition]:
        a, hint = auto.get(crit["num"], (None, ""))
        mark = marks.get(crit["num"], {"done": False, "note": ""})
        result.append({**crit, "auto": a, "hint": hint, "manual": mark["done"], "note": mark["note"],
                       "done": bool(a) or mark["done"]})
    return result


# ---------- матрица компетенций ----------

def matrix_rows(comps, target_level):
    rows = []
    for c in C.COMPETENCIES:
        fact = comps.get(c["code"], 0)
        req = c["required"].get(target_level) if target_level else None
        gap = max(req - fact, 0) if req is not None else None
        rows.append({**c, "fact": fact, "req": req, "gap": gap})
    return rows


# ---------- право на повышение (раздел 4.1) ----------

def short_list(items, limit=6):
    items = list(items)
    text = ", ".join(str(i) for i in items[:limit])
    return text + (f" и ещё {len(items) - limit}" if len(items) > limit else "")


def promotion_status(emp, comps, factors, attempts, surveys, marks, today=None):
    today = today or date.today()
    transition = C.next_transition(emp["level"])
    if not transition:
        return None
    cfg = C.TRANSITIONS[transition]
    conds = []

    start = parse_date(emp.get("level_date"))
    need = C.MIN_MONTHS[transition]["months"]
    if start:
        have = months_between(start, today)
        conds.append(("Стаж на уровне ≥ минимального", have >= need, f"{have} из {need} мес."))
    else:
        conds.append(("Стаж на уровне ≥ минимального", False, f"не указана дата присвоения уровня (нужно {need} мес.)"))

    exam = latest_exam(attempts, transition)
    if exam:
        ok = exam_passed(exam["data"])
        conds.append(("Экзамен сдан (теория + практика + защита работ)", ok,
                      f"аттестация от {exam['started'][:10]}: {'все части сданы' if ok else 'есть несданные части'}"))
    else:
        conds.append(("Экзамен сдан (теория + практика + защита работ)", False, "аттестация не проводилась"))

    if transition in C.CRITERIA:
        crit = criteria_status(transition, surveys, attempts, marks)
        left = [c for c in crit if not c["done"]]
        conds.append((f"Критерии перехода {C.transition_title(transition)} выполнены", not left,
                      "все выполнены" if not left else "не выполнены пункты: " + short_list(c["num"] for c in left)))
    if cfg["to"] >= 2:
        rows = matrix_rows(comps, cfg["to"])
        gaps = [r for r in rows if r["gap"]]
        conds.append(("Матрица компетенций закрыта по всем строкам уровня", not gaps,
                      "закрыта" if not gaps else f"разрыв по {len(gaps)} строкам: " + short_list(r["code"] for r in gaps)))

    active = active_blocking(factors)
    conds.append(("Отсутствуют блокирующие факторы", not active,
                  "нет" if not active else f"действующих: {len(active)}"))

    if transition in C.EXTRA_CONDITIONS:
        mark = marks.get(100, {"done": False})
        conds.append((C.EXTRA_CONDITIONS[transition], mark["done"], "отмечается комиссией"))

    return {"transition": transition, "conditions": conds, "eligible": all(c[1] for c in conds)}
