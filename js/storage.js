// Хранение в браузере, скачивание файлов, разбор строки плана.
'use strict';

// ---------- Сохранение ----------
const LS_KEY = 'vacation-2027-v1', LS_KEY_OLD = 'otpusk-2027-v1';
let localOk = null;
function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(serialize())); return true; } catch (e) { return false; } }
function loadLocal() { try { const t = localStorage.getItem(LS_KEY) || localStorage.getItem(LS_KEY_OLD); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
function touched() { S.updatedAt = Date.now(); localOk = saveLocal(); renderStore(); }
function renderStore() {
  const el = $('#storeStatus');
  if (!S.updatedAt) el.textContent = 'Изменения сохранятся автоматически в этом браузере, на этой странице.';
  else if (localOk === false) el.textContent = 'Браузер не даёт сохранять. Скопируйте план кнопкой внизу, чтобы не потерять его.';
  else el.innerHTML = 'Сохранено в этом браузере в ' + new Date(S.updatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) + '. Для другого устройства <a href="#save" class="jump">скопируйте план строкой</a>.';
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
  const wide = r => (r.name + ' ' + r.where + ' ' + (r.note || '')).toLowerCase().replace(/ё/g, 'е');
  return RESORTS.find(r => nm(r) === t) || RESORTS.find(r => nm(r).includes(t) || t.includes(nm(r))) ||
    RESORTS.find(r => words.some(w => nm(r).includes(w))) || RESORTS.find(r => words.some(w => wide(r).includes(w))) || null;
}
function parsePlan(text) {
  text = String(text || '').trim();
  if (!text) return { error: 'Поле пустое. Вставьте строку плана.' };
  if (text[0] === '{') { try { return { data: JSON.parse(text) }; } catch (e) { return { error: 'Это похоже на файл плана, но он повреждён.' }; } }
  // Строки из таблицы (через табуляцию): Вид, С, По, Дней, Куда — переводим в обычный вид «Основной: 05.07–18.07 (Куда);»
  text = text.split(/\r?\n/).map(line => {
    if (!line.includes('\t')) return line;
    const c = line.split('\t').map(x => x.trim());
    if (!/\d{1,2}\.\d{1,2}/.test(c[1] || '')) return '';
    const kind = /^доп/i.test(c[0]) ? 'Доп.' : /^(дей|day)/i.test(c[0]) ? 'Дейоффы' : 'Основной';
    const place = c[4] ? ' (' + c[4].replace(/[()]/g, '') + ')' : '';
    return kind + ': ' + c[1] + (c[2] && c[2] !== c[1] ? '–' + c[2] : '') + place + ';';
  }).join('\n');
  const sel = new Uint8Array(N), notes = {};
  let kind = 1, count = 0; const bad = [];
  const re = /(доп)|(осн)|(дей|day)|(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?:\s*(?:[-–—]|по|до)\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?)?(?:\s*\(([^)]*)\))?/gi;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) { kind = 2; continue; }
    if (m[2]) { kind = 1; continue; }
    if (m[3]) { kind = 3; continue; }
    const a = toIdx(+m[4], +m[5], m[6]);
    const b = m[7] ? toIdx(+m[7], +m[8], m[9]) : a;
    if (a == null || b == null || b < a) { bad.push(m[0]); continue; }
    let first = -1;
    for (let i = a; i <= b; i++) if (kind === 3 ? DAYS[i].work : !DAYS[i].hol) { sel[i] = kind; if (first < 0) first = i; }
    count++;
    if (m[10] && first >= 0 && kind !== 3) { const r = findResort(m[10]); if (r) notes[first] = r.id; }
  }
  if (!count) return { error: 'Не нашёл ни одной даты. Нужен формат 05.07–18.07.' };
  return { sel, notes, count, bad };
}
function applyImport(text, source) {
  const res = parsePlan(text);
  if (res.error) { toast(res.error); return; }
  const before = snapshot();
  if (res.data) {
    if (!applyData(res.data, { keepVariants: false })) { toast('Это план не на 2027 год или файл не тот.'); return; }
    syncInputs(); commit(before, true); toast('План загружен' + (source ? ' из файла' : ''));
    return;
  }
  S.sel = res.sel; S.notes = res.notes;
  commit(before);
  toast(`Загружено интервалов: ${res.count}` + (res.bad.length ? `. Пропущены непонятные даты: ${res.bad.slice(0, 3).join(', ')}` : ''));
}
