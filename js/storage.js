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
  const words3 = t.split(/[^a-zа-я-]+/).filter(w => w.length >= 3); // страны вроде «ОАЭ»
  const wide = r => (r.name + ' ' + r.where + ' ' + (r.note || '')).toLowerCase().replace(/ё/g, 'е');
  return RESORTS.find(r => nm(r) === t) || RESORTS.find(r => nm(r).includes(t) || t.includes(nm(r))) ||
    RESORTS.find(r => words.some(w => nm(r).includes(w))) || RESORTS.find(r => words3.some(w => wide(r).includes(w))) || null;
}
function parsePlan(text) {
  text = String(text || '').trim();
  if (!text) return { error: 'Поле пустое. Вставьте план.' };
  if (text[0] === '{') { try { return { data: JSON.parse(text) }; } catch (e) { return { error: 'Это похоже на файл плана, но он повреждён.' }; } }
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
function applyImport(text, source) {
  const res = parsePlan(text);
  if (res.error) { toast(res.error); return; }
  const before = snapshot();
  if (res.data) {
    const full = serialize();
    if (!applyData(res.data, { mergeVariants: true })) { toast('Это план не на 2027 год или файл не тот.'); return; }
    before.full = full;
    syncInputs(); commit(before, true); toast('План загружен' + (source ? ' из файла' : '') + '. «Отменить» вернёт прежний.');
    return;
  }
  S.sel = res.sel; S.notes = res.notes;
  commit(before);
  toast(`Загружено интервалов: ${res.count}` + (res.bad.length ? `. Пропущены непонятные даты: ${res.bad.slice(0, 3).join(', ')}` : ''));
}
