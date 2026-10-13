"""Общие элементы интерфейса: стили, прокручиваемые области, вывод форматированного текста."""
import sys
import tkinter as tk
from tkinter import ttk

FONT = "Segoe UI" if sys.platform == "win32" else "DejaVu Sans"

COL = {
    "bg": "#f4f6f8",
    "panel": "#ffffff",
    "border": "#d0d7de",
    "text": "#1f2328",
    "muted": "#57606a",
    "accent": "#1f6feb",
    "accent_dark": "#1858c4",
    "ok": "#1a7f37",
    "ok_bg": "#dafbe1",
    "bad": "#cf222e",
    "bad_bg": "#ffebe9",
    "warn": "#9a6700",
    "warn_bg": "#fff8c5",
    "sidebar": "#1c2733",
    "sidebar_hover": "#2b3a4a",
    "sidebar_text": "#e6edf3",
    "sel": "#ddf4ff",
}


def setup_styles(root):
    root.configure(bg=COL["bg"])
    root.option_add("*Font", (FONT, 10))
    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure(".", font=(FONT, 10), background=COL["bg"], foreground=COL["text"])
    style.configure("TFrame", background=COL["bg"])
    style.configure("Panel.TFrame", background=COL["panel"])
    style.configure("TLabel", background=COL["bg"])
    style.configure("Panel.TLabel", background=COL["panel"])
    style.configure("Muted.TLabel", foreground=COL["muted"])
    style.configure("PanelMuted.TLabel", background=COL["panel"], foreground=COL["muted"])
    style.configure("Title.TLabel", font=(FONT, 18, "bold"))
    style.configure("H2.TLabel", font=(FONT, 13, "bold"))
    style.configure("PanelH2.TLabel", font=(FONT, 13, "bold"), background=COL["panel"])
    style.configure("Big.TLabel", font=(FONT, 12), background=COL["panel"])
    style.configure("Ok.TLabel", foreground=COL["ok"], background=COL["panel"], font=(FONT, 10, "bold"))
    style.configure("Bad.TLabel", foreground=COL["bad"], background=COL["panel"], font=(FONT, 10, "bold"))
    style.configure("Warn.TLabel", foreground=COL["warn"], background=COL["panel"], font=(FONT, 10, "bold"))
    style.configure("Timer.TLabel", font=(FONT, 14, "bold"), foreground=COL["accent_dark"])
    style.configure("TButton", padding=(12, 6))
    style.configure("Accent.TButton", background=COL["accent"], foreground="white", padding=(14, 7),
                    font=(FONT, 10, "bold"), bordercolor=COL["accent_dark"])
    style.map("Accent.TButton", background=[("active", COL["accent_dark"]), ("disabled", "#8cb4f5")])
    style.configure("Danger.TButton", foreground=COL["bad"])
    style.configure("TCheckbutton", background=COL["panel"])
    style.configure("TRadiobutton", background=COL["panel"])
    style.configure("Option.TRadiobutton", background=COL["panel"], font=(FONT, 11), padding=6)
    style.configure("TLabelframe", background=COL["panel"])
    style.configure("TLabelframe.Label", background=COL["panel"], font=(FONT, 10, "bold"))
    style.configure("Treeview", rowheight=26, font=(FONT, 10))
    style.configure("Treeview.Heading", font=(FONT, 10, "bold"))
    style.configure("TNotebook", background=COL["bg"])
    style.configure("TNotebook.Tab", padding=(12, 5))
    style.configure("Horizontal.TProgressbar", background=COL["accent"])


def clear(frame):
    for child in frame.winfo_children():
        child.destroy()


class ScrollFrame(ttk.Frame):
    """Вертикально прокручиваемая область; содержимое кладётся в .inner."""

    def __init__(self, master, bg=None, **kw):
        super().__init__(master, **kw)
        bg = bg or COL["bg"]
        self.canvas = tk.Canvas(self, bg=bg, highlightthickness=0, bd=0)
        self.vbar = ttk.Scrollbar(self, orient="vertical", command=self.canvas.yview)
        self.inner = tk.Frame(self.canvas, bg=bg)
        self._win = self.canvas.create_window((0, 0), window=self.inner, anchor="nw")
        self.canvas.configure(yscrollcommand=self.vbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.vbar.pack(side="right", fill="y")
        self.inner.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfigure(self._win, width=e.width))
        self.bind("<Enter>", self._bind_wheel)
        self.bind("<Leave>", self._unbind_wheel)

    def _bind_wheel(self, _):
        self.bind_all("<MouseWheel>", self._on_wheel)
        self.bind_all("<Button-4>", lambda e: self.canvas.yview_scroll(-3, "units"))
        self.bind_all("<Button-5>", lambda e: self.canvas.yview_scroll(3, "units"))

    def _unbind_wheel(self, _):
        self.unbind_all("<MouseWheel>")
        self.unbind_all("<Button-4>")
        self.unbind_all("<Button-5>")

    def _on_wheel(self, event):
        if self.inner.winfo_height() > self.canvas.winfo_height():
            self.canvas.yview_scroll(int(-event.delta / 120) or (-1 if event.delta > 0 else 1), "units")

    def to_top(self):
        self.canvas.yview_moveto(0)


def panel(master, padding=16, **pack):
    """Белая карточка с рамкой."""
    outer = tk.Frame(master, bg=COL["border"])
    inner = tk.Frame(outer, bg=COL["panel"], padx=padding, pady=padding)
    inner.pack(fill="both", expand=True, padx=1, pady=1)
    if pack:
        outer.pack(**pack)
    return outer, inner


class WrapLabel(tk.Label):
    """Метка, перенос строк которой следует за фактической шириной (растягивается по горизонтали)."""

    def __init__(self, master, **kw):
        super().__init__(master, **kw)
        self.bind("<Configure>", self._rewrap)

    def _rewrap(self, event):
        # Если контейнер выделил ровно запрошенную ширину, значит его размер задаёт сама метка —
        # сужение перенесло бы строки ещё уже и зациклилось.
        if event.width == self.winfo_reqwidth():
            return
        width = max(event.width - 2 * int(self.cget("padx")) - 4, 60)
        if abs(width - int(self.cget("wraplength"))) > 3:
            self.configure(wraplength=width)

    def grid(self, **kw):
        # в ячейках таблиц ширина столбца зависит от содержимого — оставляем фиксированный перенос
        self.unbind("<Configure>")
        super().grid(**kw)

    def pack(self, **kw):
        kw.setdefault("fill", "x")
        if kw.get("side") in ("left", "right"):
            kw.setdefault("expand", True)
        super().pack(**kw)


def label(master, text, size=10, bold=False, color=None, bg=None, wrap=0, **kw):
    """Метка; при wrap > 0 текст переносится по ширине доступного места."""
    bg = bg if bg is not None else master.cget("bg") if isinstance(master, tk.Frame) else COL["panel"]
    cls = WrapLabel if wrap else tk.Label
    return cls(master, text=text, font=(FONT, size, "bold" if bold else "normal"),
               fg=color or COL["text"], bg=bg, wraplength=wrap, justify="left", anchor="w", **kw)


def page_header(master, title, subtitle=None):
    box = tk.Frame(master, bg=COL["bg"])
    box.pack(fill="x", padx=24, pady=(20, 8))
    label(box, title, 18, True, bg=COL["bg"]).pack(anchor="w")
    if subtitle:
        label(box, subtitle, 10, color=COL["muted"], bg=COL["bg"], wrap=900).pack(anchor="w", pady=(2, 0))
    return box


def badge(master, text, kind="ok"):
    colors = {"ok": (COL["ok"], COL["ok_bg"]), "bad": (COL["bad"], COL["bad_bg"]),
              "warn": (COL["warn"], COL["warn_bg"]), "info": (COL["accent_dark"], COL["sel"])}
    fg, bg = colors[kind]
    return tk.Label(master, text=f" {text} ", fg=fg, bg=bg, font=(FONT, 9, "bold"), padx=4, pady=1)


class RichText(tk.Text):
    """Текст только для чтения с заголовками, жирным, списками и таблицами из materials.json."""

    def __init__(self, master, **kw):
        super().__init__(master, wrap="word", bd=0, highlightthickness=0, padx=28, pady=20,
                         bg=COL["panel"], fg=COL["text"], font=(FONT, 11), cursor="arrow", spacing1=2,
                         spacing3=6, **kw)
        self.tag_configure("h1", font=(FONT, 17, "bold"), spacing1=10, spacing3=10)
        self.tag_configure("h2", font=(FONT, 14, "bold"), spacing1=14, spacing3=6, foreground=COL["accent_dark"])
        self.tag_configure("h3", font=(FONT, 12, "bold"), spacing1=10, spacing3=4)
        self.tag_configure("b", font=(FONT, 11, "bold"))
        self.tag_configure("li", lmargin1=18, lmargin2=34)
        self.tag_configure("found", background="#fff3a3")
        self._tables = []
        self.bind("<Configure>", self._resize_tables)

    def render(self, title, blocks):
        self.configure(state="normal")
        self.delete("1.0", "end")
        self._tables = []
        self.insert("end", title + "\n", "h1")
        for b in blocks:
            t = b["type"]
            if t == "h":
                self.insert("end", b["text"] + "\n", f"h{min(b['level'] + 1, 3)}")
            elif t in ("p", "li"):
                if t == "li":
                    self.insert("end", "•  ", "li")
                for text, bold in b["runs"]:
                    tags = ("b",) if bold else ()
                    if t == "li":
                        tags += ("li",)
                    self.insert("end", text, tags)
                self.insert("end", "\n", ("li",) if t == "li" else ())
            elif t == "table":
                self._insert_table(b["rows"])
        self.configure(state="disabled")

    def _insert_table(self, rows):
        frame = tk.Frame(self, bg=COL["border"])
        ncols = max(len(r) for r in rows)
        cells = []
        for i, row in enumerate(rows):
            for j in range(ncols):
                text = row[j] if j < len(row) else ""
                head = i == 0
                lab = tk.Label(frame, text=text, justify="left", anchor="nw",
                               bg="#eef2f6" if head else COL["panel"], fg=COL["text"],
                               font=(FONT, 10, "bold" if head else "normal"), padx=6, pady=4)
                lab.grid(row=i, column=j, sticky="nsew", padx=(0, 1), pady=(0, 1))
                cells.append((lab, j))
        for j in range(ncols):
            frame.grid_columnconfigure(j, weight=1)
        self.window_create("end", window=frame, padx=0, pady=6)
        self.insert("end", "\n")
        self._tables.append((frame, cells, ncols, rows))
        self.after_idle(self._resize_tables)

    def _resize_tables(self, _=None):
        width = max(self.winfo_width() - 70, 400)
        for frame, cells, ncols, rows in self._tables:
            # ширина столбца пропорциональна длине самого длинного текста в нём
            lens = [max(len(r[j]) if j < len(r) else 0 for r in rows) for j in range(ncols)]
            lens = [min(max(l, 6), 60) for l in lens]
            total = sum(lens)
            widths = [int(width * l / total) for l in lens]
            for lab, j in cells:
                lab.configure(wraplength=max(widths[j] - 14, 40))
            for j in range(ncols):
                frame.grid_columnconfigure(j, minsize=widths[j])

    def highlight(self, needle):
        self.tag_remove("found", "1.0", "end")
        if not needle:
            return None
        first = None
        start = "1.0"
        while True:
            pos = self.search(needle, start, stopindex="end", nocase=True)
            if not pos:
                break
            end = f"{pos}+{len(needle)}c"
            self.tag_add("found", pos, end)
            first = first or pos
            start = end
        if first:
            self.see(first)
        return first


def make_tree(master, columns, height=12):
    """Treeview с прокруткой. columns: [(id, заголовок, ширина, stretch)]."""
    box = ttk.Frame(master)
    tree = ttk.Treeview(box, columns=[c[0] for c in columns], show="headings", height=height, selectmode="browse")
    for cid, title, width, stretch in columns:
        tree.heading(cid, text=title, anchor="w")
        tree.column(cid, width=width, stretch=stretch, anchor="w")
    sb = ttk.Scrollbar(box, orient="vertical", command=tree.yview)
    tree.configure(yscrollcommand=sb.set)
    tree.pack(side="left", fill="both", expand=True)
    sb.pack(side="right", fill="y")
    tree.tag_configure("ok", foreground=COL["ok"])
    tree.tag_configure("bad", foreground=COL["bad"])
    tree.tag_configure("muted", foreground=COL["muted"])
    return box, tree


def text_area(master, height=6, width=80, readonly=False):
    t = tk.Text(master, height=height, width=width, wrap="word", font=(FONT, 11), bd=1, relief="solid",
                highlightthickness=1, highlightcolor=COL["accent"], highlightbackground=COL["border"],
                padx=8, pady=6)
    if readonly:
        t.configure(state="disabled", bg="#f6f8fa")
    return t


def set_text(widget, value):
    state = widget.cget("state")
    widget.configure(state="normal")
    widget.delete("1.0", "end")
    widget.insert("1.0", value or "")
    widget.configure(state=state)


def get_text(widget):
    return widget.get("1.0", "end").strip()
