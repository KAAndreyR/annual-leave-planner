// Направления и сезоны, «Дома хорошо», цели подбора.
'use strict';

// ---------- Курорты и сезоны ----------
const CATS = [
  { id:'beach', name:'Пляж' },
  { id:'culture', name:'Культура' },
  { id:'nature', name:'Природа' },
  { id:'active', name:'Активный отдых' },
  { id:'home', name:'Дома хорошо' }
];
// Направления одной страны и одного сезона объединены по 2–3
const RESORTS = [
  { id:'turkey', cat:'beach', name:'Анталья и Бодрум', where:'Турция', months:[5,6,7,8,9,10] },
  { id:'egypt', cat:'beach', name:'Хургада и Шарм-эш-Шейх', where:'Египет', months:[1,2,3,4,5,10,11,12] },
  { id:'uae', cat:'beach', name:'Дубай и Абу-Даби', where:'ОАЭ', months:[1,2,3,4,11,12] },
  { id:'thai', far:true, cat:'beach', name:'Пхукет и Самуи', where:'Таиланд', months:[1,2,3,4] },
  { id:'vietnam', far:true, cat:'beach', name:'Нячанг и Дананг', where:'Вьетнам', months:[3,4,5,6,7,8] },
  { id:'bali', far:true, cat:'beach', name:'Бали', where:'Индонезия', months:[4,5,6,7,8,9,10] },
  { id:'rusea', cat:'beach', name:'Сочи и Крым', where:'Россия', months:[6,7,8,9] },
  { id:'greece', cat:'beach', name:'Крит и Родос', where:'Греция', months:[5,6,7,8,9,10] },
  { id:'canary', cat:'beach', name:'Тенерифе и Гран-Канария', where:'Испания', note:'мягкая зима: днём +21, море +19–20', months:[1,2,3,10,11,12] },
  { id:'india', far:true, cat:'beach', name:'Гоа и Дели', where:'Индия', note:'пляж и Золотой треугольник; в Дели зимой бывает смог', months:[12,1,2,3] },
  { id:'rucity', cat:'culture', name:'Петербург, Казань, Калининград', where:'Россия', months:[5,6,7,8,9] },
  { id:'istanbul', cat:'culture', name:'Стамбул и Каппадокия', where:'Турция', months:[4,5,6,9,10] },
  { id:'georgia', cat:'culture', name:'Тбилиси и Батуми', where:'Грузия', months:[5,6,9,10] },
  { id:'uzbek', cat:'culture', name:'Самарканд и Бухара', where:'Узбекистан', months:[4,5,9,10] },
  { id:'armenia', cat:'culture', name:'Ереван и Дилижан', where:'Армения', months:[4,5,6,9,10] },
  { id:'morocco', cat:'culture', name:'Марракеш и Агадир', where:'Марокко', months:[3,4,5,10,11] },
  { id:'italy', cat:'culture', name:'Рим и Флоренция', where:'Италия', months:[4,5,6,9,10] },
  { id:'vienna', cat:'culture', name:'Вена и Зальцбург', where:'Австрия', note:'ярмарки к Рождеству', months:[12] },
  { id:'sakura', far:true, cat:'culture', name:'Токио и Киото', where:'Япония', note:'сакура: конец марта – начало апреля', months:[3,4] },
  { id:'rusnature', cat:'nature', name:'Алтай, Байкал, Карелия', where:'Россия', months:[6,7,8,9] },
  { id:'caucasus', cat:'nature', name:'Кисловодск и Осетия', where:'Россия', note:'Кавказ', months:[5,6,7,8,9,10] },
  { id:'fareast', far:true, cat:'nature', name:'Владивосток, Камчатка, Сахалин', where:'Россия', note:'Дальний Восток, можно пожить', months:[7,8,9] },
  { id:'aurora', cat:'nature', name:'Териберка и Хибины', where:'Россия', note:'северное сияние', months:[1,2,3,11,12] },
  { id:'norway', cat:'nature', name:'Фьорды и Лофотены', where:'Норвегия', months:[6,7,8] },
  { id:'madeira', cat:'nature', name:'Мадейра', where:'Португалия', note:'тропы вдоль левад', months:[3,4,5,6,9,10] },
  { id:'momiji', far:true, cat:'nature', name:'Хаконэ и Никко', where:'Япония', note:'клёны: конец октября – середина ноября', months:[10,11] },
  { id:'zhangjiajie', far:true, cat:'nature', name:'Чжанцзяцзе и Гуйлинь', where:'Китай', note:'горы-столбы', months:[4,9,10,11] },
  { id:'safari', far:true, cat:'nature', name:'Серенгети и Занзибар', where:'Танзания', note:'сафари', months:[1,2,6,7,8,9,10] },
  { id:'skiru', cat:'active', name:'Красная Поляна и Шерегеш', where:'Россия', note:'горные лыжи', months:[12,1,2,3] },
  { id:'alps', cat:'active', name:'Куршевель и Шамони', where:'Франция', note:'горные лыжи', months:[12,1,2,3] },
  { id:'niseko', far:true, cat:'active', name:'Нисэко и Фурано', where:'Япония', note:'лыжи по пухляку', months:[12,1,2,3] },
  { id:'dolomites', cat:'active', name:'Доломиты', where:'Италия', note:'треккинг', months:[6,7,8,9] },
  { id:'elbrus', cat:'active', name:'Эльбрус и Домбай', where:'Россия', note:'горные походы', months:[6,7,8,9] },
  { id:'surf', far:true, cat:'active', name:'Велигама и Хиккадува', where:'Шри-Ланка', note:'сёрфинг', months:[12,1,2,3,4] },
  { id:'dahab', cat:'active', name:'Дахаб и Марса-Алам', where:'Египет', note:'дайвинг и кайт', months:[3,4,5,9,10,11] },
  { id:'mallorca', cat:'active', name:'Майорка', where:'Испания', note:'велоспорт и скалолазание', months:[3,4,5,9,10] },
  { id:'nepal', far:true, cat:'active', name:'Аннапурна', where:'Непал', note:'треккинг в Гималаях', months:[3,4,10,11] }
];
// Без поездок. win — точные даты части отпуска [[мес, день], [мес, день]]: такую часть генератор ставит ровно на них
RESORTS.push(
  { id:'mayhol', cat:'home', name:'Майские праздники', win:[[5,4],[5,7]], months:[5] },
  { id:'dacha', cat:'home', name:'Дача: посадки и огород', where:'', months:[5,6] },
  { id:'harvest', cat:'home', name:'Сбор урожая и заготовки', where:'', note:'грибы, ягоды, соленья', months:[8,9] },
  { id:'kidsummer', cat:'home', name:'Летние каникулы с детьми', where:'', months:[6,7,8] },
  { id:'school', cat:'home', name:'С детьми в школу', note:'1 сентября', win:[[8,30],[9,3]], months:[8,9] },
  { id:'autumnbreak', cat:'home', name:'Осенние каникулы с детьми', note:'даты в школах разные', win:[[10,25],[11,3]], months:[10,11] },
  { id:'newyear', cat:'home', name:'Подготовка к Новому году', note:'и дальше январские 2028', win:[[12,27],[12,30]], months:[12] }
);
const dayIdx = (d, m) => DAYS.findIndex(D => D.m === m - 1 && D.d === d);
RESORTS.forEach(r => {
  if (r.where == null) r.where = '';
  if (r.win) { r.winIdx = []; for (let i = dayIdx(r.win[0][1], r.win[0][0]); i <= dayIdx(r.win[1][1], r.win[1][0]); i++) if (!DAYS[i].hol) r.winIdx.push(i); }
});
const TRAVEL = RESORTS.filter(r => r.cat !== 'home');
const RES_BY_ID = Object.fromEntries(RESORTS.map(r => [r.id, r]));
// Старые id из сохранённых планов
const RES_ALIAS = { antalya:'turkey', hurghada:'egypt', dubai:'uae', phuket:'thai', nhatrang:'vietnam', sochi:'rusea', crimea:'rusea',
  kaliningrad:'rucity', spb:'rucity', kazan:'rucity', altai:'rusnature', baikal:'rusnature', karelia:'rusnature', teriberka:'aurora', srilanka:'surf' };
const resolveRes = id => RES_BY_ID[id] ? id : (RES_ALIAS[id] && RES_BY_ID[RES_ALIAS[id]] ? RES_ALIAS[id] : null);
const GOALS = [
  { id:'rest', name:'Максимальный отдых', desc:'Цепляю отпуск к праздникам и выходным, чтобы отдыхать подряд дольше. Майские в ходу, хотя по деньгам май в минусе.' },
  { id:'standard', name:'Стандартный', desc:'Баланс отдыха и денег: часть на 2–3 недели, остальное неделями, выходные по краям.' },
  { id:'money', name:'Максимальная выгода', desc:'Только месяцы с 20+ рабочими днями, части с субботы по воскресенье: выходные внутри оплачиваются, а зарплата за них не теряется.' }
];
const GOAL_IDS = GOALS.map(g => g.id);
const SEASONS = [
  { id:'winter', name:'Зима', months:[12,1,2] },
  { id:'spring', name:'Весна', months:[3,4,5] },
  { id:'summer', name:'Лето', months:[6,7,8] },
  { id:'autumn', name:'Осень', months:[9,10,11] }
];
const SEASON_BY_ID = Object.fromEntries(SEASONS.map(s => [s.id, s]));
