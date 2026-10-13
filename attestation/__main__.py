"""Запуск: python -m attestation"""
import tkinter as tk

from .db import Database
from .ui.app import App


def main():
    root = tk.Tk()
    App(root, Database())
    root.mainloop()


if __name__ == "__main__":
    main()
