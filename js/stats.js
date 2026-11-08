// Статистика мастера: период (месяц / год) с листанием, три вкладки без повторов.
// Суть по образцу «Анализа финансов» Сбера: выбранный период, сравнение с прошлым, разбивка по категориям
// с долями, тап по категории — список операций; цель (бюджет) на период и подсказки-выводы.
// Данные прошлых периодов — примерные (генерируются детерминированно), пока нет настоящих.
import { actions, rerender, val } from './core.js?v=273';
import * as S from './store.js?v=273';
import { esc, toast } from './ui.js?v=273';
import { selectField, pickers } from './oformit.js?v=273';

const ICON_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="10" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="15" width="18" height="2" rx="1" fill="#A3AEBE"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="#edf0e7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ARR = (d) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="${d === 'l' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const MONN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
const k = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1).replace('.0', '')}к` : String(Math.round(v)));
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ── Примерные данные: заказы и расходы за 2 года ──
const C = { inc: '#7ee2a3', exp: '#ff8a7a', blue: '#7aa7d6', gold: '#d6c15a', orange: '#e8913a', violet: '#c7a7f5', teal: '#5fd0c5', pink: '#f29bc0', gray: 'rgba(214,229,194,.45)' };
const INC_CAT = [['Поклейка обоев', C.inc], ['Демонтаж старых обоев', C.orange], ['Грунтовка', C.blue], ['Выравнивание стен', C.gold], ['Покраска потолка', C.violet]];
const EXP_CAT = [['Клей', C.exp], ['Грунт', C.blue], ['Расходники', C.gold], ['Транспорт', C.orange], ['Инструмент', C.violet]];
const BRANDS = [['Victoria Stenova', 30, C.inc, ['Флизелин', 'Винил на флизелине']], ['Erismann', 18, C.blue, ['Винил на флизелине', 'Флизелин']], ['Палитра', 14, C.orange, ['Винил на бумаге', 'Бумажные']], ['A.S. Création', 10, C.violet, ['Флизелин', 'Текстильные']], ['Marburg', 9, C.gold, ['Флизелин', 'Текстильные']], ['Andrea Rossi', 8, C.pink, ['Винил на флизелине']], ['Oscar', 6, C.teal, ['Стеклообои']], ['Limonta', 5, C.gray, ['Винил на флизелине']]];
const TYPES = [['Флизелин', C.inc], ['Винил на флизелине', C.blue], ['Винил на бумаге', C.orange], ['Бумажные', C.gold], ['Текстильные', C.violet], ['Стеклообои', C.teal]];
const GLUES = [['Quelyd', 38, C.inc], ['Metylan', 30, C.blue], ['Kleo', 22, C.orange], ['Pufas', 10, C.gold]];
const ROOMS = [['Гостиная', C.blue], ['Спальня', C.violet], ['Кухня', C.orange], ['Детская', C.inc], ['Коридор', C.gold], ['Кабинет', C.teal]];
const SRC = [['Авито', 36, C.inc], ['Сайт', 20, C.blue], ['Агенты', 17, C.orange], ['Рекомендации', 15, C.gold], ['Магазин обоев', 12, C.violet]];
const NAMES = ['Смирнова', 'Иванов', 'Кузнецова', 'Попов', 'Соколова', 'Лебедев', 'Козлова', 'Новиков', 'Морозова', 'Петров', 'Волкова', 'Соловьёв', 'Васильева', 'Зайцев', 'Павлова', 'Семёнов', 'Голубева', 'Виноградов', 'Богданова', 'Воробьёв'];

let DATA = null;
function data() {
  if (DATA) return DATA;
  let seed = 20261108;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (arr) => { const tot = arr.reduce((a, x) => a + x[1], 0); let r = rnd() * tot; for (const x of arr) { r -= x[1]; if (r <= 0) return x; } return arr[0]; };
  const ri = (a, b) => Math.round(a + rnd() * (b - a));
  const now = new Date(), orders = [], ops = [];
  let no = 1;
  const span = (now.getFullYear() - (now.getFullYear() - 2)) * 12 + now.getMonth();
  for (let back = span; back >= 0; back--) {
    const ms = new Date(now.getFullYear(), now.getMonth() - back, 1), y = ms.getFullYear(), m = ms.getMonth();
    const dim = new Date(y, m + 1, 0).getDate(), lastDay = back === 0 ? now.getDate() : dim;
    const season = [0.7, 0.75, 0.9, 1.1, 1.15, 1, 0.95, 1.05, 1.2, 1.15, 1, 0.8][m];
    const n = back === 0 ? 2 : Math.max(2, Math.round((3 + rnd() * 3) * season * (back === 0 ? lastDay / dim : 1)));
    const rate = 250 + (span - back) * 3;
    for (let i = 0; i < n; i++) {
      const d = new Date(y, m, ri(1, lastDay));
      const br = pick(BRANDS), type = br[3][Math.floor(rnd() * br[3].length)], glue = pick(GLUES), src = pick(SRC);
      const rooms = Array.from({ length: ri(1, 3) }, () => [ROOMS[Math.floor(rnd() * ROOMS.length)][0], ri(18, 52)]);
      const m2 = rooms.reduce((a, r) => a + r[1], 0), rolls = Math.ceil((m2 / 5.3) * 1.1);
      const o = { no: String(no++).padStart(3, '0'), d, client: NAMES[Math.floor(rnd() * NAMES.length)], src: src[0], brand: br[0], type, glue: glue[0], rooms, m2, rolls, days: Math.max(1, Math.round(m2 / ri(26, 36))), repeat: rnd() < 0.22 };
      const inc = [['Поклейка обоев', m2 * rate]];
      if (rnd() < 0.6) inc.push(['Демонтаж старых обоев', m2 * 80]);
      if (rnd() < 0.8) inc.push(['Грунтовка', m2 * 40]);
      if (rnd() < 0.25) inc.push(['Выравнивание стен', m2 * 250]);
      if (rnd() < 0.15) inc.push(['Покраска потолка', ri(6, 12) * 1000]);
      inc.forEach(([cat, sum]) => ops.push({ kind: 'inc', cat, sum, d, o }));
      o.sum = inc.reduce((a, x) => a + x[1], 0);
      ops.push({ kind: 'exp', cat: 'Клей', sum: Math.ceil(rolls / 8) * 650, d, o });
      ops.push({ kind: 'exp', cat: 'Грунт', sum: Math.ceil(m2 / 50) * 900, d, o });
      ops.push({ kind: 'exp', cat: 'Расходники', sum: ri(4, 15) * 100, d, o });
      ops.push({ kind: 'exp', cat: 'Транспорт', sum: ri(6, 25) * 100, d, o });
      orders.push(o);
    }
    if (rnd() < 0.3) ops.push({ kind: 'exp', cat: 'Инструмент', sum: ri(3, 15) * 1000, d: new Date(y, m, ri(1, lastDay)), o: null, note: ['Лазерный уровень', 'Шпатели и валики', 'Стремянка', 'Нож и лезвия', 'Миксер'][Math.floor(rnd() * 5)] });
  }
  DATA = { orders, ops };
  return DATA;
}

// ── Состояние ──
const now = new Date();
let tab = 'all', mode = 'month', py = now.getFullYear(), pm = now.getMonth(), sel = {}, money = 'inc', open = '';
const isCur = () => (mode === 'year' ? py === now.getFullYear() : py === now.getFullYear() && pm === now.getMonth());
const minD = new Date(now.getFullYear() - 2, 0, 1);
const canPrev = () => py > minD.getFullYear();
const reset = () => { sel = {}; open = ''; };
actions['sd2-tab'] = (el) => { tab = el.dataset.k; reset(); rerender(); window.scrollTo(0, 0); };
// столбик месяца — сводка за месяц; повторный тап или «Весь год» — сводка за год; стрелки — год
actions['sd2-month'] = (el) => { const m = +el.dataset.m; if (mode === 'month' && pm === m) mode = 'year'; else { mode = 'month'; pm = m; } reset(); rerender(); };
actions['sd2-year'] = () => { mode = 'year'; reset(); rerender(); };
actions['sd2-prev'] = () => { if (!canPrev()) return; py--; mode = 'year'; reset(); rerender(); };
actions['sd2-next'] = () => { if (py >= now.getFullYear()) return; py++; mode = 'year'; reset(); rerender(); };
actions['sd2-pt'] = (el) => { sel[el.dataset.c] = +el.dataset.i; rerender(); };
actions['sd2-money'] = (el) => { money = el.dataset.k; open = ''; rerender(); };
actions['sd2-open'] = (el) => { open = open === el.dataset.k ? '' : el.dataset.k; rerender(); };

// период: [начало, конец), корзины для графика, прошлый период
function period(y = py, m = pm) {
  if (mode === 'year') {
    const lastM = y === now.getFullYear() ? now.getMonth() : 11;
    return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), title: `${y} год`, short: String(y),
      buckets: Array.from({ length: lastM + 1 }, (_, i) => ({ l: MONS[i], from: new Date(y, i, 1), to: new Date(y, i + 1, 1), name: MONN[i] })) };
  }
  const dim = new Date(y, m + 1, 0).getDate(), last = y === now.getFullYear() && m === now.getMonth() ? now.getDate() : dim;
  const buckets = [];
  for (let s = 1; s <= last; s += 7) { const e = Math.min(s + 6, dim); buckets.push({ l: `${s}–${e}`, from: new Date(y, m, s), to: new Date(y, m, e + 1), name: `${s}–${e} ${MONG[m]}` }); }
  return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1), title: `${cap(MONN[m])} ${y}`, short: MONN[m], buckets };
}
const prevPeriod = () => { const q = mode === 'year' ? period(py - 1, pm) : period(pm ? py : py - 1, pm ? pm - 1 : 11);
  // текущий период ещё идёт — сравниваем с тем же отрезком прошлого (с 1-го по сегодняшнее число)
  if (isCur()) { const cut = mode === 'year' ? new Date(py - 1, now.getMonth(), now.getDate() + 1) : new Date(q.from.getFullYear(), q.from.getMonth(), Math.min(now.getDate(), new Date(q.from.getFullYear(), q.from.getMonth() + 1, 0).getDate()) + 1); q.to = cut; q.partial = true; }
  return q; };
const inP = (p) => (x) => x.d >= p.from && x.d < p.to;
function agg(p) {
  const { orders, ops } = data(), f = inP(p);
  const O = orders.filter(f), P = ops.filter(f);
  const inc = P.filter((x) => x.kind === 'inc').reduce((a, x) => a + x.sum, 0), exp = P.filter((x) => x.kind === 'exp').reduce((a, x) => a + x.sum, 0);
  return { O, P, inc, exp, profit: inc - exp, n: O.length, m2: O.reduce((a, o) => a + o.m2, 0), days: O.reduce((a, o) => a + o.days, 0), rolls: O.reduce((a, o) => a + o.rolls, 0) };
}
const delta = (v, pv) => (pv ? Math.round(((v - pv) / Math.abs(pv)) * 100) : null);
const dTag = (d, inverse) => (d === null || !isFinite(d) ? '' : `<em class="sd-d ${(d >= 0) !== !!inverse ? 'up' : 'dn'}">${d >= 0 ? '↑' : '↓'} ${Math.abs(d)}%</em>`);
const prevName = () => { const d = now.getDate(), pmn = MONS[(pm + 11) % 12]; if (isCur()) return mode === 'year' ? `к 1 янв – ${d} ${MONS[now.getMonth()]} ${py - 1}` : `к 1–${d} ${pmn}.`; return mode === 'year' ? `к ${py - 1}` : `к ${pmn}.`; };

// ── Графики ──
const smooth = (pts) => pts.map(([x, y], i) => { if (!i) return `M${x},${y.toFixed(1)}`; const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || [x, y];
  return `C${(p1[0] + (x - p0[0]) / 6).toFixed(1)},${(p1[1] + (y - p0[1]) / 6).toFixed(1)} ${(x - (p3[0] - p1[0]) / 6).toFixed(1)},${(y - (p3[1] - p1[1]) / 6).toFixed(1)} ${x},${y.toFixed(1)}`; }).join(' ');
function chart({ c, kind, labels, series, unit }) {
  const W = 320, H = 170, top = 36, bot = 24, ph = H - top - bot, n = labels.length, s = sel[c] ?? n - 1;
  const max = Math.max(1, ...series.flatMap((x) => x.vals)) * 1.12;
  const cx = (i) => (i + 0.5) * (W / n), cy = (v) => top + ph - (v / max) * ph;
  const grid = [0, 0.5, 1].map((f) => `<line x1="0" x2="${W}" y1="${top + ph - f * ph}" y2="${top + ph - f * ph}" class="sd-grid"/>`).join('');
  const lbl = labels.map((m, i) => `<text x="${cx(i)}" y="${H - 6}" text-anchor="middle" class="sd-ax${i === s ? ' is-on' : ''}">${m}</text>`).join('');
  const defs = series.map((x, j) => kind === 'bar'
    ? `<linearGradient id="g-${c}${j}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${x.col}"/><stop offset="1" stop-color="${x.col}" stop-opacity=".25"/></linearGradient>`
    : `<linearGradient id="g-${c}${j}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${x.col}" stop-opacity=".38"/><stop offset="1" stop-color="${x.col}" stop-opacity="0"/></linearGradient>`).join('');
  let body = '';
  if (kind === 'bar') {
    const g = series.length, bw = Math.min(26, (W / n) * (g > 1 ? 0.34 : 0.55)), gap = g > 1 ? 3 : 0;
    body = series.map((x, j) => x.vals.map((v, i) => { const h = Math.max(4, (v / max) * ph), x0 = cx(i) - (g * bw + (g - 1) * gap) / 2 + j * (bw + gap);
      return `<rect x="${x0.toFixed(1)}" y="${top + ph - h}" width="${bw.toFixed(1)}" height="${h}" rx="${Math.min(9, bw / 2.6).toFixed(1)}" fill="url(#g-${c}${j})" class="sd-bar${i === s ? ' is-on' : ''}" style="--c:${x.col}"/>`; }).join('')).join('');
  } else {
    const x = series[0], pts = x.vals.map((v, i) => [cx(i), cy(v)]), line = smooth(pts);
    body = `<path d="${line} L${pts[n - 1][0]},${top + ph} L${pts[0][0]},${top + ph} Z" fill="url(#g-${c}0)"/>
      <path d="${line}" fill="none" stroke="${x.col}" stroke-width="3" stroke-linecap="round" class="sd-ln" style="--c:${x.col}"/>
      <line x1="${pts[s][0]}" x2="${pts[s][0]}" y1="${pts[s][1]}" y2="${top + ph}" class="sd-guide"/>
      ${pts.map(([px, py2], i) => i === s ? `<circle cx="${px}" cy="${py2}" r="11" fill="${x.col}" opacity=".2"/><circle cx="${px}" cy="${py2}" r="5.5" fill="#fff" stroke="${x.col}" stroke-width="3"/>` : (n <= 12 ? `<circle cx="${px}" cy="${py2}" r="3" fill="${x.col}" opacity=".55"/>` : '')).join('')}`;
  }
  const top1 = Math.max(...series.map((x) => x.vals[s]));
  const pv = series.length > 1 ? series.map((x) => k(x.vals[s])).join(' / ') : `${k(series[0].vals[s])}${unit}`;
  const pw = pv.length * 7 + 18, px = Math.min(W - pw / 2, Math.max(pw / 2, cx(s))), pyy = Math.max(2, cy(top1) - 32);
  const pill = `<g class="sd-pill"><rect x="${px - pw / 2}" y="${pyy}" width="${pw}" height="22" rx="11"/><text x="${px}" y="${pyy + 15}" text-anchor="middle">${pv}</text></g>`;
  return `<div class="sd-ch"><svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${defs}</defs>${grid}${body}${lbl}${pill}</svg>
    <div class="sd-hit" style="--n:${n}">${labels.map((l, i) => `<button type="button" data-action="sd2-pt" data-c="${c}" data-i="${i}" aria-label="${esc(l)}"></button>`).join('')}</div></div>`;
}
function donut(rows, centerN, centerS) {
  const tot = rows.reduce((a, x) => a + x[1], 0) || 1, R = 52, CC = 2 * Math.PI * R; let ac = 0;
  const segs = rows.filter((x) => x[1] > 0).map(([, v, col]) => { const len = (v / tot) * CC; const sg = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${col}" stroke-width="16" stroke-dasharray="${Math.max(1.5, len - 3).toFixed(1)} ${CC}" stroke-dashoffset="${(-ac).toFixed(1)}" transform="rotate(-90 70 70)"/>`; ac += len; return sg; }).join('');
  return `<svg class="sd-dnsvg" viewBox="0 0 140 140" aria-hidden="true"><circle r="${R}" cx="70" cy="70" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="16"/>${segs}<text x="70" y="72" text-anchor="middle" class="sd-dn__n">${centerN}</text><text x="70" y="90" text-anchor="middle" class="sd-dn__s">${centerS}</text></svg>`;
}
// список категорий: доля, сумма, разница с прошлым периодом, раскрытие — операции
function catList(rows, unit, sub, details) {
  const tot = rows.reduce((a, x) => a + x.v, 0) || 1, mx = Math.max(1, ...rows.map((x) => x.v));
  return `<div class="sd-cl">${rows.map((x) => { const on = open === x.key;
    return `<div class="sd-cl__it${on ? ' is-open' : ''}"><button type="button" class="sd-cl__r" data-action="sd2-open" data-k="${esc(x.key)}">
      <span class="sd-cl__ic" style="--c:${x.col}">${esc(x.t.slice(0, 1))}</span>
      <span class="sd-cl__t"><b>${esc(x.t)}</b><small>${sub(x)}</small><span class="sd-cl__bar"><i style="--w:${(x.v / mx) * 100}%;--c:${x.col}"></i></span></span>
      <span class="sd-cl__v"><b>${fmt(x.v)}${unit}</b><small>${Math.round((x.v / tot) * 100)}% ${x.d === undefined ? '' : dTag(x.d, x.inv)}</small></span></button>
      ${on ? `<div class="sd-cl__ops">${details(x)}</div>` : ''}</div>`; }).join('')}</div>`;
}
const opRow = (d, t, s, v) => `<div class="sd-op"><span class="sd-op__d">${d.getDate()} ${MONS[d.getMonth()]}</span><span class="sd-op__t"><b>${esc(t)}</b><small>${esc(s)}</small></span><span class="sd-op__v">${v}</span></div>`;
const groupBy = (arr, key, val) => { const m = new Map(); arr.forEach((x) => m.set(key(x), (m.get(key(x)) || 0) + val(x))); return m; };
const block = (h, inner, cls = '') => `<section class="h-block sd-b ${cls}">${h ? `<div class="sd-bh"><div><h2>${h[0]}</h2>${h[1] ? `<small>${h[1]}</small>` : ''}</div>${h[2] || ''}</div>` : ''}${inner}</section>`;
// сворачиваемый блок: всегда видно главное (summary), по тапу на заголовок — подробно (full)
let fold = new Set();
actions['sd2-fold'] = (el) => { const k2 = el.dataset.k; fold.has(k2) ? fold.delete(k2) : fold.add(k2); rerender(); };
const CHEV = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fblock = (key, h, summary, full, cls = '') => { const on = fold.has(key);
  return `<section class="h-block sd-b sd-f${on ? ' is-open' : ''} ${cls}"><button type="button" class="sd-bh sd-f__hd" data-action="sd2-fold" data-k="${key}" aria-expanded="${on}"><div><h2>${h[0]}</h2>${h[1] ? `<small>${h[1]}</small>` : ''}</div><span class="sd-f__r">${h[2] || ''}<i class="sd-f__ch">${CHEV}</i></span></button>
    ${summary}${on ? `<div class="sd-f__full">${full}</div>` : `<button type="button" class="sd-f__more" data-action="sd2-fold" data-k="${key}">Подробнее</button>`}</section>`; };
// краткая сводка списка: полоса долей + 3 главных
const stackSum = (rows, unit) => { const tot = rows.reduce((a, x) => a + x.v, 0) || 1;
  return `<div class="sd-stk">${rows.map((x) => `<i style="flex:${x.v};background:${x.col}"></i>`).join('')}</div>
    <ul class="sd-stk__lg">${rows.slice(0, 3).map((x) => `<li><i style="background:${x.col}"></i><span>${esc(x.t)}</span><b>${fmt(x.v)}${unit} <small>${Math.round((x.v / tot) * 100)}%</small></b></li>`).join('')}${rows.length > 3 ? `<li class="sd-stk__more">и ещё ${rows.length - 3}</li>` : ''}</ul>`; };
const legend = (rows, tot) => `<ul class="sd-leg">${rows.slice(0, 5).map((x) => `<li><i style="background:${x.col}"></i><span>${esc(x.t)}</span><b>${Math.round((x.v / (tot || 1)) * 100)}%</b></li>`).join('')}${rows.length > 5 ? `<li class="sd-stk__more">и ещё ${rows.length - 5}</li>` : ''}</ul>`;
const seg2 = (items, cur, act) => `<div class="f-topnav sd-seg"><div class="f-topnav__track" role="tablist">${items.map(([key, t]) => `<button type="button" role="tab" aria-selected="${key === cur}" class="f-tab${key === cur ? ' is-active' : ''}" data-action="${act}" data-k="${key}">${t}</button>`).join('')}</div></div>`;

// ── Цели: ставятся мастером (месяц или год), прогресс, прогноз, история выполнения ──
const GK = { inc: ['Доход', ' ₽'], profit: ['Прибыль', ' ₽'], m2: ['Поклеено', ' м²'], n: ['Заказов', ''] };
const GP = { month: 'на месяц', year: 'на год' };
const DEF_GOALS = [{ id: 'g1', kind: 'inc', per: 'month', target: 150000 }, { id: 'g2', kind: 'm2', per: 'month', target: 300 }, { id: 'g3', kind: 'inc', per: 'year', target: 1800000 }];
const goalsList = () => (S.me().settings.goals || DEF_GOALS);
const setGoals = (L) => S.updateSettings({ goals: L });
let gEdit = '';
actions['gl-edit'] = (el) => { gEdit = gEdit === el.dataset.id ? '' : el.dataset.id; rerender(); };
actions['gl-add'] = () => { const id = 'g' + Date.now().toString(36); setGoals([...goalsList(), { id, kind: 'inc', per: 'month', target: 100000 }]); gEdit = id; rerender(); };
actions['gl-del'] = (el) => { setGoals(goalsList().filter((g) => g.id !== el.dataset.id)); gEdit = ''; toast('Цель удалена'); rerender(); };
actions['gl-save'] = (el) => { const id = el.dataset.id; const t = parseFloat(String(val(`gl-t-${id}`)).replace(/\s/g, '').replace(',', '.'));
  if (!(t > 0)) { toast('Введите число больше нуля'); return; }
  setGoals(goalsList().map((g) => (g.id === id ? { ...g, target: Math.round(t) } : g))); gEdit = ''; toast('Цель сохранена'); rerender(); };
const goalPick = (id, field) => (v) => { setGoals(goalsList().map((g) => (g.id === id ? { ...g, [field]: v } : g))); rerender(); };
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };

function goalsTab() {
  const L = goalsList();
  const cards = L.map((g) => {
    const [title, unit] = GK[g.kind];
    // период цели: месячная — выбранный месяц (в режиме года — текущий/последний месяц года), годовая — выбранный год
    const gm = g.per === 'year' ? null : (mode === 'month' ? pm : (py === now.getFullYear() ? now.getMonth() : 11));
    const from = g.per === 'year' ? new Date(py, 0, 1) : new Date(py, gm, 1), to = g.per === 'year' ? new Date(py + 1, 0, 1) : new Date(py, gm + 1, 1);
    const A = agg({ from, to }), v = Math.max(0, A[g.kind]), pc = Math.min(100, (v / g.target) * 100);
    const live = now >= from && now < to;
    let note = '', chip = '';
    if (v >= g.target) { chip = '<em class="sd-chip ok">Выполнена</em>'; note = `Перевыполнение на ${fmt(v - g.target)}${unit}`; }
    else if (live) {
      const span = (to - from) / 864e5, gone = (now - from) / 864e5 + 1, fc = (v / gone) * span, left = Math.max(1, Math.ceil(span - gone));
      chip = fc >= g.target ? '<em class="sd-chip ok">По плану</em>' : '<em class="sd-chip warn">Отстаёте</em>';
      note = fc >= g.target ? `Прогноз ~${fmt(fc)}${unit} — при таком темпе успеваете · осталось ${left} ${plural(left, 'день', 'дня', 'дней')}` : `Прогноз ~${fmt(fc)}${unit} · чтобы успеть, нужно ${fmt((g.target - v) / left)}${unit} в день, осталось ${left} ${plural(left, 'день', 'дня', 'дней')}`;
    } else if (now < from) { chip = '<em class="sd-chip">Впереди</em>'; note = 'Период ещё не начался'; }
    else { chip = '<em class="sd-chip bad">Не выполнена</em>'; note = `Не хватило ${fmt(g.target - v)}${unit}`; }
    // история: для месячной цели — 12 месяцев года, выполнен/нет
    let hist = '';
    if (g.per === 'month') {
      const H = Array.from({ length: 12 }, (_, i) => { if (py === now.getFullYear() && i > now.getMonth()) return null; const x = agg({ from: new Date(py, i, 1), to: new Date(py, i + 1, 1) })[g.kind]; return x; });
      const done = H.filter((x, i) => x !== null && x >= g.target && !(py === now.getFullYear() && i === now.getMonth())).length;
      const closed = H.filter((x, i) => x !== null && !(py === now.getFullYear() && i === now.getMonth())).length;
      const hm = Math.max(g.target, ...H.filter((x) => x !== null));
      hist = `<div class="sd-gh"><div class="sd-gh__bars" style="--t:${(g.target / hm) * 100}%">${H.map((x, i) => `<span class="${x === null ? 'is-off' : x >= g.target ? 'is-ok' : 'is-no'}${i === gm ? ' is-cur' : ''}"><i style="--h:${x === null ? 4 : Math.max(4, (x / hm) * 100)}%"></i><small>${MONS[i][0].toUpperCase()}</small></span>`).join('')}<b class="sd-gh__line"></b></div>
        <p class="sd-note">Выполнена в <b>${done} из ${closed}</b> ${plural(closed, 'месяца', 'месяцев', 'месяцев')} ${py} года</p></div>`;
    }
    const per = g.per === 'year' ? `${py} год` : `${MONN[gm]} ${py}`;
    const ed = gEdit === g.id;
    if (ed) {
      pickers[`gl-k-${g.id}`] = goalPick(g.id, 'kind'); pickers[`gl-p-${g.id}`] = goalPick(g.id, 'per');
    }
    const editor = ed ? `<div class="sd-ged">${selectField(`gl-k-${g.id}`, 'Что считаем', GK[g.kind][0], Object.entries(GK).map(([key, [t]]) => ({ value: key, label: t })), false)}
      ${selectField(`gl-p-${g.id}`, 'Период', g.per === 'year' ? 'Год' : 'Месяц', [{ value: 'month', label: 'Месяц' }, { value: 'year', label: 'Год' }], false)}
      <label class="f-field" for="gl-t-${g.id}"><span class="f-field__label">Цель${unit ? `, ${unit.trim()}` : ''}</span><span class="f-input"><input id="gl-t-${g.id}" inputmode="decimal" value="${g.target}"/></span></label>
      <div class="f-btn-row"><button type="button" class="f-btn st2-del" data-action="gl-del" data-id="${g.id}">Удалить</button><button type="button" class="f-btn" data-action="gl-save" data-id="${g.id}">Сохранить</button></div></div>` : '';
    const on = fold.has('g-' + g.id) || ed;
    return `<section class="h-block sd-b sd-gc sd-f${on ? ' is-open' : ''}">
      <button type="button" class="sd-gc__hd" data-action="sd2-fold" data-k="g-${g.id}" aria-expanded="${on}"><span><b>${title} ${GP[g.per]}</b><small>${per}</small></span><span class="sd-f__r">${chip}<i class="sd-f__ch">${CHEV}</i></span></button>
      <div class="sd-gc__v"><b>${fmt(v)}<i>${unit}</i></b><span>из ${fmt(g.target)}${unit}</span><strong>${Math.round((v / g.target) * 100)}%</strong></div>
      <div class="sd-goal"><i style="--w:${pc}%"></i></div>
      ${on ? `<div class="sd-f__full"><p class="sd-note">${note}</p>${hist}${ed ? editor : `<div class="f-btn-row"><button type="button" class="f-btn" data-action="gl-edit" data-id="${g.id}">Изменить цель</button></div>`}</div>` : `<button type="button" class="sd-f__more" data-action="sd2-fold" data-k="g-${g.id}">Подробнее</button>`}</section>`;
  }).join('');
  const done = L.filter((g) => { const gm = g.per === 'year' ? 0 : (mode === 'month' ? pm : (py === now.getFullYear() ? now.getMonth() : 11)); const f = g.per === 'year' ? new Date(py, 0, 1) : new Date(py, gm, 1), t = g.per === 'year' ? new Date(py + 1, 0, 1) : new Date(py, gm + 1, 1); return agg({ from: f, to: t })[g.kind] >= g.target; }).length;
  const sum = L.length ? `<div class="sd-gsum"><div><b>${done}<i> из ${L.length}</i></b><small>${plural(L.length, 'цель выполнена', 'целей выполнено', 'целей выполнено')}</small></div><small>Нажмите на цель — подробности</small></div>` : '<p class="sd-note">Целей пока нет — добавьте первую</p>';
  return sum + cards + `<div class="f-btn-row"><button type="button" class="f-btn" data-action="gl-add">+ Добавить цель</button></div>`;
}

export function renderStatsMaster() {
  const p = period(), pp = prevPeriod(), A = agg(p), B = agg(pp);
  const bk = p.buckets.map((b) => agg({ from: b.from, to: b.to }));
  const labels = p.buckets.map((b) => b.l);
  const scope = mode === 'year' ? 'за год' : 'за месяц';
  let content = '';

  if (tab === 'all') {
    const avgChk = A.n ? A.inc / A.n : 0, avgChkB = B.n ? B.inc / B.n : 0;
    const rep = A.n ? Math.round((A.O.filter((o) => o.repeat).length / A.n) * 100) : 0;
    const hero = `<section class="h-block sd-hero"><small>Прибыль ${scope}</small><div class="sd-hero__v"><b>${fmt(A.profit)}<i> ₽</i></b>${dTag(delta(A.profit, B.profit))}</div>
      <div class="sd-hero__row"><span><i style="background:${C.inc}"></i>Доходы<b>${fmt(A.inc)} ₽</b></span><span><i style="background:${C.exp}"></i>Расходы<b>${fmt(A.exp)} ₽</b></span></div>
      <p class="sd-hero__cmp">${B.inc ? `${isCur() ? 'За тот же срок' : 'За прошлый период'} (${prevName().replace('к ', '')}) прибыль была ${fmt(B.profit)} ₽` : ''}</p></section>`;
    const tile = (t, v, d, sub) => `<div class="sd-tile"><small>${t}</small><b>${v}</b><em>${d}${sub ? ` <span>${sub}</span>` : ''}</em></div>`;
    const tiles = `<div class="sd-tiles">${tile('Заказов', A.n, dTag(delta(A.n, B.n)), prevName())}${tile('Средний чек', `${k(avgChk)} ₽`, dTag(delta(avgChk, avgChkB)), prevName())}
      ${tile('Рабочих дней', A.days, dTag(delta(A.days, B.days)), prevName())}${tile('Повторные клиенты', `${rep}%`, '', `${A.O.filter((o) => o.repeat).length} из ${A.n}`)}</div>`;
    // выводы
    const ins = [];
    const bi = bk.reduce((a, x, i) => (x.inc > bk[a].inc ? i : a), 0);
    if (bk.length > 1 && bk[bi].inc) ins.push([C.inc, mode === 'year' ? `Лучший месяц — ${MONN[bi]}` : `Лучшая неделя — ${p.buckets[bi].name}`, `${fmt(bk[bi].inc)} ₽ дохода`]);
    if (A.inc) ins.push([C.exp, `Расходы — ${Math.round((A.exp / A.inc) * 100)}% от дохода`, `на каждые 100 ₽ дохода уходит ${Math.round((A.exp / A.inc) * 100)} ₽`]);
    const srcM = [...groupBy(A.O, (o) => o.src, () => 1)].sort((a, b) => b[1] - a[1]);
    if (srcM[0]) ins.push([C.blue, `Больше всего заказов — ${srcM[0][0]}`, `${srcM[0][1]} из ${A.n}`]);
    const insB = ins.length ? `<div class="sd-ins">${ins.map(([c, t, s]) => `<div class="sd-ins__c" style="--c:${c}"><b>${esc(t)}</b><small>${esc(s)}</small></div>`).join('')}</div>` : '';
    const srcRows = SRC.map(([t, , col]) => ({ key: 'src:' + t, t, col, v: A.O.filter((o) => o.src === t).length, d: delta(A.O.filter((o) => o.src === t).length, B.O.filter((o) => o.src === t).length) })).filter((x) => x.v).sort((a, b) => b.v - a.v);
    content = hero + tiles + insB + (srcRows.length ? fblock('src', ['Откуда заказы', scope], stackSum(srcRows, ''), catList(srcRows, '', (x) => `${x.v} ${x.v === 1 ? 'заказ' : x.v < 5 ? 'заказа' : 'заказов'}`,
      (x) => A.O.filter((o) => 'src:' + o.src === x.key).map((o) => opRow(o.d, `№${o.no} · ${o.client}`, `${o.m2} м² · ${o.brand}`, `${fmt(o.sum)} ₽`)).join(''))) : '');
  } else if (tab === 'money') {
    const cats = money === 'inc' ? INC_CAT : EXP_CAT;
    const rows = cats.map(([t, col]) => { const v = A.P.filter((x) => x.kind === money && x.cat === t).reduce((a, x) => a + x.sum, 0), pv = B.P.filter((x) => x.kind === money && x.cat === t).reduce((a, x) => a + x.sum, 0);
      return { key: money + ':' + t, t, col, v, d: delta(v, pv), inv: money === 'exp', cnt: A.P.filter((x) => x.kind === money && x.cat === t).length }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const tot = money === 'inc' ? A.inc : A.exp;
    const catB = `<div class="sd-mseg">${seg2([['inc', 'Доходы'], ['exp', 'Расходы']], money, 'sd2-money')}</div>` + fblock('money-' + money, [money === 'inc' ? 'Доходы' : 'Расходы', `${scope} · ${rows.length} ${plural(rows.length, 'категория', 'категории', 'категорий')}`],
      `<div class="sd-dn">${donut(rows.map((x) => [x.t, x.v, x.col]), k(tot), money === 'inc' ? 'доход, ₽' : 'расход, ₽')}<div><div class="sd-dn__sum"><b>${fmt(tot)} ₽</b><small>${dTag(delta(tot, money === 'inc' ? B.inc : B.exp), money === 'exp')} <span>${prevName()}</span></small></div>${legend(rows, tot)}</div></div>`,
      rows.length ? catList(rows, ' ₽', (x) => `${x.cnt} ${x.cnt === 1 ? 'операция' : x.cnt < 5 ? 'операции' : 'операций'}`,
        (x) => A.P.filter((o) => o.kind + ':' + o.cat === x.key).sort((a, b) => b.d - a.d).slice(0, 12).map((o) => opRow(o.d, o.o ? `№${o.o.no} · ${o.o.client}` : o.note || x.t, o.o ? `${o.o.m2} м²` : 'покупка', `${money === 'inc' ? '+' : '−'}${fmt(o.sum)} ₽`)).join('')) : '<p class="sd-note">Нет операций за период</p>');
    content = catB;
  } else if (tab === 'goals') {
    content = goalsTab();
  } else {
    const kpi = `<div class="sd-kpi"><span><b>${fmt(A.m2)}</b><small>м² поклеено ${dTag(delta(A.m2, B.m2))}</small></span><span><b>${A.days ? Math.round(A.m2 / A.days) : 0}</b><small>м² в день</small></span><span><b>${A.O.reduce((a, o) => a + o.rooms.length, 0)}</b><small>комнат</small></span><span><b>${fmt(A.rolls)}</b><small>рулонов</small></span></div>`;
    const brRows = BRANDS.map(([t, , col]) => { const O = A.O.filter((o) => o.brand === t); return { key: 'br:' + t, t, col, v: O.reduce((a, o) => a + o.m2, 0), rolls: O.reduce((a, o) => a + o.rolls, 0), n: O.length, d: delta(O.reduce((a, o) => a + o.m2, 0), B.O.filter((o) => o.brand === t).reduce((a, o) => a + o.m2, 0)) }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const ordList = (f) => A.O.filter(f).sort((a, b) => b.d - a.d).map((o) => opRow(o.d, `№${o.no} · ${o.client}`, `${o.rooms.map((r) => r[0]).join(', ')} · ${o.type}`, `${o.m2} м²`)).join('');
    // Материалы: кольцо по брендам + список брендов; раскрытие — подробно: из чего обои, рулоны, клей, заказы
    const brDetail = (x) => { const O = A.O.filter((o) => 'br:' + o.brand === x.key);
      const tp = [...groupBy(O, (o) => o.type, (o) => o.m2)].sort((a, b) => b[1] - a[1]);
      const gl = [...groupBy(O, (o) => o.glue, () => 1)].sort((a, b) => b[1] - a[1]);
      return `<div class="sd-bd"><div class="sd-bd__kv"><span><b>${fmt(x.v)} м²</b><small>поклеено</small></span><span><b>${x.rolls}</b><small>рулонов</small></span><span><b>${x.n}</b><small>${plural(x.n, 'заказ', 'заказа', 'заказов')}</small></span></div>
        <p class="sd-bd__t">Обои</p><div class="sd-bd__chips">${tp.map(([t, v]) => `<span>${esc(t)} <b>${fmt(v)} м²</b></span>`).join('')}</div>
        <p class="sd-bd__t">Клей</p><div class="sd-bd__chips">${gl.map(([t, n]) => `<span>${esc(t)} <b>${n} ${plural(n, 'заказ', 'заказа', 'заказов')}</b></span>`).join('')}</div>
        <p class="sd-bd__t">Заказы</p></div>${ordList((o) => 'br:' + o.brand === x.key)}`; };
    const brands = fblock('mat', ['Материалы', `бренды обоев · поклеено ${scope}`], `<div class="sd-dn">${donut(brRows.map((x) => [x.t, x.v, x.col]), brRows.length, plural(brRows.length, 'бренд', 'бренда', 'брендов'))}${legend(brRows, A.m2)}</div>`,
      catList(brRows, ' м²', (x) => `${x.rolls} рулонов · ${x.n} ${plural(x.n, 'заказ', 'заказа', 'заказов')}`, brDetail));
    const gRows = GLUES.map(([t, , col]) => { const O = A.O.filter((o) => o.glue === t); return { key: 'gl:' + t, t, col, v: O.length, pk: O.reduce((a, o) => a + Math.ceil(o.rolls / 8), 0) }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const glue = fblock('glue', ['Клей', 'в скольких заказах'], stackSum(gRows, ''), catList(gRows, '', (x) => `${x.pk} пачек`, (x) => ordList((o) => 'gl:' + o.glue === x.key)));
    const rRows = ROOMS.map(([t, col]) => { let v = 0, n = 0; A.O.forEach((o) => o.rooms.forEach((r) => { if (r[0] === t) { v += r[1]; n++; } })); return { key: 'rm:' + t, t, col, v, n }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const rooms = fblock('rooms', ['По комнатам', `поклеено ${scope}`], stackSum(rRows, ' м²'), catList(rRows, ' м²', (x) => `${x.n} ${x.n === 1 ? 'комната' : x.n < 5 ? 'комнаты' : 'комнат'}`, (x) => ordList((o) => o.rooms.some((r) => 'rm:' + r[0] === x.key))));
    content = A.n ? kpi + brands + glue + rooms : '<p class="sd-note">Нет заказов за период</p>';
  }

  // ── Выбор периода: год стрелками, 12 столбиков-месяцев ──
  const MA = Array.from({ length: 12 }, (_, i) => (py === now.getFullYear() && i > now.getMonth() ? null : agg({ from: new Date(py, i, 1), to: new Date(py, i + 1, 1) })));
  const metric = tab === 'work' ? [['m2', C.blue, ' м²']] : tab === 'money' ? [['inc', C.inc, ' ₽'], ['exp', C.exp, ' ₽']] : tab === 'goals' ? [['inc', C.gold, ' ₽']] : [['profit', C.inc, ' ₽']];
  const pmax = Math.max(1, ...MA.filter(Boolean).flatMap((a) => metric.map(([key]) => a[key])));
  const cols = MA.map((a, i) => { const on = mode === 'month' && pm === i;
    if (!a) return `<span class="sd-mp__c is-off"><span class="sd-mp__bars"><i style="--h:4%"></i></span><small>${MONS[i]}</small></span>`;
    return `<button type="button" class="sd-mp__c${on ? ' is-on' : ''}${mode === 'year' ? ' is-all' : ''}" data-action="sd2-month" data-m="${i}" aria-label="${MONN[i]}">
      <em>${on ? k(a[metric[0][0]]) : ''}</em><span class="sd-mp__bars">${metric.map(([key, col]) => `<i style="--h:${Math.max(3, (Math.max(0, a[key]) / pmax) * 100)}%;--c:${col}"></i>`).join('')}</span><small>${MONS[i]}</small></button>`; }).join('');
  const lbl = tab === 'work' ? 'поклеено, м²' : tab === 'money' ? `<span class="sd-lg"><i style="background:${C.inc}"></i>доходы <i style="background:${C.exp}"></i>расходы</span>` : tab === 'goals' ? 'доход по месяцам' : 'прибыль по месяцам';
  const per = `<section class="h-block sd-mp">
    <div class="sd-mp__hd"><div class="sd-per__nav"><button type="button" class="f-icon-btn" data-action="sd2-prev" aria-label="Прошлый год"${canPrev() ? '' : ' disabled'}>${ARR('l')}</button>
      <b>${py}</b><button type="button" class="f-icon-btn" data-action="sd2-next" aria-label="Следующий год"${py >= now.getFullYear() ? ' disabled' : ''}>${ARR('r')}</button></div>
      <button type="button" class="sd-mp__all${mode === 'year' ? ' is-on' : ''}" data-action="sd2-year">Весь год</button></div>
    <div class="sd-mp__grid">${cols}</div>
    <div class="sd-mp__ft"><small>${lbl}</small><b>${mode === 'year' ? `Сводка за ${py} год` : `Сводка за ${MONN[pm]}`}</b></div></section>`;
  const tabs = [['all', 'Обзор'], ['money', 'Деньги'], ['work', 'Работа'], ['goals', 'Цели']];
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    <div class="h-page sd"><header class="sd-hd"><h1>Статистика</h1></header>${per}${content}<p class="sd-demo">Прошлые периоды — примерные данные для показа</p></div>
    <nav class="f-nav f-nav--tabs" aria-label="Нижнее меню">
      <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open" aria-label="Меню">${ICON_MENU}</button>
      <button type="button" class="f-icon-btn st2-back" data-action="st-back" aria-label="Назад">${BACK}</button>
      <div class="f-topnav f-botnav"><div class="f-topnav__track" role="tablist">${tabs.map(([key, t]) => `<button type="button" role="tab" aria-selected="${key === tab}" class="f-tab${key === tab ? ' is-active' : ''}" data-action="sd2-tab" data-k="${key}">${t}</button>`).join('')}</div></div>
    </nav>`;
}
