"""Печатные формы: протокол аттестации с бланком ответов и карта уровня сотрудника (HTML)."""
from html import escape

from . import content as C
from . import logic as L

LETTERS = "абвгде"

STYLE = """
body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 2cm; color: #000; }
h1 { font-size: 15pt; text-align: center; margin: 0 0 4pt; }
h2 { font-size: 13pt; margin: 16pt 0 6pt; }
.sub { text-align: center; margin-bottom: 14pt; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; }
th, td { border: 1px solid #000; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { background: #eee; }
.ok { color: #1a7f37; } .bad { color: #cf222e; }
.sign { margin-top: 18pt; line-height: 2; }
@media print { body { margin: 0; } }
"""


def _page(title, body):
    return (f"<!doctype html><html lang='ru'><head><meta charset='utf-8'><title>{escape(title)}</title>"
            f"<style>{STYLE}</style></head><body>{body}</body></html>")


def _v(value):
    return escape(str(value)) if value not in (None, "") else "________"


def protocol_html(attempt, employee):
    data = attempt["data"]
    cfg = C.TRANSITIONS[attempt["transition"]]
    h = ["<h1>Протокол аттестационной комиссии</h1>",
         "<div class='sub'>Служба по ремонту медицинского оборудования</div>",
         f"<p>Ф. И. О. аттестуемого: <b>{_v(employee['full_name'] if employee else '')}</b></p>",
         f"<p>Текущий уровень: У{cfg['from']} &nbsp;&nbsp; Аттестация на уровень: У{cfg['to']} &nbsp;&nbsp; "
         f"Дата: {_v(data.get('date') or attempt['started'][:10])}</p>",
         "<table><tr><th>Часть аттестации</th><th>Максимум</th><th>Набрано</th><th>Результат</th></tr>"]
    for name, mx, got, res in L.parts_summary(data):
        h.append(f"<tr><td>{name}</td><td>{mx}</td><td>{got}</td><td>{escape(res)}</td></tr>")
    h.append("</table>")
    h.append(f"<p>Блокирующие вопросы отвечены: <b>{'да' if L.blocking_answered(data) else 'нет'}</b></p>")
    for key, title in (("practical", "Практическое задание"), ("documentation", "Оформление документации")):
        if data[key]["comment"]:
            h.append(f"<p><b>{title}:</b> {escape(data[key]['comment'])}</p>")
    h.append(f"<p><b>Замечания комиссии:</b> {escape(data.get('remarks') or '')}</p>")
    decision = data.get("decision") or "________"
    if data.get("repeat_date"):
        decision += f" (повторная аттестация: {data['repeat_date']})"
    h.append(f"<p><b>Решение:</b> {escape(decision)}</p>")
    h.append("<p><b>Что необходимо для перехода (не более трёх позиций):</b></p><ol>")
    for item in data.get("needs", []):
        h.append(f"<li>{_v(item)}</li>")
    h.append("</ol>")
    members = data.get("commission") or ""
    h.append(f"<div class='sign'>Состав комиссии: {escape(members)}<br>"
             "Председатель комиссии ______________ / ______________<br>"
             "Члены комиссии ______________ / ______________ &nbsp; ______________ / ______________<br>"
             "С результатом ознакомлен ______________ / ______________</div>")

    # Бланк ответов
    h.append("<h2 style='page-break-before: always'>Бланк ответов</h2>")
    if data["closed"]:
        h.append("<p><b>Закрытая часть</b></p><table><tr><th>№</th><th>Вопрос банка</th>"
                 "<th>Ответ аттестуемого</th><th>Ключ</th><th></th></tr>")
        for i, item in enumerate(data["closed"], 1):
            q = C.CLOSED[item["id"]]
            ans = data["closed_answers"].get(item["id"])
            ok = ans == q["answer"]
            given = f"{LETTERS[ans]}) {escape(q['options'][ans])}" if ans is not None else "нет ответа"
            h.append(f"<tr><td>{i}</td><td>№ {q['num']}. {escape(q['text'])}</td><td>{given}</td>"
                     f"<td>{LETTERS[q['answer']]}</td><td class='{'ok' if ok else 'bad'}'>{'+' if ok else '−'}</td></tr>")
        h.append("</table><p>Буквы вариантов указаны по банку вопросов (на экране варианты перемешивались).</p>")
    h.append("<p><b>Открытая часть</b></p><table><tr><th>№</th><th>Вопрос</th><th>Ответ аттестуемого</th>"
             "<th>Балл</th></tr>")
    for i, qid in enumerate(data["open"], 1):
        q = C.OPEN[qid]
        mark = " <i>(блокирующий)</i>" if qid in data.get("blocking", []) else ""
        score = data["open_scores"].get(qid)
        h.append(f"<tr><td>{i}</td><td>{escape(q['text'])}{mark}</td>"
                 f"<td>{escape(data['open_answers'].get(qid, '')) or '—'}</td><td>{'' if score is None else score}</td></tr>")
    h.append("</table>")
    d = data.get("defense")
    if d:
        h.append("<p><b>Защита работ из журнала</b></p><table><tr><th>Вопрос опроса</th>")
        for w in d["works"]:
            h.append(f"<th>{_v(w)}</th>")
        h.append("</tr>")
        for qi, qtext in enumerate(C.SURVEY_QUESTIONS):
            h.append(f"<tr><td>{qi + 1}. {escape(qtext)}</td>")
            for work in d["scores"]:
                h.append(f"<td>{'' if work[qi] is None else work[qi]}</td>")
            h.append("</tr>")
        h.append("</table>")
    return _page("Протокол аттестации", "".join(h))


def level_card_html(emp, comps, factors):
    transition = C.next_transition(emp["level"])
    target = C.TRANSITIONS[transition]["to"] if transition else None
    h = ["<h1>Карта уровня сотрудника</h1>",
         "<div class='sub'>Служба по ремонту медицинского оборудования</div>",
         f"<p>Ф. И. О.: <b>{_v(emp['full_name'])}</b> &nbsp;&nbsp; Должность: {_v(emp['position'])}</p>"]
    months = ""
    start = L.parse_date(emp.get("level_date"))
    if start:
        from datetime import date
        months = L.months_between(start, date.today())
    h.append(f"<p>Текущий уровень: <b>У{emp['level']}</b> ({C.LEVEL_NAMES[emp['level']]}) &nbsp;&nbsp; "
             f"Присвоен: {_v(emp.get('level_date'))} &nbsp;&nbsp; Стаж на уровне: {_v(months)} мес.</p>")
    req_title = f"требуется для У{target}" if target and target >= 2 else "требуется"
    h.append(f"<p><b>Матрица компетенций (факт / {req_title}):</b></p>")
    h.append("<table><tr><th>Код</th><th>Компетенция</th><th>Факт</th><th>Требуется</th><th>Разрыв</th></tr>")
    for r in L.matrix_rows(comps, target if target and target >= 2 else None):
        req = "—" if r["req"] is None else r["req"]
        gap = "—" if r["gap"] is None else r["gap"]
        h.append(f"<tr><td>{r['code']}</td><td>{escape(r['short'])}</td><td>{r['fact']}</td><td>{req}</td><td>{gap}</td></tr>")
    h.append("</table>")
    h.append(f"<p><b>Допуски по группам оборудования:</b> {_v(emp.get('admissions'))}</p>")
    active = L.active_blocking(factors)
    if active:
        h.append("<p><b>Действующие блокирующие факторы:</b></p><ul>")
        for f in active:
            h.append(f"<li>{escape(f['date'])} — {escape(f['description'])}</li>")
        h.append("</ul>")
    nxt = f"У{target}" if target is not None else "—"
    h.append(f"<p><b>Что нужно для перехода на {nxt} (заполняет комиссия, не более 3 позиций):</b></p>"
             "<ol><li>________</li><li>________</li><li>________</li></ol>")
    h.append(f"<p><b>Срок следующей аттестации:</b> {_v(emp.get('next_attestation'))}</p>")
    h.append("<div class='sign'>Подписи: сотрудник ____________ / руководитель службы ____________</div>")
    return _page("Карта уровня сотрудника", "".join(h))
