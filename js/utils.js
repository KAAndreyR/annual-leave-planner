// Форматирование чисел и дат, мелкие помощники.
'use strict';

// ---------- Утилиты ----------
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const nf1 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = v => nf1.format(v) + '%';
const rub = v => nf0.format(Math.round(v)) + ' ₽';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; }
const dn = n => n + ' ' + plural(n, 'день', 'дня', 'дней');
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function dLabel(i) { const D = DAYS[i]; return D.d + ' ' + MON_GEN[D.m]; }
function rangeLabel(s, e) {
  const A = DAYS[s], B = DAYS[e];
  if (s === e) return A.d + ' ' + MON_GEN[A.m];
  if (A.m === B.m) return A.d + '–' + B.d + ' ' + MON_GEN[A.m];
  return A.d + ' ' + MON_GEN[A.m] + ' – ' + B.d + ' ' + MON_GEN[B.m];
}
const fmtD = i => pad(DAYS[i].d) + '.' + pad(DAYS[i].m + 1);
function monthsLabel(set) {
  const a = [...set].sort((x, y) => x - y);
  if (!a.length) return '—';
  if (a.length === 12) return 'весь год';
  const has = m => set.has((m + 12) % 12);
  const starts = a.filter(m => !has(m - 1));
  return starts.map(s => { let e = s; while (has(e + 1) && (e + 1) % 12 !== s) e = (e + 1) % 12; return s === e ? MON_SH[s] : MON_SH[s] + '–' + MON_SH[e]; }).join(', ');
}
const resortMonths = r => new Set(r.months.map(m => m - 1));
const resortWhere = r => r.where && r.where !== 'Россия' ? r.where : (r.where === 'Россия' ? 'Россия' : '');
