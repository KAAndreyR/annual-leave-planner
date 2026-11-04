// Подбор вариантов отпуска под цель и фильтры.
'use strict';

// ---------- Генератор ----------
function allowedSpec() {
  const P = S.prefs, M = new Set();
  P.months.forEach(m => M.add(m - 1));
  P.seasons.forEach(id => SEASON_BY_ID[id].months.forEach(m => M.add(m - 1)));
  const chosen = P.resorts.map(id => RES_BY_ID[id]).filter(Boolean);
  // События с точными датами (майские, 1 сентября…) месяцы не ограничивают — их часть ставится прямо на даты
  const wins = chosen.filter(r => r.winIdx), byMonth = chosen.filter(r => !r.winIdx);
  const R = new Set(); byMonth.forEach(r => r.months.forEach(m => R.add(m - 1)));
  let months, pool = byMonth.length ? byMonth : TRAVEL, note = '';
  if (M.size && R.size) {
    const I = [...M].filter(m => R.has(m));
    if (I.length) months = new Set(I);
    else { months = M; pool = TRAVEL; note = 'Выбранные направления не подходят к выбранным месяцам. Оставил месяцы, а куда поехать подберу по сезону.'; }
  } else if (M.size) months = M;
  else if (R.size) months = R;
  // Ничего не отмечено — месяцы под цель. Январь сюда не входит никогда: он самый невыгодный (15 рабочих дней)
  const autoFor = g => {
    const all = [1,2,3,4,5,6,7,8,9,10,11];
    if (g === 'money') { const ms = new Set(all.filter(m => MONTH_INFO[m].work >= 20)); return { ms, t: 'только месяцы с 20+ рабочими днями: ' + monthsLabel(ms) }; }
    return { ms: new Set(all), t: g === 'rest' ? 'с февраля по декабрь, с упором на праздники' : 'с февраля по декабрь' };
  };
  let auto = '';
  if (!months) { const a = autoFor(P.goal); months = a.ms; auto = a.t; }
  // Январь — только с галкой «Хочу продлить январские»; явно выбранный январь тогда тоже можно занимать
  const janExtend = !!P.janExtend;
  const janAll = janExtend && months.has(0);
  if (!janAll && months.has(0)) {
    months = new Set([...months].filter(m => m !== 0));
    if (P.months.includes(1)) note = (note ? note + ' ' : '') + 'Январь пропускаю: включите «Хочу продлить январские».';
    if (!months.size) { const a = autoFor(P.goal); months = a.ms; auto = a.t; }
  }
  // Главная поездка: часть от 14 дней ставим в её сезон (январь — только с галкой)
  const dest = P.mainDest ? RES_BY_ID[P.mainDest] : null;
  let destSpec = null;
  if (dest) {
    const dm = new Set(dest.months.map(m => m - 1).filter(m => m !== 0 || janExtend));
    if (dm.size) destSpec = Object.assign({}, { months: dm, janAll: janExtend && dm.has(0) });
  }
  return { months, pool, chosen, byMonth, wins, note, auto, janExtend, janAll, dest, destSpec, active: M.size > 0 || R.size > 0 };
}
// Можно ли занимать эти дни: январь — только когда он разрешён
const janOK = (idx, spec) => spec.janAll || idx.every(i => DAYS[i].m !== 0);
// Дейоффы ставят только вручную; подбор их сохраняет и отпуск на них не кладёт
const onDoff = (idx, spec) => !!spec.doff && idx.some(i => spec.doff[i]);
// Вес месяца для старта части: чем больше рабочих дней, тем выгоднее
function monthWeight(m, goal) {
  const w = MONTH_INFO[m].work - 14;
  return goal === 'money' ? w * w : goal === 'standard' ? w : 1;
}
function weighted(arr, wf) {
  const w = arr.map(wf); let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < arr.length; k++) { r -= w[k]; if (r <= 0) return arr[k]; }
  return arr[arr.length - 1];
}
function takeFwd(s, len) { const idx = []; for (let i = s; i < N && idx.length < len; i++) if (!DAYS[i].hol) idx.push(i); return idx.length === len ? idx : null; }
function takeBack(e, len) { const idx = []; for (let i = e; i >= 0 && idx.length < len; i--) if (!DAYS[i].hol) idx.unshift(i); return idx.length === len ? idx : null; }
function isFree(sel, a, b) { for (let i = Math.max(0, a); i <= Math.min(N - 1, b); i++) if (sel[i]) return false; return true; }
function fracIn(idx, months) { let k = 0; for (const i of idx) if (months.has(DAYS[i].m)) k++; return k / idx.length; }
function splitMain(L, mc, goal) {
  if (L <= 16) return [L];
  const maxParts = mc <= 2 ? 2 : 4;
  let first, pieces;
  if (goal === 'money') { first = rnd([16, 16, 16, 23, 14]); pieces = [9, 9, 9, 5, 7, 16]; }
  else if (goal === 'rest') { first = rnd([14, 14, 14, 16, 21]); pieces = [5, 5, 5, 4, 12, 9]; }
  else { const r = Math.random(); first = r < 0.12 ? L : r < 0.68 ? 14 : r < 0.84 ? 21 : 14 + Math.floor(Math.random() * Math.min(8, L - 13)); pieces = [7, 7, 7, 5, 9, 10, 14]; }
  first = Math.min(first, L);
  const parts = [first]; let rest = L - first;
  while (rest > 0) {
    if (parts.length >= maxParts) { parts[parts.length - 1] += rest; break; }
    if (rest <= 9 || Math.random() < 0.25) { parts.push(rest); break; }
    let piece = rnd(pieces);
    if (piece > rest) piece = rest;
    if (rest - piece > 0 && rest - piece < 3) piece = rest;
    parts.push(piece); rest -= piece;
  }
  return parts;
}
function randomStart(spec, len, goal) {
  // «Максимальный отдых»: чаще всего встаём вплотную к длинным выходным и праздникам
  if (goal === 'rest' && Math.random() < 0.6) {
    const runs = OFF_RUNS.filter(r => r.len >= 3 && (spec.months.has(DAYS[r.a].m) || spec.months.has(DAYS[r.b].m)));
    if (runs.length) {
      const run = weighted(runs, r => r.len * r.len);
      if (Math.random() < 0.55 && run.b + 1 < N) return run.b + 1;
      const back = takeBack(run.a - 1, len); if (back) return back[0];
      if (run.b + 1 < N) return run.b + 1;
    }
  }
  const ms = [...spec.months]; if (!ms.length) return null;
  const m = weighted(ms, x => monthWeight(x, goal));
  const M = MONTH_INFO[m];
  let i = M.start + Math.floor(Math.random() * M.len);
  const q = Math.random(), dir = Math.random() < 0.5 ? -1 : 1;
  // день недели старта: 0 — понедельник, 5 — суббота
  const target = goal === 'money' ? (q < 0.7 ? 5 : q < 0.82 ? 4 : -1)
    : goal === 'rest' ? (q < 0.75 ? 0 : -1)
    : (q < 0.55 ? 0 : q < 0.75 ? 5 : -1);
  if (target >= 0) while (i > 0 && i < N - 1 && DAYS[i].dow !== target) i += dir;
  while (i < N - 1 && DAYS[i].hol) i++;
  return i;
}
// Вклад части: сколько дней отдыха подряд она даёт (с выходными по краям) и разница отпускных и потерянной зарплаты, % заработка
function blockGain(idx) {
  let a = idx[0], b = idx[idx.length - 1];
  while (a > 0 && DAYS[a - 1].off) a--;
  while (b < N - 1 && DAYS[b + 1].off) b++;
  const dp = dayPct(); let diff = 0;
  for (const i of idx) { diff += dp; if (DAYS[i].work) diff -= 100 / MONTH_INFO[DAYS[i].m].work; }
  return { rest: b - a + 1, diff };
}
// Веса цели: [отдых, деньги, случайность]
const GOAL_W = { rest: [1, 0.05, 2], standard: [1, 1, 3], money: [0.1, 1, 0.8] };
function goalScore(ev, goal, noise = 1) { const w = GOAL_W[goal] || GOAL_W.standard; return ev.rest * w[0] + ev.diff * w[1] + Math.random() * w[2] * noise; }
function bridgeExtra(sel, spec, E, minFrac, goal) {
  const cands = [];
  for (let s = 0; s < N; s++) {
    if (DAYS[s].off) continue;
    const idx = takeFwd(s, E); if (!idx) continue;
    if (fracIn(idx, spec.months) < minFrac) continue;
    if (!isFree(sel, idx[0] - 7, idx[idx.length - 1] + 7)) continue;
    if (!idx.some(i => DAYS[i].work) || !janOK(idx, spec) || onDoff(idx, spec)) continue;
    cands.push({ idx, score: goalScore(blockGain(idx), goal, 0.5) });
  }
  if (!cands.length) return null;
  cands.sort((x, y) => y.score - x.score);
  return rnd(cands.slice(0, goal === 'standard' ? 6 : 3)).idx;
}
function placeExtra(sel, spec, E, minFrac, placed, goal) {
  let mode = S.prefs.extraMode;
  if (mode === 'auto') mode = Math.random() < 0.5 ? 'attach' : 'bridge';
  if (mode === 'bridge' || !placed.length) {
    const b = bridgeExtra(sel, spec, E, minFrac, goal);
    if (b) return { idx: b, separate: true };
    if (!placed.length) return null;
  }
  for (const p of shuffle(placed.slice())) {
    for (const dir of shuffle([1, -1])) {
      const idx = dir > 0 ? takeFwd(p.idx[p.idx.length - 1] + 1, E) : takeBack(p.idx[0] - 1, E);
      if (idx && idx.every(i => !sel[i]) && idx.some(i => DAYS[i].work) && (p.jan || janOK(idx, spec)) && !onDoff(idx, spec)) return { idx, separate: false };
    }
  }
  return null;
}
// Весь план: дней отдыха подряд с выходными и праздниками + разница отпускных и потерянной зарплаты
function evalSel(sel) {
  const chains = buildIntervals(sel, v => v > 0, 0);
  const mark = new Uint8Array(N); let rest = 0;
  for (const c of chains) for (let k = c.ra; k <= c.rb; k++) if (!mark[k]) { mark[k] = 1; rest++; }
  const dp = dayPct(); let pay = 0, lost = 0;
  for (let i = 0; i < N; i++) if (sel[i]) { pay += dp; if (DAYS[i].work) lost += 100 / MONTH_INFO[DAYS[i].m].work; }
  return { rest, diff: pay - lost, ratio: lost > 0 ? pay / lost * 100 : null };
}
function assignResorts(placed, spec) {
  const notes = {}, used = new Set();
  const near = TRAVEL.filter(r => r.where === 'Россия');
  for (const p of placed) {
    if (p.fixed) { used.add(p.fixed); notes[p.idx[0]] = p.fixed; continue; }
    if (p.kind === 2 && !p.separate) continue;
    const counts = new Array(12).fill(0); p.idx.forEach(i => counts[DAYS[i].m]++);
    const mm = counts.indexOf(Math.max(...counts)) + 1;
    // Короткая часть — без дальних перелётов: до 4 дней только Россия, до 9 дней без дальнемагистральных
    const span = p.idx[p.idx.length - 1] - p.idx[0] + 1;
    const fits = r => r.cat === 'home' || span >= 10 || (span >= 5 ? !r.far : r.where === 'Россия' && !r.far);
    const pick = list => { const c = list.filter(r => !r.winIdx && r.months.includes(mm) && !used.has(r.id) && fits(r)); return c.length ? rnd(c) : null; };
    let r = p.kind === 2 ? (pick(spec.byMonth) || pick(near)) : (pick(spec.pool) || pick(TRAVEL));
    if (r) { used.add(r.id); notes[p.idx[0]] = r.id; }
  }
  return notes;
}
// Части на точные даты событий. Берём их из основного отпуска, пока остаётся место для части от 14 дней.
function presetWins(spec, L) {
  const blocks = [], skipped = []; let left = L;
  for (const r of spec.wins) {
    const len = r.winIdx.length, after = left - len;
    const has14 = len >= 14 || blocks.some(b => b.idx.length >= 14);
    if (after < 0 || (!has14 && after < 14) || onDoff(r.winIdx, spec)) { skipped.push(r.name); continue; }
    blocks.push({ idx: r.winIdx, id: r.id }); left = after;
  }
  return { blocks, left, skipped };
}
function tryPlan(spec, L, E, minFrac, goal, pre) {
  const sel = new Uint8Array(N), placed = [];
  if (pre) { for (const b of pre.blocks) { b.idx.forEach(i => sel[i] = 1); placed.push({ idx: b.idx, kind: 1, fixed: b.id }); } L = pre.left; }
  const parts = L > 0 ? splitMain(L, spec.months.size, goal) : [];
  const multi = parts.length > 1;
  // Главная поездка забирает самую длинную часть и встаёт первой
  let destLen = 0;
  if (spec.destSpec && parts.length) {
    let k = 0; parts.forEach((p, j) => { if (p > parts[k]) k = j; });
    destLen = parts.splice(k, 1)[0];
  }
  let gap = multi ? (spec.months.size >= 4 ? 28 : spec.months.size >= 2 ? 10 : 2) : 1;
  if (placed.length) gap = Math.min(gap, 10);
  // «Хочу продлить январские»: одна часть начинается сразу после каникул — доп. отпуск или самая короткая часть основного
  let extraDone = false;
  if (spec.janExtend) {
    if (E > 0 && S.prefs.extraMode !== 'attach') {
      const idx = takeFwd(JAN_START, E);
      if (onDoff(idx, spec)) return null;
      idx.forEach(i => sel[i] = 2); placed.push({ idx, kind: 2, separate: true, jan: true }); extraDone = true;
    } else if (parts.length) {
      let k = 0; parts.forEach((p, j) => { if (p < parts[k]) k = j; });
      const idx = takeFwd(JAN_START, parts.splice(k, 1)[0]);
      if (onDoff(idx, spec)) return null;
      idx.forEach(i => sel[i] = 1); placed.push({ idx, kind: 1, jan: true });
    }
  }
  // Для каждой части пробуем несколько стартов и берём лучший под цель
  const K = goal === 'standard' ? 2 : 8;
  const jobs = (destLen ? [{ len: destLen, dest: true }] : []).concat(parts.map(len => ({ len })));
  for (const job of jobs) {
    const len = job.len, sp = job.dest ? Object.assign({}, spec, spec.destSpec) : spec;
    let got = null, best = -Infinity, seen = 0;
    for (let a = 0; a < 80 && seen < K; a++) {
      const s = randomStart(sp, len, goal); if (s == null) break;
      const idx = takeFwd(s, len); if (!idx) continue;
      if (!idx.some(i => DAYS[i].work) || !janOK(idx, sp) || onDoff(idx, spec)) continue;
      if (fracIn(idx, sp.months) < (job.dest ? Math.max(minFrac, 0.5) : minFrac)) continue;
      if (!isFree(sel, idx[0] - gap, idx[idx.length - 1] + gap)) continue;
      seen++;
      const sc = goalScore(blockGain(idx), goal, 0.5);
      if (sc > best) { best = sc; got = idx; }
    }
    if (!got) return null;
    got.forEach(i => sel[i] = 1); placed.push(job.dest ? { idx: got, kind: 1, fixed: spec.dest.id } : { idx: got, kind: 1 });
  }
  if (E > 0 && !extraDone) {
    const ex = placeExtra(sel, spec, E, minFrac, placed, goal);
    if (!ex) return null;
    ex.idx.forEach(i => sel[i] = 2); placed.push({ idx: ex.idx, kind: 2, separate: ex.separate });
  }
  const ev = evalSel(sel);
  return { sel, notes: assignResorts(placed, spec), ev, score: goalScore(ev, goal) };
}
function generate() {
  const spec = allowedSpec(), L = S.mainDays, E = S.extraDays, goal = S.prefs.goal;
  spec.doff = new Uint8Array(N); for (let i = 0; i < N; i++) if (S.sel[i] === 3) spec.doff[i] = 1;
  if (L + E <= 0) { $('#genNote').textContent = 'Укажите наверху, сколько дней отпуска распределять.'; return; }
  const plans = [], pre = presetWins(spec, L);
  for (let t = 0; t < 700 && plans.length < 150; t++) {
    const minFrac = t < 350 ? 0.85 : t < 550 ? 0.5 : 0;
    const p = tryPlan(spec, L, E, minFrac, goal, pre); if (p) plans.push(p);
  }
  if (!plans.length) { $('#genNote').textContent = 'Не получилось разложить дни. Попробуйте снять часть фильтров.'; return; }
  plans.sort((a, b) => b.score - a.score);
  const pick = rnd(plans.slice(0, Math.min(goal === 'standard' ? 10 : 4, plans.length)));
  for (let i = 0; i < N; i++) if (spec.doff[i] && !pick.sel[i]) pick.sel[i] = 3;
  const before = snapshot();
  S.sel = pick.sel; S.notes = pick.notes; anchorPending = null; lastClick = null;
  commit(before);
  const md = model;
  const desc = iv => { const r = resortFor(iv); return `<b>${rangeLabel(iv.s, iv.e)}</b> (${dn(iv.vac)})${r ? ' — ' + esc(r.name) : ''}`; };
  const G = GOALS.find(g => g.id === goal);
  let html = `<b>${esc(G.name)}.</b> ` + md.main.map(desc).join(' · ');
  if (md.extra.length) html += (md.main.length ? ' · доп.: ' : 'Доп.: ') + md.extra.map(desc).join(', ');
  html += `. Отдых всего ${dn(md.restTotal)} за ${dn(md.usedM + md.usedE)} отпуска`;
  if (pick.ev.ratio != null) html += `, разница к обычной зарплате ${pick.ev.diff >= 0 ? '+' : '−'}${pct(Math.abs(pick.ev.diff))} заработка за год`;
  html += '.';
  if (spec.note) html += ' ' + esc(spec.note);
  if (pre.skipped.length) html += ' Не поместилось: ' + esc(pre.skipped.join(', ')) + ' — не хватило дней, чтобы осталась часть от 14 дней.';
  html += ' Нажмите «Собрать вариант» ещё раз — будет другой, «Отменить» вернёт прежний.';
  $('#genNote').innerHTML = html;
  document.getElementById('calendar').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
function renderGenSum() {
  const spec = allowedSpec();
  let t;
  if (!spec.active && !spec.wins.length) t = 'Ничего не выбрано: подберу ' + spec.auto + ', куда поехать — по сезону.';
  else if (!spec.active) t = 'Остальные части подберу ' + spec.auto + '.';
  else {
    t = 'Подберу в: ' + monthsLabel(spec.months) + '. Куда: ' + (spec.byMonth.length && spec.pool === spec.byMonth ? spec.byMonth.map(r => r.name).join(', ') : 'любые подходящие по сезону') + '.';
    if (spec.note) t += ' ' + spec.note;
  }
  if (spec.wins.length) t += ' На точные даты: ' + spec.wins.map(r => r.name + ' (' + rangeLabel(r.winIdx[0], r.winIdx[r.winIdx.length - 1]) + ')').join(', ') + '.';
  if (spec.dest) t += spec.destSpec ? ' Главная поездка: ' + spec.dest.name + ' (' + monthsLabel(spec.destSpec.months) + ').' : ' Главная поездка: ' + spec.dest.name + ' — её сезон только в январе, включите «Хочу продлить январские».';
  if (spec.janExtend) t += ' Январские продлю: ' + (S.extraDays > 0 && S.prefs.extraMode !== 'attach' ? 'доп. отпуск' : 'самая короткая часть отпуска') + ' начнётся 11 января.';
  $('#genSum').textContent = t;
}
function syncChips() {
  document.querySelectorAll('[data-res]').forEach(el => el.setAttribute('aria-pressed', String(S.prefs.resorts.includes(el.dataset.res))));
  document.querySelectorAll('[data-season]').forEach(el => el.setAttribute('aria-pressed', String(S.prefs.seasons.includes(el.dataset.season))));
  document.querySelectorAll('[data-month]').forEach(el => el.setAttribute('aria-pressed', String(S.prefs.months.includes(+el.dataset.month))));
  document.querySelectorAll('[data-goal]').forEach(el => el.setAttribute('aria-checked', String(S.prefs.goal === el.dataset.goal)));
  document.querySelectorAll('[data-cat]').forEach(el => {
    const all = RESORTS.filter(r => r.cat === el.dataset.cat).every(r => S.prefs.resorts.includes(r.id));
    el.setAttribute('aria-pressed', String(all));
    el.querySelector('span').textContent = all ? 'снять все' : 'выбрать все';
  });
  $('#extraMode').value = S.prefs.extraMode;
  $('#janExtend').checked = !!S.prefs.janExtend;
  $('#mainDest').value = S.prefs.mainDest || '';
  renderGenSum();
}
function toggleIn(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
