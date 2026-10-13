"""Главное окно: вход, боковое меню, переключение экранов."""
import tkinter as tk
from tkinter import messagebox, ttk

from .. import content as C
from .base import COL, FONT, clear, label, panel, setup_styles

APP_TITLE = "Система обучения и аттестации персонала"


class App:
    def __init__(self, root, db):
        self.root = root
        self.db = db
        self.role = None          # "employee" | "guest" | "commission"
        self.employee = None      # dict сотрудника при входе сотрудником
        self.exam_active = False
        self.nav_buttons = {}
        root.title(f"{APP_TITLE} — служба по ремонту медицинского оборудования")
        root.geometry("1280x820")
        root.minsize(1024, 660)
        setup_styles(root)
        self.sidebar = tk.Frame(root, bg=COL["sidebar"], width=240)
        self.sidebar.pack_propagate(False)
        self.main = tk.Frame(root, bg=COL["bg"])
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.show_login()

    # ---------- вход ----------
    def show_login(self):
        self.role = None
        self.employee = None
        self.sidebar.pack_forget()
        self.main.pack(side="left", fill="both", expand=True)
        clear(self.main)
        wrap = tk.Frame(self.main, bg=COL["bg"])
        wrap.place(relx=0.5, rely=0.45, anchor="center")
        label(wrap, APP_TITLE, 22, True, bg=COL["bg"]).pack()
        label(wrap, "Служба по ремонту медицинского оборудования · единая шкала уровней У0—У5", 11,
              color=COL["muted"], bg=COL["bg"]).pack(pady=(4, 24))
        row = tk.Frame(wrap, bg=COL["bg"])
        row.pack()

        # сотрудник
        outer, p = panel(row, 24)
        outer.pack(side="left", padx=12, fill="y")
        label(p, "Сотрудник / ученик", 14, True).pack(anchor="w")
        label(p, "Учебные материалы, тренировка, пробная\nаттестация и ваш путь по уровням.", 10,
              color=COL["muted"]).pack(anchor="w", pady=(4, 14))
        employees = self.db.employees()
        names = [e["full_name"] for e in employees]
        var = tk.StringVar()
        combo = ttk.Combobox(p, textvariable=var, values=names, state="readonly", width=34, font=(FONT, 11))
        combo.pack(anchor="w")
        if not names:
            label(p, "Список сотрудников пуст — его заполняет комиссия.\nМожно войти как гость.", 9,
                  color=COL["muted"]).pack(anchor="w", pady=(6, 0))

        def enter_employee():
            if not var.get():
                messagebox.showinfo(APP_TITLE, "Выберите себя в списке или войдите как гость.")
                return
            self.employee = employees[names.index(var.get())]
            self.role = "employee"
            self.open_workspace()

        def enter_guest():
            self.role = "guest"
            self.open_workspace()

        btns = tk.Frame(p, bg=COL["panel"])
        btns.pack(anchor="w", pady=(16, 0))
        ttk.Button(btns, text="Войти", style="Accent.TButton", command=enter_employee).pack(side="left")
        ttk.Button(btns, text="Войти как гость", command=enter_guest).pack(side="left", padx=8)

        # комиссия
        outer, p = panel(row, 24)
        outer.pack(side="left", padx=12, fill="y")
        label(p, "Комиссия / наставник", 14, True).pack(anchor="w")
        label(p, "Сотрудники, журнал опросов, матрица компетенций,\nпроведение и проверка аттестаций, протоколы.",
              10, color=COL["muted"]).pack(anchor="w", pady=(4, 14))
        pw1 = ttk.Entry(p, show="•", width=34, font=(FONT, 11))
        pw1.pack(anchor="w")
        first_run = not self.db.has_password()
        pw2 = None
        if first_run:
            label(p, "Первый запуск: задайте пароль комиссии и повторите его.", 9, color=COL["warn"]).pack(anchor="w", pady=(6, 4))
            pw2 = ttk.Entry(p, show="•", width=34, font=(FONT, 11))
            pw2.pack(anchor="w")

        def enter_commission(_=None):
            if first_run:
                if len(pw1.get()) < 4:
                    messagebox.showwarning(APP_TITLE, "Пароль должен содержать не менее 4 символов.")
                    return
                if pw1.get() != pw2.get():
                    messagebox.showwarning(APP_TITLE, "Пароли не совпадают.")
                    return
                self.db.set_password(pw1.get())
            elif not self.db.check_password(pw1.get()):
                messagebox.showerror(APP_TITLE, "Неверный пароль.")
                return
            self.role = "commission"
            self.open_workspace()

        pw1.bind("<Return>", enter_commission)
        ttk.Button(p, text="Войти", style="Accent.TButton", command=enter_commission).pack(anchor="w", pady=(16, 0))

    # ---------- рабочая область ----------
    def nav_items(self):
        if self.role == "commission":
            return [("employees", "Сотрудники"), ("attempts", "Аттестации"), ("materials", "Учебные материалы"),
                    ("bank", "Банк вопросов"), ("settings", "Настройки")]
        items = [("path", "Мой путь")] if self.role == "employee" else []
        return items + [("materials", "Учебные материалы"), ("quiz", "Тест по темам"),
                        ("cards", "Открытые вопросы"), ("trial", "Пробная аттестация")]

    def open_workspace(self):
        self.main.pack_forget()
        clear(self.sidebar)
        self.sidebar.pack(side="left", fill="y")
        self.main.pack(side="left", fill="both", expand=True)
        label(self.sidebar, "Обучение\nи аттестация", 15, True, color="white", bg=COL["sidebar"]).pack(
            anchor="w", padx=20, pady=(22, 4))
        who = {"commission": "Комиссия / наставник", "guest": "Гость"}.get(self.role)
        if self.role == "employee":
            who = f"{self.employee['full_name']}\nУровень У{self.employee['level']}"
        label(self.sidebar, who, 9, color="#9fb0c2", bg=COL["sidebar"], wrap=200).pack(anchor="w", padx=20, pady=(0, 18))
        self.nav_buttons = {}
        for key, title in self.nav_items():
            b = tk.Label(self.sidebar, text="   " + title, anchor="w", font=(FONT, 11), fg=COL["sidebar_text"],
                         bg=COL["sidebar"], padx=10, pady=9, cursor="hand2")
            b.pack(fill="x")
            b.bind("<Button-1>", lambda e, k=key: self.navigate(k))
            b.bind("<Enter>", lambda e, w=b, k=key: self.current != k and w.configure(bg=COL["sidebar_hover"]))
            b.bind("<Leave>", lambda e, w=b, k=key: w.configure(bg=COL["accent"] if self.current == k else COL["sidebar"]))
            self.nav_buttons[key] = b
        exit_btn = tk.Label(self.sidebar, text="   Выйти", anchor="w", font=(FONT, 10), fg="#9fb0c2",
                            bg=COL["sidebar"], padx=10, pady=8, cursor="hand2")
        exit_btn.pack(side="bottom", fill="x", pady=12)
        exit_btn.bind("<Button-1>", lambda e: self.show_login())
        self.current = None
        self.navigate(self.nav_items()[0][0])

    def refresh_employee(self):
        if self.employee:
            self.employee = self.db.employee(self.employee["id"])

    def navigate(self, key, **kwargs):
        from . import commission, materials, training
        self.current = key
        for k, b in self.nav_buttons.items():
            b.configure(bg=COL["accent"] if k == key else COL["sidebar"], fg="white" if k == key else COL["sidebar_text"])
        clear(self.main)
        screens = {
            "path": training.PathScreen,
            "materials": materials.MaterialsScreen,
            "quiz": training.QuizScreen,
            "cards": training.CardsScreen,
            "trial": training.TrialScreen,
            "employees": commission.EmployeesScreen,
            "employee": commission.EmployeeScreen,
            "attempts": commission.AttemptsScreen,
            "review": commission.ReviewScreen,
            "bank": commission.BankScreen,
            "settings": commission.SettingsScreen,
        }
        screens[key](self.main, self, **kwargs)

    # ---------- официальная аттестация ----------
    def start_official_exam(self, attempt_id):
        """Аттестуемый работает в отдельном режиме без меню; по завершении — возврат ко входу."""
        from .exam import ExamRunner
        self.exam_active = True
        self.sidebar.pack_forget()
        clear(self.main)
        attempt = self.db.attempt(attempt_id)
        emp = self.db.employee(attempt["employee_id"])

        def done():
            self.exam_active = False
            messagebox.showinfo(APP_TITLE, "Аттестация завершена. Ответы переданы комиссии на проверку.\n"
                                           "Пригласите члена комиссии.")
            self.show_login()

        ExamRunner(self.main, self, attempt, official=True, employee=emp, on_finish=done)

    def on_close(self):
        if self.exam_active:
            if not messagebox.askyesno(APP_TITLE, "Идёт аттестация. Закрыть приложение? Попытка будет отмечена как прерванная."):
                return
        self.db.close()
        self.root.destroy()


def level_title(level):
    return f"У{level} — {C.LEVEL_NAMES[level]}"
