// Состояние плана, сохранение в строку, интервалы, отдых и деньги.
'use strict';

// ---------- Состояние ----------
const S = {
  mainDays: 28, extraDays: 3, dayoffDays: 0, salary: '', avgPct: 100,
  sel: new Uint8Array(N), notes: {},
  prefs: { resorts: [], seasons: [], months: [], extraMode: 'auto', goal: 'standard', janExtend: false, mainDest: '' },
  variants: [], example: false, updatedAt: 0
};
let brush = 1, rangeMode = false, anchorPending = null, lastClick = null, shiftHeld = false;
const undo = [];
let model = null;

function encodeRuns(sel) {
  const out = []; let i = 0;
  while (i < N) {
    if (sel[i]) { const k = sel[i]; let j = i; while (j + 1 < N && sel[j + 1] === k) j++; out.push(i + '+' + (j - i + 1) + (k === 3 ? 'd' : k === 2 ? 'e' : 'm')); i = j + 1; }
    else i++;
  }
  return out.join(',');
}
function decodeRuns(str) {
  const sel = new Uint8Array(N);
  if (!str) return sel;
  for (const t of String(str).split(',')) {
    const m = /^(\d+)\+(\d+)([med])$/.exec(t.trim()); if (!m) continue;
    const s = +m[1], l = +m[2], k = m[3] === 'd' ? 3 : m[3] === 'e' ? 2 : 1;
    for (let i = s; i < s + l && i < N; i++) if (k === 3 ? DAYS[i].work : !DAYS[i].hol) sel[i] = k;
  }
  return sel;
}
function cleanNotes(obj, sel) {
  const out = {};
  if (obj && typeof obj === 'object') for (const k in obj) { const i = +k, id = resolveRes(obj[k]); if (Number.isInteger(i) && i >= 0 && i < N && id && (!sel || sel[i])) out[i] = id; }
  return out;
}
function serialize() {
  return {
    v: 1, year: YEAR, mainDays: S.mainDays, extraDays: S.extraDays, dayoffDays: S.dayoffDays, salary: S.salary, avgPct: S.avgPct,
    runs: encodeRuns(S.sel), notes: S.notes, prefs: S.prefs,
    variants: S.variants.map(v => ({ id: v.id, name: v.name, runs: v.runs, notes: v.notes, created: v.created })),
    example: S.example, updatedAt: S.updatedAt
  };
}
function applyData(d, opts = {}) {
  if (!d || typeof d !== 'object') return false;
  if (d.year != null && +d.year !== YEAR) return false;
  const num = (v, def, min, max) => { v = parseInt(v, 10); return Number.isFinite(v) ? clamp(v, min, max) : def; };
  S.mainDays = num(d.mainDays, 28, 0, 120);
  S.extraDays = num(d.extraDays, 3, 0, 60);
  S.dayoffDays = num(d.dayoffDays, 0, 0, 60);
  S.avgPct = num(d.avgPct, 100, 10, 500);
  S.salary = d.salary ? num(d.salary, '', 0, 1e9) : '';
  S.sel = decodeRuns(d.runs);
  S.notes = cleanNotes(d.notes, S.sel);
  const p = d.prefs || {};
  S.prefs = {
    resorts: [...new Set((Array.isArray(p.resorts) ? p.resorts : []).map(resolveRes).filter(Boolean))],
    seasons: (Array.isArray(p.seasons) ? p.seasons : []).filter(id => SEASON_BY_ID[id]),
    months: (Array.isArray(p.months) ? p.months : []).map(Number).filter(m => m >= 1 && m <= 12),
    extraMode: ['auto','attach','bridge'].includes(p.extraMode) ? p.extraMode : 'auto',
    goal: GOAL_IDS.includes(p.goal) ? p.goal : 'standard',
    janExtend: p.janExtend === true,
    mainDest: resolveRes(p.mainDest) && !RES_BY_ID[resolveRes(p.mainDest)].winIdx ? resolveRes(p.mainDest) : ''
  };
  if (Array.isArray(d.variants) && !opts.keepVariants) {
    S.variants = d.variants.filter(v => v && typeof v.runs === 'string').slice(0, 20)
      .map(v => ({ id: String(v.id || Math.random().toString(36).slice(2)), name: String(v.name || 'Вариант'), runs: v.runs, notes: cleanNotes(v.notes), created: +v.created || 0 }));
  }
  S.example = !!d.example;
  S.updatedAt = +d.updatedAt || 0;
  return true;
}

// ---------- Модель: интервалы, отдых, деньги ----------
function buildIntervals(sel, test, kind) {
  const out = []; let cur = null;
  for (let i = 0; i < N; i++) {
    if (!test(sel[i])) continue;
    if (cur) {
      let bridge = true;
      for (let k = cur.e + 1; k < i; k++) if (!DAYS[k].hol) { bridge = false; break; }
      if (bridge) { cur.e = i; continue; }
    }
    cur = { s: i, e: i, kind }; out.push(cur);
  }
  for (const iv of out) {
    let vac = 0, hol = 0, work = 0, wk = 0;
    const workBy = new Array(12).fill(0), paidBy = new Array(12).fill(0);
    for (let k = iv.s; k <= iv.e; k++) {
      const D = DAYS[k];
      if (D.hol) { hol++; continue; }
      vac++; paidBy[D.m]++;
      if (D.work) { work++; workBy[D.m]++; } else wk++;
    }
    let a = iv.s, b = iv.e;
    while (a > 0 && (DAYS[a - 1].off || sel[a - 1])) a--;
    while (b < N - 1 && (DAYS[b + 1].off || sel[b + 1])) b++;
    Object.assign(iv, { vac, hol, work, wk, workBy, paidBy, ra: a, rb: b, streak: b - a + 1 });
  }
  return out;
}
const dayPct = () => S.avgPct / 29.3;
function lostPct(workBy) { let s = 0; for (let m = 0; m < 12; m++) if (workBy[m]) s += workBy[m] / MONTH_INFO[m].work * 100; return s; }
function majorMonth(iv) { let best = 0; for (let m = 1; m < 12; m++) if (iv.paidBy[m] > iv.paidBy[best]) best = m; return best; }
function resortFor(iv) { for (const k in S.notes) { const i = +k; if (i >= iv.s && i <= iv.e) return RES_BY_ID[S.notes[k]] || null; } return null; }

function computeModel() {
  const sel = S.sel;
  const main = buildIntervals(sel, v => v === 1, 1);
  const extra = buildIntervals(sel, v => v === 2, 2);
  const doffs = buildIntervals(sel, v => v === 3, 3);
  const chains = buildIntervals(sel, v => v > 0, 0);
  const vchains = buildIntervals(sel, v => v === 1 || v === 2, 0);
  let usedM = 0, usedE = 0, usedD = 0;
  for (let i = 0; i < N; i++) { if (sel[i] === 1) usedM++; else if (sel[i] === 2) usedE++; else if (sel[i] === 3) usedD++; }
  const insideHol = new Uint8Array(N);
  for (const iv of main.concat(extra)) for (let k = iv.s; k <= iv.e; k++) if (DAYS[k].hol) insideHol[k] = iv.kind;
  const rest = new Uint8Array(N);
  for (const c of chains) for (let k = c.ra; k <= c.rb; k++) if (!sel[k] && !insideHol[k]) rest[k] = 1;
  // Дейоффы — не отпуск: отпускные за них не платят, зарплата сохраняется, поэтому в деньги они не идут
  const months = MONTH_INFO.map((M, m) => ({ m, work: M.work, vacWork: 0, paid: 0, doff: 0 }));
  for (let i = 0; i < N; i++) {
    const D = DAYS[i];
    if (sel[i] === 3) months[D.m].doff++;
    else if (sel[i]) { months[D.m].paid++; if (D.work) months[D.m].vacWork++; }
  }
  let restTotal = 0; for (let i = 0; i < N; i++) if (sel[i] || insideHol[i] || rest[i]) restTotal++;
  return { main, extra, doffs, chains, vchains, usedM, usedE, usedD, insideHol, rest, months, restTotal };
}
