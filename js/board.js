// «Заказы» мастера — доска по дням. Одна карточка = одна комната заказа на один рабочий день.
// Слева язычок-листок календаря с датой, в карточке: клиент, адрес, время, сумма, номер заказа;
// внизу ярлык комнаты (полоска цвета комнаты) и линия смен: пройденные — точки, текущая — капсула.
// Пока показ на примерных заказах (даты от сегодняшнего дня), позже — из настоящих заказов.

import { actions, rerender, go } from './core.js?v=70';
import * as S from './store.js?v=70';
import { renderOformit } from './oformit.js?v=70';
import { esc } from './ui.js?v=70';

const ICON_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="10" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="15" width="18" height="2" rx="1" fill="#A3AEBE"/></svg>';
const SEARCH = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="#edf0e7" stroke-width="1.8"/><path d="M16 16l4 4" stroke="#edf0e7" stroke-width="1.8" stroke-linecap="round"/></svg>';
const STAGES = [['measure', 'Замер'], ['approval', 'Согласование'], ['queue', 'Очередь'], ['work', 'В работе'], ['done', 'Выполнено']];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

let stage = 'queue';
let query = '';

const P = { no: '004', n: 'Александр Петров', a: 'ул. Ленина 15, кв. 42', ph: '+7 (917) 123-45-67' };
const A = { no: '007', n: 'Анастасия Смирнова', a: 'ул. Айская 35/1, кв. 7', ph: '+7 (987) 555-12-34' };
const I = { no: '011', n: 'Мария Иванова', a: 'ул. Пушкина 4, кв. 12', ph: '+7 (903) 777-88-99' };
const H = { no: '014', n: 'Ильдар Хасанов', a: 'ул. Кирова 12, кв. 51', ph: '+7 (927) 321-00-11' };
// комнаты: название, этаж, цвет, сумма, смены (доли дня)
const R = {
  pS: { c: P, r: 'Спальня', f: '1 этаж', col: '#3b82f6', sum: 11900, sh: [1, 1] },
  aK: { c: A, r: 'Кухня', f: '2 этаж', col: '#ef4444', sum: 15600, sh: [1, 1, 0.5] },
  pK: { c: P, r: 'Коридор', f: '1 этаж', col: '#10b981', sum: 3310, sh: [0.5] },
  pV: { c: P, r: 'Ванная', f: '1 этаж', col: '#8b5cf6', sum: 3310, sh: [0.5] },
  iK: { c: I, r: 'Кухня', f: '1 этаж', col: '#f59e0b', sum: 6880, sh: [1] },
  hG: { c: H, r: 'Гостиная', f: '3 этаж', col: '#f59e0b', sum: 18700, sh: [1, 1, 1] },
};
// Смены считаются по заказу целиком (все комнаты клиента подряд): доли рабочих дней заказа.
const ORDER_SH = { '004': [1, 1, 0.5], '007': [1, 1, 0.5], '011': [1], '014': [1, 1, 1] };
// день относительно сегодня → [комната, номер смены заказа, время]
const QUEUE = [
  [-1, 'aK', 0, '10:00'], [0, 'aK', 1, '9:00'], [1, 'aK', 2, '9:00'], [1, 'pS', 0, '13:00'],
  [2, 'pS', 1, '9:00'], [3, 'pK', 2, '9:00'], [3, 'pV', 2, '13:00'], [4, null], [5, 'iK', 0, '11:00'],
  [6, null], [7, 'hG', 0, '9:00'], [8, 'hG', 1, '9:00'], [9, 'hG', 2, '9:00'],
];
const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
const dayOf = (off) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; };
const label = (sh, i) => (sh[i] < 1 ? `${Math.round(sh[i] * 8)} ч` : `${i + 1}-й день`);

function steps(x, k) {
  const sh = ORDER_SH[x.c.no];
  const parts = sh.map((h, i) => `${i ? `<b class="${i <= k ? 'past' : ''}"></b>` : ''}<i class="${i < k ? 'past' : i === k ? 'on' : ''}">${i === k ? label(sh, i) : ''}</i>`).join('');
  return `<span class="bd-steps">${parts}${sh.length === 1 ? '<b class="bd-gap"></b>' : ''}</span>`;
}
// Все листки одинаковые: день недели, число, месяц.
const leaf = (d) => `<span class="bd-leaf"><small>${WD[d.getDay()]}</small><b>${d.getDate()}</b><i>${MON[d.getMonth()]}</i></span>`;

function card(off, key, k, time) {
  const d = dayOf(off);
  const today = off === 0;
  if (!key) return `<div class="bd-slot">${leaf(d, today)}<div class="bd-card bd-card--free">свободная дата</div></div>`;
  const x = R[key];
  return `<div class="bd-slot">${leaf(d, today)}<button type="button" class="bd-card${today ? ' is-today' : ''}" data-action="bd-open" data-no="${x.c.no}">
    <span class="bd-top"><span class="bd-who"><b>${esc(x.c.n)}</b><small>${esc(x.c.a)} · <em>с ${time}</em></small></span><span class="bd-sum"><b>${fmt(x.sum)} ₽</b><small>№${x.c.no}</small></span></span>
    <span class="bd-foot"><span class="bd-room" style="--c:${x.col}">${esc(x.r)}<small>${esc(x.f)}</small></span>${steps(x, k)}</span>
  </button></div>`;
}

export function renderBoard() {
  if (restore) { restore = false; const y = backY; setTimeout(() => window.scrollTo(0, y), 30); }
  const q = query.trim().toLowerCase();
  let rows = stage === 'queue' ? QUEUE : [];
  if (q) rows = rows.filter(([, k]) => k && [R[k].c.n, R[k].c.a, R[k].c.ph, R[k].c.no].join(' ').toLowerCase().includes(q));
  const body = rows.length ? rows.map(([off, k, n, t]) => card(off, k, n, t)).join('')
    : `<p class="bd-empty">${q ? 'Ничего не нашлось' : 'В этом этапе пока пусто'}</p>`;
  const tabs = STAGES.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === stage}" class="f-tab${k === stage ? ' is-active' : ''}" data-action="bd-stage" data-stage="${k}">${t}</button>`).join('');
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    <label class="f-input bd-search">${SEARCH}<input id="bd-q" type="search" placeholder="Телефон, имя или адрес…" value="${esc(query)}" data-live="bd-q"/></label>
    <div class="bd-list">${body}</div>
    <nav class="f-nav f-nav--tabs" aria-label="Нижнее меню">
      <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open">${ICON_MENU}<span>Меню</span></button>
      <div class="f-topnav f-botnav f-botnav--many"><div class="f-topnav__track" role="tablist">${tabs}</div></div>
    </nav>`;
}

actions['bd-stage'] = (el) => { stage = el.dataset.stage; rerender(); window.scrollTo(0, 0); };
// Нажатие на карточку — весь заказ (обычный наш заказ со всеми вкладками): посмотреть и поправить.
// Запоминаем этап и место в списке: «назад» возвращает ровно туда, откуда открыли.
let backY = 0;
actions['bd-open'] = (el) => { backY = window.scrollY; go('bd-order-' + el.dataset.no); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (off) => { const d = dayOf(off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Примерные заказы: что в них «заполнено» — канал, клиент, оценка по комнатам, график.
const DEMO = {
  '004': { src: 'Авито', ph: '9171234567', street: 'г Уфа, ул Ленина', house: '15', flat: '42', fl: '3', hour: '09', start: 1,
    rooms: [['Спальня', '#3b82f6', 1, [['prime', 20], ['paste-flizelin', 30]]], ['Коридор', '#10b981', 1, [['prime', 10], ['paste-flizelin', 7]]], ['Ванная', '#8b5cf6', 1, [['prime', 10], ['paste-flizelin', 7]]]], days: [1, 1, 3, 3] },
  '007': { src: 'Сайт', ph: '9875551234', street: 'г Уфа, ул Айская', house: '35/1', flat: '7', fl: '5', hour: '10',
    rooms: [['Кухня', '#ef4444', 2, [['strip', 20], ['prime', 20], ['putty', 20], ['paste-flizelin', 20]]]], days: [-1] },
  '011': { src: 'Рекомендация', ph: '9037778899', street: 'г Уфа, ул Пушкина', house: '4', flat: '12', fl: '2', hour: '11',
    rooms: [['Кухня', '#f59e0b', 1, [['prime', 16], ['paste-flizelin', 16]]]], days: [5] },
  '014': { src: 'Авито', ph: '9273210011', street: 'г Уфа, ул Кирова', house: '12', flat: '51', fl: '9', hour: '09',
    rooms: [['Гостиная', '#f59e0b', 3, [['strip', 10], ['prime', 40], ['paste-flizelin', 40]]]], days: [7] },
};
const CL = { '004': P, '007': A, '011': I, '014': H };
function seedOrder(no) {
  const st = S.get(); st.oformit = st.oformit || {};
  const key = 'ord-' + no;
  if (st.oformit[key]) return;
  const x = DEMO[no]; const c = CL[no];
  const cl = { name: c.n, phone: `+7 (${x.ph.slice(0, 3)}) ${x.ph.slice(3, 6)}-${x.ph.slice(6, 8)}-${x.ph.slice(8)}`, street: x.street, house: x.house, entrance: '1', flat: x.flat, floor: x.fl, hour: x.hour, min: '00', comment: '', saved: true, editing: false, dirty: false };
  cl.snap = Object.fromEntries(['name', 'phone', 'street', 'house', 'entrance', 'flat', 'floor', 'hour', 'min', 'comment'].map((k) => [k, cl[k]]));
  const rooms = x.rooms.map(([name, color, floor, svcs], i) => ({ key: `r${no}${i}`, floor, name, color, svcs: svcs.map(([id, qty]) => ({ id, qty })), status: 'saved', panel: '', snap: Object.fromEntries(svcs) }));
  const place = {}; rooms.forEach((r, i) => { place[r.key] = iso(x.days[Math.min(i, x.days.length - 1)] + (no === '004' && i > 0 ? 2 : 0)); });
  if (no === '004') { place[rooms[1].key] = iso(3); place[rooms[2].key] = iso(3); }
  const d0 = dayOf(x.days[0]);
  st.oformit[key] = {
    channel: { source: x.src, partner: 'self', url: '', pct: 0 }, saved: true, dirty: false, editing: false,
    cl, est: { rooms, view: rooms[0].key, floor: 1, confirm: null },
    sched: { mode: 'rooms', sel: '', picks: [], place, measure: '', month: `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}`, status: 'saved', dirty: false },
  };
  S.save();
}
const BACK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="#edf0e7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function renderBoardOrder(no) {
  if (!DEMO[no]) return null;
  seedOrder(no);
  S.setDraftKey('ord-' + no);
  restore = true; // «назад» (кнопкой или жестом) вернёт на тот же этап и то же место списка
  const c = CL[no];
  const head = `<div class="bd-ohead"><button type="button" class="f-icon-btn bd-back" data-action="bd-back" aria-label="К заказам">${BACK}</button><span><b>${esc(c.n)}</b><small>Заказ №${no} · Очередь</small></span></div>`;
  return renderOformit('order').replace('<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>', `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>${head}`);
}
let restore = false;
actions['bd-back'] = () => go('orders');
export function onLiveBoard(el) {
  if (el.dataset.live !== 'bd-q') return false;
  query = el.value;
  const pos = el.selectionStart;
  rerender();
  const again = document.getElementById('bd-q');
  if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* поле */ } }
  return true;
}
