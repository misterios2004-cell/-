"""Прохождение аттестации: закрытая часть (тест с таймером) и открытая часть (письменные ответы).

Используется в двух режимах:
- official=True — официальная аттестация, ответы сохраняются в базе и уходят комиссии на проверку;
- official=False — пробная аттестация, после ответа показываются ключи и эталоны, открытая часть
  оценивается самостоятельно.
"""
import time
import tkinter as tk
from tkinter import messagebox, ttk

from .. import content as C
from .. import db as D
from .. import logic as L
from .base import COL, FONT, ScrollFrame, badge, clear, get_text, label, panel, set_text, text_area

LETTERS = "абвгде"


def fmt_time(seconds):
    seconds = max(int(seconds), 0)
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


class ExamRunner:
    def __init__(self, master, app, attempt, official, employee=None, on_finish=None):
        self.master = master
        self.app = app
        self.attempt = attempt          # {"id": int | None, "transition": str, "data": dict}
        self.data = attempt["data"]
        self.official = official
        self.employee = employee
        self.on_finish = on_finish
        self.timer_job = None
        self.autosave_job = None
        self.deadline = None
        self.index = 0
        self.root = tk.Frame(master, bg=COL["bg"])
        self.root.pack(fill="both", expand=True)
        self.root.bind("<Destroy>", self._on_destroy)
        self.show_intro()

    # ---------- служебное ----------
    def _on_destroy(self, event):
        if event.widget is self.root:
            self._stop_timer()

    def _stop_timer(self):
        for job in (self.timer_job, self.autosave_job):
            if job:
                try:
                    self.root.after_cancel(job)
                except tk.TclError:
                    pass
        self.timer_job = self.autosave_job = None

    def save(self, status=None, finished=None):
        if self.attempt.get("id"):
            self.app.db.update_attempt(self.attempt["id"], data=self.data, status=status, finished=finished)

    def header(self, title, subtitle=None, timer=False):
        clear(self.root)
        bar = tk.Frame(self.root, bg=COL["bg"])
        bar.pack(fill="x", padx=24, pady=(16, 6))
        label(bar, title, 17, True, bg=COL["bg"]).pack(side="left")
        if timer:
            self.timer_label = ttk.Label(bar, text="", style="Timer.TLabel")
            self.timer_label.pack(side="right")
        if subtitle:
            label(self.root, subtitle, 10, color=COL["muted"], bg=COL["bg"], wrap=1000).pack(anchor="w", padx=24)

    def start_timer(self, minutes, on_timeout):
        self._stop_timer()
        self.deadline = time.monotonic() + minutes * 60

        def tick():
            left = self.deadline - time.monotonic()
            self.timer_label.configure(text=f"Осталось {fmt_time(left)}",
                                       foreground=COL["bad"] if left < 300 else COL["accent_dark"])
            if left <= 0:
                self._stop_timer()
                messagebox.showinfo("Время вышло", "Время на эту часть истекло. Ответы сохранены.")
                on_timeout()
                return
            self.timer_job = self.root.after(1000, tick)

        tick()

    # ---------- вступление ----------
    def show_intro(self):
        cfg = C.TRANSITIONS[self.data["transition"]]
        mode = "Аттестация" if self.official else "Пробная аттестация"
        self.header(f"{mode}: {C.transition_title(self.data['transition'])}")
        outer, p = panel(self.root, 24)
        outer.pack(fill="x", padx=24, pady=12)
        if self.employee:
            label(p, f"Аттестуемый: {self.employee['full_name']}", 12, True).pack(anchor="w", pady=(0, 10))
        lines = []
        if self.data["closed"]:
            lines.append(f"• Закрытая часть: {len(self.data['closed'])} вопросов с одним верным вариантом, "
                         f"{C.CLOSED_MINUTES} минут, 1 балл за вопрос.")
        lines.append(f"• Открытая часть: {len(self.data['open'])} вопросов с развёрнутым ответом, до "
                     f"{C.OPEN_MINUTES} минут. Оценка 0 / 1 / 2: 0 — не ответил, 1 — частично, 2 — полно.")
        lines.append(f"• Проходной порог — {int(C.PASS_RATIO * 100)} % от максимума по каждой части.")
        lines.append("• Вопросы о первопричине отказа и по безопасности — блокирующие: оценка 0 по любому из них "
                     "означает несдачу части независимо от суммы баллов.")
        if cfg["defense"]:
            lines.append("• Кроме того, комиссия проводит защиту трёх работ из журнала, практическое задание "
                         "и проверку оформления документации.")
        else:
            lines.append("• Кроме того, комиссия проводит практическое задание и проверку оформления документации.")
        if self.official:
            lines.append("• Во время аттестации учебные материалы недоступны. Закрытие программы прерывает попытку.")
        else:
            lines.append("• Это тренировка: результат не влияет на уровень. После каждой части будут показаны "
                         "правильные ответы и эталоны.")
        for line in lines:
            label(p, line, 11, wrap=980).pack(anchor="w", pady=2)
        btns = tk.Frame(p, bg=COL["panel"])
        btns.pack(anchor="w", pady=(16, 0))
        ttk.Button(btns, text="Начать", style="Accent.TButton", command=self.start).pack(side="left")
        if not self.official:
            ttk.Button(btns, text="Отмена", command=lambda: self.app.navigate("trial")).pack(side="left", padx=8)

    def start(self):
        if self.data["closed"] and not self.data["closed_done"]:
            self.show_closed()
        else:
            self.show_open()

    # ---------- навигация по номерам ----------
    def number_grid(self, parent, count, answered, on_click):
        grid = tk.Frame(parent, bg=COL["panel"])
        self.num_labels = []
        for i in range(count):
            lab = tk.Label(grid, text=str(i + 1), width=3, font=(FONT, 10), cursor="hand2", bd=1, relief="solid")
            lab.grid(row=i // 6, column=i % 6, padx=2, pady=2)
            lab.bind("<Button-1>", lambda e, k=i: on_click(k))
            self.num_labels.append(lab)
        self.answered_fn = answered
        return grid

    def paint_numbers(self):
        for i, lab in enumerate(self.num_labels):
            if i == self.index:
                lab.configure(bg=COL["accent"], fg="white")
            elif self.answered_fn(i):
                lab.configure(bg=COL["ok_bg"], fg=COL["text"])
            else:
                lab.configure(bg=COL["panel"], fg=COL["text"])

    # ---------- закрытая часть ----------
    def show_closed(self):
        items = self.data["closed"]
        self.header("Закрытая часть — тест", "Выберите один вариант ответа. Переходить между вопросами можно "
                    "в любом порядке; номера отвеченных вопросов подсвечены зелёным.", timer=True)
        body = tk.Frame(self.root, bg=COL["bg"])
        body.pack(fill="both", expand=True, padx=24, pady=12)
        side_o, side = panel(body, 12)
        side_o.pack(side="left", fill="y")
        label(side, "Вопросы", 11, True).pack(anchor="w", pady=(0, 6))
        self.number_grid(side, len(items), lambda i: items[i]["id"] in self.data["closed_answers"],
                         lambda k: self.goto_closed(k)).pack()
        self.progress_label = label(side, "", 10, color=COL["muted"])
        self.progress_label.pack(anchor="w", pady=(10, 0))
        ttk.Button(side, text="Завершить тест", style="Accent.TButton",
                   command=self.finish_closed).pack(fill="x", pady=(16, 0))

        main_o, self.q_panel = panel(body, 24)
        main_o.pack(side="left", fill="both", expand=True, padx=(12, 0))
        self.index = 0
        self.render_closed()
        self.start_timer(C.CLOSED_MINUTES, lambda: self.finish_closed(force=True))

    def goto_closed(self, k):
        self.index = k
        self.render_closed()

    def render_closed(self):
        clear(self.q_panel)
        items = self.data["closed"]
        item = items[self.index]
        q = C.CLOSED[item["id"]]
        label(self.q_panel, f"Вопрос {self.index + 1} из {len(items)} · тема {q['topic']} «{q['topic_title']}»",
              10, color=COL["muted"]).pack(anchor="w")
        label(self.q_panel, q["text"], 14, True, wrap=820).pack(anchor="w", pady=(8, 16))
        var = tk.IntVar(value=self.data["closed_answers"].get(item["id"], -1))

        def choose():
            self.data["closed_answers"][item["id"]] = var.get()
            self.save()
            self.paint_numbers()
            self.update_progress()

        for pos, orig in enumerate(item["perm"]):
            rb = tk.Radiobutton(self.q_panel, text=f"{LETTERS[pos]})  {q['options'][orig]}", variable=var, value=orig,
                                command=choose, font=(FONT, 12), bg=COL["panel"], activebackground=COL["sel"],
                                anchor="w", justify="left", wraplength=780, padx=6, pady=6, selectcolor="white")
            rb.pack(fill="x", anchor="w", pady=2)
        nav = tk.Frame(self.q_panel, bg=COL["panel"])
        nav.pack(fill="x", pady=(24, 0))
        if self.index > 0:
            ttk.Button(nav, text="← Назад", command=lambda: self.goto_closed(self.index - 1)).pack(side="left")
        if self.index < len(items) - 1:
            ttk.Button(nav, text="Далее →", command=lambda: self.goto_closed(self.index + 1)).pack(side="right")
        self.paint_numbers()
        self.update_progress()

    def update_progress(self):
        n = len(self.data["closed_answers"])
        self.progress_label.configure(text=f"Отвечено: {n} из {len(self.data['closed'])}")

    def finish_closed(self, force=False):
        if not force:
            left = len(self.data["closed"]) - len(self.data["closed_answers"])
            msg = "Завершить тестовую часть? Изменить ответы после этого будет нельзя."
            if left:
                msg = f"Без ответа осталось вопросов: {left}. " + msg
            if not messagebox.askyesno("Завершение теста", msg):
                return
        self._stop_timer()
        self.data["closed_done"] = True
        self.save()
        if self.app.role != "commission" and not self.official:
            for item in self.data["closed"]:
                q = C.CLOSED[item["id"]]
                self.app.db.record_answer(self.employee and self.employee["id"], q["id"],
                                          self.data["closed_answers"].get(q["id"]) == q["answer"])
        self.show_closed_result()

    def show_closed_result(self):
        res = L.closed_result(self.data)
        self.header("Тестовая часть завершена")
        sf = ScrollFrame(self.root)
        sf.pack(fill="both", expand=True, padx=24, pady=12)
        outer, p = panel(sf.inner, 20)
        outer.pack(fill="x", pady=(0, 10))
        pct = round(100 * res["score"] / res["max"])
        label(p, f"Результат: {res['score']} из {res['max']} ({pct} %)", 15, True).pack(anchor="w")
        badge(p, "порог пройден" if res["passed"] else "порог 80 % не пройден", "ok" if res["passed"] else "bad").pack(
            anchor="w", pady=(6, 10))
        ttk.Button(p, text="Перейти к открытой части →", style="Accent.TButton", command=self.show_open).pack(anchor="w")
        if self.official:
            return
        label(sf.inner, "Разбор ответов", 13, True, bg=COL["bg"]).pack(anchor="w", pady=(10, 6))
        for i, item in enumerate(self.data["closed"], 1):
            q = C.CLOSED[item["id"]]
            ans = self.data["closed_answers"].get(q["id"])
            ok = ans == q["answer"]
            o, p = panel(sf.inner, 14)
            o.pack(fill="x", pady=4)
            row = tk.Frame(p, bg=COL["panel"])
            row.pack(fill="x")
            badge(row, "верно" if ok else "ошибка", "ok" if ok else "bad").pack(side="left")
            label(row, f"  {i}. {q['text']}", 11, True, wrap=880).pack(side="left", fill="x")
            if not ok:
                given = q["options"][ans] if ans is not None else "нет ответа"
                label(p, f"Ваш ответ: {given}", 10, color=COL["bad"], wrap=950).pack(anchor="w", pady=(4, 0))
            label(p, f"Правильно: {q['options'][q['answer']]}", 10, color=COL["ok"], wrap=950).pack(anchor="w")

    # ---------- открытая часть ----------
    def show_open(self):
        ids = self.data["open"]
        self.header("Открытая часть — письменные ответы",
                    "Отвечайте своими словами, по существу. Ответы сохраняются автоматически.", timer=True)
        body = tk.Frame(self.root, bg=COL["bg"])
        body.pack(fill="both", expand=True, padx=24, pady=12)
        side_o, side = panel(body, 12)
        side_o.pack(side="left", fill="y")
        label(side, "Вопросы", 11, True).pack(anchor="w", pady=(0, 6))
        self.number_grid(side, len(ids), lambda i: bool(self.data["open_answers"].get(ids[i], "").strip()),
                         lambda k: self.goto_open(k)).pack()
        ttk.Button(side, text="Завершить", style="Accent.TButton", command=self.finish_open).pack(fill="x", pady=(16, 0))
        main_o, self.q_panel = panel(body, 24)
        main_o.pack(side="left", fill="both", expand=True, padx=(12, 0))
        self.index = 0
        self.answer_box = None
        self.render_open()
        self.start_timer(C.OPEN_MINUTES, lambda: self.finish_open(force=True))
        self._autosave()

    def _autosave(self):
        self.store_open_answer()
        self.save()
        self.autosave_job = self.root.after(20000, self._autosave)

    def store_open_answer(self):
        if self.answer_box is not None:
            try:
                self.data["open_answers"][self.data["open"][self.index]] = get_text(self.answer_box)
            except tk.TclError:
                pass

    def goto_open(self, k):
        self.store_open_answer()
        self.save()
        self.index = k
        self.render_open()

    def render_open(self):
        clear(self.q_panel)
        ids = self.data["open"]
        qid = ids[self.index]
        q = C.OPEN[qid]
        set_key = qid.rsplit("-", 1)[0]
        label(self.q_panel, f"Вопрос {self.index + 1} из {len(ids)} · {C.OPEN_SET_TITLES[set_key]}", 10,
              color=COL["muted"]).pack(anchor="w")
        label(self.q_panel, q["text"], 14, True, wrap=820).pack(anchor="w", pady=(8, 12))
        self.answer_box = text_area(self.q_panel, height=14)
        self.answer_box.pack(fill="both", expand=True)
        set_text(self.answer_box, self.data["open_answers"].get(qid, ""))
        self.answer_box.bind("<KeyRelease>", lambda e: self.paint_numbers_live())
        self.answer_box.focus_set()
        nav = tk.Frame(self.q_panel, bg=COL["panel"])
        nav.pack(fill="x", pady=(14, 0))
        if self.index > 0:
            ttk.Button(nav, text="← Назад", command=lambda: self.goto_open(self.index - 1)).pack(side="left")
        if self.index < len(ids) - 1:
            ttk.Button(nav, text="Далее →", command=lambda: self.goto_open(self.index + 1)).pack(side="right")
        self.paint_numbers()

    def paint_numbers_live(self):
        self.store_open_answer()
        self.paint_numbers()

    def finish_open(self, force=False):
        self.store_open_answer()
        if not force:
            empty = sum(1 for i in self.data["open"] if not self.data["open_answers"].get(i, "").strip())
            msg = "Завершить открытую часть? Изменить ответы после этого будет нельзя."
            if empty:
                msg = f"Без ответа осталось вопросов: {empty}. " + msg
            if not messagebox.askyesno("Завершение", msg):
                return
        self._stop_timer()
        self.data["open_done"] = True
        self.answer_box = None
        if self.official:
            self.save(status=D.ST_REVIEW, finished=D.now())
            if self.on_finish:
                self.on_finish()
        else:
            self.show_self_grading()

    # ---------- самооценка открытой части (только пробная аттестация) ----------
    def show_self_grading(self):
        self.header("Самопроверка открытой части",
                    "Сравните свой ответ с эталоном и честно оцените: 0 — не ответил, 1 — частично, 2 — полно.")
        sf = ScrollFrame(self.root)
        sf.pack(fill="both", expand=True, padx=24, pady=12)
        self.grade_vars = {}
        for i, qid in enumerate(self.data["open"], 1):
            q = C.OPEN[qid]
            o, p = panel(sf.inner, 16)
            o.pack(fill="x", pady=5)
            title = f"{i}. {q['text']}"
            label(p, title, 12, True, wrap=1000).pack(anchor="w")
            if qid in self.data["blocking"]:
                badge(p, "блокирующий вопрос", "warn").pack(anchor="w", pady=(4, 0))
            label(p, "Ваш ответ:", 10, True, color=COL["muted"]).pack(anchor="w", pady=(8, 0))
            label(p, self.data["open_answers"].get(qid) or "— нет ответа —", 11, wrap=1000).pack(anchor="w")
            label(p, "Эталонный ответ:", 10, True, color=COL["ok"]).pack(anchor="w", pady=(8, 0))
            label(p, q["reference"], 11, wrap=1000).pack(anchor="w")
            var = tk.IntVar(value=-1)
            self.grade_vars[qid] = var
            row = tk.Frame(p, bg=COL["panel"])
            row.pack(anchor="w", pady=(8, 0))
            label(row, "Оценка:", 10, True).pack(side="left")
            for v, t in ((0, "0 — не ответил"), (1, "1 — частично"), (2, "2 — полно")):
                ttk.Radiobutton(row, text=t, variable=var, value=v).pack(side="left", padx=8)
        ttk.Button(sf.inner, text="Подвести итог", style="Accent.TButton", command=self.show_trial_summary).pack(
            anchor="w", pady=14)

    def show_trial_summary(self):
        if any(v.get() < 0 for v in self.grade_vars.values()):
            messagebox.showwarning("Самопроверка", "Оцените все вопросы.")
            return
        self.data["open_scores"] = {k: v.get() for k, v in self.grade_vars.items()}
        cr = L.closed_result(self.data)
        orr = L.open_result(self.data)
        emp_id = self.employee["id"] if self.employee else None
        title = C.transition_title(self.data["transition"])
        got = (cr["score"] if cr else 0) + orr["score"]
        mx = (cr["max"] if cr else 0) + orr["max"]
        self.app.db.log_training(emp_id, "Пробная аттестация", title, got, mx)
        self.header(f"Итог пробной аттестации {title}")
        outer, p = panel(self.root, 24)
        outer.pack(fill="x", padx=24, pady=12)
        if cr:
            row = tk.Frame(p, bg=COL["panel"])
            row.pack(anchor="w", pady=4)
            label(row, f"Закрытая часть: {cr['score']} из {cr['max']}   ", 13).pack(side="left")
            badge(row, "сдано" if cr["passed"] else "не сдано", "ok" if cr["passed"] else "bad").pack(side="left")
        row = tk.Frame(p, bg=COL["panel"])
        row.pack(anchor="w", pady=4)
        label(row, f"Открытая часть: {orr['score']} из {orr['max']}   ", 13).pack(side="left")
        badge(row, "сдано" if orr["passed"] else "не сдано", "ok" if orr["passed"] else "bad").pack(side="left")
        if orr["blocking_failed"]:
            label(p, "Оценка 0 по блокирующему вопросу — часть не сдана независимо от суммы баллов.", 11,
                  color=COL["bad"]).pack(anchor="w", pady=(6, 0))
        label(p, "На официальной аттестации открытую часть оценивает комиссия; также проводятся практическое "
                 "задание, проверка документации и (с У1 → У2) защита работ.", 10, color=COL["muted"], wrap=950).pack(
            anchor="w", pady=(12, 0))
        btns = tk.Frame(p, bg=COL["panel"])
        btns.pack(anchor="w", pady=(16, 0))
        ttk.Button(btns, text="Ещё одна попытка", style="Accent.TButton",
                   command=lambda: self.app.navigate("trial")).pack(side="left")
        ttk.Button(btns, text="К материалам", command=lambda: self.app.navigate("materials")).pack(side="left", padx=8)
