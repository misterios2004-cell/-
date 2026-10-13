"""Экраны комиссии / наставника."""
import tkinter as tk
import webbrowser
from datetime import date
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from .. import content as C
from .. import db as D
from .. import logic as L
from .. import report
from .base import (COL, FONT, ScrollFrame, badge, clear, get_text, label, make_tree, page_header, panel, set_text,
                   text_area)
from .training import conditions_panel, level_ladder

BLOCKING_FACTOR_TYPES = [
    "Обоснованная рекламация с приостановкой эксплуатации оборудования по вине сотрудника",
    "Нарушение требований охраны труда или электробезопасности",
    "Выполнение работ без соответствующего допуска",
    "Выполненный ремонт, не отражённый в системе учёта",
    "Сокрытие факта отказа или повреждения оборудования при ремонте",
]


def save_html(parent, html, default_name):
    path = filedialog.asksaveasfilename(parent=parent, defaultextension=".html", initialfile=default_name,
                                        filetypes=[("HTML-документ", "*.html")])
    if not path:
        return
    Path(path).write_text(html, encoding="utf-8")
    webbrowser.open(Path(path).resolve().as_uri())


def ask_date(entry, title):
    value = entry.get().strip()
    if value and L.parse_date(value) is None:
        messagebox.showwarning(title, f"Дата «{value}» должна быть в формате ГГГГ-ММ-ДД, например {date.today()}.")
        return False
    return True


# ====================== список сотрудников ======================

class EmployeesScreen:
    def __init__(self, master, app):
        self.app = app
        page_header(master, "Сотрудники", "Двойной щелчок открывает карточку сотрудника.")
        bar = tk.Frame(master, bg=COL["bg"])
        bar.pack(fill="x", padx=24, pady=(0, 8))
        ttk.Button(bar, text="Добавить сотрудника", style="Accent.TButton",
                   command=lambda: app.navigate("employee", emp_id=None)).pack(side="left")
        ttk.Button(bar, text="Открыть", command=self.open).pack(side="left", padx=8)
        box, self.tree = make_tree(master, [
            ("name", "Ф. И. О.", 220, True), ("pos", "Должность", 130, True), ("level", "Уровень", 200, False),
            ("since", "Присвоен", 90, False), ("months", "Стаж", 70, False),
            ("next", "Следующий шаг", 230, False)], height=20)
        box.pack(fill="both", expand=True, padx=24, pady=(0, 20))
        self.tree.bind("<Double-1>", lambda e: self.open())
        db = app.db
        for e in db.employees(active_only=False):
            start = L.parse_date(e["level_date"])
            months = f"{L.months_between(start, date.today())} мес." if start else "—"
            transition = C.next_transition(e["level"])
            nxt = "—"
            if transition:
                st = L.promotion_status(e, db.competencies(e["id"]), db.blocking_factors(e["id"]),
                                        db.attempts(e["id"]), db.surveys(e["id"]), db.criteria_marks(e["id"], transition))
                done = sum(1 for c in st["conditions"] if c[1])
                nxt = f"{C.transition_title(transition)}: {done}/{len(st['conditions'])} условий"
            self.tree.insert("", "end", iid=str(e["id"]), values=(
                e["full_name"] + ("" if e["active"] else " (не активен)"), e["position"],
                f"У{e['level']} — {C.LEVEL_NAMES[e['level']]}", e["level_date"] or "—", months, nxt),
                tags=() if e["active"] else ("muted",))

    def open(self):
        sel = self.tree.selection()
        if sel:
            self.app.navigate("employee", emp_id=int(sel[0]))


# ====================== карточка сотрудника ======================

class EmployeeScreen:
    def __init__(self, master, app, emp_id=None, tab=0):
        self.app = app
        self.db = app.db
        self.master = master
        self.emp = self.db.employee(emp_id) if emp_id else {
            "id": None, "full_name": "", "position": "Ученик", "level": 0, "level_date": D.today(),
            "admissions": "", "next_attestation": "", "notes": "", "active": 1}
        top = tk.Frame(master, bg=COL["bg"])
        top.pack(fill="x", padx=24, pady=(16, 6))
        ttk.Button(top, text="← К списку", command=lambda: app.navigate("employees")).pack(side="left")
        label(top, "   " + (self.emp["full_name"] or "Новый сотрудник"), 17, True, bg=COL["bg"]).pack(side="left")
        if self.emp["id"]:
            ttk.Button(top, text="Начать аттестацию", style="Accent.TButton", command=self.start_exam).pack(side="right")
            ttk.Button(top, text="Карта уровня (печать)", command=self.print_card).pack(side="right", padx=8)
        self.nb = ttk.Notebook(master)
        self.nb.pack(fill="both", expand=True, padx=24, pady=(4, 20))
        self.build_general()
        if self.emp["id"]:
            self.build_progress()
            self.build_matrix()
            self.build_surveys()
            self.build_factors()
            self.build_attempts()
            self.nb.select(tab)

    def reopen(self, tab=0):
        self.app.navigate("employee", emp_id=self.emp["id"], tab=tab)

    def tab(self, title):
        frame = tk.Frame(self.nb, bg=COL["panel"], padx=20, pady=16)
        self.nb.add(frame, text=title)
        return frame

    # ----- общее -----
    def build_general(self):
        f = self.tab("Общее")
        self.fields = {}
        rows = [("full_name", "Ф. И. О."), ("position", "Должность"), ("level_date", "Дата присвоения уровня (ГГГГ-ММ-ДД)"),
                ("admissions", "Допуски по группам оборудования"), ("next_attestation", "Срок следующей аттестации")]
        for i, (key, title) in enumerate(rows):
            label(f, title, 10).grid(row=i, column=0, sticky="w", pady=4)
            e = ttk.Entry(f, width=70, font=(FONT, 11))
            e.insert(0, self.emp.get(key) or "")
            e.grid(row=i, column=1, sticky="w", pady=4, padx=10)
            self.fields[key] = e
        i = len(rows)
        label(f, "Текущий уровень", 10).grid(row=i, column=0, sticky="w", pady=4)
        self.level_var = tk.StringVar(value=f"У{self.emp['level']} — {C.LEVEL_NAMES[self.emp['level']]}")
        ttk.Combobox(f, textvariable=self.level_var, state="readonly", width=40, font=(FONT, 11),
                     values=[f"У{k} — {v}" for k, v in C.LEVEL_NAMES.items()]).grid(row=i, column=1, sticky="w", padx=10)
        label(f, "Заметки", 10).grid(row=i + 1, column=0, sticky="nw", pady=4)
        self.notes = text_area(f, height=5, width=70)
        self.notes.grid(row=i + 1, column=1, sticky="w", pady=4, padx=10)
        set_text(self.notes, self.emp.get("notes"))
        self.active_var = tk.BooleanVar(value=bool(self.emp.get("active", 1)))
        ttk.Checkbutton(f, text="Активен (показывается в списке при входе)", variable=self.active_var).grid(
            row=i + 2, column=1, sticky="w", padx=10, pady=4)
        btns = tk.Frame(f, bg=COL["panel"])
        btns.grid(row=i + 3, column=1, sticky="w", padx=10, pady=(14, 0))
        ttk.Button(btns, text="Сохранить", style="Accent.TButton", command=self.save_general).pack(side="left")
        if self.emp["id"]:
            ttk.Button(btns, text="Удалить сотрудника", style="Danger.TButton", command=self.delete).pack(side="left", padx=10)
        label(f, "Уровень и дату присвоения можно задать вручную при вводе сотрудника в систему; "
                 "далее они обновляются автоматически при утверждении протокола аттестации.", 9,
              color=COL["muted"], wrap=700).grid(row=i + 4, column=1, sticky="w", padx=10, pady=(12, 0))

    def save_general(self):
        name = self.fields["full_name"].get().strip()
        if not name:
            messagebox.showwarning("Сотрудник", "Укажите Ф. И. О.")
            return
        for key in ("level_date", "next_attestation"):
            if not ask_date(self.fields[key], "Сотрудник"):
                return
        emp = dict(self.emp)
        for key, e in self.fields.items():
            emp[key] = e.get().strip()
        emp["level"] = int(self.level_var.get()[1])
        emp["notes"] = get_text(self.notes)
        emp["active"] = int(self.active_var.get())
        emp_id = self.db.save_employee(emp)
        self.app.navigate("employee", emp_id=emp_id)

    def delete(self):
        if messagebox.askyesno("Удаление", f"Удалить сотрудника «{self.emp['full_name']}» вместе со всеми его "
                                           "данными (опросы, аттестации, матрица)? Это действие необратимо.\n\n"
                                           "Если сотрудник просто ушёл, лучше снять отметку «Активен»."):
            self.db.delete_employee(self.emp["id"])
            self.app.navigate("employees")

    # ----- переход на следующий уровень -----
    def build_progress(self):
        f = self.tab("Переход на уровень")
        sf = ScrollFrame(f, bg=COL["panel"])
        sf.pack(fill="both", expand=True)
        body = sf.inner
        level_ladder(body, self.emp["level"], COL["panel"]).pack(anchor="w", pady=(0, 12))
        transition = C.next_transition(self.emp["level"])
        if not transition:
            label(body, "У5 — верхний уровень шкалы.", 12).pack(anchor="w")
            return
        eid = self.emp["id"]
        marks = self.db.criteria_marks(eid, transition)
        surveys = self.db.surveys(eid)
        attempts = self.db.attempts(eid)
        status = L.promotion_status(self.emp, self.db.competencies(eid), self.db.blocking_factors(eid),
                                    attempts, surveys, marks)
        head = tk.Frame(body, bg=COL["panel"])
        head.pack(fill="x")
        label(head, f"Право на повышение {C.transition_title(transition)} (раздел 4.1)", 13, True).pack(side="left")
        badge(head, "есть" if status["eligible"] else "нет", "ok" if status["eligible"] else "bad").pack(side="left", padx=8)
        conditions_panel(body, status)
        mm = C.MIN_MONTHS[transition]
        label(body, f"Минимальный срок: {mm['months']} мес. ({mm['comment']}).", 9, color=COL["muted"]).pack(anchor="w", pady=(4, 0))

        if transition in C.EXTRA_CONDITIONS:
            var = tk.BooleanVar(value=marks.get(100, {}).get("done", False))
            ttk.Checkbutton(body, text=C.EXTRA_CONDITIONS[transition], variable=var,
                            command=lambda: (self.db.set_criteria_mark(eid, transition, 100, var.get()), self.reopen(1))).pack(
                anchor="w", pady=(10, 0))

        if transition in C.CRITERIA:
            label(body, f"Критерии перехода {C.transition_title(transition)}", 13, True).pack(anchor="w", pady=(18, 4))
            label(body, "Пункты, отмеченные «авто», рассчитываются по журналу опросов и результатам аттестации. "
                        "Остальные подтверждает комиссия. Отметка комиссии засчитывает пункт, даже если авто-проверка "
                        "не выполнена (например, когда журнал ведётся на бумаге).", 9, color=COL["muted"],
                  wrap=1000).pack(anchor="w", pady=(0, 6))
            for c in L.criteria_status(transition, surveys, attempts, marks):
                row = tk.Frame(body, bg=COL["panel"])
                row.pack(fill="x", pady=3)
                var = tk.BooleanVar(value=c["manual"])
                ttk.Checkbutton(row, variable=var, command=lambda n=c["num"], v=var: (
                    self.db.set_criteria_mark(eid, transition, n, v.get()), self.reopen(1))).pack(side="left", anchor="n")
                col = tk.Frame(row, bg=COL["panel"])
                col.pack(side="left", fill="x", expand=True)
                line = tk.Frame(col, bg=COL["panel"])
                line.pack(fill="x")
                if c["auto"] is not None:
                    badge(line, "авто: выполнено" if c["auto"] else "авто: не выполнено",
                          "ok" if c["auto"] else "bad").pack(side="right", padx=6, anchor="n")
                label(line, f"{c['num']}. {c['text']}", 11, wrap=780).pack(side="left")
                label(col, f"Как проверяется: {c['check']}" + (f" · {c['hint']}" if c["hint"] else ""), 9,
                      color=COL["muted"], wrap=900).pack(anchor="w")

    # ----- матрица -----
    def build_matrix(self):
        f = self.tab("Матрица компетенций")
        transition = C.next_transition(self.emp["level"])
        target = C.TRANSITIONS[transition]["to"] if transition else 5
        comps = self.db.competencies(self.emp["id"])
        sf = ScrollFrame(f, bg=COL["panel"])
        sf.pack(fill="both", expand=True)
        g = sf.inner
        label(g, "Шкала: 0 — не владеет; 1 — под контролем; 2 — типовые задачи самостоятельно; 3 — сложные и "
                 "нестандартные самостоятельно; 4 — обучает других, принимает их работы; 5 — разрабатывает решения "
                 "и методики. Для H9 указывается число групп оборудования с допуском.", 9, color=COL["muted"],
              wrap=900).grid(row=0, column=0, columnspan=8, sticky="ew", pady=(0, 8))
        heads = ["Код", "Компетенция", "Факт", "У2", "У3", "У4", "У5", "Разрыв"]
        for j, h in enumerate(heads):
            label(g, h, 10, True).grid(row=1, column=j, sticky="w", padx=6, pady=3)
        self.comp_vars = {}
        for i, c in enumerate(C.COMPETENCIES, start=2):
            fact = comps.get(c["code"], 0)
            label(g, c["code"], 10, True).grid(row=i, column=0, sticky="w", padx=6)
            label(g, c["name"], 10, wrap=520).grid(row=i, column=1, sticky="w", padx=6, pady=2)
            var = tk.IntVar(value=fact)
            self.comp_vars[c["code"]] = var
            ttk.Spinbox(g, from_=0, to=50 if c["unit"] else 5, textvariable=var, width=5).grid(row=i, column=2, padx=6)
            for j, lv in enumerate((2, 3, 4, 5), start=3):
                req = c["required"][lv]
                lab = label(g, str(req), 10, bold=lv == target)
                lab.grid(row=i, column=j, padx=6)
            gap = max(c["required"][target] - fact, 0) if target >= 2 else None
            label(g, "—" if gap is None else (str(gap) if gap else "✔"), 10, True,
                  color=COL["bad"] if gap else COL["ok"]).grid(row=i, column=7, padx=6)
        ttk.Button(g, text="Сохранить матрицу", style="Accent.TButton", command=self.save_matrix).grid(
            row=len(C.COMPETENCIES) + 2, column=1, sticky="w", pady=14, padx=6)

    def save_matrix(self):
        try:
            values = {k: int(v.get()) for k, v in self.comp_vars.items()}
        except (tk.TclError, ValueError):
            messagebox.showwarning("Матрица", "Значения должны быть целыми числами.")
            return
        self.db.save_competencies(self.emp["id"], values)
        self.reopen(2)

    # ----- журнал опросов -----
    def build_surveys(self):
        f = self.tab("Опросы по работам")
        label(f, "Опрос по выполненной работе (раздел 2.3) обязателен для каждой работы ученика на уровнях У0—У2. "
                 "Оценка по каждому вопросу 0 / 1 / 2; при оценке 0 по вопросу 4 работа не принимается.", 9,
              color=COL["muted"], wrap=1000).pack(anchor="w")
        bar = tk.Frame(f, bg=COL["panel"])
        bar.pack(fill="x", pady=8)
        ttk.Button(bar, text="Добавить опрос", style="Accent.TButton", command=lambda: self.survey_dialog(None)).pack(side="left")
        ttk.Button(bar, text="Изменить", command=self.edit_survey).pack(side="left", padx=8)
        ttk.Button(bar, text="Удалить", command=self.delete_survey).pack(side="left")
        self.surveys = self.db.surveys(self.emp["id"])
        avg = L.survey_average(self.surveys)
        label(bar, f"   Работ: {len(self.surveys)} · средняя оценка: {f'{avg:.2f}' if avg is not None else '—'}", 10,
              True).pack(side="left", padx=10)
        box, self.survey_tree = make_tree(f, [
            ("date", "Дата", 95, False), ("eq", "Оборудование / работа", 240, True), ("shelf", "Полка", 60, False),
            ("mode", "Режим", 70, False), ("int", "Вмеш.", 60, False), ("sum", "Сумма", 70, False),
            ("avg", "Средняя", 75, False), ("res", "Результат", 110, False), ("mentor", "Наставник", 130, False)])
        box.pack(fill="both", expand=True)
        self.survey_tree.bind("<Double-1>", lambda e: self.edit_survey())
        for s in reversed(self.surveys):
            ok = L.survey_accepted(s)
            self.survey_tree.insert("", "end", iid=str(s["id"]), values=(
                s["date"], s["equipment"] + (" (отсос)" if s["is_aspirator"] else ""), "да" if s["on_shelf"] else "нет",
                s["mode"], s["interventions"], f"{sum(s['scores'])}/20", f"{sum(s['scores']) / 10:.1f}",
                "принята" if ok else "не принята", s["mentor"]), tags=() if ok else ("bad",))

    def edit_survey(self):
        sel = self.survey_tree.selection()
        if sel:
            self.survey_dialog(next(s for s in self.surveys if s["id"] == int(sel[0])))

    def delete_survey(self):
        sel = self.survey_tree.selection()
        if sel and messagebox.askyesno("Опрос", "Удалить запись опроса?"):
            self.db.delete_survey(int(sel[0]))
            self.reopen(3)

    def survey_dialog(self, survey):
        win = tk.Toplevel(self.master)
        win.title("Опрос по выполненной работе")
        win.configure(bg=COL["panel"], padx=20, pady=16)
        win.transient(self.master.winfo_toplevel())
        win.grab_set()
        s = survey or {"date": D.today(), "equipment": "", "is_aspirator": 0, "on_shelf": 1, "mode": "С-1",
                       "interventions": 0, "scores": [None] * 10, "mentor": "", "comment": ""}
        grid = tk.Frame(win, bg=COL["panel"])
        grid.pack(fill="x")
        label(grid, "Дата (ГГГГ-ММ-ДД)", 10).grid(row=0, column=0, sticky="w")
        e_date = ttk.Entry(grid, width=14)
        e_date.insert(0, s["date"])
        e_date.grid(row=0, column=1, sticky="w", padx=8, pady=3)
        label(grid, "Оборудование / работа", 10).grid(row=1, column=0, sticky="w")
        e_eq = ttk.Entry(grid, width=60)
        e_eq.insert(0, s["equipment"])
        e_eq.grid(row=1, column=1, columnspan=3, sticky="w", padx=8, pady=3)
        v_asp = tk.BooleanVar(value=bool(s["is_aspirator"]))
        v_shelf = tk.BooleanVar(value=bool(s["on_shelf"]))
        ttk.Checkbutton(grid, text="Медицинский отсос (аспиратор)", variable=v_asp).grid(row=2, column=1, sticky="w", padx=8)
        ttk.Checkbutton(grid, text="Фонд «полки»", variable=v_shelf).grid(row=2, column=2, sticky="w", padx=8)
        label(grid, "Режим контроля", 10).grid(row=3, column=0, sticky="w")
        v_mode = tk.StringVar(value=s["mode"])
        ttk.Combobox(grid, textvariable=v_mode, state="readonly", width=30,
                     values=[f"{k}" for k in C.CONTROL_MODES]).grid(row=3, column=1, sticky="w", padx=8, pady=3)
        label(grid, " · ".join(f"{k} — {v}" for k, v in C.CONTROL_MODES.items()), 9, color=COL["muted"]).grid(
            row=3, column=2, columnspan=2, sticky="w")
        label(grid, "Вмешательств наставника", 10).grid(row=4, column=0, sticky="w")
        v_int = tk.IntVar(value=s["interventions"])
        ttk.Spinbox(grid, from_=0, to=99, textvariable=v_int, width=6).grid(row=4, column=1, sticky="w", padx=8, pady=3)
        label(grid, "Наставник", 10).grid(row=5, column=0, sticky="w")
        e_mentor = ttk.Entry(grid, width=40)
        e_mentor.insert(0, s["mentor"])
        e_mentor.grid(row=5, column=1, columnspan=2, sticky="w", padx=8, pady=3)

        qf = tk.Frame(win, bg=COL["panel"])
        qf.pack(fill="x", pady=(12, 0))
        score_vars = []
        for i, q in enumerate(C.SURVEY_QUESTIONS):
            v = tk.StringVar(value="" if s["scores"][i] is None else str(s["scores"][i]))
            score_vars.append(v)
            ttk.Combobox(qf, textvariable=v, values=["0", "1", "2"], state="readonly", width=3).grid(row=i, column=0, pady=2)
            label(qf, f"{i + 1}. {q}", 10, bold=i == C.SURVEY_BLOCKING, wrap=640).grid(row=i, column=1, sticky="w", padx=8)
        label(win, "Комментарий", 10).pack(anchor="w", pady=(10, 2))
        comment = text_area(win, height=3, width=80)
        comment.pack(fill="x")
        set_text(comment, s["comment"])

        def save():
            if not e_eq.get().strip():
                messagebox.showwarning("Опрос", "Укажите оборудование / работу.", parent=win)
                return
            if L.parse_date(e_date.get().strip()) is None:
                messagebox.showwarning("Опрос", "Дата должна быть в формате ГГГГ-ММ-ДД.", parent=win)
                return
            if any(not v.get() for v in score_vars):
                messagebox.showwarning("Опрос", "Оцените все 10 вопросов.", parent=win)
                return
            try:
                interventions = int(v_int.get())
            except (tk.TclError, ValueError):
                interventions = 0
            self.db.save_survey({
                "id": s.get("id"), "employee_id": self.emp["id"], "date": e_date.get().strip(),
                "equipment": e_eq.get().strip(), "is_aspirator": int(v_asp.get()), "on_shelf": int(v_shelf.get()),
                "mode": v_mode.get(), "interventions": interventions, "scores": [int(v.get()) for v in score_vars],
                "mentor": e_mentor.get().strip(), "comment": get_text(comment)})
            win.destroy()
            self.reopen(3)

        btns = tk.Frame(win, bg=COL["panel"])
        btns.pack(anchor="e", pady=(12, 0))
        ttk.Button(btns, text="Сохранить", style="Accent.TButton", command=save).pack(side="left")
        ttk.Button(btns, text="Отмена", command=win.destroy).pack(side="left", padx=8)

    # ----- блокирующие факторы -----
    def build_factors(self):
        f = self.tab("Блокирующие факторы")
        label(f, "Блокирующие факторы останавливают повышение независимо от стажа и экзаменов. Срок действия "
                 "блокировки — до следующей аттестации, но не менее 6 месяцев.", 9, color=COL["muted"], wrap=1000).pack(anchor="w")
        add = tk.Frame(f, bg=COL["panel"])
        add.pack(fill="x", pady=8)
        e_date = ttk.Entry(add, width=12)
        e_date.insert(0, D.today())
        e_date.pack(side="left")
        v_desc = tk.StringVar()
        ttk.Combobox(add, textvariable=v_desc, values=BLOCKING_FACTOR_TYPES, width=80).pack(side="left", padx=8)

        def add_factor():
            if not v_desc.get().strip() or L.parse_date(e_date.get().strip()) is None:
                messagebox.showwarning("Блокирующий фактор", "Укажите дату (ГГГГ-ММ-ДД) и описание.")
                return
            self.db.add_blocking_factor(self.emp["id"], e_date.get().strip(), v_desc.get().strip())
            self.reopen(4)

        ttk.Button(add, text="Добавить", style="Accent.TButton", command=add_factor).pack(side="left")
        box, tree = make_tree(f, [("date", "Дата", 100, False), ("desc", "Описание", 600, True),
                                  ("lifted", "Снят", 120, False)], height=10)
        box.pack(fill="both", expand=True)
        factors = self.db.blocking_factors(self.emp["id"])
        for fc in factors:
            tree.insert("", "end", iid=str(fc["id"]), values=(fc["date"], fc["description"], fc["lifted_date"] or "действует"),
                        tags=() if fc["lifted_date"] else ("bad",))

        def lift():
            sel = tree.selection()
            if not sel:
                return
            fc = next(x for x in factors if x["id"] == int(sel[0]))
            if fc["lifted_date"]:
                return
            if not L.can_lift(fc):
                until = L.add_months(L.parse_date(fc["date"]), C.BLOCKING_FACTOR_MONTHS)
                messagebox.showwarning("Блокирующий фактор", f"Снять блокировку можно не ранее {until} (6 месяцев).")
                return
            if messagebox.askyesno("Блокирующий фактор", "Снять блокировку по решению аттестации?"):
                self.db.lift_blocking_factor(fc["id"], D.today())
                self.reopen(4)

        def delete():
            sel = tree.selection()
            if sel and messagebox.askyesno("Блокирующий фактор", "Удалить запись (например, внесённую ошибочно)?"):
                self.db.delete_blocking_factor(int(sel[0]))
                self.reopen(4)

        bar = tk.Frame(f, bg=COL["panel"])
        bar.pack(fill="x", pady=(8, 0))
        ttk.Button(bar, text="Снять блокировку", command=lift).pack(side="left")
        ttk.Button(bar, text="Удалить запись", command=delete).pack(side="left", padx=8)

    # ----- аттестации сотрудника -----
    def build_attempts(self):
        f = self.tab("Аттестации")
        attempts_list(f, self.app, self.db.attempts(self.emp["id"]), lambda: self.reopen(5))
        tl = self.db.training_log(self.emp["id"], 15)
        label(f, "Самостоятельные тренировки сотрудника", 11, True).pack(anchor="w", pady=(14, 4))
        if not tl:
            label(f, "Нет записей.", 10, color=COL["muted"]).pack(anchor="w")
        for r in tl:
            label(f, f"{r['date'][:16].replace('T', ' ')} · {r['mode']} · {r['description']} · "
                     f"{r['correct']:g} из {r['total']:g}", 10).pack(anchor="w")

    # ----- действия -----
    def print_card(self):
        html = report.level_card_html(self.emp, self.db.competencies(self.emp["id"]),
                                       self.db.blocking_factors(self.emp["id"]))
        save_html(self.master, html, f"Карта уровня — {self.emp['full_name']}.html")

    def start_exam(self):
        start_exam_dialog(self.app, self.emp)


def attempt_result(a):
    data = a["data"]
    if a["status"] != D.ST_DONE:
        cr = L.closed_result(data)
        return f"тест {cr['score']}/{cr['max']}" if cr and data.get("closed_done") else ""
    return "все части сданы" if L.exam_passed(data) else "есть несданные части"


def attempts_list(parent, app, attempts, on_change, height=8):
    bar = tk.Frame(parent, bg=parent.cget("bg"))
    bar.pack(fill="x", pady=(0, 6))
    box, tree = make_tree(parent, [("date", "Дата", 130, False), ("name", "Ф. И. О.", 200, True),
                                   ("tr", "Переход", 80, False), ("status", "Статус", 120, False),
                                   ("res", "Результат", 160, False), ("dec", "Решение", 250, True)], height=height)
    box.pack(fill="both", expand=True)
    for a in attempts:
        tag = ()
        if a["status"] == D.ST_DONE:
            tag = ("ok",) if L.exam_passed(a["data"]) else ("bad",)
        tree.insert("", "end", iid=str(a["id"]), values=(
            a["started"][:16].replace("T", " "), a.get("full_name") or "", C.transition_title(a["transition"]),
            D.STATUS_TITLES[a["status"]], attempt_result(a), a["data"].get("decision", "")), tags=tag)

    def selected():
        sel = tree.selection()
        return int(sel[0]) if sel else None

    def open_review():
        if selected():
            app.navigate("review", attempt_id=selected())

    def delete():
        if selected() and messagebox.askyesno("Аттестация", "Удалить запись об аттестации? Это необратимо."):
            app.db.delete_attempt(selected())
            on_change()

    tree.bind("<Double-1>", lambda e: open_review())
    ttk.Button(bar, text="Проверка / протокол", style="Accent.TButton", command=open_review).pack(side="left")
    ttk.Button(bar, text="Удалить", command=delete).pack(side="left", padx=8)
    return tree


def start_exam_dialog(app, emp=None):
    win = tk.Toplevel(app.root)
    win.title("Новая аттестация")
    win.configure(bg=COL["panel"], padx=24, pady=18)
    win.transient(app.root)
    win.grab_set()
    employees = app.db.employees()
    names = [e["full_name"] for e in employees]
    label(win, "Аттестуемый", 10).grid(row=0, column=0, sticky="w")
    v_emp = tk.StringVar(value=emp["full_name"] if emp else "")
    ttk.Combobox(win, textvariable=v_emp, values=names, state="readonly", width=40).grid(row=0, column=1, sticky="w", padx=8, pady=4)
    label(win, "Переход", 10).grid(row=1, column=0, sticky="w")
    titles = {C.transition_title(k): k for k in C.TRANSITIONS}
    default = C.next_transition(emp["level"]) if emp else None
    v_tr = tk.StringVar(value=C.transition_title(default) if default else "")
    ttk.Combobox(win, textvariable=v_tr, values=list(titles), state="readonly", width=20).grid(row=1, column=1, sticky="w", padx=8, pady=4)
    label(win, "После нажатия «Начать» программа перейдёт в режим аттестации: меню скрывается, учебные материалы "
               "недоступны. Передайте рабочее место аттестуемому. По окончании программа вернётся к экрану входа.",
          9, color=COL["muted"], wrap=460).grid(row=2, column=0, columnspan=2, sticky="w", pady=(10, 0))

    def go():
        if not v_emp.get() or not v_tr.get():
            messagebox.showwarning("Аттестация", "Выберите аттестуемого и переход.", parent=win)
            return
        e = employees[names.index(v_emp.get())]
        key = titles[v_tr.get()]
        if C.TRANSITIONS[key]["from"] != e["level"] and not messagebox.askyesno(
                "Аттестация", f"Текущий уровень сотрудника — У{e['level']}, а выбран переход {v_tr.get()}. Продолжить?",
                parent=win):
            return
        data = L.build_attempt(key)
        attempt_id = app.db.create_attempt(e["id"], key, "exam", data)
        win.destroy()
        app.start_official_exam(attempt_id)

    btns = tk.Frame(win, bg=COL["panel"])
    btns.grid(row=3, column=1, sticky="e", pady=(14, 0))
    ttk.Button(btns, text="Начать", style="Accent.TButton", command=go).pack(side="left")
    ttk.Button(btns, text="Отмена", command=win.destroy).pack(side="left", padx=8)


# ====================== список аттестаций ======================

class AttemptsScreen:
    def __init__(self, master, app):
        page_header(master, "Аттестации", "Проведение аттестации, проверка открытой части комиссией и оформление протокола.")
        bar = tk.Frame(master, bg=COL["bg"])
        bar.pack(fill="x", padx=24, pady=(0, 6))
        ttk.Button(bar, text="Новая аттестация", style="Accent.TButton",
                   command=lambda: start_exam_dialog(app)).pack(side="left")
        box = tk.Frame(master, bg=COL["bg"])
        box.pack(fill="both", expand=True, padx=24, pady=(0, 20))
        attempts_list(box, app, app.db.attempts(), lambda: app.navigate("attempts"), height=20)


# ====================== проверка и протокол ======================

class ReviewScreen:
    def __init__(self, master, app, attempt_id):
        self.app = app
        self.db = app.db
        self.master = master
        self.attempt = self.db.attempt(attempt_id)
        self.data = self.attempt["data"]
        self.emp = self.db.employee(self.attempt["employee_id"])
        self.cfg = C.TRANSITIONS[self.attempt["transition"]]
        locked = self.attempt["status"] == D.ST_DONE

        top = tk.Frame(master, bg=COL["bg"])
        top.pack(fill="x", padx=24, pady=(16, 6))
        ttk.Button(top, text="← К аттестациям", command=lambda: app.navigate("attempts")).pack(side="left")
        label(top, f"   {self.emp['full_name']} · {C.transition_title(self.attempt['transition'])}", 16, True,
              bg=COL["bg"]).pack(side="left")
        badge(top, D.STATUS_TITLES[self.attempt["status"]], "ok" if locked else "info").pack(side="left", padx=8)
        ttk.Button(top, text="Протокол (печать)", command=self.print_protocol).pack(side="right")

        sf = ScrollFrame(master)
        sf.pack(fill="both", expand=True, padx=24, pady=(0, 16))
        body = sf.inner

        if self.attempt["status"] in (D.ST_INTERRUPTED, D.ST_IN_PROGRESS):
            o, p = panel(body, 16)
            o.pack(fill="x", pady=6)
            label(p, "Аттестация была прервана (программа закрыта до завершения). Сохранённые ответы показаны ниже.",
                  11, color=COL["warn"]).pack(anchor="w")
            ttk.Button(p, text="Продолжить аттестацию (время частей отсчитывается заново)",
                       command=self.resume).pack(anchor="w", pady=(8, 0))

        self.build_closed(body)
        self.build_open(body, locked)
        if self.data.get("defense"):
            self.build_defense(body, locked)
        self.build_other(body, locked)
        self.build_decision(body, locked)
        self.refresh_summary()

    def resume(self):
        self.db.update_attempt(self.attempt["id"], status=D.ST_IN_PROGRESS)
        self.app.start_official_exam(self.attempt["id"])

    # ----- закрытая часть -----
    def build_closed(self, body):
        o, p = panel(body, 16)
        o.pack(fill="x", pady=6)
        label(p, "Закрытая часть (проверяется автоматически)", 13, True).pack(anchor="w")
        cr = L.closed_result(self.data)
        if not cr:
            label(p, "Для этого перехода закрытая часть не предусмотрена.", 10, color=COL["muted"]).pack(anchor="w")
            return
        row = tk.Frame(p, bg=COL["panel"])
        row.pack(anchor="w", pady=4)
        label(row, f"{cr['score']} из {cr['max']} ({round(100 * cr['score'] / cr['max'])} %)  ", 12).pack(side="left")
        badge(row, "сдано" if cr["passed"] else "не сдано", "ok" if cr["passed"] else "bad").pack(side="left")
        wrong = [it for it in self.data["closed"]
                 if self.data["closed_answers"].get(it["id"]) != C.CLOSED[it["id"]]["answer"]]
        if wrong:
            label(p, "Ошибки:", 10, True).pack(anchor="w", pady=(6, 2))
            for it in wrong:
                q = C.CLOSED[it["id"]]
                ans = self.data["closed_answers"].get(it["id"])
                given = q["options"][ans] if ans is not None else "нет ответа"
                label(p, f"№ {q['num']} ({q['topic']}). {q['text']}", 10, wrap=1000).pack(anchor="w")
                label(p, f"     ответ: {given}  |  верно: {q['options'][q['answer']]}", 9, color=COL["muted"],
                      wrap=1000).pack(anchor="w")

    # ----- открытая часть -----
    def build_open(self, body, locked):
        o, p = panel(body, 16)
        o.pack(fill="x", pady=6)
        label(p, "Открытая часть — оценка комиссии", 13, True).pack(anchor="w")
        label(p, "0 — не ответил, 1 — ответил частично, 2 — ответил полно. Вопрос о первопричине отказа и вопросы "
                 "по безопасности — блокирующие: оценка 0 по любому из них означает несдачу части. Вопросы 5 и 14 "
                 "раздела 3 отмечены блокирующими заранее; остальные комиссия отмечает сама.", 9,
              color=COL["muted"], wrap=1000).pack(anchor="w", pady=(0, 6))
        self.open_vars = {}
        self.block_vars = {}
        state = "disabled" if locked else "normal"
        for i, qid in enumerate(self.data["open"], 1):
            q = C.OPEN[qid]
            box = tk.Frame(p, bg="#f6f8fa", padx=12, pady=10)
            box.pack(fill="x", pady=5)
            label(box, f"{i}. {q['text']}", 11, True, bg="#f6f8fa", wrap=1000).pack(anchor="w")
            label(box, "Ответ аттестуемого:", 9, True, color=COL["muted"], bg="#f6f8fa").pack(anchor="w", pady=(6, 0))
            label(box, self.data["open_answers"].get(qid) or "— нет ответа —", 11, bg="#f6f8fa", wrap=1000).pack(anchor="w")
            label(box, "Эталонный ответ:", 9, True, color=COL["ok"], bg="#f6f8fa").pack(anchor="w", pady=(6, 0))
            label(box, q["reference"], 10, bg="#f6f8fa", wrap=1000, color=COL["muted"]).pack(anchor="w")
            row = tk.Frame(box, bg="#f6f8fa")
            row.pack(anchor="w", pady=(6, 0))
            cur = self.data["open_scores"].get(qid)
            var = tk.IntVar(value=-1 if cur is None else cur)
            self.open_vars[qid] = var
            for v in (0, 1, 2):
                tk.Radiobutton(row, text=str(v), variable=var, value=v, bg="#f6f8fa", state=state, font=(FONT, 11),
                               command=self.refresh_summary).pack(side="left", padx=4)
            bv = tk.BooleanVar(value=qid in self.data.get("blocking", []))
            self.block_vars[qid] = bv
            tk.Checkbutton(row, text="блокирующий", variable=bv, bg="#f6f8fa", state=state,
                           command=self.refresh_summary).pack(side="left", padx=16)

    # ----- защита работ -----
    def build_defense(self, body, locked):
        o, p = panel(body, 16)
        o.pack(fill="x", pady=6)
        label(p, "Защита работ из журнала", 13, True).pack(anchor="w")
        label(p, "Комиссия выбирает 3 работы из журнала наугад и проводит опрос без подготовки по форме опроса "
                 "(раздел 2.3). Оценка 0 по вопросу 4 означает, что работа не принимается.", 9, color=COL["muted"],
              wrap=1000).pack(anchor="w", pady=(0, 6))
        g = tk.Frame(p, bg=COL["panel"])
        g.pack(anchor="w")
        d = self.data["defense"]
        state = "disabled" if locked else "normal"
        self.def_works = []
        self.def_vars = []
        label(g, "Работа", 10, True).grid(row=0, column=0, sticky="w")
        for w in range(3):
            e = ttk.Entry(g, width=22, state=state)
            e.configure(state="normal")
            e.insert(0, d["works"][w])
            e.configure(state=state)
            e.grid(row=0, column=w + 1, padx=4, pady=2)
            self.def_works.append(e)
        for qi, qtext in enumerate(C.SURVEY_QUESTIONS):
            label(g, f"{qi + 1}. {qtext}", 9, bold=qi == C.SURVEY_BLOCKING, wrap=520).grid(row=qi + 1, column=0, sticky="w", pady=1)
            row_vars = []
            for w in range(3):
                val = d["scores"][w][qi]
                v = tk.StringVar(value="" if val is None else str(val))
                cb = ttk.Combobox(g, textvariable=v, values=["0", "1", "2"], width=4,
                                  state="disabled" if locked else "readonly")
                cb.grid(row=qi + 1, column=w + 1, padx=4)
                cb.bind("<<ComboboxSelected>>", lambda e: self.refresh_summary())
                row_vars.append(v)
            self.def_vars.append(row_vars)

    # ----- практическое задание и документация -----
    def build_other(self, body, locked):
        o, p = panel(body, 16)
        o.pack(fill="x", pady=6)
        label(p, "Практическое задание и оформление документации", 13, True).pack(anchor="w")
        tasks = next(ch for ch in C.MATERIALS if ch["title"].startswith("Практические"))
        rows = next(b["rows"] for b in tasks["blocks"] if b["type"] == "table")
        task = next((r for r in rows[1:] if r[0].replace(" ", "") == C.transition_title(self.attempt["transition"]).replace(" ", "")), None)
        if task:
            label(p, f"Задание: {task[1]}", 10, wrap=1000).pack(anchor="w", pady=(4, 0))
            label(p, f"Что оценивается: {task[2]}", 10, color=COL["muted"], wrap=1000).pack(anchor="w", pady=(0, 6))
        self.other = {}
        state = "disabled" if locked else "readonly"
        for key, title in (("practical", "Практическое задание"), ("documentation", "Оформление документации")):
            row = tk.Frame(p, bg=COL["panel"])
            row.pack(fill="x", pady=3)
            label(row, title, 10, True, width=26).pack(side="left")
            v = tk.StringVar(value=self.data[key]["result"])
            cb = ttk.Combobox(row, textvariable=v, values=[L.PART_PASSED, L.PART_FAILED], state=state, width=12)
            cb.pack(side="left")
            cb.bind("<<ComboboxSelected>>", lambda e: self.refresh_summary())
            e = ttk.Entry(row, width=80)
            e.insert(0, self.data[key]["comment"])
            if locked:
                e.configure(state="disabled")
            e.pack(side="left", padx=8)
            self.other[key] = (v, e)

    # ----- итог и решение -----
    def build_decision(self, body, locked):
        o, p = panel(body, 16)
        o.pack(fill="x", pady=6)
        label(p, "Итог", 13, True).pack(anchor="w")
        self.summary_box = tk.Frame(p, bg=COL["panel"])
        self.summary_box.pack(fill="x", pady=6)

        g = tk.Frame(p, bg=COL["panel"])
        g.pack(fill="x", pady=(8, 0))
        st = "disabled" if locked else "normal"
        label(g, "Дата аттестации", 10).grid(row=0, column=0, sticky="w")
        self.e_date = ttk.Entry(g, width=14)
        self.e_date.insert(0, self.data.get("date") or self.attempt["started"][:10])
        self.e_date.configure(state=st)
        self.e_date.grid(row=0, column=1, sticky="w", padx=8, pady=3)
        label(g, "Решение", 10).grid(row=1, column=0, sticky="w")
        self.v_dec = tk.StringVar(value=self.data.get("decision", ""))
        ttk.Combobox(g, textvariable=self.v_dec, values=self.cfg["decisions"], width=60,
                     state="disabled" if locked else "readonly").grid(row=1, column=1, sticky="w", padx=8, pady=3)
        label(g, "Повторная аттестация (дата)", 10).grid(row=2, column=0, sticky="w")
        self.e_repeat = ttk.Entry(g, width=14)
        self.e_repeat.insert(0, self.data.get("repeat_date", ""))
        self.e_repeat.configure(state=st)
        self.e_repeat.grid(row=2, column=1, sticky="w", padx=8, pady=3)
        label(g, "Состав комиссии", 10).grid(row=3, column=0, sticky="w")
        self.e_comm = ttk.Entry(g, width=80)
        self.e_comm.insert(0, self.data.get("commission", ""))
        self.e_comm.configure(state=st)
        self.e_comm.grid(row=3, column=1, sticky="w", padx=8, pady=3)
        label(g, "Замечания комиссии", 10).grid(row=4, column=0, sticky="nw")
        self.t_rem = text_area(g, height=3, width=80)
        self.t_rem.grid(row=4, column=1, sticky="w", padx=8, pady=3)
        set_text(self.t_rem, self.data.get("remarks", ""))
        if locked:
            self.t_rem.configure(state="disabled")
        label(g, "Что необходимо для перехода\n(не более трёх позиций)", 10).grid(row=5, column=0, sticky="nw")
        nf = tk.Frame(g, bg=COL["panel"])
        nf.grid(row=5, column=1, sticky="w", padx=8)
        self.e_needs = []
        for i in range(3):
            e = ttk.Entry(nf, width=80)
            e.insert(0, self.data.get("needs", ["", "", ""])[i])
            e.configure(state=st)
            e.pack(anchor="w", pady=1)
            self.e_needs.append(e)
        if locked:
            label(p, "Протокол утверждён; изменения недоступны.", 10, color=COL["muted"]).pack(anchor="w", pady=(10, 0))
            return
        btns = tk.Frame(p, bg=COL["panel"])
        btns.pack(anchor="w", pady=(14, 0))
        ttk.Button(btns, text="Сохранить", command=self.save).pack(side="left")
        ttk.Button(btns, text="Утвердить протокол", style="Accent.TButton", command=self.approve).pack(side="left", padx=8)

    def collect(self):
        d = self.data
        for qid, var in self.open_vars.items():
            d["open_scores"][qid] = None if var.get() < 0 else var.get()
        d["blocking"] = [qid for qid, v in self.block_vars.items() if v.get()]
        if d.get("defense"):
            d["defense"]["works"] = [e.get().strip() for e in self.def_works]
            d["defense"]["scores"] = [[None if not self.def_vars[q][w].get() else int(self.def_vars[q][w].get())
                                       for q in range(10)] for w in range(3)]
        for key, (v, e) in self.other.items():
            d[key] = {"result": v.get(), "comment": e.get().strip()}
        if hasattr(self, "v_dec"):
            d["decision"] = self.v_dec.get()
            d["date"] = self.e_date.get().strip()
            d["repeat_date"] = self.e_repeat.get().strip()
            d["commission"] = self.e_comm.get().strip()
            d["remarks"] = get_text(self.t_rem)
            d["needs"] = [e.get().strip() for e in self.e_needs]

    def refresh_summary(self):
        if not hasattr(self, "summary_box"):
            return
        self.collect()
        clear(self.summary_box)
        for name, mx, got, res in L.parts_summary(self.data):
            row = tk.Frame(self.summary_box, bg=COL["panel"])
            row.pack(fill="x")
            label(row, name, 10, width=30).pack(side="left")
            label(row, f"{got} из {mx}" if mx != "—" else "", 10, width=12).pack(side="left")
            kind = {L.PART_PASSED: "ok", L.PART_FAILED: "bad", L.PART_NA: "info"}.get(res, "warn")
            badge(row, res, kind).pack(side="left")
        row = tk.Frame(self.summary_box, bg=COL["panel"])
        row.pack(fill="x", pady=(6, 0))
        ok = L.blocking_answered(self.data)
        label(row, "Блокирующие вопросы отвечены:", 10, width=30).pack(side="left")
        badge(row, "да" if ok else "нет", "ok" if ok else "bad").pack(side="left")
        passed = L.exam_passed(self.data)
        label(self.summary_box, "Все части сданы — можно присваивать уровень (при выполнении остальных условий раздела 4.1)."
              if passed else "Не все части сданы или оценены.", 10, True,
              color=COL["ok"] if passed else COL["muted"]).pack(anchor="w", pady=(6, 0))

    def validate(self):
        for e, title in ((self.e_date, "Дата аттестации"), (self.e_repeat, "Повторная аттестация")):
            if e.get().strip() and L.parse_date(e.get().strip()) is None:
                messagebox.showwarning("Протокол", f"{title}: формат даты ГГГГ-ММ-ДД.")
                return False
        return True

    def save(self):
        if not self.validate():
            return
        self.collect()
        status = self.attempt["status"]
        if status == D.ST_INTERRUPTED and self.data.get("open_done"):
            status = D.ST_REVIEW
        self.db.update_attempt(self.attempt["id"], data=self.data, status=status)
        messagebox.showinfo("Протокол", "Сохранено.")

    def approve(self):
        if not self.validate():
            return
        self.collect()
        d = self.data
        if not L.open_result(d)["graded"]:
            messagebox.showwarning("Протокол", "Оцените все вопросы открытой части.")
            return
        dr = L.defense_result(d)
        if dr and not dr["graded"]:
            messagebox.showwarning("Протокол", "Оцените защиту всех трёх работ.")
            return
        if not d["practical"]["result"] or not d["documentation"]["result"]:
            messagebox.showwarning("Протокол", "Укажите результат практического задания и оформления документации.")
            return
        if not d["decision"]:
            messagebox.showwarning("Протокол", "Выберите решение комиссии.")
            return
        promote = d["decision"].startswith("Присвоить")
        if promote and not L.exam_passed(d):
            if not messagebox.askyesno("Протокол", "Не все части аттестации сданы, но выбрано решение о присвоении "
                                                   "уровня. Утвердить всё равно?"):
                return
        msg = "Утвердить протокол? После этого изменения будут недоступны."
        if promote:
            msg += f"\n\nСотруднику будет присвоен уровень У{self.cfg['to']} с датой {d['date'] or D.today()}."
        if not messagebox.askyesno("Протокол", msg):
            return
        self.db.update_attempt(self.attempt["id"], data=d, status=D.ST_DONE)
        emp = dict(self.emp)
        if promote:
            emp["level"] = self.cfg["to"]
            emp["level_date"] = d["date"] or D.today()
            if "должность инженера" in d["decision"]:
                emp["position"] = "Инженер"
        if d.get("repeat_date"):
            emp["next_attestation"] = d["repeat_date"]
        self.db.save_employee(emp)
        self.app.navigate("review", attempt_id=self.attempt["id"])

    def print_protocol(self):
        if self.attempt["status"] != D.ST_DONE:
            self.collect()
        a = dict(self.attempt)
        a["data"] = self.data
        save_html(self.master, report.protocol_html(a, self.emp),
                  f"Протокол — {self.emp['full_name']} — {C.transition_title(a['transition']).replace(' → ', '-')}.html")


# ====================== банк вопросов ======================

class BankScreen:
    def __init__(self, master, app):
        page_header(master, "Банк вопросов", "Просмотр вопросов с ключами и эталонными ответами "
                    "(экземпляр комиссии). Аттестуемым ключи не показываются.")
        nb = ttk.Notebook(master)
        nb.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        f = tk.Frame(nb, bg=COL["panel"], padx=12, pady=12)
        nb.add(f, text=f"Закрытые ({len(C.CLOSED)})")
        box, tree = make_tree(f, [("n", "№", 50, False), ("t", "Тема", 220, False), ("q", "Вопрос", 560, True),
                                  ("k", "Ключ", 60, False)], height=14)
        box.pack(fill="both", expand=True)
        for q in C.CLOSED.values():
            tree.insert("", "end", iid=q["id"], values=(q["num"], f"{q['topic']} {q['topic_title']}", q["text"],
                                                         "абв"[q["answer"]]))
        detail = text_area(f, height=6, readonly=True)
        detail.pack(fill="x", pady=(8, 0))

        def show_closed(_=None):
            sel = tree.selection()
            if sel:
                q = C.CLOSED[sel[0]]
                text = q["text"] + "\n" + "\n".join(
                    f"{'абв'[i]}) {o}{'   ✔' if i == q['answer'] else ''}" for i, o in enumerate(q["options"]))
                set_text(detail, text)

        tree.bind("<<TreeviewSelect>>", show_closed)

        for key, title in C.OPEN_SET_TITLES.items():
            f = tk.Frame(nb, bg=COL["panel"], padx=12, pady=12)
            nb.add(f, text=title.replace("Аттестационный опросник ", "Опросник ").split(" (")[0][:34])
            box, tr = make_tree(f, [("n", "№", 50, False), ("q", "Вопрос", 800, True)], height=12)
            box.pack(fill="both", expand=True)
            for q in C.OPEN_SETS[key]:
                mark = "  [блокирующий]" if q["id"] in C.DEFAULT_BLOCKING else ""
                tr.insert("", "end", iid=q["id"], values=(q["num"], q["text"] + mark))
            det = text_area(f, height=7, readonly=True)
            det.pack(fill="x", pady=(8, 0))
            tr.bind("<<TreeviewSelect>>", lambda e, t=tr, d=det: t.selection() and set_text(
                d, "Эталонный ответ:\n" + C.OPEN[t.selection()[0]]["reference"]))


# ====================== настройки ======================

class SettingsScreen:
    def __init__(self, master, app):
        self.app = app
        page_header(master, "Настройки")
        o, p = panel(master, 20)
        o.pack(fill="x", padx=24, pady=6)
        label(p, "Пароль комиссии", 13, True).pack(anchor="w", pady=(0, 6))
        g = tk.Frame(p, bg=COL["panel"])
        g.pack(anchor="w")
        entries = []
        for i, t in enumerate(("Текущий пароль", "Новый пароль", "Повторите новый пароль")):
            label(g, t, 10).grid(row=i, column=0, sticky="w")
            e = ttk.Entry(g, show="•", width=30)
            e.grid(row=i, column=1, padx=8, pady=3)
            entries.append(e)

        def change():
            cur, new, rep = (e.get() for e in entries)
            if not app.db.check_password(cur):
                messagebox.showerror("Пароль", "Текущий пароль неверен.")
            elif len(new) < 4:
                messagebox.showwarning("Пароль", "Новый пароль должен содержать не менее 4 символов.")
            elif new != rep:
                messagebox.showwarning("Пароль", "Пароли не совпадают.")
            else:
                app.db.set_password(new)
                for e in entries:
                    e.delete(0, "end")
                messagebox.showinfo("Пароль", "Пароль изменён.")

        ttk.Button(p, text="Сменить пароль", command=change).pack(anchor="w", pady=(10, 0))

        o, p = panel(master, 20)
        o.pack(fill="x", padx=24, pady=6)
        label(p, "Данные", 13, True).pack(anchor="w", pady=(0, 6))
        label(p, f"Файл базы данных: {app.db.path}", 10, wrap=1000).pack(anchor="w")
        label(p, "Чтобы работать с общей базой с нескольких компьютеров по очереди, задайте путь к файлу в "
                 "переменной окружения ATTESTATION_DB.", 9, color=COL["muted"], wrap=1000).pack(anchor="w", pady=(2, 8))

        def backup():
            path = filedialog.asksaveasfilename(defaultextension=".db",
                                                initialfile=f"attestation-backup-{D.today()}.db",
                                                filetypes=[("База данных", "*.db")])
            if path:
                app.db.backup(path)
                messagebox.showinfo("Резервная копия", f"Сохранено: {path}")

        ttk.Button(p, text="Сделать резервную копию", command=backup).pack(anchor="w")

        o, p = panel(master, 20)
        o.pack(fill="x", padx=24, pady=6)
        label(p, "Содержание", 13, True).pack(anchor="w", pady=(0, 6))
        label(p, f"Закрытых вопросов: {len(C.CLOSED)} · открытых вопросов: {len(C.OPEN)} · глав материалов: "
                 f"{len(C.MATERIALS)}.\nИсточник — документ «Система обучения, уровней и аттестации персонала». "
                 "При обновлении документа банк пересобирается скриптом tools/extract_docx.py.", 10,
              wrap=1000).pack(anchor="w")
