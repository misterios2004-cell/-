"""Содержание системы обучения: банк вопросов, материалы и справочные таблицы.

Всё берётся из data/bank.json и data/materials.json, которые сгенерированы из исходного
документа скриптом tools/extract_docx.py. Таблицы (матрица компетенций, опрос по работе,
критерии перехода, минимальные сроки) разбираются из материалов, а не переписываются вручную.
"""
import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"


def _load(name):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


BANK = _load("bank.json")
MATERIALS = _load("materials.json")["chapters"]

CLOSED_TOPICS = BANK["closed_topics"]
CLOSED = {q["id"]: q for q in BANK["closed"]}
OPEN_SETS = BANK["open"]
OPEN = {q["id"]: q for items in OPEN_SETS.values() for q in items}

OPEN_SET_TITLES = {
    "aspirator": "Модуль 2. Лёгкое оборудование (медицинский отсос)",
    "classification": "Проверка знания классификации оборудования",
    "U2-U3": "Аттестационный опросник У2 → У3",
    "U3-U4": "Аттестационный опросник У3 → У4",
    "U4-U5": "Аттестационный опросник У4 → У5",
}

LEVEL_NAMES = {
    0: "Новичок",
    1: "Базовый",
    2: "Самостоятельный исполнитель",
    3: "Специалист среднего звена",
    4: "Эксперт / наставник",
    5: "Ведущий инженер",
}

# Режимы контроля (раздел 0): под контролем, под наблюдением, с приёмкой, самостоятельно
CONTROL_MODES = {
    "С-1": "под контролем",
    "С-2": "под наблюдением",
    "С-3": "с приёмкой",
    "С-4": "самостоятельно",
}

PASS_RATIO = 0.8          # проходной порог — 80 % от максимума по части
CLOSED_MINUTES = 45       # закрытая часть — 45 минут
OPEN_MINUTES = 60         # открытая часть — до 60 минут
BLOCKING_FACTOR_MONTHS = 6  # блокировка — не менее 6 месяцев


def _tables():
    for ch in MATERIALS:
        for b in ch["blocks"]:
            if b["type"] == "table":
                yield b["rows"]


def _find_tables(header):
    return [rows for rows in _tables() if rows[0][:len(header)] == header]


def _parse_competencies():
    result = []
    for rows in _find_tables(["Код", "Компетенция", "У2", "У3", "У4", "У5"]):
        for code, name, *req in rows[1:]:
            values = [int(re.match(r"\d+", v).group()) for v in req]
            result.append({
                "code": code,
                "name": name,
                "short": name.split(":")[0],
                "required": dict(zip((2, 3, 4, 5), values)),
                "unit": "групп" if "групп" in req[0] else "",
            })
    return result


def _parse_survey():
    (rows,) = _find_tables(["№", "Вопрос"])
    return [q for _, q in rows[1:]]


def _parse_criteria():
    u01, u12 = _find_tables(["№", "Критерий", "Как проверяется"])
    return {
        "U0-U1": [{"num": int(n), "text": t, "check": c} for n, t, c in u01[1:]],
        "U1-U2": [{"num": int(n), "text": t, "check": c} for n, t, c in u12[1:]],
    }


def _parse_min_months():
    (rows,) = _find_tables(["Переход", "Минимальный срок на текущем уровне"])
    result = {}
    for transition, term, comment in rows[1:]:
        a, b = re.findall(r"У(\d)", transition)
        result[f"U{a}-U{b}"] = {"months": int(re.match(r"\d+", term).group()), "comment": comment}
    return result


COMPETENCIES = _parse_competencies()
SURVEY_QUESTIONS = _parse_survey()
SURVEY_BLOCKING = 3  # вопрос 4 — блокирующий (индекс с нуля)
CRITERIA = _parse_criteria()
MIN_MONTHS = _parse_min_months()

# Состав билетов — раздел 5 банка вопросов и раздел 1 «Порядок применения»
TRANSITIONS = {
    "U0-U1": {
        "from": 0, "to": 1,
        "closed_count": 20, "closed_topics": ["1.1", "1.2", "1.3", "1.4", "1.5"],
        "open_fixed": [f"aspirator-{n}" for n in (1, 2, 10, 16)] + [f"classification-{n}" for n in (1, 2, 3, 4)],
        "open_random": None,
        "defense": False,
        "decisions": ["Присвоить У1", "Продлить обучение на У0 на 1 месяц", "Расстаться"],
    },
    "U1-U2": {
        "from": 1, "to": 2,
        "closed_count": 30, "closed_topics": [t["id"] for t in CLOSED_TOPICS],
        "open_fixed": [f"aspirator-{n}" for n in (3, 5, 14)],
        "open_random": ("aspirator", 7),  # всего 10 вопросов раздела 3
        "defense": True,
        "decisions": ["Присвоить У2 и перевести на должность инженера",
                      "Оставить на У1 с повторной аттестацией через 2 месяца", "Расстаться"],
    },
}
for _a in (2, 3, 4):
    _key = f"U{_a}-U{_a + 1}"
    TRANSITIONS[_key] = {
        "from": _a, "to": _a + 1,
        "closed_count": 0, "closed_topics": [],
        "open_fixed": [q["id"] for q in OPEN_SETS[_key]],
        "open_random": None,
        "defense": True,
        "decisions": [f"Присвоить уровень У{_a + 1}", "Оставить на текущем уровне, повторная аттестация", "Расстаться"],
    }

# Вопросы 5 и 14 раздела 3 — блокирующие (проверяют отличие первопричины от следствия)
DEFAULT_BLOCKING = {"aspirator-5", "aspirator-14"}

# Дополнительные условия перехода, которые проверяет комиссия (разделы 1.6, 1.7, 4.2)
EXTRA_CONDITIONS = {
    "U3-U4": "Есть подготовленный сотрудник уровня У2 или выше",
    "U4-U5": "В службе есть функция ведущего инженера (присваивается при наличии функции, а не по выслуге)",
}


def transition_title(key):
    t = TRANSITIONS[key]
    return f"У{t['from']} → У{t['to']}"


def next_transition(level):
    key = f"U{level}-U{level + 1}"
    return key if key in TRANSITIONS else None
