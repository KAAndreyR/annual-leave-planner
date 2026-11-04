// Отметка дней мышью, касанием и с клавиатуры.
'use strict';

// ---------- Редактирование ----------
function snapshot() { return { sel: S.sel.slice(), notes: Object.assign({}, S.notes) }; }
function commit(before, keepExample) {
  undo.push(before); if (undo.length > 80) undo.shift();
  if (!keepExample) S.example = false;
  S.notes = cleanNotes(S.notes, S.sel);
  touched(); render();
}
function doUndo() {
  const u = undo.pop();
  if (!u) { toast('Отменять нечего'); return; }
  S.sel = u.sel; S.notes = u.notes; S.example = false;
  touched(); render();
}
function actionFor(i) { if (brush === 0) return 0; return S.sel[i] === brush ? 0 : brush; }
function applyRange(arr, a, b, action) { const lo = Math.min(a, b), hi = Math.max(a, b); for (let i = lo; i <= hi; i++) if (action === 3 ? DAYS[i].work : !DAYS[i].hol) arr[i] = action; }
function sameSel(a, b) { for (let i = 0; i < N; i++) if (a[i] !== b[i]) return false; return true; }
function holidayToast(i) { const D = DAYS[i]; toast(`${dLabel(i)} — ${D.hol}. Праздники в отпуск не входят (ст. 120 ТК).`); }
function handleTap(i) {
  const before = snapshot(); applyRange(S.sel, i, i, actionFor(i));
  if (sameSel(before.sel, S.sel)) { if (DAYS[i].hol) holidayToast(i); return; }
  commit(before); lastClick = i;
}
let drag = null, touch = null;
monthsEl.addEventListener('pointerdown', e => {
  const c = e.target.closest('.day'); if (!c) return;
  const i = +c.dataset.i;
  if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
    if (e.button !== 0) return;
    e.preventDefault();
    const shift = e.shiftKey;
    const anchor = shift && lastClick != null ? lastClick : i;
    const before = snapshot();
    // Shift + клик всегда закрашивает текущей кистью: первый — сам день, следующий — диапазон от него
    drag = { anchor, cur: i, action: shift ? brush : actionFor(anchor), before };
    S.sel = before.sel.slice(); applyRange(S.sel, anchor, i, drag.action);
    render();
  } else {
    touch = { i, x: e.clientX, y: e.clientY };
  }
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const c = el && el.closest ? el.closest('.day') : null; if (!c) return;
  const j = +c.dataset.i; if (j === drag.cur) return;
  drag.cur = j;
  S.sel = drag.before.sel.slice(); applyRange(S.sel, drag.anchor, j, drag.action);
  render();
});
document.addEventListener('pointerup', e => {
  if (drag) {
    const d = drag; drag = null;
    lastClick = d.cur;
    if (sameSel(d.before.sel, S.sel)) { if (d.anchor === d.cur && DAYS[d.cur].hol) holidayToast(d.cur); render(); return; }
    commit(d.before); return;
  }
  if (touch) {
    const t = touch; touch = null;
    const c = e.target && e.target.closest ? e.target.closest('.day') : null;
    if (c && +c.dataset.i === t.i && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 12) handleTap(t.i);
  }
});
document.addEventListener('pointercancel', () => { if (drag) { S.sel = drag.before.sel; drag = null; render(); } touch = null; });
monthsEl.addEventListener('click', e => { if (e.detail !== 0) return; const c = e.target.closest('.day'); if (c) handleTap(+c.dataset.i); });

function setBrush(b) {
  brush = b;
  document.querySelectorAll('[data-brush]').forEach(el => el.setAttribute('aria-checked', String(+el.dataset.brush === b)));
}
function clearAll() {
  const before = snapshot();
  S.sel = new Uint8Array(N); S.notes = {}; lastClick = null;
  commit(before);
  toast('Календарь очищен', { label: 'Вернуть', fn: doUndo });
}
