// Статистика мастера: период (месяц / год) с листанием, три вкладки без повторов.
// Суть по образцу «Анализа финансов» Сбера: выбранный период, сравнение с прошлым, разбивка по категориям
// с долями, тап по категории — список операций; цель (бюджет) на период и подсказки-выводы.
// Данные прошлых периодов — примерные (генерируются детерминированно), пока нет настоящих.
import { actions, rerender } from './core.js?v=268';
import { esc } from './ui.js?v=268';

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
    const n = Math.max(back === 0 ? 3 : 2, Math.round((3 + rnd() * 3) * season * (back === 0 ? lastDay / dim : 1)));
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
const canPrev = () => (mode === 'year' ? py > minD.getFullYear() : new Date(py, pm - 1, 1) >= minD);
const reset = () => { sel = {}; open = ''; };
actions['sd2-tab'] = (el) => { tab = el.dataset.k; reset(); rerender(); window.scrollTo(0, 0); };
actions['sd2-mode'] = (el) => { mode = el.dataset.k; if (mode === 'month' && py === now.getFullYear()) pm = Math.min(pm, now.getMonth()); reset(); rerender(); };
actions['sd2-prev'] = () => { if (!canPrev()) return; if (mode === 'year') py--; else { pm--; if (pm < 0) { pm = 11; py--; } } reset(); rerender(); };
actions['sd2-next'] = () => { if (isCur()) return; if (mode === 'year') { py++; if (py === now.getFullYear()) pm = Math.min(pm, now.getMonth()); } else { pm++; if (pm > 11) { pm = 0; py++; } } reset(); rerender(); };
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
const seg2 = (items, cur, act) => `<div class="f-topnav sd-seg"><div class="f-topnav__track" role="tablist">${items.map(([key, t]) => `<button type="button" role="tab" aria-selected="${key === cur}" class="f-tab${key === cur ? ' is-active' : ''}" data-action="${act}" data-k="${key}">${t}</button>`).join('')}</div></div>`;

export function renderStatsMaster() {
  const p = period(), pp = prevPeriod(), A = agg(p), B = agg(pp);
  const bk = p.buckets.map((b) => agg({ from: b.from, to: b.to }));
  const labels = p.buckets.map((b) => b.l);
  const scope = mode === 'year' ? 'за год' : 'за месяц';
  let content = '';

  if (tab === 'all') {
    const goal = mode === 'year' ? 720000 : 60000, gp = Math.min(100, (A.inc / goal) * 100);
    const avgChk = A.n ? A.inc / A.n : 0, avgChkB = B.n ? B.inc / B.n : 0;
    const rep = A.n ? Math.round((A.O.filter((o) => o.repeat).length / A.n) * 100) : 0;
    const hero = `<section class="h-block sd-hero"><small>Прибыль ${scope}</small><div class="sd-hero__v"><b>${fmt(A.profit)}<i> ₽</i></b>${dTag(delta(A.profit, B.profit))}</div>
      <div class="sd-hero__row"><span><i style="background:${C.inc}"></i>Доходы<b>${fmt(A.inc)} ₽</b></span><span><i style="background:${C.exp}"></i>Расходы<b>${fmt(A.exp)} ₽</b></span></div>
      <p class="sd-hero__cmp">${B.inc ? `${isCur() ? 'За тот же срок' : 'За прошлый период'} (${prevName().replace('к ', '')}) прибыль была ${fmt(B.profit)} ₽` : ''}</p></section>`;
    const tile = (t, v, d, sub) => `<div class="sd-tile"><small>${t}</small><b>${v}</b><em>${d}${sub ? ` <span>${sub}</span>` : ''}</em></div>`;
    const tiles = `<div class="sd-tiles">${tile('Заказов', A.n, dTag(delta(A.n, B.n)), prevName())}${tile('Средний чек', `${k(avgChk)} ₽`, dTag(delta(avgChk, avgChkB)), prevName())}
      ${tile('Рабочих дней', A.days, dTag(delta(A.days, B.days)), prevName())}${tile('Повторные клиенты', `${rep}%`, '', `${A.O.filter((o) => o.repeat).length} из ${A.n}`)}</div>`;
    const goalB = block([`Цель ${scope}`, `${fmt(goal)} ₽ дохода`, `<b class="sd-goal__p">${Math.round(gp)}%</b>`],
      `<div class="sd-goal"><i style="--w:${gp}%"></i></div><p class="sd-note">${A.inc >= goal ? 'Цель выполнена 🎉' : `Осталось ${fmt(goal - A.inc)} ₽${isCur() ? (mode === 'year' ? ` · ${12 - now.getMonth()} мес. до конца года` : ` · ${new Date(py, pm + 1, 0).getDate() - now.getDate()} дн. до конца месяца`) : ''}`}</p>`);
    // выводы
    const ins = [];
    const bi = bk.reduce((a, x, i) => (x.inc > bk[a].inc ? i : a), 0);
    if (bk.length > 1 && bk[bi].inc) ins.push([C.inc, mode === 'year' ? `Лучший месяц — ${MONN[bi]}` : `Лучшая неделя — ${p.buckets[bi].name}`, `${fmt(bk[bi].inc)} ₽ дохода`]);
    if (A.inc) ins.push([C.exp, `Расходы — ${Math.round((A.exp / A.inc) * 100)}% от дохода`, `на каждые 100 ₽ дохода уходит ${Math.round((A.exp / A.inc) * 100)} ₽`]);
    const srcM = [...groupBy(A.O, (o) => o.src, () => 1)].sort((a, b) => b[1] - a[1]);
    if (srcM[0]) ins.push([C.blue, `Больше всего заказов — ${srcM[0][0]}`, `${srcM[0][1]} из ${A.n}`]);
    const insB = ins.length ? `<div class="sd-ins">${ins.map(([c, t, s]) => `<div class="sd-ins__c" style="--c:${c}"><b>${esc(t)}</b><small>${esc(s)}</small></div>`).join('')}</div>` : '';
    const srcRows = SRC.map(([t, , col]) => ({ key: 'src:' + t, t, col, v: A.O.filter((o) => o.src === t).length, d: delta(A.O.filter((o) => o.src === t).length, B.O.filter((o) => o.src === t).length) })).filter((x) => x.v).sort((a, b) => b.v - a.v);
    content = hero + tiles + goalB + insB + (srcRows.length ? block(['Откуда заказы', scope], catList(srcRows, '', (x) => `${x.v} ${x.v === 1 ? 'заказ' : x.v < 5 ? 'заказа' : 'заказов'}`,
      (x) => A.O.filter((o) => 'src:' + o.src === x.key).map((o) => opRow(o.d, `№${o.no} · ${o.client}`, `${o.m2} м² · ${o.brand}`, `${fmt(o.sum)} ₽`)).join(''))) : '');
  } else if (tab === 'money') {
    const s = sel.mon ?? bk.length - 1;
    const head = `<div class="sd-bh__v"><b>${fmt(bk[s].inc - bk[s].exp)}<i> ₽</i></b><small>прибыль · ${esc(p.buckets[s].name)}</small></div>`;
    const ch = block(['Доходы и расходы', `<span class="sd-lg"><i style="background:${C.inc}"></i>доходы <i style="background:${C.exp}"></i>расходы</span>`, head],
      chart({ c: 'mon', kind: 'bar', labels, unit: ' ₽', series: [{ col: C.inc, vals: bk.map((x) => x.inc) }, { col: C.exp, vals: bk.map((x) => x.exp) }] }));
    const cats = money === 'inc' ? INC_CAT : EXP_CAT;
    const rows = cats.map(([t, col]) => { const v = A.P.filter((x) => x.kind === money && x.cat === t).reduce((a, x) => a + x.sum, 0), pv = B.P.filter((x) => x.kind === money && x.cat === t).reduce((a, x) => a + x.sum, 0);
      return { key: money + ':' + t, t, col, v, d: delta(v, pv), inv: money === 'exp', cnt: A.P.filter((x) => x.kind === money && x.cat === t).length }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const tot = money === 'inc' ? A.inc : A.exp;
    const catB = block(null, seg2([['inc', 'Доходы'], ['exp', 'Расходы']], money, 'sd2-money')
      + `<div class="sd-dn">${donut(rows.map((x) => [x.t, x.v, x.col]), k(tot), money === 'inc' ? 'доход, ₽' : 'расход, ₽')}<div class="sd-dn__sum"><b>${fmt(tot)} ₽</b><small>${scope} ${dTag(delta(tot, money === 'inc' ? B.inc : B.exp), money === 'exp')} <span>${prevName()}</span></small></div></div>`
      + (rows.length ? catList(rows, ' ₽', (x) => `${x.cnt} ${x.cnt === 1 ? 'операция' : x.cnt < 5 ? 'операции' : 'операций'}`,
        (x) => A.P.filter((o) => o.kind + ':' + o.cat === x.key).sort((a, b) => b.d - a.d).slice(0, 12).map((o) => opRow(o.d, o.o ? `№${o.o.no} · ${o.o.client}` : o.note || x.t, o.o ? `${o.o.m2} м²` : 'покупка', `${money === 'inc' ? '+' : '−'}${fmt(o.sum)} ₽`)).join('')) : '<p class="sd-note">Нет операций за период</p>'));
    content = ch + catB;
  } else {
    const s = sel.m2 ?? bk.length - 1;
    const head = `<div class="sd-bh__v"><b>${fmt(bk[s].m2)}<i> м²</i></b><small>${esc(p.buckets[s].name)}</small></div>`;
    const ch = block(['Поклеено', `${fmt(A.m2)} м² ${scope} ${dTag(delta(A.m2, B.m2))}`, head], chart({ c: 'm2', kind: 'area', labels, unit: 'м²', series: [{ col: C.blue, vals: bk.map((x) => x.m2) }] }));
    const kpi = `<div class="sd-kpi"><span><b>${A.days ? Math.round(A.m2 / A.days) : 0}</b><small>м² в день</small></span><span><b>${A.O.reduce((a, o) => a + o.rooms.length, 0)}</b><small>комнат</small></span><span><b>${fmt(A.rolls)}</b><small>рулонов</small></span></div>`;
    const brRows = BRANDS.map(([t, , col]) => { const O = A.O.filter((o) => o.brand === t); return { key: 'br:' + t, t, col, v: O.reduce((a, o) => a + o.m2, 0), rolls: O.reduce((a, o) => a + o.rolls, 0), n: O.length, d: delta(O.reduce((a, o) => a + o.m2, 0), B.O.filter((o) => o.brand === t).reduce((a, o) => a + o.m2, 0)) }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const ordList = (f) => A.O.filter(f).sort((a, b) => b.d - a.d).map((o) => opRow(o.d, `№${o.no} · ${o.client}`, `${o.rooms.map((r) => r[0]).join(', ')} · ${o.type}`, `${o.m2} м²`)).join('');
    const brands = block(['Обои по брендам', `поклеено ${scope}`], catList(brRows, ' м²', (x) => `${x.rolls} рулонов · ${x.n} ${x.n === 1 ? 'заказ' : x.n < 5 ? 'заказа' : 'заказов'}`, (x) => ordList((o) => 'br:' + o.brand === x.key)));
    const tRows = TYPES.map(([t, col]) => [t, A.O.filter((o) => o.type === t).reduce((a, o) => a + o.m2, 0), col]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]);
    const tTot = tRows.reduce((a, x) => a + x[1], 0) || 1;
    const types = block(['Тип обоев', 'доля по площади'], `<div class="sd-dn">${donut(tRows, tRows.length, 'типов')}<ul class="sd-leg">${tRows.map(([t, v, col]) => `<li><i style="background:${col}"></i><span>${t}</span><b>${Math.round((v / tTot) * 100)}%</b></li>`).join('')}</ul></div>`);
    const gRows = GLUES.map(([t, , col]) => { const O = A.O.filter((o) => o.glue === t); return { key: 'gl:' + t, t, col, v: O.length, pk: O.reduce((a, o) => a + Math.ceil(o.rolls / 8), 0) }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const glue = block(['Клей', 'в скольких заказах'], catList(gRows, '', (x) => `${x.pk} пачек`, (x) => ordList((o) => 'gl:' + o.glue === x.key)));
    const rRows = ROOMS.map(([t, col]) => { let v = 0, n = 0; A.O.forEach((o) => o.rooms.forEach((r) => { if (r[0] === t) { v += r[1]; n++; } })); return { key: 'rm:' + t, t, col, v, n }; }).filter((x) => x.v).sort((a, b) => b.v - a.v);
    const rooms = block(['По комнатам', `поклеено ${scope}`], catList(rRows, ' м²', (x) => `${x.n} ${x.n === 1 ? 'комната' : x.n < 5 ? 'комнаты' : 'комнат'}`, (x) => ordList((o) => o.rooms.some((r) => 'rm:' + r[0] === x.key))));
    content = A.n ? ch + kpi + brands + types + glue + rooms : ch + '<p class="sd-note">Нет заказов за период</p>';
  }

  const per = `<div class="sd-per">${seg2([['month', 'Месяц'], ['year', 'Год']], mode, 'sd2-mode')}
    <div class="sd-per__nav"><button type="button" class="f-icon-btn" data-action="sd2-prev" aria-label="Назад"${canPrev() ? '' : ' disabled'}>${ARR('l')}</button>
      <b>${p.title}</b><button type="button" class="f-icon-btn" data-action="sd2-next" aria-label="Вперёд"${isCur() ? ' disabled' : ''}>${ARR('r')}</button></div></div>`;
  const tabs = [['all', 'Обзор'], ['money', 'Деньги'], ['work', 'Работа']];
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    <div class="h-page sd"><header class="sd-hd"><h1>Статистика</h1></header>${per}${content}<p class="sd-demo">Прошлые периоды — примерные данные для показа</p></div>
    <nav class="f-nav f-nav--tabs" aria-label="Нижнее меню">
      <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open" aria-label="Меню">${ICON_MENU}</button>
      <button type="button" class="f-icon-btn st2-back" data-action="st-back" aria-label="Назад">${BACK}</button>
      <div class="f-topnav f-botnav"><div class="f-topnav__track" role="tablist">${tabs.map(([key, t]) => `<button type="button" role="tab" aria-selected="${key === tab}" class="f-tab${key === tab ? ' is-active' : ''}" data-action="sd2-tab" data-k="${key}">${t}</button>`).join('')}</div></div>
    </nav>`;
}
