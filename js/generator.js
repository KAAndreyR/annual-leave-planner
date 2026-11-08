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
    if (g === 'money') { const ms = new Set(all.filter(m => MONTH_INFO[m].work >= GOOD_WORK)); return { ms, t: `только месяцы с ${GOOD_WORK}+ рабочими днями: ` + monthsLabel(ms) }; }
    return { ms: new Set(all), t: g === 'rest' ? 'с февраля по декабрь, с упором на праздники' : 'с февраля по декабрь' };
  };
  let auto = '';
  if (!months) { const a = autoFor(P.goal); months = a.ms; auto = a.t; }
  // Январь — только с галкой «Хочу продлить январские»; явно выбранный январь тогда тоже можно занимать
  const janExtend = !!P.janExtend;
  const janAll = janExtend && months.has(0);
  if (!janAll && months.has(0)) {
    months = new Set([...months].filter(m => m !== 0));
    note = (note ? note + ' ' : '') + 'Январь пропускаю: в нём всего 15 рабочих дней. Чтобы взять его, включите «Хочу продлить январские».';
    if (!months.size) { const a = autoFor(P.goal); months = a.ms; auto = a.t; }
  }
  // Главная поездка: часть от 14 дней ставим в её сезон (январь — только с галкой)
  const dest = P.mainDest ? RES_BY_ID[P.mainDest] : null;
  let destSpec = null;
  if (dest) {
    const dm = new Set(dest.months.map(m => m - 1).filter(m => m !== 0 || janExtend));
    if (dm.size) destSpec = Object.assign({}, { months: dm, janAll: janExtend && dm.has(0) });
  }
  const special = (P.special || []).map(x => x.i);
  return { months, pool, chosen, byMonth, wins, note, auto, janExtend, janAll, dest, destSpec, special, active: M.size > 0 || R.size > 0 };
}
// Можно ли занимать эти дни: январь — только когда он разрешён
const janOK = (idx, spec) => spec.janAll || idx.every(i => DAYS[i].m !== 0);
// Дейоффы ставят только вручную; подбор их сохраняет и отпуск на них не кладёт
const onDoff = (idx, spec) => !!spec.doff && idx.some(i => spec.doff[i]);
// Особые даты: часть, которая их захватывает, можно ставить и в январь, и вне выбранных месяцев
const coversSpecial = (idx, spec) => !!spec.special && spec.special.some(d => d >= idx[0] && d <= idx[idx.length - 1]);
const SPECIAL_W = 40;
// len дней подряд от s без праздников и дейоффов: дейоффы остаются дейоффами и не рвут отдых
function takeFwdAround(s, len, spec) { const idx = []; for (let i = s; i < N && idx.length < len; i++) if (!DAYS[i].hol && !(spec.doff && spec.doff[i])) idx.push(i); return idx.length === len ? idx : null; }
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
function splitMain(L, mc, goal, nSpecial = 0) {
  if (L <= 16) return [L];
  // Много особых дат — больше частей, чтобы на каждую хватило
  const maxParts = Math.max(mc <= 2 ? 2 : 4, Math.min(5, nSpecial));
  let first, pieces;
  // Одна часть — ровно 14 дней (в «выгоде» 16: с субботы по воскресенье), остальное неделями — так отпуск ложится равномернее
  // Длины под недели: 7 и 14 — с понедельника по воскресенье, 5 — будни, 9 и 16 — с субботы по воскресенье
  if (goal === 'money') { first = 16; pieces = [9, 9, 16]; }
  else if (goal === 'rest') { first = 14; pieces = [5, 9, 9]; }
  else { first = 14; pieces = [7, 7, 7, 14]; }
  if (nSpecial >= 3) {
    // Частей основного — на одну меньше, чем дат: ещё одну обычно берёт доп. отпуск
    const k = Math.max(1, Math.min(maxParts, nSpecial - 1) - 1), left = L - Math.min(first, L);
    if (left >= 3 * k) return [Math.min(first, L)].concat(Array.from({ length: k }, (_, j) => Math.floor(left / k) + (j < left % k ? 1 : 0)));
  }
  first = Math.min(first, L);
  if (L - first > 0 && L - first < 3) first = L; // не оставляем хвост в 1–2 дня
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
  // Особые даты: часто ставим часть так, чтобы она их захватила
  if (spec.special && spec.special.length && Math.random() < 0.5) {
    const d = rnd(spec.special), good = [];
    for (let s = Math.max(0, d - len - 3); s <= d; s++) {
      if (DAYS[s].hol) continue;
      const prevOff = s > 0 && DAYS[s - 1].off;
      if ((!DAYS[s].off && prevOff) || (goal === 'money' && DAYS[s].off && !prevOff)) good.push(s);
    }
    if (good.length) return rnd(good);
    let i = Math.max(0, d - Math.floor(Math.random() * len));
    while (i < N - 1 && DAYS[i].hol) i++;
    return i;
  }
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
    : (q < 0.75 ? 0 : -1);
  if (target >= 0) while (i > 0 && i < N - 1 && DAYS[i].dow !== target) i += dir;
  while (i < N - 1 && DAYS[i].hol) i++;
  return i;
}
// Ровность краёв части. Хорошо: начать после выходных/праздника или в субботу, закончить перед выходными или в воскресенье.
// Плохо: начать или закончить посреди выходных (воскресенье / суббота) — дни отпуска уходят на половину выходных;
// чуть хуже: оборвать посреди недели.
const EDGE_HALF = 8, EDGE_MID = 3;
function edgePenalty(a, b, isOff = i => DAYS[i].off) {
  let p = 0;
  const prevOff = a > 0 && isOff(a - 1), nextOff = b < N - 1 && isOff(b + 1);
  if (DAYS[a].off && prevOff) p += EDGE_HALF; else if (!DAYS[a].off && !prevOff) p += EDGE_MID;
  if (DAYS[b].off && nextOff) p += EDGE_HALF; else if (!DAYS[b].off && !nextOff) p += EDGE_MID;
  return p;
}
// Лишние выходные в отпуске: в целых неделях их 2 из 7, всё сверх — дни отпуска, потраченные на дни,
// которые и так свободны. «Стандартный» этого избегает, «Максимальная выгода» — наоборот, ищет.
const OFF_W = { rest: 0, standard: 10, money: 0 };
function excessOff(idx) {
  let off = 0;
  for (const i of idx) if (!DAYS[i].work) off++;
  return Math.max(0, off - Math.floor(idx.length * 2 / 7));
}
// Вклад части: сколько дней отдыха подряд она даёт (с выходными по краям) и разница отпускных и потерянной зарплаты, % месячного заработка
function blockGain(idx) {
  let a = idx[0], b = idx[idx.length - 1];
  while (a > 0 && DAYS[a - 1].off) a--;
  while (b < N - 1 && DAYS[b + 1].off) b++;
  const dp = dayPct(); let diff = 0;
  for (const i of idx) { diff += dp; if (DAYS[i].work) diff -= 100 / MONTH_INFO[DAYS[i].m].work; }
  return { rest: b - a + 1, diff, align: edgePenalty(idx[0], idx[idx.length - 1]), excess: excessOff(idx) };
}
// Веса цели: [отдых, деньги, случайность]
const GOAL_W = { rest: [1, 0.05, 2], standard: [1, 1, 3], money: [0.1, 1, 0.8] };
function goalScore(ev, goal, noise = 1) { const w = GOAL_W[goal] || GOAL_W.standard; return ev.rest * w[0] + ev.diff * w[1] + (ev.even || 0) * (EVEN_W[goal] || 0) + (ev.special || 0) * SPECIAL_W - (ev.align || 0) - (ev.excess || 0) * (OFF_W[goal] || 0) + Math.random() * w[2] * noise; }
// Равномерность: насколько части разнесены по году (1 — идеально поровну, 0 — вплотную)
const EVEN_W = { rest: 4, standard: 14, money: 6 };
function evenness(placed) {
  const starts = placed.filter(p => p.kind === 1 || p.separate).map(p => p.idx[0]).sort((a, b) => a - b);
  if (starts.length < 2) return 0.5;
  const gaps = starts.slice(1).map((s, k) => s - starts[k]);
  gaps.push(N - starts[starts.length - 1] + starts[0]);
  return Math.min(1, Math.min(...gaps) / (N / starts.length));
}
// Доп. отпуск — последним: после последней части основного и ближе к концу года
const LATE_W = 12;
function bridgeExtra(sel, spec, E, minFrac, goal, lastMain) {
  const cands = [];
  for (let s = 0; s < N; s++) {
    if (DAYS[s].off) continue;
    const idx = takeFwd(s, E); if (!idx) continue;
    const sp = coversSpecial(idx, spec);
    if (!sp && fracIn(idx, spec.months) < minFrac) continue;
    if (!isFree(sel, idx[0] - 7, idx[idx.length - 1] + 7)) continue;
    if (!idx.some(i => DAYS[i].work) || (!janOK(idx, spec) && !sp) || onDoff(idx, spec)) continue;
    const late = (idx[0] > lastMain ? LATE_W : 0) + idx[0] / N * 6;
    cands.push({ idx, score: goalScore(blockGain(idx), goal, 0.5) + (sp ? SPECIAL_W : 0) + late });
  }
  if (!cands.length) return null;
  cands.sort((x, y) => y.score - x.score);
  return rnd(cands.slice(0, goal === 'standard' ? 6 : 3)).idx;
}
function placeExtra(sel, spec, E, minFrac, placed, goal) {
  let mode = S.prefs.extraMode;
  // Отдельно чаще: вплотную к двум неделям доп. отпуск даёт почти три недели подряд
  if (mode === 'auto') mode = Math.random() < 0.2 ? 'attach' : 'bridge';
  const mains = placed.filter(p => p.kind === 1);
  const lastMain = mains.length ? Math.max(...mains.map(p => p.idx[p.idx.length - 1])) : -1;
  if (mode === 'bridge' || !placed.length) {
    const b = bridgeExtra(sel, spec, E, minFrac, goal, lastMain);
    if (b) return { idx: b, separate: true };
    if (!placed.length) return null;
  }
  // Вплотную — к последней части основного, сначала после неё
  for (const p of mains.slice().sort((a, b) => b.idx[0] - a.idx[0])) {
    for (const dir of [1, -1]) {
      let from = dir > 0 ? p.idx[p.idx.length - 1] + 1 : p.idx[0] - 1;
      if (goal !== 'money') while (from >= 0 && from < N && DAYS[from].off) from += dir;
      if (from < 0 || from >= N) continue;
      const idx = dir > 0 ? takeFwd(from, E) : takeBack(from, E);
      if (idx && idx.every(i => !sel[i]) && idx.some(i => DAYS[i].work) && (p.jan || janOK(idx, spec) || coversSpecial(idx, spec)) && !onDoff(idx, spec)) return { idx, separate: false };
    }
  }
  return null;
}
// Весь план: дней отдыха подряд с выходными и праздниками + разница отпускных и потерянной зарплаты
function evalSel(sel, special) {
  const chains = buildIntervals(sel, v => v > 0, 0);
  const mark = new Uint8Array(N); let rest = 0;
  for (const c of chains) for (let k = c.ra; k <= c.rb; k++) if (!mark[k]) { mark[k] = 1; rest++; }
  const dp = dayPct(); let pay = 0, lost = 0;
  for (let i = 0; i < N; i++) if (sel[i]) { pay += dp; if (DAYS[i].work) lost += 100 / MONTH_INFO[DAYS[i].m].work; }
  let align = 0, excess = 0;
  for (const c of buildIntervals(sel, v => v === 1 || v === 2, 0)) {
    align += edgePenalty(c.s, c.e, i => DAYS[i].off || sel[i] === 3);
    const idx = []; for (let k = c.s; k <= c.e; k++) if (sel[k] === 1 || sel[k] === 2) idx.push(k);
    excess += excessOff(idx);
  }
  return { rest, diff: pay - lost, ratio: lost > 0 ? pay / lost * 100 : null, special: special ? special.filter(d => mark[d]).length : 0, align, excess };
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
    // Если направления выбраны — предлагаем только их; не подошло ни одно — часть остаётся без направления
    const own = spec.byMonth.length > 0 && spec.pool === spec.byMonth;
    let r = p.kind === 2 ? (pick(spec.byMonth) || (own ? null : pick(near))) : (pick(spec.pool) || (own ? null : pick(TRAVEL)));
    if (r) { used.add(r.id); notes[p.idx[0]] = r.id; }
  }
  return notes;
}
// Части на точные даты событий. Берём их из основного отпуска, пока остаётся место для части от 14 дней.
function presetWins(spec, L) {
  const blocks = [], skipped = [], skippedDoff = []; let left = L;
  for (const r of spec.wins) {
    const len = r.winIdx.length, after = left - len;
    const has14 = len >= 14 || blocks.some(b => b.idx.length >= 14);
    if (onDoff(r.winIdx, spec)) { skippedDoff.push(r.name); continue; }
    if (after < 0 || (!has14 && after < 14)) { skipped.push(r.name); continue; }
    blocks.push({ idx: r.winIdx, id: r.id }); left = after;
  }
  return { blocks, left, skipped, skippedDoff };
}
function tryPlan(spec, L, E, minFrac, goal, pre) {
  const sel = new Uint8Array(N), placed = [];
  if (pre) { for (const b of pre.blocks) { b.idx.forEach(i => sel[i] = 1); placed.push({ idx: b.idx, kind: 1, fixed: b.id }); } L = pre.left; }
  const parts = L > 0 ? splitMain(L, spec.months.size, goal, spec.special.length) : [];
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
  let extraDone = false, janMiss = false;
  if (spec.janExtend) {
    if (E > 0 && S.prefs.extraMode !== 'attach') {
      const idx = takeFwdAround(JAN_START, E, spec);
      if (idx) { idx.forEach(i => sel[i] = 2); placed.push({ idx, kind: 2, separate: true, jan: true }); extraDone = true; }
    } else if (parts.length) {
      let k = 0; parts.forEach((p, j) => { if (p < parts[k]) k = j; });
      const idx = takeFwdAround(JAN_START, parts.splice(k, 1)[0], spec);
      if (idx) { idx.forEach(i => sel[i] = 1); placed.push({ idx, kind: 1, jan: true }); }
    } else janMiss = true; // весь основной отпуск ушёл на главную поездку
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
      if (!idx.some(i => DAYS[i].work) || onDoff(idx, spec)) continue;
      const special = !job.dest && coversSpecial(idx, spec);
      if (!janOK(idx, sp) && !special) continue;
      if (!special && fracIn(idx, sp.months) < (job.dest ? Math.max(minFrac, 0.5) : minFrac)) continue;
      if (!isFree(sel, idx[0] - gap, idx[idx.length - 1] + gap)) continue;
      seen++;
      const sc = goalScore(blockGain(idx), goal, 0.5) + (special ? SPECIAL_W : 0);
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
  const ev = evalSel(sel, spec.special);
  ev.even = evenness(placed);
  return { sel, notes: assignResorts(placed, spec), ev, score: goalScore(ev, goal), janMiss };
}
// Подбор без записи в план: { pick, spec, pre, goal, L } или { error }
function makePlan() {
  const spec = allowedSpec(), L = S.mainDays, E = S.extraDays, goal = S.prefs.goal;
  spec.doff = new Uint8Array(N); for (let i = 0; i < N; i++) if (S.sel[i] === 3) spec.doff[i] = 1;
  if (L + E <= 0) return { error: 'Укажите наверху, сколько дней отпуска распределять.' };
  const plans = [], pre = presetWins(spec, L);
  for (let t = 0; t < 700 && plans.length < 150; t++) {
    const minFrac = t < 350 ? 0.85 : t < 550 ? 0.5 : 0;
    const p = tryPlan(spec, L, E, minFrac, goal, pre); if (p) plans.push(p);
  }
  if (!plans.length) return { error: 'Не получилось разложить дни. Попробуйте снять часть фильтров.' };
  plans.sort((a, b) => b.score - a.score);
  const pick = rnd(plans.slice(0, Math.min(goal === 'standard' ? 10 : 4, plans.length)));
  for (let i = 0; i < N; i++) if (spec.doff[i] && !pick.sel[i]) pick.sel[i] = 3;
  return { pick, spec, pre, goal, L };
}
function generate() {
  const res = makePlan();
  if (res.error) { $('#genNote').textContent = res.error; return; }
  const { pick, spec, pre, goal, L } = res;
  const before = snapshot();
  S.sel = pick.sel; S.notes = pick.notes; lastClick = null;
  commit(before);
  const md = model;
  const desc = iv => { const r = resortFor(iv); return `<b>${rangeLabel(iv.s, iv.e)}</b> (${dn(iv.vac)})${r ? ' — ' + esc(r.name) : ''}`; };
  const G = GOALS.find(g => g.id === goal);
  let html = `<b>${esc(G.name)}.</b> ` + md.main.map(desc).join(' · ');
  if (md.extra.length) html += (md.main.length ? ' · доп.: ' : 'Доп.: ') + md.extra.map(desc).join(', ');
  html += `. Отдых всего ${dn(md.restTotal)} за ${dn(md.usedM + md.usedE)} отпуска`;
  if (pick.ev.ratio != null) html += `, разница с обычной зарплатой ${pick.ev.diff >= 0 ? '+' : '−'}${pct(Math.abs(pick.ev.diff))} месячного заработка`;
  html += '.';
  if (spec.note) html += ' ' + esc(spec.note);
  if (pre.skipped.length) html += ' Не поместилось: ' + esc(pre.skipped.join(', ')) + ' — не хватило дней, чтобы осталась часть от 14 дней.';
  if (pre.skippedDoff.length) html += ' Не поставил ' + esc(pre.skippedDoff.join(', ')) + ': на эти даты стоит дейофф.';
  if (pick.janMiss) html += ' Январские не продлил: весь основной отпуск ушёл на главную поездку, а отдельного доп. отпуска нет.';
  if (L > 0 && L < 14) html += ' Основного отпуска меньше 14 дней — части от 14 дней не будет (ст. 125 ТК).';
  if (spec.special.length) {
    const miss = S.prefs.special.filter(x => !(S.sel[x.i] || md.insideHol[x.i] || md.rest[x.i]));
    html += ` Особые даты в отдыхе: ${spec.special.length - miss.length} из ${spec.special.length}`
      + (miss.length ? ' (не вошло: ' + esc(miss.map(x => dLabel(x.i) + (x.label ? ' — ' + x.label : '')).join(', ')) + ')' : '') + '.';
  }
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
  if (spec.special.length) t += ' Особые даты: ' + spec.special.length + ' — постараюсь захватить их отдыхом.';
  if (spec.janExtend && spec.dest && !(S.extraDays > 0 && S.prefs.extraMode !== 'attach') && S.mainDays <= 16) t += ' Январские не продлю: весь основной отпуск уйдёт на главную поездку — добавьте отдельный доп. отпуск.';
  else if (spec.janExtend) t += ' Январские продлю: ' + (S.extraDays > 0 && S.prefs.extraMode !== 'attach' ? 'доп. отпуск' : 'самая короткая часть отпуска') + ' начнётся 11 января.';
  // В блоке на странице — с целью и подсказкой, где всё выбирать
  const goalName = (GOALS.find(g => g.id === S.prefs.goal) || GOALS[1]).name;
  const nothing = !spec.active && !spec.wins.length && !spec.special.length && !spec.dest && !spec.janExtend;
  const card = nothing
    ? `Цель — «${goalName}», больше ничего не выбрано. Цель, направления, месяцы и особые даты выбираются в «Настроить подбор». Или сразу «Собрать вариант» — подберу ${spec.auto}.`
    : `Цель — «${goalName}». ` + t;
  document.querySelectorAll('[data-gensum]').forEach(el => { el.textContent = el.dataset.gensum === 'card' ? card : t; });
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
  renderSpecial();
  renderGenSum();
}
function renderSpecial() {
  const box = $('#specialChips'), list = S.prefs.special || [];
  box.innerHTML = list.length
    ? list.map(x => `<button type="button" class="chip special-chip" data-special-del="${x.i}" title="Убрать"><b>${esc(dLabel(x.i))}</b><span>${x.label ? esc(x.label) + ' · ' : ''}убрать ×</span></button>`).join('')
    : '<p class="fine">Пока нет. Например, день рождения, свадьба друзей или концерт.</p>';
}
function toggleIn(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
