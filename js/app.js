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
  $('#sumVariants').textContent = S.variants.length ? 'сохранено ' + S.variants.length + ' — откройте, чтобы сравнить' : 'запомните вариант, чтобы сравнить с другими';
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
function hideToast() { const t = $('#toast'); t.hidden = true; t.style.transform = t.style.opacity = ''; }
function toast(msg, action) {
  const t = $('#toast'); t.textContent = '';
  const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
  if (action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-btn'; b.textContent = action.label; b.onclick = () => { hideToast(); action.fn(); }; t.appendChild(b); }
  t.hidden = false; clearTimeout(toastTimer);
  const arm = () => { clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, action ? 6000 : 3400); };
  if (document.hidden) document.addEventListener('visibilitychange', arm, { once: true }); else arm();
}

// В буфер обмена; если браузер не даёт — через скрытое поле, иначе fallback
function copyText(text, ok, fallback) {
  const legacy = () => {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select();
    let done = false; try { done = document.execCommand('copy'); } catch (e) {}
    ta.remove(); if (done) toast(ok); else fallback();
  };
  try { navigator.clipboard.writeText(text).then(() => toast(ok), legacy); } catch (e) { legacy(); }
}

// ---------- Привязки ----------
function syncInputs() {
  $('#mainDays').value = S.mainDays;
  $('#extraDays').value = S.extraDays;
  $('#dayoffDays').value = S.dayoffDays;
  $('#salary').value = S.salary ? nf0.format(S.salary) : '';
  syncChips();
}
// Тост убирается смахиванием вбок или вниз и нажатием на текст
function bindToast() {
  const t = $('#toast'); let id = null, sx = 0, sy = 0;
  const shift = e => [e.clientX - sx, e.clientY - sy];
  t.addEventListener('pointerdown', e => {
    if (e.target.closest('.toast-btn')) return;
    id = e.pointerId; sx = e.clientX; sy = e.clientY; t.classList.add('drag');
    try { t.setPointerCapture(id); } catch (err) {}
  });
  t.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const [dx, dy] = shift(e), down = Math.max(0, dy);
    t.style.transform = `translate(${dx}px, ${down}px)`;
    t.style.opacity = String(Math.max(0.25, 1 - Math.max(Math.abs(dx) / 180, down / 90)));
  });
  const end = (e, cancel) => {
    if (e.pointerId !== id) return;
    id = null; t.classList.remove('drag');
    const [dx, dy] = shift(e);
    if (!cancel && (Math.abs(dx) > 60 || dy > 30 || (Math.abs(dx) < 6 && Math.abs(dy) < 6))) { clearTimeout(toastTimer); hideToast(); return; }
    t.style.transform = t.style.opacity = '';
  };
  t.addEventListener('pointerup', e => end(e, false));
  t.addEventListener('pointercancel', e => end(e, true));
}
function bind() {
  bindToast();
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
  // Особые даты
  const addSpecial = () => {
    const v = $('#specialDate').value, m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    const i = m ? toIdx(+m[3], +m[2], m[1]) : null;
    if (i == null) { toast('Выберите дату в 2027 году'); return; }
    if (S.prefs.special.some(x => x.i === i)) { toast('Эта дата уже есть'); return; }
    if (S.prefs.special.length >= 20) { toast('Хватит 20 дат'); return; }
    S.prefs.special.push({ i, label: $('#specialLabel').value.trim().slice(0, 40) });
    S.prefs.special.sort((a, b) => a.i - b.i);
    $('#specialDate').value = ''; $('#specialLabel').value = '';
    syncChips(); touched(); render();
  };
  $('#specialAdd').addEventListener('click', addSpecial);
  ['specialDate', 'specialLabel'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSpecial(); } }));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-special-del]'); if (!b) return;
    S.prefs.special = S.prefs.special.filter(x => x.i !== +b.dataset.specialDel);
    syncChips(); touched(); render();
  });
  // Сбросить выбор — все настройки подбора к исходным
  $('#clearFilters').addEventListener('click', () => { S.prefs = defaultPrefs(); syncChips(); touched(); render(); });
  // Окна подбора и загрузки плана. Где нет <dialog> (Firefox до 98, Safari до 15.4) — обычный слой поверх страницы
  const modal = dlg => {
    const native = typeof dlg.showModal === 'function';
    const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop'; backdrop.hidden = true;
    if (!native) document.body.appendChild(backdrop);
    const open = () => {
      if (native) { if (!dlg.open) dlg.showModal(); return; }
      dlg.setAttribute('open', ''); dlg.classList.add('modal-fallback'); backdrop.hidden = false; document.documentElement.classList.add('modal-open');
    };
    const close = () => {
      if (native) { if (dlg.open) dlg.close(); return; }
      dlg.removeAttribute('open'); dlg.classList.remove('modal-fallback'); backdrop.hidden = true; document.documentElement.classList.remove('modal-open');
    };
    dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !native && dlg.hasAttribute('open')) close(); });
    return { open, close };
  };
  const { open: openGen, close: closeGen } = modal($('#genDialog'));
  $('#genOpen').addEventListener('click', openGen);
  $('#genClose').addEventListener('click', closeGen);
  // Загрузить план: вставить строки из таблицы или выбрать файл
  const imp = modal($('#importDialog'));
  const openImport = () => { $('#importErr').hidden = true; imp.open(); $('#importText').focus(); };
  $('#importOpen').addEventListener('click', openImport);
  $('#importClose').addEventListener('click', imp.close);
  $('#importText').addEventListener('input', () => { $('#importErr').hidden = true; });
  $('#importApply').addEventListener('click', () => { if (applyImport($('#importText').value)) { $('#importText').value = ''; imp.close(); } });
  $('#importFileBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { if (applyImport(String(r.result || ''), 'file')) imp.close(); e.target.value = ''; };
    r.onerror = () => importFail('Не удалось прочитать файл');
    r.readAsText(f);
  });
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
  // Клик по интервалу — прокрутка к его месяцу и подсветка дней
  let flashTimer = 0;
  document.addEventListener('click', e => {
    const iv = e.target.closest('.ivs .iv'); if (!iv || e.target.closest('select, option, a')) return;
    const s = +iv.dataset.s, last = +iv.dataset.e; if (!cells[s]) return;
    cells[s].closest('.month').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    cells.forEach(c => c.classList.remove('flash'));
    for (let i = s; i <= last; i++) cells[i].classList.add('flash');
    clearTimeout(flashTimer); flashTimer = setTimeout(() => cells.forEach(c => c.classList.remove('flash')), 1800);
  });
  // Ссылка «Загрузить план» открывает окно загрузки
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href="#import"]'); if (!a) return;
    e.preventDefault(); openImport();
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
  // Всплывающие пояснения («Обозначения», «Как считается»): по ссылке, закрываются кликом мимо и Esc
  const pops = [...document.querySelectorAll('.legend-link[aria-controls]')].map(btn => ({ btn, pop: document.getElementById(btn.getAttribute('aria-controls')) }));
  const setPop = (p, open) => { p.pop.hidden = !open; p.btn.setAttribute('aria-expanded', String(open)); };
  pops.forEach(p => p.btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = p.pop.hidden;
    pops.forEach(q => setPop(q, false));
    setPop(p, open);
  }));
  document.addEventListener('click', e => pops.forEach(p => { if (!p.pop.hidden && !p.pop.contains(e.target)) setPop(p, false); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') pops.forEach(p => { if (!p.pop.hidden) setPop(p, false); }); });
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
    copyText(text, 'План скопирован', () => { ta.focus(); ta.select(); toast('Выделил строку — нажмите Ctrl+C'); });
  });
  // «Поделиться» — системное меню телефона; на компьютере остаётся только копирование
  const shareText = 'Ссылка скопирована — по ней откроется этот план';
  if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
    $('#shareLink').hidden = false; $('#copyLink').classList.remove('primary');
  }
  $('#shareLink').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    if (!S.sel.some(v => v)) { toast('План пуст — отметьте дни'); return; }
    const url = shareUrl();
    navigator.share({ title: 'Отпуск 2027', text: 'План отпуска на 2027 год', url }).catch(err => {
      if (err && err.name === 'AbortError') return; // закрыли меню
      copyText(url, shareText, () => toast('Не получилось поделиться. Ссылка на план — в адресной строке'));
    });
  });
  // Кнопки в заголовке «Сохранить и поделиться»: не сворачивают и не разворачивают блок
  $('#copyLink').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    if (!S.sel.some(v => v)) { toast('План пуст — отметьте дни'); return; }
    copyText(shareUrl(), shareText, () => toast('Не получилось скопировать. Ссылка на план — в адресной строке'));
  });
  $('#dlJson').addEventListener('click', () => saveFile('vacation-2027.json', JSON.stringify(serialize(), null, 2)));
  $('#dlCsv').addEventListener('click', () => {
    if (!model.main.length && !model.extra.length && !model.doffs.length) { toast('План пуст — отметьте дни'); return; }
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

// Пример при первом открытии: случайный вариант от подбора с настройками по умолчанию,
// а если подбор не сработал — постоянный пример
function loadExample() {
  S.sel = new Uint8Array(N); S.notes = {};
  S.example = true; S.updatedAt = 0;
  let res = null;
  try { res = makePlan(); } catch (e) { res = null; }
  if (res && res.pick) { S.sel = res.pick.sel; S.notes = res.pick.notes; return; }
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
let restored = false;
try { restored = !!(saved && applyData(saved)); } catch (e) { restored = false; }
if (!restored) loadExample();
bind();
try { syncInputs(); render(); }
catch (e) {
  // Сохранённый план не открывается — показываем пример, чтобы страница работала
  console.error(e);
  Object.assign(S, { mainDays: 28, extraDays: 3, dayoffDays: 0, variants: [],
    prefs: defaultPrefs() });
  loadExample(); syncInputs(); render();
  toast('Сохранённый план повреждён — открыл пример');
}
// План из ссылки важнее сохранённого в браузере; без плана в ссылке — кладём туда свой
const openedLink = applyLink(location.hash, 'open') === true;
if (!openedLink) syncUrl();
window.addEventListener('hashchange', () => { if (applyLink(location.hash, 'open') !== true) syncUrl(); });

// ---------- Новая версия ----------
// GitHub Pages разрешает браузеру 10 минут брать страницу из кеша, а встроенные браузеры мессенджеров
// держат её и дольше. Сверяем метку ?v= у своих скриптов с опубликованной страницей.
const myVer = (() => { const s = document.querySelector('script[src*="?v="]'); const m = s && /[?&]v=([0-9a-f]+)/.exec(s.getAttribute('src')); return m ? m[1] : null; })();
async function checkVersion(autoReload) {
  if (!myVer || typeof fetch !== 'function') return; // локальный запуск или файл
  let ver = null;
  try {
    // no-cache: браузер переспрашивает сервер и кладёт свежую страницу в кеш — перезагрузка возьмёт её
    const r = await fetch(location.pathname, { cache: 'no-cache' });
    const m = r.ok && /[?&]v=([0-9a-f]+)"/.exec(await r.text());
    ver = m ? m[1] : null;
  } catch (e) { return; }
  if (!ver || ver === myVer) return;
  const reload = () => { writeUrl(); location.reload(); };
  // Сразу после открытия — обновляемся сами (план в браузере и в ссылке не теряется), но один раз на версию
  let tried = null; try { tried = sessionStorage.getItem('vacation-2027-upd'); } catch (e) {}
  if (autoReload && tried !== ver) { try { sessionStorage.setItem('vacation-2027-upd', ver); } catch (e) {} reload(); return; }
  const offer = () => { if (!$('#toast').hidden) { setTimeout(offer, 2000); return; } toast('Вышла новая версия планировщика', { label: 'Обновить', fn: reload }); };
  offer();
}
// Если открыли по ссылке и показали «Вернуть прежний», сами не перезагружаем — только предлагаем
checkVersion(!openedLink);
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => { if (document.hidden) hiddenAt = Date.now(); else if (hiddenAt && Date.now() - hiddenAt > 60000) checkVersion(false); });
window.__vacation ={ DAYS, MONTH_INFO, S, RESORTS, parsePlan, computeModel, generate, allowedSpec, evalSel, applyData };
