// Хранение в браузере, скачивание файлов, разбор строки плана.
'use strict';

// ---------- Сохранение ----------
const LS_KEY = 'vacation-2027-v1', LS_KEY_OLD = 'otpusk-2027-v1';
let localOk = null;
function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(serialize())); return true; } catch (e) { return false; } }
function loadLocal() {
  // Если новая запись повреждена, пробуем старую
  for (const key of [LS_KEY, LS_KEY_OLD]) { try { const t = localStorage.getItem(key); if (t) return JSON.parse(t); } catch (e) {} }
  return null;
}
// Сохраняем молча; если браузер не даёт — говорим один раз
function touched() {
  S.updatedAt = Date.now();
  const ok = saveLocal();
  if (ok === false && localOk !== false) toast('Браузер не даёт сохранять. Скопируйте ссылку на план кнопкой внизу, чтобы не потерять его.');
  localOk = ok;
  syncUrl();
}
async function saveFile(filename, data) {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'text/plain;charset=utf-8' }));
    a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { toast('Скачивание здесь недоступно. Скопируйте план строкой.'); }
}

// ---------- Импорт ----------
function toIdx(d, mo, y) {
  if (y) { y = +y; if (y < 100) y += 2000; if (y !== YEAR) return null; }
  if (mo < 1 || mo > 12 || d < 1) return null;
  const t = Date.UTC(YEAR, mo - 1, d);
  if (new Date(t).getUTCMonth() !== mo - 1) return null;
  return Math.round((t - T0) / DAY_MS);
}
function findResort(text) {
  const t = text.toLowerCase().replace(/ё/g, 'е').trim(); if (!t) return null;
  const nm = r => r.name.toLowerCase().replace(/ё/g, 'е');
  const words = t.split(/[^a-zа-я-]+/).filter(w => w.length >= 4);
  const words3 = t.split(/[^a-zа-я-]+/).filter(w => w.length >= 3); // страны вроде «ОАЭ»
  const wide = r => (r.name + ' ' + r.where + ' ' + (r.note || '')).toLowerCase().replace(/ё/g, 'е');
  return RESORTS.find(r => nm(r) === t) || RESORTS.find(r => nm(r).includes(t) || t.includes(nm(r))) ||
    RESORTS.find(r => words.some(w => nm(r).includes(w))) || RESORTS.find(r => words3.some(w => wide(r).includes(w))) || null;
}
function parsePlan(text) {
  text = String(text || '').trim();
  if (!text) return { error: 'Поле пустое. Вставьте план.' };
  if (text[0] === '{') { try { return { data: JSON.parse(text) }; } catch (e) { return { error: 'Это похоже на файл плана, но он повреждён.' }; } }
  // Ссылка на план
  if (/(^|[#&])(days|main|extra|dayoff)=/i.test(text)) {
    const L = parseLink(text);
    if (L) return L.count || L.hasDays ? { link: L } : { error: 'В ссылке нет ни одного интервала.' };
  }
  // По строке на интервал: вид, с, по, дней, куда. Столбцы — табуляция или пробелы
  // (на телефоне при копировании табуляция часто превращается в пробелы).
  const sel = new Uint8Array(N), notes = {}, bad = [];
  let count = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const dates = [...line.matchAll(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/g)];
    if (!dates.length) continue; // заголовок «Вид С По Дней Куда» и пустые строки
    const kind = /^доп|^extra/i.test(line) ? 2 : /^(дей|day)/i.test(line) ? 3 : 1;
    const [d1, d2] = dates;
    const a = toIdx(+d1[1], +d1[2], d1[3]);
    const b = d2 ? toIdx(+d2[1], +d2[2], d2[3]) : a;
    if (a == null || b == null || b < a) { bad.push(line.slice(0, 40)); continue; }
    let first = -1;
    for (let i = a; i <= b; i++) if (kind === 3 ? DAYS[i].work : !DAYS[i].hol) { sel[i] = kind; if (first < 0) first = i; }
    if (first < 0) { bad.push(line.slice(0, 40)); continue; }
    count++;
    // «Куда» — хвост строки после дат и числа дней
    const last = d2 || d1;
    const place = line.slice(last.index + last[0].length).replace(/^\s*\d+(?=\s|$)/, '').replace(/[()]/g, '').replace(/^[\s,;:—–-]+/, '').trim();
    if (place && kind !== 3) { const r = findResort(place); if (r) notes[first] = r.id; }
  }
  if (!count) return { error: 'Не нашёл ни одного интервала. Нужны строки вида: Основной 05.07.2027 18.07.2027 14 Крит и Родос' };
  return { sel, notes, count, bad };
}
// Ошибка загрузки — под полем в окне «Загрузить план» (тост за окном не виден)
function importFail(msg) {
  const el = $('#importErr');
  if (el) { el.textContent = msg; el.hidden = false; } else toast(msg);
  return false;
}
function applyImport(text, source) {
  const res = parsePlan(text);
  if (res.error) return importFail(res.error);
  if (res.link) { applyLinkData(res.link, 'import'); return true; }
  const before = snapshot();
  if (res.data) {
    const full = serialize();
    if (!applyData(res.data, { mergeVariants: true })) return importFail('Это план не на 2027 год или файл не тот.');
    before.full = full;
    syncInputs(); commit(before, true); toast('План загружен' + (source ? ' из файла' : '') + '. «Отменить» вернёт прежний.');
    return true;
  }
  S.sel = res.sel; S.notes = res.notes;
  commit(before);
  toast(`Загружено интервалов: ${res.count}` + (res.bad.length ? `. Пропущены непонятные даты: ${res.bad.slice(0, 3).join(', ')}` : ''));
  return true;
}

// ---------- План в ссылке ----------
// #days=28,3,1&main=1-7.03ter,28.06-11.07cre&extra=1-3.11&dayoff=12.02
// days — основной, дополнительный, дейоффы; интервалы через запятую: «день.месяц»,
// внутри месяца «5-18.07», через месяц «28.06-11.07», один день «12.02»; буквы в конце — код направления.
// Заработок, настройки подбора и варианты в ссылку не попадают.
const SITE_URL = 'https://kaandreyr.github.io/annual-leave-planner/';
const LINK_KINDS = [['main', 1], ['extra', 2], ['dayoff', 3]];
const linkDate = i => DAYS[i].d + '.' + pad(DAYS[i].m + 1);
function planHash(st = S) {
  const parts = ['days=' + [st.mainDays, st.extraDays, st.dayoffDays].join(',')];
  for (const [key, kind] of LINK_KINDS) {
    const ivs = buildIntervals(st.sel, v => v === kind, kind);
    if (!ivs.length) continue;
    parts.push(key + '=' + ivs.map(iv => {
      const range = iv.s === iv.e ? linkDate(iv.s) : (DAYS[iv.s].m === DAYS[iv.e].m ? DAYS[iv.s].d : linkDate(iv.s)) + '-' + linkDate(iv.e);
      let code = '';
      if (kind !== 3) for (const k in st.notes) { const i = +k, r = RES_BY_ID[st.notes[k]]; if (i >= iv.s && i <= iv.e && r) { code = r.code || ''; break; } }
      return range + code;
    }).join(','));
  }
  return parts.length > 1 || parts[0] !== 'days=28,3,0' ? parts.join('&') : '';
}
// Принимает ссылку целиком или только часть после #; не план — null
function parseLink(text) {
  const p = Object.create(null);
  for (const kv of String(text || '').trim().replace(/^[^#]*#/, '').split('&')) {
    const k = kv.indexOf('='); if (k < 1) continue;
    let v = kv.slice(k + 1); try { v = decodeURIComponent(v); } catch (e) {}
    p[kv.slice(0, k).toLowerCase()] = v;
  }
  if (!('days' in p) && !LINK_KINDS.some(([key]) => key in p)) return null;
  const sel = new Uint8Array(N), notes = {}, bad = [];
  let count = 0;
  for (const [key, kind] of LINK_KINDS) {
    for (const raw of String(p[key] || '').split(',')) {
      const t = raw.trim(); if (!t) continue;
      const m = /^(\d{1,2})(?:\.(\d{1,2}))?(?:-(\d{1,2})\.(\d{1,2}))?([a-z]{2,3})?$/i.exec(t);
      if (!m || (m[2] == null && m[3] == null)) { bad.push(t); continue; }
      const a = toIdx(+m[1], +(m[2] || m[4])), b = m[3] != null ? toIdx(+m[3], +m[4]) : a;
      if (a == null || b == null || b < a) { bad.push(t); continue; }
      let first = -1;
      for (let i = a; i <= b; i++) if (kind === 3 ? DAYS[i].work : !DAYS[i].hol) { sel[i] = kind; if (first < 0) first = i; }
      if (first < 0) { bad.push(t); continue; }
      count++;
      const r = m[5] && kind !== 3 ? RES_BY_CODE[m[5].toLowerCase()] : null;
      if (r) notes[first] = r.id;
    }
  }
  const nums = String(p.days || '').split(',').map(x => parseInt(x, 10));
  const num = (v, def, max) => Number.isFinite(v) ? clamp(v, 0, max) : def;
  return { days: [num(nums[0], S.mainDays, 120), num(nums[1], S.extraDays, 60), num(nums[2], S.dayoffDays, 60)], hasDays: 'days' in p, sel, notes, count, bad };
}
// Открыть план из ссылки. Свой же план (после перезагрузки) — ничего не делаем
function applyLinkData(L, how) {
  const next = { mainDays: L.days[0], extraDays: L.days[1], dayoffDays: L.days[2], sel: L.sel, notes: cleanNotes(L.notes, L.sel) };
  if (planHash(next) === planHash(S)) { if (S.example) { S.example = false; touched(); render(); } return 'same'; }
  const hadOwn = !S.example && S.sel.some(v => v);
  const before = snapshot(); before.full = serialize();
  Object.assign(S, next);
  syncInputs(); commit(before);
  const msg = (how === 'import' ? 'План загружен из ссылки' : 'План открыт по ссылке') + (L.bad.length ? `. Не понял: ${L.bad.slice(0, 3).join(', ')}` : '');
  toast(msg, hadOwn ? { label: 'Вернуть прежний', fn: () => { if (undo[undo.length - 1] === before) doUndo(); } } : undefined);
  return true;
}
function applyLink(text, how) { const L = parseLink(text); return L ? applyLinkData(L, how) : false; }
// Адресная строка повторяет план: её можно просто скопировать
let urlTimer = 0;
function writeUrl() {
  clearTimeout(urlTimer);
  const h = S.example ? '' : planHash();
  if (location.hash === (h ? '#' + h : '')) return;
  try { history.replaceState(history.state, '', h ? '#' + h : location.pathname + location.search); } catch (e) {}
}
// Не чаще раза в 120 мс (Safari ограничивает replaceState), но перед уходом со страницы — сразу
function syncUrl() { clearTimeout(urlTimer); urlTimer = setTimeout(writeUrl, 120); }
window.addEventListener('pagehide', writeUrl);
// Ссылка для отправки: адрес этой страницы, а если она открыта внутри другой или из файла — адрес сайта
function shareUrl() {
  let base = SITE_URL;
  try { if (/^https?:$/.test(location.protocol) && window.top === window.self) base = location.origin + location.pathname; } catch (e) {}
  const h = planHash();
  return base + (h ? '#' + h : '');
}
