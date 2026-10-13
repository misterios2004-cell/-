"""Экраны сотрудника: «Мой путь», тест по темам, открытые вопросы (карточки), пробная аттестация."""
import random
import tkinter as tk
from tkinter import messagebox, ttk

from .. import content as C
from .. import logic as L
from .base import COL, FONT, ScrollFrame, badge, clear, label, page_header, panel, text_area
from .exam import LETTERS, ExamRunner


# ====================== Мой путь ======================

def level_ladder(parent, level, bg):
    row = tk.Frame(parent, bg=bg)
    for lv in range(6):
        cur = lv == level
        done = lv < level
        box = tk.Frame(row, bg=COL["accent"] if cur else (COL["ok_bg"] if done else "#eef2f6"), padx=10, pady=8)
        box.pack(side="left", padx=3, fill="y")
        fg = "white" if cur else COL["text"]
        tk.Label(box, text=f"У{lv}", font=(FONT, 14, "bold"), bg=box.cget("bg"), fg=fg).pack()
        tk.Label(box, text=C.LEVEL_NAMES[lv], font=(FONT, 8), bg=box.cget("bg"), fg=fg, wraplength=110).pack()
    return row


def conditions_panel(parent, status):
    for title, ok, hint in status["conditions"]:
        row = tk.Frame(parent, bg=COL["panel"])
        row.pack(fill="x", pady=2)
        tk.Label(row, text="✔" if ok else "✖", fg=COL["ok"] if ok else COL["bad"], bg=COL["panel"],
                 font=(FONT, 12, "bold"), width=2).pack(side="left")
        label(row, title, 11).pack(side="left")
        label(row, f"  — {hint}", 10, color=COL["muted"], wrap=600).pack(side="left")


def criteria_panel(parent, crit):
    for c in crit:
        row = tk.Frame(parent, bg=COL["panel"])
        row.pack(fill="x", pady=3)
        ok = c["done"]
        tk.Label(row, text="✔" if ok else "○", fg=COL["ok"] if ok else COL["muted"], bg=COL["panel"],
                 font=(FONT, 12, "bold"), width=2).pack(side="left", anchor="n")
        col = tk.Frame(row, bg=COL["panel"])
        col.pack(side="left", fill="x", expand=True)
        label(col, f"{c['num']}. {c['text']}", 11, wrap=820).pack(anchor="w")
        hint = f"Как проверяется: {c['check']}"
        if c["hint"]:
            hint += f" · {c['hint']}"
        label(col, hint, 9, color=COL["muted"], wrap=820).pack(anchor="w")


class PathScreen:
    def __init__(self, master, app):
        app.refresh_employee()
        emp = app.employee
        db = app.db
        page_header(master, emp["full_name"], f"{emp['position'] or 'Должность не указана'} · "
                    f"текущий уровень У{emp['level']} — {C.LEVEL_NAMES[emp['level']]}")
        sf = ScrollFrame(master)
        sf.pack(fill="both", expand=True, padx=24, pady=(0, 16))
        body = sf.inner

        o, p = panel(body, 18)
        o.pack(fill="x", pady=6)
        level_ladder(p, emp["level"], COL["panel"]).pack(anchor="w")

        comps = db.competencies(emp["id"])
        factors = db.blocking_factors(emp["id"])
        attempts = db.attempts(emp["id"])
        surveys = db.surveys(emp["id"])
        transition = C.next_transition(emp["level"])
        if transition:
            marks = db.criteria_marks(emp["id"], transition)
            status = L.promotion_status(emp, comps, factors, attempts, surveys, marks)
            o, p = panel(body, 18)
            o.pack(fill="x", pady=6)
            head = tk.Frame(p, bg=COL["panel"])
            head.pack(fill="x", pady=(0, 8))
            label(head, f"Следующий шаг: {C.transition_title(transition)}", 13, True).pack(side="left")
            badge(head, "условия выполнены" if status["eligible"] else "в процессе",
                  "ok" if status["eligible"] else "info").pack(side="left", padx=10)
            label(p, "Повышение возможно при одновременном выполнении условий — ни одно не компенсируется другим.",
                  10, color=COL["muted"]).pack(anchor="w", pady=(0, 6))
            conditions_panel(p, status)

            if transition in C.CRITERIA:
                o, p = panel(body, 18)
                o.pack(fill="x", pady=6)
                label(p, f"Критерии перехода {C.transition_title(transition)} (все обязательны)", 13, True).pack(
                    anchor="w", pady=(0, 8))
                criteria_panel(p, L.criteria_status(transition, surveys, attempts, marks))

            target = C.TRANSITIONS[transition]["to"]
            if target >= 2:
                rows = [r for r in L.matrix_rows(comps, target) if r["gap"]]
                o, p = panel(body, 18)
                o.pack(fill="x", pady=6)
                label(p, f"Матрица компетенций: чего не хватает для У{target}", 13, True).pack(anchor="w", pady=(0, 8))
                if not rows:
                    label(p, "Разрывов нет — все строки матрицы закрыты.", 11, color=COL["ok"]).pack(anchor="w")
                for r in rows:
                    unit = f" {r['unit']}" if r["unit"] else ""
                    label(p, f"{r['code']}  {r['name']} — факт {r['fact']}{unit}, требуется {r['req']}{unit}",
                          11, wrap=950).pack(anchor="w", pady=1)
        else:
            o, p = panel(body, 18)
            o.pack(fill="x", pady=6)
            label(p, "У5 — верхний уровень шкалы.", 12).pack(anchor="w")

        active = L.active_blocking(factors)
        if active:
            o, p = panel(body, 18)
            o.pack(fill="x", pady=6)
            label(p, "Действующие блокирующие факторы", 13, True, color=COL["bad"]).pack(anchor="w")
            for f in active:
                label(p, f"{f['date']} — {f['description']}", 11, wrap=950).pack(anchor="w")

        o, p = panel(body, 18)
        o.pack(fill="x", pady=6)
        label(p, "Журнал опросов по выполненным работам", 13, True).pack(anchor="w", pady=(0, 6))
        avg = L.survey_average(surveys)
        label(p, f"Работ с опросом: {len(surveys)} · средняя оценка: "
                 f"{f'{avg:.2f}' if avg is not None else '—'} из 2", 11).pack(anchor="w")
        for s in surveys[-5:][::-1]:
            ok = L.survey_accepted(s)
            label(p, f"{s['date']} · {s['equipment']} · {s['mode']} · сумма {sum(s['scores'])}/20"
                     f"{'' if ok else ' · НЕ ПРИНЯТА (0 по вопросу 4)'}", 10,
                  color=COL["text"] if ok else COL["bad"]).pack(anchor="w")

        log = db.training_log(emp["id"], 8)
        o, p = panel(body, 18)
        o.pack(fill="x", pady=6)
        label(p, "Последние тренировки", 13, True).pack(anchor="w", pady=(0, 6))
        if not log:
            label(p, "Пока нет. Начните с раздела «Тест по темам».", 11, color=COL["muted"]).pack(anchor="w")
        for r in log:
            pct = round(100 * r["correct"] / r["total"]) if r["total"] else 0
            label(p, f"{r['date'][:16].replace('T', ' ')} · {r['mode']} · {r['description']} · "
                     f"{r['correct']:g} из {r['total']:g} ({pct} %)", 10).pack(anchor="w")


# ====================== Тест по темам ======================

class QuizScreen:
    def __init__(self, master, app):
        self.app = app
        self.master = master
        self.emp_id = app.employee["id"] if app.employee else None
        self.show_setup()

    def show_setup(self):
        clear(self.master)
        page_header(self.master, "Тест по темам Модуля 1",
                    "Закрытые вопросы банка (раздел 2). После каждого ответа показывается правильный вариант.")
        o, p = panel(self.master, 20)
        o.pack(fill="x", padx=24, pady=8)
        stats = self.app.db.question_stats(self.emp_id) if self.emp_id else {}
        self.topic_vars = {}
        for t in C.CLOSED_TOPICS:
            qs = [q for q in C.CLOSED.values() if q["topic"] == t["id"]]
            var = tk.BooleanVar(value=True)
            self.topic_vars[t["id"]] = var
            row = tk.Frame(p, bg=COL["panel"])
            row.pack(fill="x", pady=1)
            ttk.Checkbutton(row, text=f"{t['id']}  {t['title']}  ({len(qs)} вопр.)", variable=var).pack(side="left")
            if stats:
                seen = [stats[q["id"]] for q in qs if q["id"] in stats]
                if seen:
                    right = sum(s["last_correct"] for s in seen)
                    label(row, f"   последний раз верно: {right} из {len(seen)} отвеченных", 9,
                          color=COL["muted"]).pack(side="left")
        opts = tk.Frame(p, bg=COL["panel"])
        opts.pack(fill="x", pady=(12, 0))
        self.wrong_only = tk.BooleanVar(value=False)
        if self.emp_id:
            n_wrong = len(self.app.db.wrong_questions(self.emp_id))
            ttk.Checkbutton(opts, text=f"Только вопросы, в которых была ошибка ({n_wrong})",
                            variable=self.wrong_only).pack(anchor="w")
        self.shuffle = tk.BooleanVar(value=True)
        ttk.Checkbutton(opts, text="Перемешать вопросы и варианты ответа", variable=self.shuffle).pack(anchor="w")
        btns = tk.Frame(p, bg=COL["panel"])
        btns.pack(anchor="w", pady=(14, 0))
        ttk.Button(btns, text="Начать", style="Accent.TButton", command=self.start).pack(side="left")
        ttk.Button(btns, text="Выбрать все", command=lambda: [v.set(True) for v in self.topic_vars.values()]).pack(
            side="left", padx=8)
        ttk.Button(btns, text="Снять все", command=lambda: [v.set(False) for v in self.topic_vars.values()]).pack(side="left")

    def start(self):
        topics = {k for k, v in self.topic_vars.items() if v.get()}
        qs = [q for q in C.CLOSED.values() if q["topic"] in topics]
        if self.wrong_only.get():
            wrong = set(self.app.db.wrong_questions(self.emp_id))
            qs = [q for q in qs if q["id"] in wrong]
        if not qs:
            messagebox.showinfo("Тест", "Нет вопросов по выбранным условиям.")
            return
        self.items = []
        for q in qs:
            perm = list(range(len(q["options"])))
            if self.shuffle.get():
                random.shuffle(perm)
            self.items.append({"q": q, "perm": perm, "answer": None})
        if self.shuffle.get():
            random.shuffle(self.items)
        self.topics = sorted(topics)
        self.index = 0
        self.show_question()

    def show_question(self):
        clear(self.master)
        item = self.items[self.index]
        q = item["q"]
        correct = sum(1 for it in self.items if it["answer"] is not None and it["answer"] == it["q"]["answer"])
        answered = sum(1 for it in self.items if it["answer"] is not None)
        page_header(self.master, f"Вопрос {self.index + 1} из {len(self.items)}",
                    f"Тема {q['topic']} «{q['topic_title']}» · верно: {correct} из {answered}")
        bar = ttk.Progressbar(self.master, maximum=len(self.items), value=answered)
        bar.pack(fill="x", padx=24)
        o, p = panel(self.master, 24)
        o.pack(fill="x", padx=24, pady=12)
        label(p, q["text"], 14, True, wrap=950).pack(anchor="w", pady=(0, 14))
        self.option_labels = []
        for pos, orig in enumerate(item["perm"]):
            lab = tk.Label(p, text=f"{LETTERS[pos]})  {q['options'][orig]}", font=(FONT, 12), bg="#f6f8fa",
                           fg=COL["text"], anchor="w", justify="left", wraplength=920, padx=12, pady=10,
                           cursor="hand2" if item["answer"] is None else "arrow")
            lab.pack(fill="x", pady=3)
            if item["answer"] is None:
                lab.bind("<Button-1>", lambda e, o_=orig: self.answer(o_))
            self.option_labels.append((lab, orig))
        self.feedback = tk.Frame(p, bg=COL["panel"])
        self.feedback.pack(fill="x", pady=(12, 0))
        if item["answer"] is not None:
            self.paint_feedback()

    def answer(self, orig):
        item = self.items[self.index]
        if item["answer"] is not None:
            return
        item["answer"] = orig
        self.app.db.record_answer(self.emp_id, item["q"]["id"], orig == item["q"]["answer"])
        self.show_question()

    def paint_feedback(self):
        item = self.items[self.index]
        q = item["q"]
        for lab, orig in self.option_labels:
            if orig == q["answer"]:
                lab.configure(bg=COL["ok_bg"], fg=COL["ok"])
            elif orig == item["answer"]:
                lab.configure(bg=COL["bad_bg"], fg=COL["bad"])
        ok = item["answer"] == q["answer"]
        badge(self.feedback, "Верно" if ok else "Неверно", "ok" if ok else "bad").pack(side="left")
        if self.index < len(self.items) - 1:
            ttk.Button(self.feedback, text="Следующий вопрос →", style="Accent.TButton",
                       command=self.next_question).pack(side="right")
        else:
            ttk.Button(self.feedback, text="Итоги", style="Accent.TButton", command=self.show_summary).pack(side="right")
        ttk.Button(self.feedback, text="Закончить досрочно", command=self.show_summary).pack(side="right", padx=8)

    def next_question(self):
        self.index += 1
        self.show_question()

    def show_summary(self):
        done = [it for it in self.items if it["answer"] is not None]
        correct = sum(1 for it in done if it["answer"] == it["q"]["answer"])
        self.app.db.log_training(self.emp_id, "Тест по темам", ", ".join(self.topics), correct, len(done))
        clear(self.master)
        page_header(self.master, "Итоги теста")
        o, p = panel(self.master, 24)
        o.pack(fill="x", padx=24, pady=8)
        pct = round(100 * correct / len(done)) if done else 0
        label(p, f"Верно: {correct} из {len(done)} ({pct} %)", 16, True).pack(anchor="w")
        passed = done and correct >= C.PASS_RATIO * len(done)
        badge(p, "порог 80 % пройден" if passed else "порог 80 % не пройден", "ok" if passed else "bad").pack(
            anchor="w", pady=8)
        by_topic = {}
        for it in done:
            t = it["q"]["topic"]
            by_topic.setdefault(t, [0, 0])
            by_topic[t][1] += 1
            by_topic[t][0] += it["answer"] == it["q"]["answer"]
        for t in sorted(by_topic):
            title = next(x["title"] for x in C.CLOSED_TOPICS if x["id"] == t)
            r, n = by_topic[t]
            label(p, f"{t} {title}: {r} из {n}", 11, color=COL["ok"] if r == n else COL["text"]).pack(anchor="w")
        btns = tk.Frame(p, bg=COL["panel"])
        btns.pack(anchor="w", pady=(16, 0))
        ttk.Button(btns, text="Новый тест", style="Accent.TButton", command=self.show_setup).pack(side="left")


# ====================== Открытые вопросы ======================

class CardsScreen:
    def __init__(self, master, app):
        self.app = app
        self.master = master
        self.emp_id = app.employee["id"] if app.employee else None
        self.show_setup()

    def show_setup(self):
        clear(self.master)
        page_header(self.master, "Открытые вопросы",
                    "Сформулируйте ответ, затем сравните с эталоном и оцените себя по шкале 0 / 1 / 2.")
        o, p = panel(self.master, 20)
        o.pack(fill="x", padx=24, pady=8)
        self.set_var = tk.StringVar(value="aspirator")
        for key, title in C.OPEN_SET_TITLES.items():
            ttk.Radiobutton(p, text=f"{title} ({len(C.OPEN_SETS[key])} вопр.)", variable=self.set_var,
                            value=key).pack(anchor="w", pady=2)
        self.shuffle = tk.BooleanVar(value=False)
        ttk.Checkbutton(p, text="Перемешать вопросы", variable=self.shuffle).pack(anchor="w", pady=(10, 0))
        ttk.Button(p, text="Начать", style="Accent.TButton", command=self.start).pack(anchor="w", pady=(14, 0))

    def start(self):
        self.key = self.set_var.get()
        self.items = [{"q": q, "score": None, "answer": ""} for q in C.OPEN_SETS[self.key]]
        if self.shuffle.get():
            random.shuffle(self.items)
        self.index = 0
        self.show_card()

    def show_card(self, revealed=False):
        clear(self.master)
        item = self.items[self.index]
        q = item["q"]
        page_header(self.master, f"Вопрос {self.index + 1} из {len(self.items)}", C.OPEN_SET_TITLES[self.key])
        o, p = panel(self.master, 24)
        o.pack(fill="both", expand=True, padx=24, pady=(8, 20))
        label(p, q["text"], 14, True, wrap=950).pack(anchor="w")
        if q["id"] in C.DEFAULT_BLOCKING:
            badge(p, "блокирующий вопрос на аттестации", "warn").pack(anchor="w", pady=(6, 0))
        label(p, "Ваш ответ (для себя, не обязательно):", 10, color=COL["muted"]).pack(anchor="w", pady=(12, 2))
        box = text_area(p, height=6)
        box.pack(fill="x")
        box.insert("1.0", item["answer"])
        actions = tk.Frame(p, bg=COL["panel"])

        def reveal():
            item["answer"] = box.get("1.0", "end").strip()
            self.show_card(revealed=True)

        if not revealed:
            actions.pack(anchor="w", pady=(12, 0))
            ttk.Button(actions, text="Показать эталон", style="Accent.TButton", command=reveal).pack(side="left")
            ttk.Button(actions, text="Пропустить", command=self.next_card).pack(side="left", padx=8)
            return
        box.configure(state="disabled", bg="#f6f8fa")
        ref_o, ref = panel(p, 14)
        ref_o.pack(fill="x", pady=(12, 0))
        ref.configure(bg=COL["ok_bg"])
        label(ref, "Эталонный ответ", 10, True, color=COL["ok"], bg=COL["ok_bg"]).pack(anchor="w")
        label(ref, q["reference"], 12, bg=COL["ok_bg"], wrap=930).pack(anchor="w")
        actions.pack(anchor="w", pady=(14, 0))
        label(actions, "Насколько полно вы ответили?", 11, True).pack(side="left", padx=(0, 10))
        for v, t in ((0, "0 — не ответил"), (1, "1 — частично"), (2, "2 — полно")):
            ttk.Button(actions, text=t, command=lambda s=v: self.grade(s)).pack(side="left", padx=3)

    def grade(self, score):
        self.items[self.index]["score"] = score
        self.next_card()

    def next_card(self):
        if self.index < len(self.items) - 1:
            self.index += 1
            self.show_card()
        else:
            self.show_summary()

    def show_summary(self):
        graded = [it for it in self.items if it["score"] is not None]
        score = sum(it["score"] for it in graded)
        mx = 2 * len(graded)
        self.app.db.log_training(self.emp_id, "Открытые вопросы", C.OPEN_SET_TITLES[self.key], score, mx)
        clear(self.master)
        page_header(self.master, "Итоги самопроверки", C.OPEN_SET_TITLES[self.key])
        o, p = panel(self.master, 24)
        o.pack(fill="x", padx=24, pady=8)
        label(p, f"Баллы: {score} из {mx} (оценено вопросов: {len(graded)} из {len(self.items)})", 15, True).pack(anchor="w")
        weak = [it for it in graded if it["score"] < 2]
        if weak:
            label(p, "Вопросы, которые стоит повторить:", 11, True).pack(anchor="w", pady=(12, 4))
            for it in weak:
                label(p, f"№ {it['q']['num']}. {it['q']['text']} — {it['score']} балл.", 10, wrap=950).pack(anchor="w")
        ttk.Button(p, text="Ещё раз", style="Accent.TButton", command=self.show_setup).pack(anchor="w", pady=(16, 0))


# ====================== Пробная аттестация ======================

class TrialScreen:
    def __init__(self, master, app):
        self.app = app
        page_header(master, "Пробная аттестация",
                    "Билет формируется так же, как на официальной аттестации (раздел 5 банка вопросов), "
                    "с теми же лимитами времени. Результат не влияет на уровень.")
        o, p = panel(master, 20)
        o.pack(fill="x", padx=24, pady=8)
        default = C.next_transition(app.employee["level"]) if app.employee else "U0-U1"
        self.var = tk.StringVar(value=default or "U4-U5")
        for key, cfg in C.TRANSITIONS.items():
            parts = []
            if cfg["closed_count"]:
                parts.append(f"тест {cfg['closed_count']} вопр.")
            parts.append(f"открытых {len(cfg['open_fixed']) + (cfg['open_random'][1] if cfg['open_random'] else 0)} вопр.")
            ttk.Radiobutton(p, text=f"{C.transition_title(key)}: {', '.join(parts)}", variable=self.var,
                            value=key).pack(anchor="w", pady=3)
        ttk.Button(p, text="Сформировать билет", style="Accent.TButton", command=self.start).pack(anchor="w", pady=(14, 0))

    def start(self):
        data = L.build_attempt(self.var.get())
        clear(self.app.main)
        ExamRunner(self.app.main, self.app, {"id": None, "data": data}, official=False, employee=self.app.employee)
