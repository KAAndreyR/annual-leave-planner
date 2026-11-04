// Сетка календаря, интервалы, проверки по ТК, деньги, экспорт.
'use strict';

// ---------- Построение статики ----------
const monthsEl = $('#months');
let cells = [];

function buildBars() {
  const max = 23, h = 80;
  let html = `<div class="guide" style="bottom:${(20 / max * h + 18).toFixed(1)}px"><span>20</span></div>`;
  MONTH_INFO.forEach((M, m) => {
    html += `<div class="bar${M.work >= 20 ? ' good' : ''}" title="${MONTHS[m]}: ${M.work} рабочих дней, ${M.hours} ч"><b>${M.work}</b><i style="height:${(M.work / max * h).toFixed(1)}px"></i><span>${MON_LETTER[m]}</span></div>`;
  });
  $('#bars').innerHTML = html;
}
function dayTitle(D) {
  const parts = [D.d + ' ' + MON_GEN[D.m] + ', ' + DOW_FULL[D.dow]];
  if (D.hol) parts.push(D.hol + ' — праздник, в отпуск не входит');
  if (D.tr) parts.push(D.tr + ' — в отпуск входит');
  if (D.ws) parts.push(D.ws);
  if (D.short) parts.push('Сокращённый на час предпраздничный день');
  return parts.join('. ');
}
function buildCalendar() {
  let html = '';
  for (let m = 0; m < 12; m++) {
    const M = MONTH_INFO[m];
    html += `<article class="month${M.work >= 20 ? ' good' : ''}" data-m="${m}"><header><h3>${MONTHS[m]}</h3><span class="wd" title="Норма при 40-часовой неделе: ${M.hours} ч">${M.work} раб. ${plural(M.work, 'день', 'дня', 'дней')}</span></header>`;
    html += `<div class="dow">${DOW.map((d, k) => `<span class="${k >= 5 ? 'we' : ''}">${d}</span>`).join('')}</div><div class="grid">`;
    for (let k = 0; k < DAYS[M.start].dow; k++) html += '<span></span>';
    for (let i = M.start; i < M.start + M.len; i++) {
      const D = DAYS[i], cls = ['day'];
      if (D.off) cls.push('off'); if (D.hol) cls.push('hol'); if (D.tr) cls.push('tr'); if (D.ws) cls.push('ws'); if (D.short) cls.push('short');
      html += `<button type="button" class="${cls.join(' ')}" data-i="${i}" title="${esc(dayTitle(D))}" aria-label="${esc(dayTitle(D))}">${D.d}</button>`;
    }
    html += `</div><div class="msum" data-msum="${m}"></div></article>`;
  }
  monthsEl.innerHTML = html;
  cells = Array.from(monthsEl.querySelectorAll('.day'));
}
function buildChips() {
  $('#goalSeg').innerHTML = GOALS.map(g => `<button type="button" class="goal" role="radio" data-goal="${g.id}" aria-checked="false"><b>${esc(g.name)}</b><span>${esc(g.desc)}</span></button>`).join('');
  $('#mainDest').innerHTML = '<option value="">Любое — подберу сам</option>' + CATS.map(c => `<optgroup label="${esc(c.name)}">` +
    RESORTS.filter(r => r.cat === c.id && !r.winIdx).map(r => `<option value="${r.id}">${esc(r.name)}${r.where && r.where !== 'Россия' ? ', ' + esc(r.where) : ''} · ${monthsLabel(resortMonths(r))}</option>`).join('') + '</optgroup>').join('');
  $('#resHead').textContent = 'Куда или зачем · ' + RESORTS.length + ' ' + plural(RESORTS.length, 'вариант', 'варианта', 'вариантов');
  $('#resortChips').innerHTML = CATS.map(c => {
    const list = RESORTS.filter(r => r.cat === c.id);
    const chips = list.map(r => {
      let sub;
      if (r.winIdx) {
        const a = r.winIdx[0], b = r.winIdx[r.winIdx.length - 1], g = blockGain(r.winIdx);
        sub = rangeLabel(a, b) + ' · отдых ' + dn(g.rest) + ' подряд' + (r.note ? ', ' + r.note : '');
      } else sub = [[r.where, r.note].filter(Boolean).join(', '), monthsLabel(resortMonths(r))].filter(Boolean).join(' · ');
      return `<button type="button" class="chip" data-res="${r.id}" aria-pressed="false"><b>${esc(r.name)}</b><span>${esc(sub)}</span></button>`;
    }).join('');
    return `<div class="res-group"><button type="button" class="res-cat" data-cat="${c.id}" aria-pressed="false" title="Отметить или снять все направления раздела">${esc(c.name)}<span>выбрать все</span></button>${chips}</div>`;
  }).join('');
  $('#seasonChips').innerHTML = SEASONS.map(s => `<button type="button" class="chip" data-season="${s.id}" aria-pressed="false"><b>${s.name}</b><span>${monthsLabel(new Set(s.months.map(m => m - 1)))}</span></button>`).join('');
  $('#monthChips').innerHTML = MONTH_INFO.map((M, m) => `<button type="button" class="chip mon${M.work >= 20 ? ' good' : ''}" data-month="${m + 1}" aria-pressed="false" title="${MONTHS[m]}: ${M.work} рабочих дней"><b>${MON_SH[m]}</b><span>${M.work}</span></button>`).join('');
}

// ---------- Рендер ----------
function render() {
  model = computeModel();
  paint(model);
  renderTally(model);
  renderChecks(model);
  renderIntervals(model);
  renderMoney(model);
  renderMonthSums(model);
  renderExport(model);
  $('#exampleBanner').hidden = !S.example;
  $('#undoBtn').disabled = !undo.length;
}
function paint(md) {
  const sel = S.sel;
  const key = i => sel[i] ? 'v' + sel[i] : md.insideHol[i] ? 'v' + md.insideHol[i] : md.rest[i] ? 'r' : '';
  for (let i = 0; i < N; i++) {
    const c = cells[i], k = sel[i], ih = md.insideHol[i];
    c.classList.toggle('s-m', k === 1);
    c.classList.toggle('s-e', k === 2);
    c.classList.toggle('s-d', k === 3);
    c.classList.toggle('s-h', ih > 0);
    c.classList.toggle('hk2', ih === 2);
    c.classList.toggle('rest', !k && !ih && md.rest[i] === 1);
    const me = key(i);
    const prev = i > 0 && DAYS[i].dow !== 0 && DAYS[i].d !== 1 && me && key(i - 1) === me;
    const next = i < N - 1 && DAYS[i].dow !== 6 && DAYS[i + 1].d !== 1 && me && key(i + 1) === me;
    c.classList.toggle('el', !prev);
    c.classList.toggle('er', !next);
    c.classList.toggle('anchor', shiftHeld && lastClick === i);
  }
  const spec = allowedSpec();
  monthsEl.querySelectorAll('.month').forEach(el => el.classList.toggle('pref', spec.active && spec.months.has(+el.dataset.m)));
}
function tallyPill(label, used, target) {
  let cls = 'warn';
  if (used === target) cls = 'ok'; else if (used > target) cls = 'bad';
  if (!target && !used) cls = '';
  return `<span class="pill ${cls}">${label} ${used} / ${target}</span>`;
}
function renderTally(md) {
  const issues = md._issues || 0;
  $('#tally').innerHTML = tallyPill('Основной', md.usedM, S.mainDays) + tallyPill('Доп.', md.usedE, S.extraDays) +
    (S.dayoffDays || md.usedD ? tallyPill('Дейоффы', md.usedD, S.dayoffDays) : '') +
    `<span class="pill">Отдых всего ${md.restTotal} ${plural(md.restTotal, 'день', 'дня', 'дней')}</span>`;
}
function renderChecks(md) {
  const out = [];
  const add = (lvl, html) => out.push({ lvl, html });
  if (!md.usedM && !md.usedE && !md.usedD) {
    add('info', 'Пока ничего не отмечено. Нажмите на дни в календаре или соберите вариант выше.');
  } else {
    const long = md.main.find(iv => iv.vac >= 14);
    if (long) add('ok', `Есть часть от 14 дней: ${rangeLabel(long.s, long.e)}, ${dn(long.vac)} (ст. 125 ТК).`);
    else {
      const ch = md.vchains.find(c => c.vac >= 14);
      if (ch) add('warn', `14 дней подряд набирается только вместе с доп. отпуском (${rangeLabel(ch.s, ch.e)}). По ст. 120 ТК дополнительный отпуск суммируется с основным, но лучше заранее уточнить у работодателя.`);
      else add('bad', 'Нет части отпуска от 14 дней подряд. По ст. 125 ТК хотя бы одна часть должна быть не короче 14 календарных дней.');
    }
    if (md.usedM === S.mainDays) add('ok', `Основной отпуск: распределены все ${dn(S.mainDays)}.`);
    else if (md.usedM < S.mainDays) add('warn', `Основной отпуск: распределено ${md.usedM} из ${S.mainDays}, осталось ${dn(S.mainDays - md.usedM)}.`);
    else add('bad', `Основной отпуск: отмечено ${md.usedM}, это на ${dn(md.usedM - S.mainDays)} больше положенного.`);
    if (S.extraDays || md.usedE) {
      if (md.usedE === S.extraDays) add('ok', `Доп. отпуск: распределены все ${dn(S.extraDays)}.`);
      else if (md.usedE < S.extraDays) add('warn', `Доп. отпуск: распределено ${md.usedE} из ${S.extraDays}, осталось ${dn(S.extraDays - md.usedE)}.`);
      else add('bad', `Доп. отпуск: отмечено ${md.usedE}, это на ${dn(md.usedE - S.extraDays)} больше положенного.`);
    }
    if (S.dayoffDays || md.usedD) {
      if (md.usedD === S.dayoffDays) add('ok', `Дейоффы: расставлены все ${S.dayoffDays}.`);
      else if (md.usedD < S.dayoffDays) add('warn', `Дейоффы: отмечено ${md.usedD} из ${S.dayoffDays}. Их ставят только вручную, кистью «Дейофф».`);
      else add('bad', `Дейоффы: отмечено ${md.usedD}, это на ${md.usedD - S.dayoffDays} больше, чем есть.`);
    }
    for (const iv of md.main.concat(md.extra)) {
      if (iv.work === 0) add('bad', `${rangeLabel(iv.s, iv.e)} (${iv.kind === 2 ? 'доп.' : 'основной'}): только выходные. Отпуск только на выходные по ТК взять нельзя, в части должен быть хотя бы один рабочий день.`);
    }
    if (md.main.length + md.extra.length > 1 && !out.some(o => o.lvl === 'bad')) {
      add('info', 'Делить отпуск на части можно только по соглашению с работодателем (ст. 125 ТК).');
    }
  }
  const icon = { ok: '✓', warn: '!', bad: '×', info: 'i' };
  $('#checks').innerHTML = out.map(o => `<li class="${o.lvl}"><span class="ic" aria-hidden="true">${icon[o.lvl]}</span><span>${o.html}</span></li>`).join('');
  md._issues = out.filter(o => o.lvl === 'bad' || o.lvl === 'warn').length;
  const nBad = out.filter(o => o.lvl === 'bad').length, nWarn = out.filter(o => o.lvl === 'warn').length;
  const parts = md.main.length + md.extra.length, sum = $('#sumChecks');
  if (!parts && !md.usedD) { sum.textContent = 'пока ничего не отмечено'; sum.className = 'fold-sum'; }
  else {
    const what = nBad ? nBad + ' ' + plural(nBad, 'ошибка', 'ошибки', 'ошибок') : nWarn ? nWarn + ' ' + plural(nWarn, 'замечание', 'замечания', 'замечаний') : 'всё по ТК';
    sum.textContent = parts + ' ' + plural(parts, 'часть', 'части', 'частей') + ' · ' + what;
    sum.className = 'fold-sum ' + (nBad ? 'bad' : nWarn ? 'warn' : 'ok');
  }
}
function resortSelect(iv) {
  const mm = majorMonth(iv) + 1, cur = resortFor(iv);
  const opt = r => `<option value="${r.id}"${cur && cur.id === r.id ? ' selected' : ''}>${esc(r.name)}${r.where && r.where !== 'Россия' ? ', ' + esc(r.where) : ''}</option>`;
  const fit = RESORTS.filter(r => r.months.includes(mm)), other = RESORTS.filter(r => !r.months.includes(mm));
  return `<select class="place" data-s="${iv.s}" data-e="${iv.e}" aria-label="Куда поехать"><option value="">Куда — не выбрано</option><optgroup label="Сезон подходит (${MON_SH[mm - 1]})">${fit.map(opt).join('')}</optgroup><optgroup label="Не сезон">${other.map(opt).join('')}</optgroup></select>`;
}
function ivHTML(iv) {
  const dp = dayPct(), pay = iv.vac * dp, lost = lostPct(iv.workBy);
  const sal = S.salary ? +S.salary : 0;
  const meta = [];
  meta.push(`отдых подряд <b>${dn(iv.streak)}</b>${iv.streak > iv.vac + iv.hol ? ' · ' + rangeLabel(iv.ra, iv.rb) : ''}`);
  meta.push(`рабочих дней <b>${iv.work}</b>`);
  if (iv.hol) meta.push(`<span class="tag">+${iv.hol} ${plural(iv.hol, 'праздник', 'праздника', 'праздников')}, не в счёт</span>`);
  if (iv.work > 0 && iv.wk === 0) meta.push('<span class="tag">только будни</span>');
  let money;
  if (iv.work > 0) {
    const d = pay - lost, s = d >= 0 ? '+' : '−';
    money = `разница <b>${s}${pct(Math.abs(d))}</b> заработка${sal ? ` (${s}${rub(Math.abs(d) / 100 * sal)})` : ''}: отпускные ${pct(pay)} против зарплаты ${pct(lost)} за ${iv.work} раб. ${plural(iv.work, 'день', 'дня', 'дней')}`;
  } else {
    money = '';
  }
  const r = resortFor(iv);
  const mm = majorMonth(iv) + 1;
  const offSeason = r && !r.months.includes(mm) ? `<span class="tag off">не сезон: лучше ${monthsLabel(resortMonths(r))}</span>` : '';
  const warn = iv.work === 0 ? `<p class="iv-warn">Только выходные: так отпуск по ТК не оформить. Добавьте в эту часть хотя бы один рабочий день.</p>` : '';
  return `<li class="iv k${iv.kind}${iv.work === 0 ? ' flag' : ''}">
    <div class="iv-top"><span class="iv-dates">${rangeLabel(iv.s, iv.e)}</span><span class="iv-dow">${DOW[DAYS[iv.s].dow]}–${DOW[DAYS[iv.e].dow]}</span><span class="iv-n">${dn(iv.vac)}</span></div>
    <div class="iv-meta">${meta.map(x => `<span>${x}</span>`).join('')}</div>
    ${money ? `<div class="iv-money">${money}</div>` : ''}
    <div class="iv-place">${resortSelect(iv)}${offSeason}</div>${warn}</li>`;
}
function doffHTML(iv) {
  const n = iv.vac;
  return `<li class="iv k3">
    <div class="iv-top"><span class="iv-dates">${rangeLabel(iv.s, iv.e)}</span><span class="iv-dow">${iv.s === iv.e ? DOW_FULL[DAYS[iv.s].dow] : DOW[DAYS[iv.s].dow] + '–' + DOW[DAYS[iv.e].dow]}</span><span class="iv-n">${n} ${plural(n, 'дейофф', 'дейоффа', 'дейоффов')}</span></div>
    <div class="iv-meta"><span>отдых подряд <b>${dn(iv.streak)}</b>${iv.streak > n ? ' · ' + rangeLabel(iv.ra, iv.rb) : ''}</span></div></li>`;
}
function renderIntervals(md) {
  $('#mainList').innerHTML = md.main.length ? md.main.map(ivHTML).join('') : '<li class="empty">Нет отмеченных дней.</li>';
  $('#extraList').innerHTML = md.extra.length ? md.extra.map(ivHTML).join('') : `<li class="empty">${S.extraDays ? 'Выберите кисть «Доп.» и отметьте дни.' : 'Доп. отпуска нет.'}</li>`;
  $('#doffGroup').hidden = !S.dayoffDays && !md.usedD;
  $('#doffList').innerHTML = md.doffs.length ? md.doffs.map(doffHTML).join('') : '<li class="empty">Выберите кисть «Дейофф» и отметьте рабочие дни. Подбор их не ставит.</li>';
}
function renderMoney(md) {
  const dp = dayPct(), sal = S.salary ? +S.salary : 0;
  let pay = 0, lost = 0, paid = 0, work = 0;
  const rows = [];
  for (const mo of md.months) {
    if (!mo.paid) continue;
    const salaryPct = (mo.work - mo.vacWork) / mo.work * 100, vacPct = mo.paid * dp, total = salaryPct + vacPct;
    pay += vacPct; lost += mo.vacWork / mo.work * 100; paid += mo.paid; work += mo.vacWork;
    const r = v => sal ? `<small>${rub(v / 100 * sal)}</small>` : '';
    rows.push(`<tr class="${mo.work >= 20 ? 'good' : ''}"><td>${MONTHS[mo.m]}</td><td>${mo.work}</td><td>${mo.paid} дн.<small>${mo.vacWork} ${plural(mo.vacWork, 'рабочий', 'рабочих', 'рабочих')}</small></td><td>${pct(salaryPct)}${r(salaryPct)}</td><td>${pct(vacPct)}${r(vacPct)}</td><td><b>${pct(total)}</b>${r(total)}</td></tr>`);
  }
  const week = w => 7 * dp / (5 / w * 100) * 100;
  $('#moneyTip').innerHTML = `Неделя отпуска (7 дней, из них 5 рабочих) в месяце с <b>22 рабочими днями</b> даёт ${pct(week(22))} зарплаты за эту неделю, в январе с 15 рабочими днями — ${pct(week(15))}. Поэтому отпуск в месяцах с 20+ рабочими днями выгоднее, а выходные внутри отпуска тоже оплачиваются.`;
  if (!paid) {
    $('#moneySummary').innerHTML = '<p class="hint">Отметьте дни отпуска — здесь появится расчёт.</p>';
    $('#moneyTable').innerHTML = '';
    $('#sumMoney').textContent = 'отметьте дни отпуска'; $('#sumMoney').className = 'fold-sum';
    return;
  }
  const ratio = lost > 0 ? pay / lost * 100 : null;
  const diff = pay - lost;
  const sg = diff >= 0 ? '+' : '−';
  const bigCls = ratio != null && diff >= 0 ? 'up' : 'down';
  $('#sumMoney').textContent = ratio == null ? 'нет рабочих дней в отпуске' : `${sg}${pct(Math.abs(diff))} заработка за год${sal ? ' · ' + sg + rub(Math.abs(diff) / 100 * sal) : ''}`;
  $('#sumMoney').className = 'fold-sum ' + (ratio != null && diff >= 0 ? 'ok' : 'bad');
  const bigText = ratio == null
    ? 'все отмеченные дни — выходные, а отпуск только на выходные по ТК не оформить'
    : `заработка за год к обычной зарплате${sal ? ', это ' + sg + rub(Math.abs(diff) / 100 * sal) : ''}. Столько вы ${diff >= 0 ? 'получите сверху' : 'недополучите'}, если взять отпуск в эти дни`;
  $('#moneySummary').innerHTML = `
    <div class="money-big"><span class="big ${bigCls}">${ratio == null ? '—' : sg + pct(Math.abs(diff))}</span>
    <p>${bigText}</p></div>
    <dl class="mini">
      <div><dt>Отпускные</dt><dd>${pct(pay)} заработка<small>${dn(paid)} × ${nf2.format(dp)}%${sal ? ' · ' + rub(pay / 100 * sal) : ''}</small></dd></div>
      <div><dt>Пропущенная зарплата</dt><dd>${pct(lost)} заработка<small>${work} раб. ${plural(work, 'день', 'дня', 'дней')}${sal ? ' · ' + rub(lost / 100 * sal) : ''}</small></dd></div>
      <div><dt>Отпускные к пропущенному</dt><dd>${ratio == null ? '—' : pct(ratio)}<small>${ratio == null ? 'нет рабочих дней' : 'на 1 ₽ пропущенной зарплаты — ' + nf2.format(ratio / 100) + ' ₽ отпускных'}</small></dd></div>
    </dl>`;
  $('#moneyTable').innerHTML = `<thead><tr><th>Месяц</th><th>Раб. дней</th><th>Отпуск</th><th>Зарплата</th><th>Отпускные</th><th>Итого</th></tr></thead><tbody>${rows.join('')}</tbody>`;
}
function renderMonthSums(md) {
  monthsEl.querySelectorAll('.msum').forEach(el => {
    const mo = md.months[+el.dataset.msum];
    const parts = [];
    if (mo.paid) parts.push(`в отпуске <b>${mo.paid}</b> ${plural(mo.paid, 'день', 'дня', 'дней')}, из них рабочих <b>${mo.vacWork}</b> из ${mo.work}`);
    if (mo.doff) parts.push(`дейоффов <b>${mo.doff}</b>`);
    el.innerHTML = parts.join(' · ');
  });
}
// План по строкам, столбцы через табуляцию: вставляется в Excel / Google Таблицы по ячейкам и читается обратно
const KIND_NAME = { 1: 'Основной', 2: 'Доп.', 3: 'Дейофф' };
function planText(md) {
  const fullD = i => fmtD(i) + '.' + YEAR;
  const all = md.main.concat(md.extra, md.doffs).sort((a, b) => a.s - b.s);
  if (!all.length) return '';
  const rows = all.map(iv => { const r = iv.kind === 3 ? null : resortFor(iv); return [KIND_NAME[iv.kind], fullD(iv.s), fullD(iv.e), iv.vac, r ? r.name : ''].join('\t'); });
  return ['Вид\tС\tПо\tДней\tКуда'].concat(rows).join('\n');
}
function renderExport(md) {
  const ta = $('#planText');
  ta.value = planText(md);
  ta.rows = Math.max(3, Math.min(14, ta.value.split('\n').length + 1));
  renderVariants();
}
