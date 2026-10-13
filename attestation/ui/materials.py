"""Учебные материалы: Часть I документа и порядок аттестации, с оглавлением и поиском."""
import tkinter as tk
from tkinter import messagebox, ttk

from .. import content as C
from .base import COL, FONT, RichText, label


def _plain(block):
    if block["type"] == "h":
        return block["text"]
    if block["type"] == "table":
        return " ".join(c for row in block["rows"] for c in row)
    return "".join(t for t, _ in block["runs"])


class MaterialsScreen:
    def __init__(self, master, app):
        self.app = app
        self.current = None
        self.last_needle = None
        top = tk.Frame(master, bg=COL["bg"])
        top.pack(fill="x", padx=24, pady=(18, 8))
        label(top, "Учебные материалы", 18, True, bg=COL["bg"]).pack(side="left")
        self.search_var = tk.StringVar()
        entry = ttk.Entry(top, textvariable=self.search_var, width=34, font=(FONT, 11))
        entry.pack(side="right")
        entry.bind("<Return>", lambda e: self.search())
        ttk.Button(top, text="Найти", command=self.search).pack(side="right", padx=(0, 6))

        body = tk.Frame(master, bg=COL["bg"])
        body.pack(fill="both", expand=True, padx=24, pady=(0, 20))
        left = tk.Frame(body, bg=COL["border"])
        left.pack(side="left", fill="y")
        self.tree = ttk.Treeview(left, show="tree", selectmode="browse", height=30)
        self.tree.column("#0", width=320)
        self.tree.pack(fill="both", expand=True, padx=1, pady=1)
        for ci, ch in enumerate(C.MATERIALS):
            node = self.tree.insert("", "end", iid=f"c{ci}", text=ch["title"], open=False)
            for bi, b in enumerate(ch["blocks"]):
                if b["type"] == "h" and b["level"] == 2:
                    self.tree.insert(node, "end", iid=f"c{ci}-{bi}", text=b["text"])
        self.tree.bind("<<TreeviewSelect>>", self.on_select)

        right = tk.Frame(body, bg=COL["border"])
        right.pack(side="left", fill="both", expand=True, padx=(12, 0))
        self.text = RichText(right)
        sb = ttk.Scrollbar(right, orient="vertical", command=self.text.yview)
        self.text.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y", pady=1)
        self.text.pack(side="left", fill="both", expand=True, padx=(1, 0), pady=1)
        self.tree.selection_set("c0")

    def show_chapter(self, ci):
        if self.current != ci:
            ch = C.MATERIALS[ci]
            self.text.render(ch["title"], ch["blocks"])
            self.current = ci

    def on_select(self, _=None):
        sel = self.tree.selection()
        if not sel:
            return
        iid = sel[0]
        if "-" in iid:
            ci, bi = (int(x) for x in iid[1:].split("-"))
            self.show_chapter(ci)
            pos = self.text.search(C.MATERIALS[ci]["blocks"][bi]["text"], "1.0", stopindex="end")
            if pos:
                self.text.yview(pos)
        else:
            self.show_chapter(int(iid[1:]))
            self.text.yview("1.0")
            self.tree.item(iid, open=True)
        if self.search_var.get().strip():
            self.text.highlight(self.search_var.get().strip())

    def search(self):
        needle = self.search_var.get().strip().lower()
        if not needle:
            return
        hits = [ci for ci, ch in enumerate(C.MATERIALS) if any(needle in _plain(b).lower() for b in ch["blocks"])]
        if not hits:
            self.text.highlight("")
            messagebox.showinfo("Поиск", "Ничего не найдено.")
            return
        # первый поиск — в текущей главе; повторное «Найти» переходит к следующей главе с совпадением
        if needle != self.last_needle and self.current in hits:
            target = self.current
        else:
            cur = self.current if self.current is not None else -1
            target = next((h for h in hits if h > cur), hits[0])
        self.last_needle = needle
        self.show_chapter(target)
        self.tree.selection_set(f"c{target}")
        self.tree.see(f"c{target}")
        self.text.highlight(self.search_var.get().strip())
