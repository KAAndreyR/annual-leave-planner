// Варианты, уведомления, привязка кнопок, пример и запуск.
'use strict';

// ---------- Варианты ----------
function variantSummary(v) {
  const sel = decodeRuns(v.runs);
  const iv = buildIntervals(sel, x => x > 0, 0);
  return iv.map(x => rangeLabel(x.s, x.e)).join(', ') || 'пусто';
}
function renderVariants() {
  const ul = $('#variants');
  $('#sumVariants').textContent = S.variants.length ? 'сохранено ' + S.variants.length : 'пока пусто';
  if (!S.variants.length) { ul.innerHTML = '<li class="empty">Пока нет сохранённых вариантов.</li>'; return; }
  ul.innerHTML = S.variants.map(v => `<li><div class="vtxt"><b>${esc(v.name)}</b><span>${esc(variantSummary(v))}</span></div><button type="button" class="btn sm" data-vopen="${esc(v.id)}">Открыть</button><button type="button" class="x" data-vdel="${esc(v.id)}" aria-label="Удалить вариант">×</button></li>`).join('');
}
function saveVariant() {
  if (!model.usedM && !model.usedE) { toast('Сначала отметьте дни отпуска'); return; }
  const names = model.main.concat(model.extra).sort((a, b) => a.s - b.s).map(iv => MON_SH[DAYS[iv.s].m]);
  const v = { id: Date.now().toString(36), name: `Вариант ${S.variants.length + 1} · ${[...new Set(names)].join(', ')}`, runs: encodeRuns(S.sel), notes: Object.assign({}, S.notes), created: Date.now() };
  S.variants.unshift(v); if (S.variants.length > 20) S.variants.pop();
  touched(); renderVariants(); toast('Вариант запомнен');
}

// ---------- Тост ----------
let toastTimer = 0;
function hideToast() { $('#toast').hidden = true; }
function toast(msg, action) {
  const t = $('#toast'); t.textContent = '';
  const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-btn'; b.textContent = action.label; b.onclick = () => { hideToast(); action.fn(); }; t.appendChild(b); }
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, action ? 6000 : 3400);
}

// ---------- Привязки ----------
function syncInputs() {
  $('#mainDays').value = S.mainDays;
  $('#extraDays').value = S.extraDays;
  $('#dayoffDays').value = S.dayoffDays;
  $('#salary').value = S.salary ? nf0.format(S.salary) : '';
  syncChips();
}
function bind() {
  const num = (id, key, min, max) => {
    const el = $('#' + id);
    el.addEventListener('input', () => { const v = parseInt(el.value, 10); if (Number.isFinite(v)) { S[key] = clamp(v, min, max); touched(); render(); } });
    el.addEventListener('blur', () => { el.value = S[key]; });
  };
  num('mainDays', 'mainDays', 0, 120); num('extraDays', 'extraDays', 0, 60); num('dayoffDays', 'dayoffDays', 0, 60);
  document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => {
    const [k, d] = b.dataset.step.split(':'); const max = k === 'mainDays' ? 120 : 60;
    S[k] = clamp(S[k] + (+d), 0, max); $('#' + k).value = S[k]; touched(); render();
  }));
  const sal = $('#salary');
  sal.addEventListener('input', () => { const v = sal.value.replace(/\D/g, ''); S.salary = v ? Math.min(+v, 1e9) : ''; touched(); render(); });
  sal.addEventListener('blur', () => { sal.value = S.salary ? nf0.format(S.salary) : ''; });

  $('#importApply').addEventListener('click', () => applyImport($('#importText').value));
  $('#importFileBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { applyImport(String(r.result || ''), 'file'); e.target.value = ''; };
    r.onerror = () => toast('Не удалось прочитать файл');
    r.readAsText(f);
  });

  document.addEventListener('click', e => {
    const res = e.target.closest('[data-res]'); if (res) { toggleIn(S.prefs.resorts, res.dataset.res); syncChips(); touched(); paint(model); return; }
    const sea = e.target.closest('[data-season]'); if (sea) { toggleIn(S.prefs.seasons, sea.dataset.season); syncChips(); touched(); paint(model); return; }
    const mon = e.target.closest('[data-month]'); if (mon) { toggleIn(S.prefs.months, +mon.dataset.month); syncChips(); touched(); paint(model); return; }
    const gl = e.target.closest('[data-goal]'); if (gl) { S.prefs.goal = gl.dataset.goal; syncChips(); touched(); return; }
    const cat = e.target.closest('[data-cat]');
    if (cat) {
      const ids = RESORTS.filter(r => r.cat === cat.dataset.cat).map(r => r.id);
      const all = ids.every(id => S.prefs.resorts.includes(id));
      S.prefs.resorts = all ? S.prefs.resorts.filter(id => !ids.includes(id)) : [...new Set(S.prefs.resorts.concat(ids))];
      syncChips(); touched(); paint(model); return;
    }
    const br = e.target.closest('[data-brush]'); if (br) { setBrush(+br.dataset.brush); return; }
    const vo = e.target.closest('[data-vopen]');
    if (vo) { const v = S.variants.find(x => x.id === vo.dataset.vopen); if (v) { const before = snapshot(); S.sel = decodeRuns(v.runs); S.notes = cleanNotes(v.notes); commit(before); toast('Открыт: ' + v.name, { label: 'Вернуть', fn: doUndo }); document.getElementById('calendar').scrollIntoView({ block: 'start' }); } return; }
    const vd = e.target.closest('[data-vdel]');
    if (vd) { const i = S.variants.findIndex(x => x.id === vd.dataset.vdel); if (i >= 0) { const [v] = S.variants.splice(i, 1); touched(); renderVariants(); toast('Вариант удалён', { label: 'Вернуть', fn: () => { S.variants.splice(i, 0, v); touched(); renderVariants(); } }); } return; }
  });
  $('#extraMode').addEventListener('change', e => { S.prefs.extraMode = e.target.value; renderGenSum(); touched(); });
  $('#janExtend').addEventListener('change', e => { S.prefs.janExtend = e.target.checked; syncChips(); touched(); paint(model); });
  $('#mainDest').addEventListener('change', e => { S.prefs.mainDest = e.target.value; syncChips(); touched(); });
  $('#clearFilters').addEventListener('click', () => { S.prefs.resorts = []; S.prefs.seasons = []; S.prefs.months = []; syncChips(); touched(); paint(model); });
  // Окно подбора. Где нет <dialog> (Firefox до 98, Safari до 15.4) — обычный слой поверх страницы
  const dlg = $('#genDialog'), native = typeof dlg.showModal === 'function';
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; backdrop.hidden = true;
  if (!native) document.body.appendChild(backdrop);
  const openGen = () => {
    if (native) { if (!dlg.open) dlg.showModal(); return; }
    dlg.setAttribute('open', ''); dlg.classList.add('modal-fallback'); backdrop.hidden = false; document.documentElement.classList.add('modal-open');
  };
  const closeGen = () => {
    if (native) { if (dlg.open) dlg.close(); return; }
    dlg.removeAttribute('open'); dlg.classList.remove('modal-fallback'); backdrop.hidden = true; document.documentElement.classList.remove('modal-open');
  };
  $('#genOpen').addEventListener('click', openGen);
  $('#genClose').addEventListener('click', closeGen);
  dlg.addEventListener('click', e => { if (e.target === dlg) closeGen(); });
  backdrop.addEventListener('click', closeGen);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !native && dlg.hasAttribute('open')) closeGen(); });
  $('#genBtn').addEventListener('click', () => { closeGen(); generate(); });
  $('#genQuick').addEventListener('click', generate);

  // Блоки внизу: интервалы и деньги открыты, остальное свёрнуто; выбор помним в этом браузере
  const FOLD_KEY = 'vacation-2027-folds-v2';
  let folds = {};
  try { folds = JSON.parse(localStorage.getItem(FOLD_KEY) || '{}') || {}; } catch (e) { folds = {}; }
  document.querySelectorAll('details.fold').forEach(d => {
    if (d.dataset.fold in folds) d.open = !!folds[d.dataset.fold];
    d.addEventListener('toggle', () => { folds[d.dataset.fold] = d.open; try { localStorage.setItem(FOLD_KEY, JSON.stringify(folds)); } catch (e) {} });
  });
  // Ссылки «Скопировать план» ведут к кнопке копирования
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="#save"]'); if (!a) return;
    e.preventDefault();
    const d = document.querySelector('details[data-fold="save"]'); if (d) d.open = true;
    const btn = $('#copyPlan');
    btn.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    btn.focus({ preventScroll: true });
    btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 1600);
  });
  $('#undoBtn').addEventListener('click', doUndo);
  $('#clearBtn').addEventListener('click', clearAll);
  $('#exampleClear').addEventListener('click', clearAll);

  document.addEventListener('change', e => {
    const s = e.target.closest('select.place'); if (!s) return;
    const a = +s.dataset.s, b = +s.dataset.e;
    for (const k in S.notes) { const i = +k; if (i >= a && i <= b) delete S.notes[k]; }
    if (s.value) { let first = a; while (first <= b && !S.sel[first]) first++; S.notes[first] = s.value; }
    touched(); render();
  });

  $('#copyPlan').addEventListener('click', () => {
    const ta = $('#planText'), text = ta.value;
    if (!text) { toast('План пуст — отметьте дни'); return; }
    const fallback = () => { ta.focus(); ta.select(); toast('Выделил строку — нажмите Ctrl+C'); };
    try { navigator.clipboard.writeText(text).then(() => toast('План скопирован'), fallback); } catch (e) { fallback(); }
  });
  $('#dlJson').addEventListener('click', () => saveFile('vacation-2027.json', JSON.stringify(serialize(), null, 2)));
  $('#dlCsv').addEventListener('click', () => {
    if (!model.main.length && !model.extra.length) { toast('План пуст — отметьте дни'); return; }
    const us = i => pad(DAYS[i].m + 1) + '/' + pad(DAYS[i].d) + '/' + YEAR;
    const q = s => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = ['Subject,Start Date,End Date,All Day Event,Description'];
    for (const iv of model.main.concat(model.extra, model.doffs).sort((a, b) => a.s - b.s)) {
      const r = resortFor(iv);
      if (iv.kind === 3) { rows.push([q('Дейофф'), us(iv.s), us(iv.e), 'True', q('')].join(',')); continue; }
      rows.push([q(iv.kind === 2 ? 'Отпуск (доп.)' : 'Отпуск'), us(iv.s), us(iv.e), 'True', q(dn(iv.vac) + ' отпуска' + (r ? ', ' + r.name : ''))].join(','));
    }
    saveFile('vacation-2027.csv', '﻿' + rows.join('\r\n'));
  });
  $('#saveVariant').addEventListener('click', saveVariant);

  const setShift = v => { if (v === shiftHeld) return; shiftHeld = v; if (lastClick != null && model) paint(model); };
  document.addEventListener('keydown', e => { if (e.key === 'Shift') setShift(true); });
  document.addEventListener('keyup', e => { if (e.key === 'Shift') setShift(false); });
  window.addEventListener('blur', () => setShift(false));
  monthsEl.addEventListener('pointermove', e => setShift(e.shiftKey));
  document.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'я' || e.code === 'KeyZ')) { e.preventDefault(); doUndo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '1') setBrush(1); else if (e.key === '2') setBrush(2); else if (e.key === '3') setBrush(3); else if (e.key === '4') setBrush(0);
  });
}

function loadExample() {
  const mark = (a, b, k) => { for (let i = a; i <= b; i++) if (!DAYS[i].hol) S.sel[i] = k; };
  const idx = (d, m) => toIdx(d, m);
  S.sel = new Uint8Array(N);
  mark(idx(1, 3), idx(7, 3), 1);
  mark(idx(5, 7), idx(18, 7), 1);
  mark(idx(20, 9), idx(26, 9), 1);
  mark(idx(1, 11), idx(3, 11), 2);
  S.notes = { [idx(1, 3)]: 'aurora', [idx(5, 7)]: 'rucity', [idx(20, 9)]: 'georgia' };
  S.example = true; S.updatedAt = 0;
}

// ---------- Старт ----------
buildBars();
buildCalendar();
buildChips();
const saved = loadLocal();
if (!(saved && applyData(saved))) loadExample();
syncInputs();
bind();
render();
renderStore();
window.__vacation ={ DAYS, MONTH_INFO, S, RESORTS, parsePlan, computeModel, generate, allowedSpec, evalSel, applyData };
