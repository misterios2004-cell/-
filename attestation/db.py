"""Хранение данных в SQLite: сотрудники, компетенции, опросы по работам, аттестации."""
import hashlib
import json
import os
import secrets
import sqlite3
import sys
from datetime import date, datetime
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    position TEXT DEFAULT '',
    level INTEGER NOT NULL DEFAULT 0,
    level_date TEXT,
    admissions TEXT DEFAULT '',
    next_attestation TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS competencies (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    value INTEGER NOT NULL,
    PRIMARY KEY (employee_id, code)
);
CREATE TABLE IF NOT EXISTS blocking_factors (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    description TEXT NOT NULL,
    lifted_date TEXT
);
CREATE TABLE IF NOT EXISTS surveys (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    equipment TEXT NOT NULL,
    is_aspirator INTEGER NOT NULL DEFAULT 0,
    on_shelf INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL,
    interventions INTEGER NOT NULL DEFAULT 0,
    scores TEXT NOT NULL,
    mentor TEXT DEFAULT '',
    comment TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS criteria_marks (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    transition TEXT NOT NULL,
    num INTEGER NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    note TEXT DEFAULT '',
    PRIMARY KEY (employee_id, transition, num)
);
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    transition TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    started TEXT NOT NULL,
    finished TEXT,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS training_log (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    mode TEXT NOT NULL,
    description TEXT NOT NULL,
    correct REAL NOT NULL,
    total REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS question_stats (
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    last_correct INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (employee_id, question_id)
);
"""

# Статусы попытки аттестации
ST_IN_PROGRESS = "in_progress"
ST_REVIEW = "review"          # ожидает проверки комиссией
ST_DONE = "done"              # протокол оформлен
ST_INTERRUPTED = "interrupted"

STATUS_TITLES = {
    ST_IN_PROGRESS: "идёт",
    ST_REVIEW: "ожидает проверки",
    ST_DONE: "завершена",
    ST_INTERRUPTED: "прервана",
}


def default_db_path():
    override = os.environ.get("ATTESTATION_DB")
    if override:
        return Path(override)
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", Path.home()))
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "AttestationMedRepair" / "attestation.db"


def today():
    return date.today().isoformat()


def now():
    return datetime.now().isoformat(timespec="seconds")


class Database:
    def __init__(self, path=None):
        self.path = Path(path) if path else default_db_path()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.executescript(SCHEMA)
        self.conn.commit()
        # Попытки, оставшиеся незавершёнными (приложение закрыли во время аттестации)
        self.conn.execute("UPDATE attempts SET status=? WHERE status=?", (ST_INTERRUPTED, ST_IN_PROGRESS))
        self.conn.commit()

    def close(self):
        self.conn.close()

    def _exec(self, sql, params=()):
        cur = self.conn.execute(sql, params)
        self.conn.commit()
        return cur

    # --- настройки и пароль комиссии ---
    def get_setting(self, key, default=None):
        row = self.conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default

    def set_setting(self, key, value):
        self._exec("INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)", (key, value))

    def has_password(self):
        return self.get_setting("password_hash") is not None

    def set_password(self, password):
        salt = secrets.token_hex(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()
        self.set_setting("password_hash", f"{salt}${digest}")

    def check_password(self, password):
        stored = self.get_setting("password_hash")
        if not stored:
            return False
        salt, digest = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()
        return secrets.compare_digest(calc, digest)

    def backup(self, target):
        self.conn.commit()
        dst = sqlite3.connect(target)
        with dst:
            self.conn.backup(dst)
        dst.close()

    # --- сотрудники ---
    def employees(self, active_only=True):
        sql = "SELECT * FROM employees"
        if active_only:
            sql += " WHERE active=1"
        return [dict(r) for r in self.conn.execute(sql + " ORDER BY full_name")]

    def employee(self, emp_id):
        row = self.conn.execute("SELECT * FROM employees WHERE id=?", (emp_id,)).fetchone()
        return dict(row) if row else None

    def save_employee(self, emp):
        fields = ("full_name", "position", "level", "level_date", "admissions", "next_attestation", "notes", "active")
        values = [emp.get(f) for f in fields]
        if emp.get("id"):
            self._exec(f"UPDATE employees SET {', '.join(f + '=?' for f in fields)} WHERE id=?", values + [emp["id"]])
            return emp["id"]
        cur = self._exec(f"INSERT INTO employees({', '.join(fields)}) VALUES ({', '.join('?' * len(fields))})", values)
        return cur.lastrowid

    def delete_employee(self, emp_id):
        self._exec("DELETE FROM employees WHERE id=?", (emp_id,))

    # --- компетенции ---
    def competencies(self, emp_id):
        rows = self.conn.execute("SELECT code, value FROM competencies WHERE employee_id=?", (emp_id,))
        return {r["code"]: r["value"] for r in rows}

    def save_competencies(self, emp_id, values):
        for code, value in values.items():
            self.conn.execute("INSERT OR REPLACE INTO competencies(employee_id, code, value) VALUES (?, ?, ?)",
                              (emp_id, code, int(value)))
        self.conn.commit()

    # --- блокирующие факторы ---
    def blocking_factors(self, emp_id):
        return [dict(r) for r in self.conn.execute(
            "SELECT * FROM blocking_factors WHERE employee_id=? ORDER BY date DESC", (emp_id,))]

    def add_blocking_factor(self, emp_id, day, description):
        self._exec("INSERT INTO blocking_factors(employee_id, date, description) VALUES (?, ?, ?)",
                   (emp_id, day, description))

    def lift_blocking_factor(self, factor_id, day):
        self._exec("UPDATE blocking_factors SET lifted_date=? WHERE id=?", (day, factor_id))

    def delete_blocking_factor(self, factor_id):
        self._exec("DELETE FROM blocking_factors WHERE id=?", (factor_id,))

    # --- опросы по выполненным работам (раздел 2.3) ---
    def surveys(self, emp_id):
        rows = self.conn.execute("SELECT * FROM surveys WHERE employee_id=? ORDER BY date, id", (emp_id,))
        result = []
        for r in rows:
            d = dict(r)
            d["scores"] = json.loads(d["scores"])
            result.append(d)
        return result

    def save_survey(self, s):
        fields = ("employee_id", "date", "equipment", "is_aspirator", "on_shelf", "mode", "interventions",
                  "scores", "mentor", "comment")
        values = [json.dumps(s[f]) if f == "scores" else s[f] for f in fields]
        if s.get("id"):
            self._exec(f"UPDATE surveys SET {', '.join(f + '=?' for f in fields)} WHERE id=?", values + [s["id"]])
        else:
            self._exec(f"INSERT INTO surveys({', '.join(fields)}) VALUES ({', '.join('?' * len(fields))})", values)

    def delete_survey(self, survey_id):
        self._exec("DELETE FROM surveys WHERE id=?", (survey_id,))

    # --- отметки комиссии по критериям перехода ---
    def criteria_marks(self, emp_id, transition):
        rows = self.conn.execute("SELECT num, done, note FROM criteria_marks WHERE employee_id=? AND transition=?",
                                 (emp_id, transition))
        return {r["num"]: {"done": bool(r["done"]), "note": r["note"]} for r in rows}

    def set_criteria_mark(self, emp_id, transition, num, done, note=""):
        self._exec("INSERT OR REPLACE INTO criteria_marks(employee_id, transition, num, done, note) VALUES (?,?,?,?,?)",
                   (emp_id, transition, num, int(done), note))

    # --- попытки аттестации ---
    def create_attempt(self, emp_id, transition, kind, data):
        cur = self._exec("INSERT INTO attempts(employee_id, transition, kind, status, started, data) VALUES (?,?,?,?,?,?)",
                         (emp_id, transition, kind, ST_IN_PROGRESS, now(), json.dumps(data, ensure_ascii=False)))
        return cur.lastrowid

    def attempt(self, attempt_id):
        row = self.conn.execute("SELECT * FROM attempts WHERE id=?", (attempt_id,)).fetchone()
        if not row:
            return None
        d = dict(row)
        d["data"] = json.loads(d["data"])
        return d

    def update_attempt(self, attempt_id, data=None, status=None, finished=None):
        if data is not None:
            self.conn.execute("UPDATE attempts SET data=? WHERE id=?", (json.dumps(data, ensure_ascii=False), attempt_id))
        if status is not None:
            self.conn.execute("UPDATE attempts SET status=? WHERE id=?", (status, attempt_id))
        if finished is not None:
            self.conn.execute("UPDATE attempts SET finished=? WHERE id=?", (finished, attempt_id))
        self.conn.commit()

    def delete_attempt(self, attempt_id):
        self._exec("DELETE FROM attempts WHERE id=?", (attempt_id,))

    def attempts(self, emp_id=None, kind="exam"):
        sql = ("SELECT a.*, e.full_name FROM attempts a LEFT JOIN employees e ON e.id=a.employee_id "
               "WHERE a.kind=?")
        params = [kind]
        if emp_id is not None:
            sql += " AND a.employee_id=?"
            params.append(emp_id)
        result = []
        for r in self.conn.execute(sql + " ORDER BY a.started DESC", params):
            d = dict(r)
            d["data"] = json.loads(d["data"])
            result.append(d)
        return result

    # --- тренировки ---
    def log_training(self, emp_id, mode, description, correct, total):
        if emp_id is None:
            return
        self._exec("INSERT INTO training_log(employee_id, date, mode, description, correct, total) VALUES (?,?,?,?,?,?)",
                   (emp_id, now(), mode, description, correct, total))

    def training_log(self, emp_id, limit=20):
        return [dict(r) for r in self.conn.execute(
            "SELECT * FROM training_log WHERE employee_id=? ORDER BY date DESC LIMIT ?", (emp_id, limit))]

    def record_answer(self, emp_id, question_id, correct):
        if emp_id is None:
            return
        self._exec(
            "INSERT INTO question_stats(employee_id, question_id, attempts, correct, last_correct) VALUES (?,?,1,?,?) "
            "ON CONFLICT(employee_id, question_id) DO UPDATE SET attempts=attempts+1, "
            "correct=correct+excluded.correct, last_correct=excluded.last_correct",
            (emp_id, question_id, int(correct), int(correct)))

    def wrong_questions(self, emp_id):
        rows = self.conn.execute(
            "SELECT question_id FROM question_stats WHERE employee_id=? AND last_correct=0", (emp_id,))
        return [r["question_id"] for r in rows]

    def question_stats(self, emp_id):
        rows = self.conn.execute("SELECT * FROM question_stats WHERE employee_id=?", (emp_id,))
        return {r["question_id"]: dict(r) for r in rows}
