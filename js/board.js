// «Заказы» мастера — доска по дням. Одна карточка = одна комната заказа на один рабочий день.
// Слева язычок-листок календаря с датой, в карточке: клиент, адрес, время, сумма, номер заказа;
// внизу ярлык комнаты (полоска цвета комнаты) и линия смен: пройденные — точки, текущая — капсула.
// Пока показ на примерных заказах (даты от сегодняшнего дня), позже — из настоящих заказов.

import { actions, rerender, go } from './core.js?v=317';
import * as S from './store.js?v=317';
import { renderOformit, oformitDraft } from './oformit.js?v=317';
import { roomTotals, svcInfo } from './ocenka.js?v=317';
import { smetaTotals } from './zakaz.js?v=317';
import { bookedDays, homeLayout, homeCalendarHtml } from './grafik.js?v=317';
import { SHIFT_HOURS, shiftsText } from './calc.js?v=317';
import { esc, toast, status, seg } from './ui.js?v=317';
import { topbar, ORDER_STATUS } from './shared.js?v=317';

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
// Заказы на этапе замера (примерные): замер назначен, оценки и плана ещё нет.
const OP = { no: '015', n: 'Ольга Петрова', a: 'ул. Комсомольская 21, кв. 40', ph: '+7 (917) 700-11-22' };
const DA = { no: '016', n: 'Дмитрий Ахметов', a: 'пр. Октября 88, кв. 113', ph: '+7 (960) 333-44-55' };
// комнаты: название, этаж, цвет, сумма, смены (доли дня)
const R = {
  pS: { c: P, r: 'Спальня', f: '1 этаж', col: '#3b82f6', sum: 11900, sh: [1, 1] },
  aK: { c: A, r: 'Кухня', f: '2 этаж', col: '#ef4444', sum: 13080, sh: [1, 1, 0.5] },
  pK: { c: P, r: 'Коридор', f: '1 этаж', col: '#10b981', sum: 3110, sh: [0.5] },
  pV: { c: P, r: 'Ванная', f: '1 этаж', col: '#8b5cf6', sum: 3110, sh: [0.5] },
  iK: { c: I, r: 'Кухня', f: '1 этаж', col: '#f59e0b', sum: 6220, sh: [1] },
  hG: { c: H, r: 'Гостиная', f: '3 этаж', col: '#f59e0b', sum: 18040, sh: [1, 1, 1] },
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
const leaf = (d, t, time) => `<span class="bd-leaf"><small>${WD[d.getDay()]}</small><b>${d.getDate()}</b><i>${MON[d.getMonth()]}</i>${time ? `<em>с ${time}</em>` : ''}</span>`;

function card(off, key, k, time) {
  const d = dayOf(off);
  const today = off === 0;
  if (!key) return `<div class="bd-slot">${leaf(d, today)}<div class="bd-card bd-card--free">свободная дата</div></div>`;
  const x = R[key];
  return `<div class="bd-slot">${leaf(d, today, time)}<button type="button" class="bd-card${today ? ' is-today' : ''}" data-action="bd-open" data-no="${x.c.no}">
    <span class="bd-top"><span class="bd-who"><b>${esc(x.c.n)}</b><small>${esc(x.c.a)}</small></span><span class="bd-sum"><b>${fmt(x.sum)} ₽</b><small>№${x.c.no}</small></span></span>
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
let restore = false;
actions['bd-open'] = (el) => { backY = window.scrollY; go('bd-order-' + el.dataset.no); };
const pad = (n) => String(n).padStart(2, '0');
const iso = (off) => { const d = dayOf(off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Примерные заказы: что в них «заполнено» — канал, клиент, оценка по комнатам, график.
const DEMO = {
  '004': { src: 'Авито', ph: '9171234567', street: 'г Уфа, ул Ленина', house: '15', flat: '42', fl: '3', hour: '09', start: 1,
    rooms: [['Спальня', '#3b82f6', 1, [['prime', 20], ['paste-flizelin', 30]]], ['Коридор', '#10b981', 1, [['prime', 8], ['paste-flizelin', 7]]], ['Ванная', '#8b5cf6', 1, [['prime', 8], ['paste-flizelin', 7]]]], days: [1, 1, 3, 3] },
  '007': { src: 'Сайт', ph: '9875551234', street: 'г Уфа, ул Айская', house: '35/1', flat: '7', fl: '5', hour: '10',
    rooms: [['Кухня', '#ef4444', 2, [['strip', 20], ['prime', 20], ['putty', 14], ['paste-flizelin', 16]]]], days: [-1] },
  '011': { src: 'Рекомендация', ph: '9037778899', street: 'г Уфа, ул Пушкина', house: '4', flat: '12', fl: '2', hour: '11',
    rooms: [['Кухня', '#f59e0b', 1, [['prime', 16], ['paste-flizelin', 14]]]], days: [5] },
  '014': { src: 'Авито', ph: '9273210011', street: 'г Уфа, ул Кирова', house: '12', flat: '51', fl: '9', hour: '09',
    rooms: [['Гостиная', '#f59e0b', 3, [['strip', 10], ['prime', 40], ['paste-flizelin', 38]]]], days: [7] },
  '015': { src: 'Авито', ph: '9177001122', street: 'г Уфа, ул Комсомольская', house: '21', flat: '40', fl: '4', hour: '17', min: '30', rooms: [], days: [0], meas: 0 },
  '016': { src: 'Сайт', ph: '9603334455', street: 'г Уфа, пр Октября', house: '88', flat: '113', fl: '7', hour: '12', rooms: [], days: [2], meas: 2 },
};
const CL = { '004': P, '007': A, '011': I, '014': H, '015': OP, '016': DA };
// Участники заказа (кроме мастера): кто передал заказ, кто ещё работает по нему.
const PARTS = { '004': [['u-agent', 'Алина Смирнова', 'Агент']], '007': [['shop', 'Продавец «Обои+»', 'Передал материал']], '011': [], '014': [], '015': [], '016': [] };
function seedOrder(no) {
  const st = S.get(); st.oformit = st.oformit || {};
  const key = 'ord-' + no;
  if (st.oformit[key]) return;
  const x = DEMO[no]; const c = CL[no];
  const cl = { name: c.n, phone: `+7 (${x.ph.slice(0, 3)}) ${x.ph.slice(3, 6)}-${x.ph.slice(6, 8)}-${x.ph.slice(8)}`, street: x.street, house: x.house, entrance: '1', flat: x.flat, floor: x.fl, hour: x.hour, min: x.min || '00', comment: '', saved: true, editing: false, dirty: false };
  cl.snap = Object.fromEntries(['name', 'phone', 'street', 'house', 'entrance', 'flat', 'floor', 'hour', 'min', 'comment'].map((k) => [k, cl[k]]));
  const rooms = x.rooms.map(([name, color, floor, svcs], i) => ({ key: `r${no}${i}`, floor, name, color, svcs: svcs.map(([id, qty]) => ({ id, qty })), status: 'saved', panel: '', snap: Object.fromEntries(svcs) }));
  const place = {}; rooms.forEach((r, i) => { place[r.key] = iso(x.days[Math.min(i, x.days.length - 1)] + (no === '004' && i > 0 ? 2 : 0)); });
  if (no === '004') { place[rooms[1].key] = iso(3); place[rooms[2].key] = iso(3); }
  const d0 = dayOf(x.days[0]);
  st.oformit[key] = {
    channel: { source: x.src, partner: 'self', url: '', pct: 0 }, saved: true, dirty: false, editing: false,
    cl, est: { rooms, view: rooms[0] ? rooms[0].key : '', floor: 1, confirm: null },
    sched: { mode: x.meas != null ? 'measure' : 'rooms', sel: '', picks: [], place, measure: x.meas != null ? iso(x.meas) : '', month: `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}`, status: 'saved', dirty: false },
  };
  // Что ещё есть в примерных заказах (показывается в сводке только то, что заполнено).
  const o = st.oformit[key];
  if (no === '007') o.mat = { view: '', scans: 1, rooms: { [rooms[0].key]: { items: [], panel: '', tab: 'added', res: null, note: 'Передал продавец магазина «Обои+»', added: { brand: 'Erismann', type: 'Обои флиз. 106 см' } } } };
  if (no === '014') o.sm = { view: '', rooms: { [rooms[0].key]: { sameH: true, h: 2.7, sameSvc: true, dlg: null, walls: [4.2, 3.6, 4.2, 3.6].map((len, i) => ({ len, h: 2.7, opens: i === 1 ? [{ name: 'Окно', area: 2.1 }] : i === 3 ? [{ name: 'Дверь', area: 1.8 }] : [], svcs: ['prime', 'paste-flizelin'] })) } } };
  if (no === '004') { o.fin = { pays: [{ kind: 'Аванс', amount: 5000, date: iso(-2), method: 'Перевод' }], exps: [] }; o.chat = [{ who: 'u-agent', text: 'Клиент просил начать в 9:30 — будет дома с 9:20.', at: new Date(Date.now() - 36e5).toISOString() }, { who: S.me().id, text: 'Хорошо, приеду к 9:30.', at: new Date(Date.now() - 30e5).toISOString(), read: true }]; }
  S.save();
}
const BACK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="#edf0e7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Открытый заказ — сводка для просмотра. У каждого блока «Изменить»: открывает знакомую форму (вкладку «Выездов»).
const PH = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.6 3.5l2.6.4 1.2 3.6-1.8 1.4a12 12 0 0 0 6.5 6.5l1.4-1.8 3.6 1.2.4 2.6c-.2 1.2-1.3 2.1-2.5 2A16.5 16.5 0 0 1 4.6 6c-.1-1.2.8-2.3 2-2.5Z" stroke="#edf0e7" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const RT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="#edf0e7" stroke-width="1.6"/><circle cx="12" cy="10" r="2.4" stroke="#edf0e7" stroke-width="1.6"/></svg>';
const CHEV = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const openRooms = new Set();
const edit = (no, t) => `<button type="button" class="bd-edit" data-action="bd-edit" data-no="${no}" data-tab="${t}">Изменить</button>`;
const block = (title, no, t, body) => `<section class="f-plate bd-block"><div class="bd-block__hd"><span>${title}</span>${t ? edit(no, t) : ''}</div>${body}</section>`;
// Дни работ: комнаты подряд с даты начала, остаток дня продолжает следующая комната (как в «Графике»).
function workDays(d) {
  const rooms = (d.est && d.est.rooms) || []; const place = (d.sched && d.sched.place) || {};
  const byDate = {};
  rooms.filter((r) => place[r.key]).sort((a, b) => (place[a.key] < place[b.key] ? -1 : 1)).forEach((r) => {
    let left = roomTotals(r).hours; let day = new Date(place[r.key] + 'T12:00:00'); let guard = 0;
    while (left > 1e-6 && guard++ < 60) {
      const k = day.toISOString().slice(0, 10); const used = (byDate[k] || []).reduce((a, x) => a + x.h, 0);
      const h = Math.min(SHIFT_HOURS - used, left);
      if (h > 1e-6) { (byDate[k] = byDate[k] || []).push({ r, h }); left -= h; }
      day.setDate(day.getDate() + 1);
    }
  });
  return Object.keys(byDate).sort().map((k) => ({ date: new Date(k + 'T12:00:00'), parts: byDate[k] }));
}
export function renderBoardOrder(no) {
  if (!DEMO[no]) return null;
  seedOrder(no);
  S.setDraftKey('ord-' + no);
  restore = true; // «назад» (кнопкой или жестом) вернёт на тот же этап и то же место списка
  const d = oformitDraft(); const c = d.cl || {}; const rooms = (d.est && d.est.rooms) || [];
  const tot = rooms.reduce((a, r) => { const t = roomTotals(r); return { sum: a.sum + t.total, h: a.h + t.hours }; }, { sum: 0, h: 0 });
  const days = workDays(d);
  const range = days.length ? `${days[0].date.getDate()} ${MONG[days[0].date.getMonth()]} — ${days[days.length - 1].date.getDate()} ${MONG[days[days.length - 1].date.getMonth()]}` : 'даты не назначены';
  const addr = [c.street, c.house && 'д. ' + c.house, c.flat && 'кв. ' + c.flat].filter(Boolean).join(', ');
  // Клиент, номер и этап — сверху экрана; внизу только «назад» (место в нижней панели свободно).
  const head = '';
  const mid = `<div class="bd-navslot"><button type="button" class="f-icon-btn bd-back" data-action="bd-back" aria-label="К заказам">${BACK}</button><span class="bd-navfree"></span></div>`;
  const client = block('Клиент', no, 'client', `<div class="bd-clname"><b>${esc(c.name || '')}</b><small>Заказ №${no} · Очередь</small></div><div class="bd-cl"><div><b>${esc(c.phone || '')}</b><small>${esc(addr)}${c.entrance ? ` · подъезд ${esc(c.entrance)}` : ''}${c.floor ? ` · этаж ${esc(c.floor)}` : ''}</small><small>Приезд <em>с ${esc(c.hour || '—')}:${esc(c.min || '00')}</em></small></div>
    <span class="bd-cl__ic"><a class="f-icon-btn" href="tel:${esc((c.phone || '').replace(/[^+\d]/g, ''))}" aria-label="Позвонить">${PH}</a><a class="f-icon-btn" href="https://yandex.ru/maps/?text=${encodeURIComponent(addr)}" target="_blank" rel="noopener" aria-label="Маршрут">${RT}</a></span></div>${c.comment ? `<p class="bd-note">${esc(c.comment)}</p>` : ''}`);
  const roomsHtml = rooms.map((r) => { const t = roomTotals(r); const on = openRooms.has(r.key);
    return `<div class="o-sroom${on ? ' is-open' : ''}" style="--rc:${r.color}"><button type="button" class="o-sroom__head" data-action="bd-room" data-key="${r.key}" aria-expanded="${on}">
      <span class="o-sroom__name"><b>${esc(r.name)}</b><small>${r.floor} этаж · ${t.lines.length} усл.</small></span><span class="o-sroom__sum"><b>${fmt(t.total)} ₽</b><small>${shiftsText(t.hours)}</small></span><span class="o-sroom__chev">${CHEV}</span></button>
      <div class="o-sroom__list">${t.lines.map((l) => `<div class="o-line"><span class="o-line__n">${esc(l.name)}</span><span class="o-line__q">${String(l.qty).replace('.', ',')} м²</span><b class="o-line__s">${fmt(l.sum)} ₽</b></div>`).join('')}</div></div>`; }).join('');
  const est = block('Оценка <small class="bd-sub">(предварительный расчёт стоимости со слов клиента)</small>', no, 'estimate', `<div class="bd-rooms">${roomsHtml || '<p class="bd-note">Оценки пока нет</p>'}</div>`);
  const sched = block('План работ', no, 'schedule', days.length ? `<div class="bd-days">${days.map((x, i) => `<div class="bd-day"><span class="bd-day__d"><b>${x.date.getDate()}</b><small>${WD[x.date.getDay()]}</small></span><span class="bd-day__r">${x.parts.map((p) => `<span class="bd-room" style="--c:${p.r.color}">${esc(p.r.name)}${p.h < SHIFT_HOURS - 1e-6 ? `<small>${Math.round(p.h)} ч</small>` : ''}</span>`).join('')}</span><span class="bd-day__n">${i + 1}-й день</span></div>`).join('')}</div>` : '<p class="bd-note">Даты не назначены</p>');
  const sum = block('Итог', no, '', `<div class="bd-total"><div><small>Стоимость</small><b>${fmt(tot.sum)} ₽</b></div><div><small>Срок</small><b>${shiftsText(tot.h)}</b></div></div><p class="bd-range">${range}</p>`);
  const chan = block('Источник', no, 'channel', `<p class="bd-line"><b>${esc(d.channel ? d.channel.source : '')}</b><small>${d.channel && d.channel.partner !== 'self' ? 'через партнёра' : 'самостоятельно'}</small></p>`);
  // Остальные разделы — только если в них что-то есть (материал от продавца, смета с замера, оплаты, чат, задачи).
  const extra = [];
  const matRooms = d.mat ? Object.entries(d.mat.rooms || {}).filter(([, r]) => r.added) : [];
  if (matRooms.length) extra.push(block('Материал', no, 'material', matRooms.map(([k, r]) => { const room = rooms.find((x) => x.key === k); return `<p class="bd-line"><b>${esc(r.added.brand)}</b><small>${esc(r.added.type)}${room ? ' · ' + esc(room.name) : ''}</small></p>${r.note ? `<p class="bd-note">${esc(r.note)}</p>` : ''}`; }).join('')));
  const smt = d.sm ? smetaTotals(d) : null;
  // Замер — всегда после «Источника»: есть замер — его итог, нет — пусто; «Изменить» открывает замер по стенам.
  const zam = block('Замер', no, 'smeta', smt && smt.total ? `${smt.rooms.filter((x) => x.total).map((x) => `<p class="bd-line bd-line--sum"><b>${esc(x.room.name)}</b><small>${x.lines.map((l) => `${esc(l.name.split(' ')[0])} ${String(Math.round(l.qty * 10) / 10).replace('.', ',')} м²`).join(' · ')}</small><em>${fmt(x.total)} ₽</em></p>`).join('')}<p class="bd-range">Итого по смете: ${fmt(smt.total)} ₽</p>` : '<p class="bd-note">Замера пока нет</p>');
  const pays = d.fin ? d.fin.pays.reduce((a, x) => a + x.amount, 0) : 0;
  const exps = d.fin ? d.fin.exps.reduce((a, x) => a + x.amount, 0) : 0;
  if (pays || exps) extra.push(block('Финансы', no, 'finance', `<div class="bd-total"><div><small>Получено</small><b>${fmt(pays)} ₽</b></div><div><small>Остаток</small><b>${fmt(Math.max(0, tot.sum - pays))} ₽</b></div></div>${exps ? `<p class="bd-range">Расходы: ${fmt(exps)} ₽</p>` : ''}`));
  const openTasks = (d.tasks || []).filter((t) => !t.done);
  if (openTasks.length) extra.push(block('Задачи', no, 'tasks', openTasks.slice(0, 3).map((t) => `<p class="bd-line"><b>${esc(t.text)}</b>${t.due ? `<small>до ${esc(t.due)}</small>` : ''}</p>`).join('')));
  const more = extra.join('');
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>${head}${client}${est}${sched}${sum}${chan}${zam}${more}
    <nav class="f-nav f-nav--tabs" aria-label="Нижнее меню"><button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open">${ICON_MENU}<span>Меню</span></button>${mid}${chatBtn(no, d)}</nav>`;
}
// Правка блока — та же форма, что при оформлении; «назад» возвращает в сводку заказа.
// Чат заказа — кнопка справа в нижней навигации; красная цифра — непрочитанные сообщения не от мастера.
const CHAT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z" stroke="#A3AEBE" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="#A3AEBE" stroke-width="1.6" stroke-linecap="round"/></svg>';
const unread = (d) => (d.chat || []).filter((m) => m.who !== S.me().id && !m.read).length;
const chatBtn = (no, d) => { const n = unread(d); return `<button type="button" class="f-nav__tab f-nav__chat" data-action="bd-edit" data-no="${no}" data-tab="chat" aria-label="Чат заказа">${CHAT}${n ? `<b class="f-nav__badge">${n}</b>` : ''}<span>Чат</span></button>`; };
// Правка блока — только этот раздел (та же форма, что при оформлении), без вкладок других разделов.
const TAB_T = { client: 'Клиент', estimate: 'Оценка', schedule: 'План', channel: 'Источник', material: 'Материал', smeta: 'Замер', chat: 'Чат', tasks: 'Задачи', finance: 'Финансы', history: 'История' };
// «Изменить» сразу включает правку раздела — «Редактировать» нажимать не нужно.
let startEdit = '';
// Снимок раздела до правки: «Отмена» возвращает его, «Сохранить» без изменений — «Без изменений».
let editSnap = null;
const PART = { channel: ['channel', 'saved', 'editing', 'dirty', 'chSnap', 'chErr'], client: ['cl'], schedule: ['sched'], estimate: ['est'] };
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
function essence(d, t) {
  if (t === 'channel') return JSON.stringify(d.channel);
  if (t === 'client') { const c = d.cl || {}; return JSON.stringify(['name', 'phone', 'street', 'house', 'entrance', 'flat', 'floor', 'hour', 'min', 'comment'].map((k) => c[k] || '')); }
  if (t === 'schedule') return JSON.stringify([(d.sched || {}).place, (d.sched || {}).measure]);
  if (t === 'estimate') return JSON.stringify(((d.est || {}).rooms || []).map((r) => [r.key, r.name, r.floor, r.svcs.map((x) => [x.id, Number(x.qty)])]));
  return '';
}
function beginEdit(d, t) {
  editSnap = PART[t] ? { t, data: Object.fromEntries(PART[t].map((k) => [k, clone(d[k])])), essence: essence(d, t) } : null;
  if (t === 'channel' && d.saved) d.editing = true;
  if (t === 'client' && d.cl && d.cl.saved) d.cl.editing = true;
  if (t === 'schedule' && d.sched && d.sched.status === 'saved') d.sched.status = 'editing';
  if (t === 'estimate' && d.est) d.est.rooms.forEach((r) => { if (r.status === 'saved') r.status = 'editing'; });
  S.save();
}
export function renderBoardEdit(no, t) {
  if (!DEMO[no] || !TAB_T[t]) return null;
  if (t === 'chat') return renderBoardChat(no);
  seedOrder(no);
  S.setDraftKey('ord-' + no);
  if (startEdit === t) { startEdit = ''; beginEdit(oformitDraft(), t); }
  const c = CL[no];
  const mid = `<div class="bd-navslot"><button type="button" class="f-icon-btn bd-back" data-action="bd-to-order" data-no="${no}" aria-label="К заказу">${BACK}</button><span class="bd-navfree"></span></div>`;
  const navHtml = ''; // шапка (назад, раздел, клиент) — в нижней навигации между «Меню» и «Чатом»
  const dd = oformitDraft();
  if (t === 'chat') { (dd.chat || []).forEach((m) => { m.read = true; }); S.save(); }
  const html = renderOformit('order', { only: t, navHtml, navRight: mid + (t === 'chat' ? '<span class="f-nav__chat"></span>' : chatBtn(no, dd)) });
  // Вместо «Редактировать / Редактирование» — «Отмена»: правка уже включена.
  return html.replace(/<button[^>]*data-action="(?:f-edit|z-cl-edit|o-edit|g-edit)"[^>]*>[^<]*<\/button>/, `<button type="button" class="f-btn" data-action="bd-cancel" data-no="${no}">Отмена</button>`);
}
actions['bd-edit'] = (el) => { startEdit = el.dataset.tab; go(`bd-edit-${el.dataset.no}-${el.dataset.tab}`); };
actions['bd-to-order'] = (el) => { showParts = false; go('bd-order-' + el.dataset.no); };
actions['bd-room'] = (el) => { const k = el.dataset.key; if (openRooms.has(k)) openRooms.delete(k); else openRooms.add(k); rerender(); };
actions['bd-back'] = () => go('orders');
export function onLiveBoard(el) {
  if (el.dataset.live === 'client-q') { clientQ = el.value; const pos = el.selectionStart; rerender(); const a = document.getElementById('client-q'); if (a) { a.focus(); try { a.setSelectionRange(pos, pos); } catch (e) { /* поле */ } } return true; }
  if (el.dataset.live !== 'bd-q') return false;
  query = el.value;
  const pos = el.selectionStart;
  rerender();
  const again = document.getElementById('bd-q');
  if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* поле */ } }
  return true;
}

// Сохранили раздел при правке заказа с доски → короткое «Сохранено» и возврат в сводку заказа.
// В «Оценке» комнаты без изменений тихо возвращаются в «сохранено»; если где-то правка не сохранена — остаёмся.
document.addEventListener('section-saved', (ev) => {
  const m = /^#bd-edit-(\d+)-/.exec(location.hash);
  if (!m) return;
  const d = oformitDraft();
  if (ev.detail === 'estimate') {
    const rooms = (d.est && d.est.rooms) || [];
    rooms.forEach((r) => { if (r.status === 'editing' && r.snap && r.svcs.every((x) => Number(r.snap[x.id]) === Number(x.qty)) && Object.keys(r.snap).length === r.svcs.length) r.status = 'saved'; });
    S.save();
    if (rooms.some((r) => r.status !== 'saved')) { rerender(); return; }
  }
  const same = editSnap && editSnap.t === ev.detail && essence(d, ev.detail) === editSnap.essence;
  if (same) { Object.assign(d, clone(editSnap.data)); S.save(); }
  // Изменили объёмы или комнаты в «Оценке» — сразу ведём в «График»: показываем, какие дни освободились
  // (снять бронь), какие добавились и какие комнаты остались без даты.
  if (!same && ev.detail === 'estimate' && editSnap) {
    const before = bookedDays(d, ((editSnap.data.est || {}).rooms) || []);
    const after = bookedDays(d, (d.est && d.est.rooms) || []);
    const key = (o, k) => JSON.stringify(o[k] || []);
    const removed = Object.keys(before).filter((k) => !after[k]).sort(); // день освободился — снять бронь
    const added = Object.keys(after).filter((k) => !before[k] || key(before, k) !== key(after, k)).sort(); // новый или изменившийся день
    d.schedHint = { removed, added };
    if (d.sched) { d.sched.status = 'editing'; d.sched.dirty = true; }
    S.save(); editSnap = null;
    setTimeout(() => bigNote('✓ Сохранено — проверьте график'), 30);
    setTimeout(() => { startEdit = 'schedule'; go(`bd-edit-${m[1]}-schedule`); setTimeout(hideBig, 400); }, 900);
    return;
  }
  editSnap = null;
  setTimeout(() => bigNote(same ? 'Без изменений' : '✓ Сохранено'), ev.detail === 'estimate' ? 30 : 0);
  setTimeout(() => { go('bd-order-' + m[1]); setTimeout(hideBig, 400); }, 650);
});
actions['bd-cancel'] = (el) => {
  const d = oformitDraft(); delete d.schedHint;
  if (editSnap) { Object.assign(d, clone(editSnap.data)); S.save(); }
  editSnap = null;
  bigNote('Отменено');
  setTimeout(() => { go('bd-order-' + el.dataset.no); setTimeout(hideBig, 400); }, 650);
};

// Крупное сообщение по центру экрана (как «Комната сохранена» в «Оценке»).
function bigNote(text) {
  let el = document.getElementById('o-note-big');
  if (!el) { el = document.createElement('div'); el.id = 'o-note-big'; el.className = 'o-note-big'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `<div class="o-note-big__plate"><b class="o-note-big__ok">${text}</b></div>`;
  el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in');
}
function hideBig() { const el = document.getElementById('o-note-big'); if (el) el.remove(); }

// ================= Чат заказа (по кадрам Figma «06 · Чат») =================
const ST_T = { wait: 'Отправляется', sent: 'Отправлено', delivered: 'Доставлено', read: 'Прочитано' };
const T1 = '<path d="M1.5 6.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
const T2 = '<path d="M5.5 6.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';
const ST_I = {
  wait: '<svg viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 3.5V6l1.8 1.2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  sent: `<svg viewBox="0 0 12 12">${T1}</svg>`,
  delivered: `<svg viewBox="0 0 16 12">${T1}${T2}</svg>`,
  read: `<svg viewBox="0 0 16 12">${T1}${T2}</svg>`,
};
const SEND = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 11.5l15-7-5.6 15-2.6-5.8z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M11.3 13.7l3.4-3.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const CLIP = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17.5 11.5l-6.4 6.4a4 4 0 0 1-5.7-5.7l7-7a2.7 2.7 0 0 1 3.8 3.8l-7 7a1.3 1.3 0 0 1-1.9-1.9l6.4-6.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
let showParts = false;
const hhmm = (iso) => new Date(iso).toTimeString().slice(0, 5);
function renderBoardChat(no) {
  seedOrder(no);
  S.setDraftKey('ord-' + no);
  const d = oformitDraft(); d.chat = d.chat || [];
  d.chat.forEach((m) => { m.read = true; }); S.save();
  const c = CL[no]; const me = S.me();
  const parts = PARTS[no] || [];
  const AV_C = ['#5b5f8f', '#8a6a3f', '#4f7a8f'];
  const tile = (n, r) => `<span class="ch-part"><b>${esc(n)}</b><small>${esc(r)}</small></span>`;
  const mid = `<div class="bd-navslot"><button type="button" class="f-icon-btn bd-back" data-action="bd-to-order" data-no="${no}" aria-label="К заказу">${BACK}</button><span class="bd-navfree"></span></div>`;
  const nav = `<nav class="f-nav f-nav--tabs" aria-label="Нижнее меню"><button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open">${ICON_MENU}<span>Меню</span></button>${mid}<button type="button" class="f-nav__tab f-nav__chat is-active" aria-current="page" aria-label="Чат заказа">${CHAT}<span>Чат</span></button></nav>`;
  if (showParts) {
    return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div><section class="f-plate ch-head"><p class="ch-t">Участники заказа</p>
      <p class="ch-x">${parts.length ? 'Все участники заказа доступны в этом чате.' : 'Заказ вы ведёте один — других участников нет.'}</p>
      <div class="ch-list">${tile('Вы', 'Мастер · ответственный за заказ')}${parts.map(([, n, r]) => tile(n, r)).join('')}</div></section>
      <div class="ch-close"><button type="button" class="f-btn" data-action="ch-parts">Закрыть</button></div>${nav}`;
  }
  const who = (m) => (m.who === me.id ? 'Вы' : ((parts.find((x) => x[0] === m.who) || [])[1] || (S.user(m.who) || {}).name || 'Участник'));
  const role = (m) => (m.who === me.id ? '' : ((parts.find((x) => x[0] === m.who) || [])[2] || ''));
  // Статусы, как в мессенджерах: часы — отправляется, одна галочка — отправлено,
  // две серые — доставлено, две голубые — прочитано.
  const tick = (st) => `<i class="ch-st ch-st--${st}" aria-label="${ST_T[st]}">${ST_I[st]}</i>`;
  // Как в Telegram: свои — справа, зелёные; чужие — слева, с кружком и цветным именем.
  // Подряд от одного человека: имя — у первого сообщения, кружок — у последнего.
  const pi = (m) => parts.findIndex((x) => x[0] === m.who);
  const msgs = d.chat.map((m, k) => { const mine = m.who === me.id;
    const meta = `<span class="ch-meta">${hhmm(m.at)}${mine ? tick(m.st || 'read') : ''}</span>`;
    if (mine) return `<div class="ch-msg is-me" data-at="${esc(m.at)}"><p>${esc(m.text)}${meta}</p></div>`;
    const prev = d.chat[k - 1]; const next = d.chat[k + 1];
    const first = !prev || prev.who !== m.who; const last = !next || next.who !== m.who;
    const col = AV_C[Math.max(0, pi(m)) % AV_C.length];
    return `<div class="ch-row${last ? ' is-last' : ''}">${last ? `<i class="ch-ava" style="background:${col}">${esc(who(m)[0])}</i>` : '<i class="ch-ava is-empty"></i>'}<div class="ch-msg${last ? ' is-tail' : ''}" data-at="${esc(m.at)}">${first ? `<div class="ch-msg__hd" style="--nc:${col}"><span>${esc(who(m))}</span>${role(m) ? `<small>${esc(role(m))}</small>` : ''}</div>` : ''}<p>${esc(m.text)}${meta}</p></div></div>`; }).join('');
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    <button type="button" class="ch-bar" data-action="ch-parts" aria-label="Участники заказа">
      <span class="ch-av"><i style="background:#3f6a5c">В</i>${parts.map(([, n], k) => `<i style="background:${AV_C[k % AV_C.length]}">${esc(n[0])}</i>`).join('')}</span>
      <span class="ch-bar__t"><b>Чат заказа</b><small>${parts.length ? `${parts.length + 1} ${parts.length + 1 < 5 ? 'участника' : 'участников'} · Вы, ${parts.map(([, n, r]) => `${esc(n)} (${esc(r.toLowerCase())})`).join(', ')}` : 'Только вы'}</small></span>
      <span class="ch-bar__go" aria-hidden="true">›</span></button>
    <div class="ch-feed">${msgs || '<p class="ch-empty">Сообщений пока нет</p>'}</div>
    <div class="ch-input"><div class="f-input ch-box"><button type="button" class="ch-clip" aria-label="Прикрепить">${CLIP}</button><textarea id="ch-text" rows="1" placeholder="Сообщение" data-kb-dock="1"></textarea><button type="button" class="ch-send" data-action="ch-send" data-no="${no}" aria-label="Отправить">${SEND}</button></div></div>
    ${nav}`;
}
// Поле сообщения растёт вместе с текстом (до 6 строк, дальше прокрутка внутри), как в Telegram.
function chGrow(t) {
  t.style.height = 'auto'; t.style.height = Math.max(48, Math.min(t.scrollHeight, 6 * 22 + 26)) + 'px';
  t.style.overflowY = t.scrollHeight > 6 * 22 + 26 ? 'auto' : 'hidden';
  const bar = document.querySelector('.ch-input'); const feed = document.querySelector('.ch-feed');
  if (bar && feed) feed.style.paddingBottom = (window.innerHeight - bar.getBoundingClientRect().top + 8) + 'px';
}
// Клавиатура открылась или закрылась: участники свёрнуты на время набора, лента прокручена к последнему сообщению.
document.addEventListener('kb-dock', () => { const t = document.getElementById('ch-text'); if (!t) return; chGrow(t); if (document.body.classList.contains('kb-docked')) window.scrollTo(0, document.body.scrollHeight); });
// Кнопки строки ввода не забирают фокус у поля: после «Отправить» клавиатура остаётся открытой.
document.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('.ch-input button') && document.body.classList.contains('kb-docked')) e.preventDefault(); }, true);
document.addEventListener('mousedown', (e) => { if (e.target.closest && e.target.closest('.ch-input button') && document.body.classList.contains('kb-docked')) e.preventDefault(); }, true);
document.addEventListener('input', (e) => { if (e.target && e.target.id === 'ch-text') { const bx = e.target.closest('.ch-box'); if (bx) bx.classList.toggle('has-text', !!e.target.value.trim()); const atEnd = window.innerHeight + window.scrollY >= document.body.scrollHeight - 4; chGrow(e.target); if (atEnd) window.scrollTo(0, document.body.scrollHeight); } });
actions['ch-parts'] = () => { showParts = !showParts; rerender(); };
actions['ch-send'] = (btn) => {
  const el = document.getElementById('ch-text'); const t = el ? el.value.trim() : '';
  if (!t) return;
  const d = oformitDraft(); d.chat = d.chat || [];
  const keep = document.body.classList.contains('kb-docked');
  const m = { who: S.me().id, text: t, at: new Date().toISOString(), st: 'wait' }; d.chat.push(m); S.save(); rerender();
  if (keep) { const nt = document.getElementById('ch-text'); if (nt) nt.focus({ preventScroll: true }); }
  requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  // Прототип: статус меняется сам. Если участников нет — дальше «доставлено» не идёт.
  const solo = !(PARTS[btn.dataset.no] || []).length;
  const step = (st, ms) => setTimeout(() => { const dd = oformitDraft(); const x = (dd.chat || []).find((y) => y.at === m.at && y.text === m.text); if (!x) return; x.st = st; S.save();
    // Меняем только значок — без перерисовки, чтобы не сбить набор следующего сообщения.
    const i = document.querySelector(`.ch-msg[data-at="${m.at}"] .ch-st`); if (i) i.outerHTML = `<i class="ch-st ch-st--${st}" aria-label="${ST_T[st]}">${ST_I[st]}</i>`; }, ms);
  step('sent', 500); step('delivered', 1500); if (!solo) step('read', 3500);
};

// ================= Главная мастера — дашборд =================
// Только то, на что мастер реагирует каждый день: «Сегодня» (куда ехать), «Требует действия»,
// «Ближайшие дни», «Деньги», «Задачи на сегодня». Всё остальное — в «Заказах».
// Пока на примерных заказах доски (QUEUE / DEMO), как и «Заказы».
const PLUS = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="#edf0e7" stroke-width="2.2" stroke-linecap="round"/></svg>';
const I_ORD = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#A3AEBE" stroke-width="1.8"/><path d="M8 9h8M8 13h8M8 17h5" stroke="#A3AEBE" stroke-width="1.8" stroke-linecap="round"/></svg>';
const I_MON = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="13" rx="2.5" stroke="#A3AEBE" stroke-width="1.8"/><path d="M16 13h2M3.5 10h17" stroke="#A3AEBE" stroke-width="1.8" stroke-linecap="round"/></svg>';
const homeOrder = (no) => { seedOrder(no); return S.get().oformit['ord-' + no]; };
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Демо-задачи на сегодня — один раз в примерные заказы.
function homeSeed() {
  Object.keys(DEMO).forEach((no) => {
    const o = homeOrder(no);
    if (o.homeSeed) return; o.homeSeed = true; o.tasks = o.tasks || [];
    if (no === '007') o.tasks.push({ id: 'ht-007', text: 'Купить клей для виниловых обоев', who: 'me', due: iso(0), done: false });
    if (no === '004') o.tasks.push({ id: 'ht-004', text: 'Забрать уровень у Ивана', who: 'me', due: iso(0), done: false });
  });
  S.save();
}
// Иконки дашборда (тонкая линия 1.7, цвет — currentColor).
const ic = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const HI = {
  call: ic('<path d="M6.6 3.5l2.6.4 1.2 3.6-1.8 1.4a12 12 0 0 0 6.5 6.5l1.4-1.8 3.6 1.2.4 2.6c-.2 1.2-1.3 2.1-2.5 2A16.5 16.5 0 0 1 4.6 6c-.1-1.2.8-2.3 2-2.5Z"/>'),
  route: ic('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>'),
  chat: ic('<path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  coin: ic('<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.4-.9-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2.1-.6-2.5-1.5M12 6.5v1.5M12 16v1.5"/>'),
  doc: ic('<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4M10 12h5M10 15.5h5"/>'),
  roll: ic('<rect x="5" y="4" width="10" height="16" rx="2"/><path d="M15 6h2.5a1.5 1.5 0 0 1 1.5 1.5V20"/><path d="M9 4v16"/>'),
  arrow: ic('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  bell: ic('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
};
let homeDay = 0;
let homeMonth = 0;
let homeSel = '';
export function renderHome() {
  homeSeed();
  const now = new Date();
  const WDF = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const short = (n) => n.split(' ')[1] || n;
  const today = QUEUE.filter(([off, k]) => off === 0 && k);
  const upcoming = QUEUE.filter(([off, k]) => off > 0 && k);
  const heroRows = today.length ? today : upcoming.slice(0, 1);

  // ── Требует действия (считаем заранее: счётчик нужен в шапке) ──
  const nextOff = (no) => { const r = QUEUE.find(([off, k]) => off >= 0 && k && R[k].c.no === no); return r ? r[0] : null; };
  const att = [];
  Object.keys(DEMO).forEach((no) => {
    const o = homeOrder(no); const who = `№${no} · ${short(CL[no].n)}`;
    const n = unread(o); if (n) att.push({ k: 'chat', icon: HI.chat, t: n === 1 ? 'Новое сообщение' : `${n} новых сообщения`, s: who, no, tab: 'chat' });
    const paid = o.fin ? o.fin.pays.reduce((a, p) => a + p.amount, 0) : 0; const off = nextOff(no);
    if (!paid && off != null && off <= 1) att.push({ k: 'money', icon: HI.coin, t: 'Аванс не внесён', s: `${who} · выезд ${off === 0 ? 'сегодня' : 'завтра'}`, no, tab: 'finance' });
    if (o.sm && !o.smSent) att.push({ k: 'doc', icon: HI.doc, t: 'Смета не отправлена', s: `${who} · замер готов`, no, tab: 'smeta' });
    const items = o.mat ? Object.values(o.mat.rooms || {}).flatMap((r) => r.items || []) : [];
    const miss = [...new Set(items.map((it) => it.code))].filter((code) => !S.reviewsOf(code).some((v) => v.authorId === S.me().id)).length;
    if (miss) att.push({ k: 'roll', icon: HI.roll, t: 'Опыт по материалу не записан', s: who, no, tab: 'material' });
  });

  // ── Мастер в цифрах: рейтинг, записанный опыт, рулоны, квадратура ──
  // Опыт — сколько разных обоев (штрихкодов) мастер описал; рулоны и м² — накоплено по заказам (прошлое — примерные данные).
  const meId = S.me().id;
  const expN = S.get().reviews.filter((v) => v.authorId === meId).length;   // записей опыта о материалах
  const newMat = S.get().materials.filter((m) => m.addedBy === meId).length; // новых материалов мастер открыл (добавил в базу)
  const area = 3862;                                                          // поклеено, м² (прошлое — примерные данные)
  // Ранг мастера — по опыту: сколько разных обоев (штрихкодов) он описал. Цвет значка — по ступени.
  const described = new Set(S.get().reviews.filter((v) => v.authorId === meId).map((v) => v.barcode)).size;
  // 25 рангов, 5 ступеней по 5 (цвет значка): Старт · Мастера · Профи · Эксперты · Вершина.
  // Порог — описано разных обоев. До Мастера — легко, до Профи — сложнее, с Знатока — очень сложно; Легенда — 1000.
  const RANKS = [
    ['Новичок', 0, 1], ['Ученик', 1, 1], ['Стажёр', 2, 1], ['Младший специалист', 3, 1], ['Специалист', 5, 1],
    ['Мастер', 10, 2], ['Супер-мастер', 15, 2], ['Топ-мастер', 20, 2], ['Мега-мастер', 25, 2], ['Грандмастер', 30, 2],
    ['Профи', 40, 3], ['Супер-профи', 50, 3], ['Топ-профи', 60, 3], ['Мега-профи', 75, 3], ['Чемпион', 100, 3],
    ['Знаток', 150, 4], ['Эксперт', 200, 4], ['Топ-эксперт', 250, 4], ['Наставник', 300, 4], ['Мэтр', 400, 4],
    ['Магистр', 500, 5], ['Маэстро', 600, 5], ['Гуру', 700, 5], ['Топ-гуру', 800, 5], ['Легенда', 1000, 5]];
  const ri = RANKS.reduce((k, r, i) => (described >= r[1] ? i : k), 0);
  const rank = RANKS[ri][0], tier = RANKS[ri][2], nextR = RANKS[ri + 1];
  const rankPct = nextR ? Math.max(4, Math.round(((described - RANKS[ri][1]) / (nextR[1] - RANKS[ri][1])) * 100)) : 100;
  const hr = now.getHours();
  const hello = hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
  const fullName = S.me().name || '';
  const initials = fullName.split(' ').map((w) => w[0] || '').slice(0, 2).join('');
  const plural = (n, a1, a2, a5) => (n % 10 === 1 && n % 100 !== 11 ? a1 : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? a2 : a5);
  const proHtml = `<section class="h-me">
    <div class="h-me__glow" aria-hidden="true"></div>
    <div class="h-me__top"><span class="h-ava"><b>${esc(initials)}</b></span>
      <span class="h-me__hi"><small>${hello},</small><b>${esc(fullName.split(' ')[0])}</b><em>${WDF[now.getDay()]}, ${now.getDate()} ${MONG[now.getMonth()]}</em></span>
      <button type="button" class="h-rate h-rate--t${tier}" data-action="home-ranks" aria-label="Ранг: ${esc(rank)} — правила">${esc(rank)} ›</button></div>
    <div class="h-me__stats">
      <span class="h-me__st"><small>Опыт</small><b>${expN}</b><em>${plural(expN, 'запись', 'записи', 'записей')} о материалах</em></span>
      <span class="h-me__st"><small>Поклеено</small><b>${fmt(area)}<i> м²</i></b><em>за всё время</em></span></div>
    ${nextR ? `<div class="h-rank"><div class="h-rank__bar"><i style="width:${rankPct}%"></i></div><span>до ранга «${esc(nextR[0])}» — опишите ещё ${nextR[1] - described} ${plural(nextR[1] - described, 'материал', 'материала', 'материалов')}</span></div>` : ''}</section>`;

  // ── Панель «Ранги» ──
  // Карточки рангов — как коллекционные образцы обоев: металл ступени (фольга), узор ступени, медальон с инструментом.
  // Полученные — «лицевая» сторона, текущая — крупно сверху, будущие — тёмные, с замком и порогом.
  const MEDAL = [
    '<path d="M12 20v-7"/><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7z"/><path d="M12 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/>',
    '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
    '<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18"/><path d="M9 4l-2 5 5 11 5-11-2-5"/>',
    '<path d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"/><path d="M19 3v4M17 5h4"/>',
    '<path d="M4 8l4 4 4-7 4 7 4-4-1.5 10h-13z"/><path d="M6 21h12"/>',
  ];
  const medal = (t) => `<span class="rc-medal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MEDAL[t - 1]}</svg></span>`;
  const TIERS = ['Старт', 'Мастера', 'Профи', 'Эксперты', 'Вершина'];
  // Гильош (как на банкнотах): розетка из повёрнутых синусоидальных кругов.
  const guilloche = (cls) => { let d = '';
    for (let k = 0; k < 18; k++) { const rot = (k / 18) * Math.PI * 2; let pts = [];
      for (let j = 0; j <= 120; j++) { const t = (j / 120) * Math.PI * 2; const r = 42 + 9 * Math.sin(7 * t + rot * 3);
        pts.push(`${(60 + r * Math.cos(t + rot)).toFixed(1)},${(60 + r * Math.sin(t + rot)).toFixed(1)}`); }
      d += `<polyline points="${pts.join(' ')}"/>`; }
    return `<svg class="${cls}" viewBox="0 0 120 120" fill="none" aria-hidden="true">${d}</svg>`; };
  const GUI = guilloche('mc__gui');
  // ПОКАЗ: пока все карты открыты, чтобы их можно было посмотреть (RANKS_PREVIEW = false — вернуть как у мастера).
  const RANKS_PREVIEW = true;
  // Палитра каждого ранга: [цвет номера, второй цвет] — у каждой карты свои цвета, пятна и место номера; стиль общий (стекло + номер + блик)
  const PAL = [['#8fe3b0','#5aa0d8'],['#5ee3a0','#2f7fd6'],['#3fe0c5','#2a6fd0'],['#b8f06a','#2fa37a'],['#6ef0e0','#3a5fe0'],
    ['#5fc8ff','#2b4fd8'],['#7aa8ff','#5a3fe0'],['#4fe0ff','#1e8aa0'],['#9ab8ff','#2fd6c0'],['#63a4ff','#9b5cff'],
    ['#ffb36b','#e0455a'],['#ffcf6b','#e06a3a'],['#ff8a6b','#c93a8a'],['#ffd36b','#ff5f6b'],['#ffb84a','#d42f2f'],
    ['#c7a7f5','#4a6fe0'],['#e0a0ff','#6a3fd0'],['#ff9ad5','#7a4ae0'],['#b49cff','#e05aa8'],['#d9b8ff','#3a2fa0'],
    ['#ffe08a','#c48a2a'],['#fff0b0','#e0a030'],['#f5f0e0','#b89a5a'],['#ffd36b','#ff7ad9'],['#ffe9a8','#7ae0ff']];
  const BLOBS = [[2, 4, -2, -8], [40, -10, -10, 30], [-6, 30, 30, -14], [20, 20, -14, -20], [-10, -12, 10, 20]];
  const NUMP = [[3, 8], [6, 22], [2, 2], [8, 14], [4, 28]];
  const gcVars = (i) => { const [g1, g2] = PAL[i]; const [ax, ay, bx, by] = BLOBS[i % 5]; const [nx, ny] = NUMP[(i * 2 + RANKS[i][2]) % 5];
    return `--g1:${g1};--g2:${g2};--ax:${ax}%;--ay:${ay}%;--bx:${bx}%;--by:${by}%;--nx:${nx}%;--ny:${ny}%`; };
  const no = (i) => String(i + 1).padStart(2, '0');
  const card = (i, size, stats) => { const r = RANKS[i]; const t = r[2]; const st = i === ri ? 'is-cur is-got' : (i < ri || RANKS_PREVIEW) ? 'is-got' : 'is-lock';
    if (size === 'l') return `<article class="gc gc--t${t}${i === 24 ? ' gc--legend' : ''}" style="${gcVars(i)}">
      <i class="gc__blob gc__blob--a"></i><i class="gc__blob gc__blob--b"></i>
      <div class="gc__num" aria-hidden="true">${no(i)}</div>
      <div class="gc__glass"><i class="gc__holo"></i><div class="gc__sweep"></div><i class="gc__spark"></i>
        <div class="gc__top"><span class="gc__brand">Metronica</span>${stats ? `<button type="button" class="gc__tier" data-action="home-ranks" aria-label="Открыть ранги">${TIERS[t - 1]} · ${i + 1}/${RANKS.length} ›</button>` : `<span class="gc__tier">${TIERS[t - 1]} · ${i + 1}/${RANKS.length}</span>`}</div>
        <h3 class="gc__name">${esc(r[0])}</h3>
        <div class="gc__foot">
          <div><small>Мастер</small><b>${esc(fullName)}</b></div>
          ${stats ? `<div><small>Поклеено</small><b>${fmt(area)} м²</b></div><div><small>Опыт</small><b>${expN}</b></div>` : `<div><small>Нужно опыта</small><b>${fmt(r[1])}</b></div>`}</div></div></article>`;
    return `<article class="gcs gc--t${t} ${st}${i === 24 ? ' gc--legend' : ''}${i === rankView ? ' is-view' : ''}" style="${gcVars(i)}" data-action="home-rank-view" data-i="${i}" role="button" tabindex="0" aria-label="Показать карту «${esc(r[0])}»">
      <i class="gc__blob gc__blob--a"></i><i class="gc__blob gc__blob--b"></i>
      <div class="gcs__num" aria-hidden="true">${no(i)}</div>
      <div class="gcs__glass"><i class="gc__holo"></i><i class="gc__spark"></i>${i <= ri || RANKS_PREVIEW ? '' : `<span class="gcs__lock">${LOCK}</span>`}
        <h3 class="gcs__name">${esc(r[0])}</h3>
        <span class="gcs__foot">${i === ri ? 'ваш ранг' : i < ri ? 'получен' : `опыт ${fmt(r[1])}`}</span></div></article>`; };
  const LOCK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
  const ranksSheet = () => {
    const left = nextR ? nextR[1] - described : 0;
    const got = ri + 1;
    const album = TIERS.map((tn, ti) => { const ids = RANKS.map((r, i) => [r, i]).filter(([r]) => r[2] === ti + 1).map(([, i]) => i);
      const n = ids.filter((i) => i <= ri).length;
      return `<section class="ra-tier ra-tier--t${ti + 1}"><header><i></i><b>${tn}</b><span>${n} из ${ids.length}</span></header><div class="ra-grid">${ids.map((i) => card(i, 's')).join('')}</div></section>`; }).join('');
    return `<div class="rk-scrim" data-action="home-ranks-close"></div><section class="rk" role="dialog" aria-label="Ранги мастера">
      <button type="button" class="rk__x" data-action="home-ranks-close" aria-label="Закрыть">×</button>
      <div class="rk-hero">${card(rankView == null ? ri : rankView, 'l')}</div>
      <div class="rk-next">${nextR ? `<p>Ещё <b>${left} ${plural(left, 'материал', 'материала', 'материалов')}</b> — и карточка «${esc(nextR[0])}» ваша</p>
        <div class="rk-next__bar rc--t${nextR[2]}"><i style="width:${rankPct}%"></i></div><div class="rk-next__row"><span>описано ${described}</span><span>нужно ${fmt(nextR[1])}</span></div>` : '<p>Вся коллекция собрана. Вы — Легенда.</p>'}</div>
      <div class="ra-hd"><h2>Коллекция рангов</h2><span>${got} из ${RANKS.length}</span></div>
      ${album}
      <div class="rk-rules"><p class="rk-rules__t">Как получить новую карточку</p>
        <p>Опишите опыт работы с обоями во вкладке «Мой опыт» в разделе «Материал». Каждые новые обои — шаг к следующему рангу.</p>
        <p>Одни и те же обои засчитываются один раз. Квадратура на ранг не влияет.</p>
        <p>До «Мастера» — быстро, до «Профи» — сложнее, со «Знатока» — очень сложно. «Легенда» — 1000 описанных обоев.</p></div></section>`;
  };

  // ── Главная: металлическая карта текущего ранга — сверху; под ней опыт, квадратура и путь до следующего ранга ──
  const meHtml = `<section class="h-hero2">
    <p class="h-hi">${hello}, ${esc(fullName.split(' ')[0])}<small>${WDF[now.getDay()]}, ${now.getDate()} ${MONG[now.getMonth()]}</small></p>
    ${S.get().homeCardMin ? `<div class="gc-mini gc--t${RANKS[ri][2]}" style="${gcVars(ri)}">
        <button type="button" class="gc-mini__main" data-action="home-ranks" aria-label="Открыть ранги"><span class="gc-mini__no">${no(ri)}</span><span class="gc-mini__t"><b>${esc(RANKS[ri][0])}</b><small>${TIERS[RANKS[ri][2] - 1]} · ${fmt(area)} м² · опыт ${expN}</small></span></button>
        <button type="button" class="gc-fold" data-action="home-card-fold" aria-label="Развернуть карточку" aria-expanded="false">${ic('<path d="M6 9l6 6 6-6"/>')}</button></div>`
      : `<div class="h-cardwrap h-cardwrap--glass">${card(ri, 'l', true)}<button type="button" class="gc-fold gc-fold--on" data-action="home-card-fold" aria-label="Свернуть карточку" aria-expanded="true">${ic('<path d="M6 15l6-6 6 6"/>')}</button></div>`}
    <div class="h-stats2" hidden>
      <span><b>${expN}</b><small>${plural(expN, 'запись', 'записи', 'записей')} опыта</small></span>
      <span><b>${fmt(area)}<i> м²</i></b><small>поклеено</small></span>
      <span class="h-stats2__next">${nextR ? `<b>${nextR[1] - described}</b><small>до «${esc(nextR[0])}»</small>` : '<b>★</b><small>все ранги</small>'}</span></div>
    ${nextR ? `<div class="h-next"><span>До ранга «${esc(nextR[0])}» — ещё ${nextR[1] - described} ${plural(nextR[1] - described, 'материал', 'материала', 'материалов')}</span><div class="h-rank__bar"><i style="width:${rankPct}%"></i></div></div>` : ''}
  </section>`;

  // ── Шапка ──
  const head = `<div class="h-bar"><span></span>
      <span class="h-bar__r">%%BELL%%
      <button type="button" class="h-icb h-new" data-action="go" data-to="oformit" aria-label="Новый заказ">${PLUS}<span>Заказ</span></button></span></div>
    ${meHtml}`;

  // ── Главная карточка: сегодняшний выезд ──
  const hero = ([off, key, k, time]) => {
    const x = R[key]; const c = x.c; const sh = ORDER_SH[c.no];
    const map = 'https://yandex.ru/maps/?text=' + encodeURIComponent('Уфа, ' + c.a);
    const d = dayOf(off);
    const when = off === 0 ? 'Сегодня' : `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
    const segs = sh.map((_, i) => `<i class="${i < k ? 'past' : i === k ? 'on' : ''}"></i>`).join('');
    return `<article class="h-hero" style="--c:${x.col}">
      <div class="h-hero__glow" aria-hidden="true"></div>
      <div class="h-hero__top"><span class="h-pill"><i></i>${when}</span><span class="h-hero__no h-tag h-tag--order">Заказ №${c.no}</span></div>
      <div class="h-hero__time">${time}</div>
      <div class="h-hero__who"><b>${esc(c.n)}</b><small>${esc(c.a)}</small></div>
      <div class="h-hero__job"><span class="h-room"><i></i>${esc(x.r)}<small>${esc(x.f)}</small></span>
        <span class="h-prog"><span class="h-prog__bar">${segs}</span><small>день ${k + 1} из ${sh.length}</small></span></div>
      <div class="h-hero__act"><a class="h-round" href="tel:${esc(c.ph.replace(/[^+\d]/g, ''))}" aria-label="Позвонить">${HI.call}</a>
        <a class="h-round" href="${map}" target="_blank" rel="noopener" aria-label="Маршрут">${HI.route}</a>
        <button type="button" class="h-go" data-action="bd-open" data-no="${c.no}">Открыть заказ ${HI.arrow}</button></div></article>`;
  };
  const heroHtml = `<div class="h-heros${heroRows.length > 1 ? ' is-many' : ''}">${heroRows.map(hero).join('')}</div>`;

  // ── Требует действия ──
  const attHtml = att.length ? `<section class="h-block"><div class="h-block__hd"><h2>Требует действия</h2><span class="h-count">${att.length}</span></div>
    <div class="h-att">${att.map((a) => `<button type="button" class="h-att__row h-att__row--${a.k}" data-action="bd-edit" data-no="${a.no}" data-tab="${a.tab}">
      <span class="h-att__ic">${a.icon}</span><span class="h-att__t"><b>${esc(a.t)}</b><small>${esc(a.s)}</small></span><span class="h-att__go">›</span></button>`).join('')}</div></section>` : '';

  // ── Неделя: загрузка по дням — столбики часов (8 ч = полная смена), слои цвета комнат; выбранный день раскрыт списком ──
  const week = [0, 1, 2, 3, 4, 5, 6].map((off) => [off, QUEUE.filter(([o2, k]) => o2 === off && k)]);
  const sel = week.find(([off]) => off === homeDay) || week[0];
  const hrs = ([, key, k]) => ORDER_SH[R[key].c.no][k] * SHIFT_HOURS;
  const weekH = week.reduce((a, [, rows]) => a + rows.reduce((b, r) => b + hrs(r), 0), 0);
  const hMax = Math.max(SHIFT_HOURS, ...week.map(([, rows]) => rows.reduce((a, r) => a + hrs(r), 0)));
  const strip = week.map(([off, rows]) => { const d = dayOf(off); const h = rows.reduce((a, r) => a + hrs(r), 0);
    return `<button type="button" class="h-wd${off === homeDay ? ' is-sel' : ''}${off === 0 ? ' is-today' : ''}" data-action="home-day" data-off="${off}" aria-label="${d.getDate()} ${MON[d.getMonth()]}: ${h} ч">
      <span class="h-wd__h">${h ? `${h}ч` : ''}</span><span class="h-wd__col">${rows.map((r) => `<i style="--c:${R[r[1]].col};height:${(hrs(r) / hMax) * 100}%"></i>`).join('')}</span>
      <small>${off === 0 ? 'сег' : WD[d.getDay()]}</small><b>${d.getDate()}</b></button>`; }).join('');
  const list = sel[1].length ? sel[1].map(([, key, k, time]) => { const x = R[key];
    return `<button type="button" class="h-vis" data-action="bd-open" data-no="${x.c.no}" style="--c:${x.col}"><em>${time}</em><span class="h-vis__t"><b>${esc(short(x.c.n))} · ${esc(x.r)}</b><small>${esc(x.c.a)}</small></span><span class="h-vis__d">${label(ORDER_SH[x.c.no], k)}</span></button>`; }).join('')
    : '<p class="h-free">Свободный день</p>';
  const weekHtml = `<section class="h-block"><div class="h-block__hd"><h2>Загрузка недели</h2><span class="h-sub">${weekH} ч из ${7 * SHIFT_HOURS}</span></div>
    <div class="h-week">${strip}</div><div class="h-list">${list}</div></section>`;

  // ── Деньги ──
  const ym = isoDay(now).slice(0, 7);
  let got = 0, total = 0, paidAll = 0;
  Object.keys(DEMO).forEach((no) => { const o = homeOrder(no); const pays = (o.fin && o.fin.pays) || [];
    got += pays.filter((p) => String(p.date || '').slice(0, 7) === ym).reduce((a, p) => a + p.amount, 0);
    paidAll += pays.reduce((a, p) => a + p.amount, 0);
    total += ((o.est && o.est.rooms) || []).reduce((a, r) => a + roomTotals(r).total, 0); });
  const pct = total ? Math.max(2, Math.round((paidAll / total) * 100)) : 0;
  const MONN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  // Доход по месяцам — последние 6 месяцев (прошлые месяцы — примерные данные для показа), текущий подсвечен.
  const HIST = [38400, 52100, 46900, 61300, 57800];
  const months = [...HIST, got].map((v, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { v, m: MON[d.getMonth()], cur: i === 5 }; });
  const vmax = Math.max(...months.map((x) => x.v), 1);
  const avg = Math.round(HIST.reduce((a, v) => a + v, 0) / HIST.length);
  const bars = months.map((x) => `<span class="h-mb${x.cur ? ' is-cur' : ''}"><em>${x.v >= 1000 ? Math.round(x.v / 1000) + 'к' : x.v}</em><i style="height:${Math.max(4, (x.v / vmax) * 100)}%"></i><small>${x.m}</small></span>`).join('');
  const moneyHtml = `<section class="h-block h-money" data-action="go" data-to="money">
    <div class="h-block__hd"><h2>Деньги</h2><span class="h-sub">начисления ›</span></div>
    <div class="h-money__big"><b>${fmt(total - paidAll)}<small> ₽</small></b><span>ожидается по заказам в работе</span></div>
    <div class="h-money__bar"><i style="width:${pct}%"></i></div>
    <div class="h-money__row"><span><i class="g"></i>получено <b>${fmt(paidAll)} ₽</b></span><span>всего по заказам <b>${fmt(total)} ₽</b></span></div>
    <div class="h-chart"><div class="h-chart__hd"><span>Доход по месяцам</span><span>в среднем ${fmt(avg)} ₽</span></div>
      <div class="h-mbars" style="--avg:${(avg / vmax) * 100}%">${bars}<b class="h-mbars__avg"></b></div></div></section>`;

  // ── Заказы по этапам — кольцо ──
  const STG = [['Замер', 1, '#d6c15a'], ['Согласование', 1, '#e8913a'], ['Очередь', 3, '#7aa7d6'], ['В работе', 1, '#7ee2a3'], ['Выполнено', 12, 'rgba(214,229,194,.35)']];
  const stTot = STG.reduce((a, x) => a + x[1], 0); let acc = 0; const R0 = 34, C0 = 2 * Math.PI * R0;
  const ring = STG.map(([, n, col]) => { const len = (n / stTot) * C0; const seg = `<circle r="${R0}" cx="44" cy="44" fill="none" stroke="${col}" stroke-width="10" stroke-dasharray="${Math.max(0, len - 2)} ${C0}" stroke-dashoffset="${-acc}" transform="rotate(-90 44 44)"/>`; acc += len; return seg; }).join('');
  const active = STG.slice(0, 4).reduce((a, x) => a + x[1], 0);
  const stagesHtml = `<section class="h-block h-stg" data-action="go" data-to="orders"><div class="h-block__hd"><h2>Заказы</h2><span class="h-sub">все заказы ›</span></div>
    <div class="h-stg__in"><svg class="h-ring" viewBox="0 0 88 88" aria-hidden="true"><circle r="${R0}" cx="44" cy="44" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="10"/>${ring}
      <text x="44" y="44" text-anchor="middle" class="h-ring__n">${active}</text><text x="44" y="58" text-anchor="middle" class="h-ring__s">в работе</text></svg>
      <ul class="h-leg">${STG.map(([t, n, col]) => `<li><i style="background:${col}"></i><span>${t}</span><b>${n}</b></li>`).join('')}</ul></div></section>`;

  // ── Задачи и замеры: один блок — выезды на замер (ближайшие 7 дней) и задачи на сегодня; пусто — блока нет ──
  const tasks = Object.keys(DEMO).flatMap((no) => ((homeOrder(no).tasks) || []).filter((t) => (!t.done || t.doneToday === iso(0)) && (!t.due || t.due <= iso(0))).map((t) => ({ t, no })));
  const done = tasks.filter((x) => x.t.done).length;
  const offOf = (date) => Math.round((new Date(date + 'T12:00') - dayOf(0)) / 864e5);
  const realMeas = S.get().orders.filter((o) => !o.trashed && !['closed', 'cancelled', 'failed'].includes(o.status))
    .flatMap((o) => o.visits.filter((v) => v.type === 'measure' && v.masterId === meId && v.date >= iso(0) && v.date <= iso(6))
      .map((v) => ({ id: o.id, no: String(o.no), off: offOf(v.date), time: v.time, n: o.client.name, a: [o.client.street, o.client.house].filter(Boolean).join(', ') + (o.client.flat ? `, кв. ${o.client.flat}` : ''), ph: o.client.phone })));
  // Примерные замеры для показа (пока в демо-заказах нет будущих замеров)
  const DEMO_MEAS = Object.keys(DEMO).filter((no) => DEMO[no].meas != null).map((no) => { const x = DEMO[no]; return { no, demo: true, off: x.meas, time: `${Number(x.hour)}:${x.min || '00'}`, n: CL[no].n, a: CL[no].a, ph: x.ph }; });
  const meas = (realMeas.length ? realMeas : DEMO_MEAS).sort((x, y) => x.off - y.off || x.time.localeCompare(y.time));
  const RULER = ic('<path d="M3.5 15.5l12-12 5 5-12 12z"/><path d="M7 12l2 2M9.5 9.5l1.5 1.5M12 7l2 2"/>');
  const whenOf = (off) => { if (off === 0) return 'сегодня'; if (off === 1) return 'завтра'; const d = dayOf(off); return `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`; };
  const measToday = meas.filter((m) => m.off === 0);
  const measRows = meas.filter((m) => m.off > 0).map((m) => `<div class="h-meas">
      <span class="h-meas__ic">${RULER}</span>
      <span class="h-meas__t"><b>Замер · ${esc(m.time)} <em>${whenOf(m.off)}</em></b><small>${esc(m.n)} · ${esc(m.a)}</small></span>
      <a class="h-meas__a" href="tel:+7${esc(String(m.ph).replace(/\D/g, '').slice(-10))}" aria-label="Позвонить">${HI.call}</a>
      <a class="h-meas__a" href="https://yandex.ru/maps/?text=${encodeURIComponent('Уфа, ' + m.a)}" target="_blank" rel="noopener" aria-label="Маршрут">${HI.route}</a></div>`).join('');
  const taskRows = tasks.map(({ t, no }) => `<button type="button" class="h-task${t.done ? ' is-done' : ''}" data-action="home-task" data-no="${no}" data-id="${esc(t.id)}"><i>${t.done ? ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>') : ''}</i><span>${esc(t.text)}<small>№${no} · ${esc(short(CL[no].n))}</small></span></button>`).join('');
  // Сегодняшние замеры — вторым рядом под выездом в «Сегодня»
  const measTodayHtml = measToday.length ? `<div class="h-heros h-mtoday">${measToday.map((m) => `<article class="h-hero h-hero--meas" style="--c:#e5484d">
      <div class="h-hero__glow" aria-hidden="true"></div>
      <div class="h-hero__top"><span class="h-pill"><i></i>Сегодня</span><span class="h-hero__no h-tag h-tag--meas">Замер${m.no ? ` №${esc(m.no)}` : ''}</span></div>
      <div class="h-hero__time">${esc(m.time)}</div>
      <div class="h-hero__who"><b>${esc(m.n)}</b><small>${esc(m.a)}</small></div>
      <div class="h-hero__act"><a class="h-round" href="tel:+7${esc(String(m.ph).replace(/\D/g, '').slice(-10))}" aria-label="Позвонить">${HI.call}</a>
        <a class="h-round" href="https://yandex.ru/maps/?text=${encodeURIComponent('Уфа, ' + m.a)}" target="_blank" rel="noopener" aria-label="Маршрут">${HI.route}</a>
        <button type="button" class="h-go h-go--meas" ${m.demo ? `data-action="bd-edit" data-no="${m.no}" data-tab="smeta"` : `data-action="go" data-to="p-order-${esc(m.id)}"`}>Открыть замер ${HI.arrow}</button></div></article>`).join('')}</div>` : '';
  // ── Календарь — тот же, что во вкладке «График»: дни комнат цветом, название и сумма за день, «З» — замер; тап по дню — список ниже ──
  const glay = homeLayout(Object.keys(DEMO).map((no) => ({ no, d: homeOrder(no) })));
  const measBy = {}; meas.forEach((m) => { const k = iso(m.off); measBy[k] = (measBy[k] || 0) + 1; });
  const todayIso = iso(0); const selIso = homeSel || todayIso;
  const base = dayOf(0); const mm = new Date(base.getFullYear(), base.getMonth() + homeMonth, 1);
  const monthKey = `${mm.getFullYear()}-${pad(mm.getMonth() + 1)}`;
  const selD = new Date(selIso + 'T12:00'); const selOff = Math.round((selD - base) / 864e5);
  const qTime = (no) => { const q = QUEUE.find(([off, key]) => off === selOff && key && R[key].c.no === no); return q ? q[3] : `${DEMO[no].hour}:00`; };
  const rows = [
    ...(glay[selIso] || []).map((x) => ({ t: qTime(x.no), html: `<button type="button" class="h-vis" data-action="bd-open" data-no="${x.no}" style="--c:${x.room.color}"><em>${qTime(x.no)}</em><span class="h-vis__t"><b>${esc(short(CL[x.no].n))} · ${esc(x.room.name)}</b><small>${esc(CL[x.no].a)}</small></span><span class="h-vis__d">${fmt(x.cost)} ₽</span></button>` })),
    ...meas.filter((m) => iso(m.off) === selIso).map((m) => ({ t: m.time, html: `<div class="h-vis" style="--c:#e5484d"><em>${esc(m.time)}</em><span class="h-vis__t"><b>Замер · ${esc(short(m.n))}</b><small>${esc(m.a)}</small></span><span class="h-vis__d">замер</span></div>` })),
  ].sort((x, y) => x.t.padStart(5, '0').localeCompare(y.t.padStart(5, '0')));
  const calHtml = `<section class="h-cal2">
    <div class="h-cal2__in f-plate g-plate">${homeCalendarHtml(monthKey, glay, measBy, selIso, todayIso)}</div>
    <div class="h-cal__day"><p class="h-cal__dt">${selOff === 0 ? 'Сегодня' : selOff === 1 ? 'Завтра' : WDF[selD.getDay()]}, ${selD.getDate()} ${MONG[selD.getMonth()]}</p>
      <div class="h-list">${rows.length ? rows.map((r) => r.html).join('') : '<p class="h-free">На этот день записей нет</p>'}</div></div></section>`;
  const tasksHtml = `<section class="h-block"><div class="h-block__hd"><h2>Задачи и замеры</h2>${tasks.length ? `<span class="h-sub">задачи ${done} из ${tasks.length}</span>` : ''}</div>
    ${measRows}${taskRows}${meas.some((m) => m.off > 0) || tasks.length ? '' : '<p class="h-free">Задач и замеров пока нет</p>'}</section>`;

  // ── Уведомления (колокольчик): что требует действия + напоминания о ближайших выездах и замерах ──
  const N = [];
  const CAL = ic('<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>');
  const nAdd = (id, k, icon, t, sub, when, act) => N.push({ id, k, icon, t, sub, when, act });
  const toTab = (no, tab) => `data-action="home-notif-go" data-to="bd-edit" data-no="${no}" data-tab="${tab}"`;
  const toOrder = (no) => `data-action="home-notif-go" data-to="bd-open" data-no="${no}"`;
  // замеры: сегодня и завтра
  meas.filter((m) => m.off <= 1).forEach((m) => nAdd(`meas-${m.no}-${iso(m.off)}`, 'meas', RULER, m.off === 0 ? `Сегодня замер в ${m.time}` : `Завтра замер в ${m.time}`, `№${m.no} · ${short(m.n)} · ${m.a}`, m.off === 0 ? 'сегодня' : 'завтра', m.demo ? toTab(m.no, 'smeta') : ''));
  // выезды: завтра и старт заказа через 2–3 дня
  const firstOff = {}; QUEUE.forEach(([off, key]) => { if (key && off >= 0) { const no = R[key].c.no; if (firstOff[no] == null) firstOff[no] = off; } });
  QUEUE.filter(([off, key]) => off === 1 && key).forEach(([, key, , time]) => { const x = R[key]; nAdd(`visit-${x.c.no}-${key}-${iso(1)}`, 'visit', CAL, `Завтра выезд в ${time}`, `№${x.c.no} · ${short(x.c.n)} · ${x.r}`, 'завтра', toOrder(x.c.no)); });
  Object.entries(firstOff).filter(([no, off]) => off >= 2 && off <= 3 && !QUEUE.some(([o2, key]) => o2 < 0 && key && R[key].c.no === no))
    .forEach(([no, off]) => nAdd(`start-${no}-${iso(off)}`, 'visit', CAL, `Через ${off} ${off === 1 ? 'день' : 'дня'} начинается заказ №${no}`, `${short(CL[no].n)} · ${CL[no].a}`, `через ${off} дн`, toOrder(no)));
  // что требует действия
  att.forEach((a) => nAdd(`att-${a.k}-${a.no}`, a.k, a.icon, a.t, a.s, '', toTab(a.no, a.tab)));
  // материала нет, а выезд через 1–2 дня
  Object.entries(firstOff).filter(([, off]) => off >= 1 && off <= 2).forEach(([no, off]) => { const o = homeOrder(no);
    const has = o.mat && Object.values(o.mat.rooms || {}).some((r) => r.added || (r.items || []).length);
    if (!has) nAdd(`mat-${no}`, 'roll', HI.roll, 'Материал не добавлен', `№${no} · ${short(CL[no].n)} · выезд ${off === 1 ? 'завтра' : 'через 2 дня'}`, '', toTab(no, 'material')); });
  // настройки уведомлений: выключены — пусто; выключенные виды не показываем
  const nset = (S.me().settings && S.me().settings.notify) || { on: true };
  const kindOf = (k) => (k === 'roll' ? 'roll' : k);
  for (let i = N.length - 1; i >= 0; i--) if (!nset.on || (nset.kinds || {})[kindOf(N[i].k)] === false) N.splice(i, 1);
  const readSet = new Set(S.get().notifRead || []);
  const unreadN = N.filter((x) => !readSet.has(x.id)).length;
  const bellHtml = `<button type="button" class="h-icb h-bell" data-action="home-notif" aria-label="Уведомления${unreadN ? `: ${unreadN} новых` : ''}">${HI.bell}${unreadN ? `<b>${unreadN}</b>` : ''}</button>`;
  const notifSheet = () => `<div class="rk-scrim" data-action="home-notif-close"></div><section class="rk nt" role="dialog" aria-label="Уведомления">
      <button type="button" class="rk__x" data-action="home-notif-close" aria-label="Закрыть">×</button>
      <div class="nt__hd"><h2>Уведомления</h2>${unreadN ? '<button type="button" class="nt__all" data-action="home-notif-all">Прочитать все</button>' : ''}</div>
      ${N.length ? `<div class="nt__list">${N.map((x) => `<button type="button" class="nt__row nt__row--${x.k}${readSet.has(x.id) ? ' is-read' : ''}" data-id="${x.id}" ${x.act || 'data-action="home-notif-read"'}>
        <span class="nt__ic">${x.icon}</span><span class="nt__t"><b>${esc(x.t)}</b><small>${esc(x.sub)}</small></span>${readSet.has(x.id) ? '' : '<i class="nt__dot"></i>'}</button>`).join('')}</div>`
        : '<p class="h-free">Уведомлений нет</p>'}</section>`;

  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    ${homeRanks ? ranksSheet() : ''}${homeNotif ? notifSheet() : ''}
    <div class="h-page">${head.replace('%%BELL%%', bellHtml)}${heroHtml}${measTodayHtml}${calHtml}</div>
    <button type="button" class="h-menu" data-action="menu-open" aria-label="Меню">${ICON_MENU}</button>`;
}
let homeRanks = false;

let homeNotif = false;
const notifRead = (id) => { const st = S.get(); st.notifRead = st.notifRead || []; if (id && !st.notifRead.includes(id)) st.notifRead.push(id); S.save(); };
actions['home-card-fold'] = () => { const st = S.get(); st.homeCardMin = !st.homeCardMin; S.save(); rerender(); };
actions['home-notif'] = () => { homeNotif = true; rerender(); };
actions['home-notif-close'] = () => { homeNotif = false; rerender(); };
actions['home-notif-read'] = (el) => { notifRead(el.dataset.id); rerender(); };
actions['home-notif-all'] = () => { document.querySelectorAll('.nt__row').forEach((r) => notifRead(r.dataset.id)); rerender(); };
actions['home-notif-go'] = (el) => { notifRead(el.dataset.id); homeNotif = false; actions[el.dataset.to](el); };
let rankView = null;   // какая карта показана крупно (null — текущий ранг мастера)
actions['home-rank-view'] = (el) => { rankView = Number(el.dataset.i); rerender(); const b = document.querySelector('.rk'); if (b) b.scrollTo({ top: 0, behavior: 'smooth' }); };
// Наклон главной карты за пальцем/мышью и блик там, где «свет» (одно живое движение экрана).
const tiltAt = (el, x, y) => { const r = el.getBoundingClientRect(); const px = Math.min(1, Math.max(0, (x - r.left) / r.width)), py = Math.min(1, Math.max(0, (y - r.top) / r.height));
  el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`); el.style.setProperty('--ry', `${(px - 0.5) * 18}deg`); el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`); };
document.addEventListener('pointermove', (e) => { const el = e.target.closest && e.target.closest('[data-tilt]'); if (el) tiltAt(el, e.clientX, e.clientY); }, { passive: true });
document.addEventListener('pointerleave', () => {}, { passive: true });
window.addEventListener('deviceorientation', (e) => { const el = document.querySelector('[data-tilt]'); if (!el || e.beta == null) return; const r = el.getBoundingClientRect();
  tiltAt(el, r.left + r.width * (0.5 + Math.max(-0.5, Math.min(0.5, e.gamma / 40))), r.top + r.height * (0.5 + Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 40)))); });
actions['home-ranks'] = () => { homeRanks = true; rerender(); };
actions['home-ranks-close'] = () => { homeRanks = false; rankView = null; rerender(); };
actions['home-day'] = (el) => { homeDay = Number(el.dataset.off); rerender(); };
actions['home-cal-m'] = (el) => { homeMonth += Number(el.dataset.d); rerender(); };
actions['home-cal-day'] = (el) => { homeSel = el.dataset.date; rerender(); };
actions['home-task'] = (el) => { const o = homeOrder(el.dataset.no); const t = (o.tasks || []).find((x) => x.id === el.dataset.id); if (!t) return;
  t.done = !t.done; t.doneToday = t.done ? iso(0) : ''; S.save(); rerender(); };

// ── Клиенты: все клиенты мастера — контакты и их заказы (этап, сумма); тап по заказу — открыть ──
let clientQ = '';
export function renderClients() {
  const plural = (n, a1, a2, a5) => (n % 10 === 1 && n % 100 !== 11 ? a1 : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? a2 : a5);
  const meId = S.me().id;
  const digits = (p) => String(p || '').replace(/\D/g, '').slice(-10);
  const map = new Map();
  const add = (key, c, ord) => { if (!map.has(key)) map.set(key, { ...c, orders: [] }); map.get(key).orders.push(ord); };
  // примерные заказы доски
  Object.keys(DEMO).forEach((no) => { const x = DEMO[no]; const c = CL[no]; const o = homeOrder(no);
    const sum = ((o.est && o.est.rooms) || []).reduce((a, r) => a + roomTotals(r).total, 0);
    const paid = o.fin ? o.fin.pays.reduce((a, p) => a + p.amount, 0) : 0;
    const offs = QUEUE.filter(([, key]) => key && R[key].c.no === no).map(([off]) => off);
    const stage = x.meas != null ? 'measure' : offs.some((f) => f <= 0) && offs.some((f) => f >= 0) ? 'work' : 'queue';
    add(digits(x.ph), { name: c.n, phone: c.ph, addr: c.a, src: x.src }, { no, stage, sum, paid, act: `data-action="bd-open" data-no="${no}"` }); });
  // заказы из базы (ведёт мастер)
  S.get().orders.filter((o) => !o.trashed && o.leadId === meId).forEach((o) => { const c = o.client;
    add(digits(c.phone), { name: c.name, phone: `+7 ${c.phone}`, addr: [c.street, c.house].filter(Boolean).join(', ') + (c.flat ? `, кв. ${c.flat}` : ''), src: o.channel.source },
      { no: String(o.no), stage: o.status, sum: 0, paid: 0, act: `data-action="go" data-to="p-order-${o.id}"` }); });
  const q = clientQ.trim().toLowerCase();
  const list = [...map.values()].filter((c) => !q || `${c.name} ${c.phone} ${c.addr}`.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const card = (c) => { const tot = c.orders.reduce((a, o) => a + o.sum, 0);
    return `<article class="plate cl-card">
      <div class="cl-card__hd"><span class="cl-av">${esc(c.name.split(' ').map((w) => w[0] || '').slice(0, 2).join(''))}</span>
        <span class="cl-card__who"><b>${esc(c.name)}</b><small>${esc(c.addr)}</small></span>
        <a class="icon-btn cl-call" href="tel:${esc(String(c.phone).replace(/[^+\d]/g, ''))}" aria-label="Позвонить">${HI.call}</a></div>
      <div class="cl-card__meta"><span>${esc(c.phone)}</span><span>${esc(c.src || '')}</span>${tot ? `<span>всего ${fmt(tot)} ₽</span>` : ''}</div>
      <div class="cl-orders">${c.orders.map((o) => { const [k, t] = ORDER_STATUS[o.stage] || ['idle', o.stage];
        return `<button type="button" class="cl-ord" ${o.act}><b>Заказ №${esc(o.no)}</b>${status(k, t)}<span class="cl-ord__sum">${o.sum ? `${fmt(o.sum)} ₽` : ''}</span><span class="cl-ord__go">›</span></button>`; }).join('')}</div></article>`; };
  return `${topbar('Клиенты')}
    <section class="plate cl-search"><input id="client-q" class="field__input" type="search" data-live="client-q" value="${esc(clientQ)}" placeholder="Поиск: имя, телефон, адрес" autocomplete="off"><small>${list.length} ${plural(list.length, 'клиент', 'клиента', 'клиентов')}</small></section>
    ${list.length ? list.map(card).join('') : '<section class="plate"><p class="empty">Никого не нашли</p></section>'}`;
}

// ── Галерея: фото работ по заказам — «до», «в процессе», «после»; фильтр и просмотр крупно ──
let galKind = 'all';
let galView = null;
const GAL_SEED = [
  ['007', 'Кухня', 'before', 'bare', -3], ['007', 'Кухня', 'process', 'strip', -1], ['007', 'Кухня', 'after', 'leaf', 0],
  ['004', 'Спальня', 'before', 'old', -4], ['004', 'Спальня', 'after', 'stripe', -2],
  ['014', 'Гостиная', 'before', 'bare', -10], ['014', 'Гостиная', 'after', 'damask', -8],
  ['011', 'Кухня', 'after', 'dots', -15],
];
function galItems() {
  const st = S.get();
  if (!st.gallery) { st.gallery = GAL_SEED.map(([no, room, kind, pat, off], i) => ({ id: 'g' + i, no, room, kind, pat, at: iso(off) })); S.save(); }
  return st.gallery;
}
export function renderGallery() {
  const items = galItems();
  const ph = (g, big) => `<span class="gl-ph gl-ph--${g.pat}${big ? ' gl-ph--big' : ''}"></span>`;
  const v = galView && items.find((g) => g.id === galView);
  const viewer = v ? `<div class="gl-view" data-action="gal-close"><div class="gl-view__in">${ph(v, true)}</div></div>` : '';
  return `${topbar('Галерея', { right: '<button type="button" class="btn btn--sm gl-add" data-action="gal-add">+ Фото</button>' })}
    <section class="plate">${items.length ? `<div class="gl-grid">${items.map((g) => `<button type="button" class="gl-item" data-action="gal-view" data-id="${g.id}" aria-label="Фото">${ph(g)}</button>`).join('')}</div>` : '<p class="empty">Фото пока нет</p>'}</section>${viewer}`;
}
actions['gal-view'] = (el) => { galView = el.dataset.id; rerender(); };
actions['gal-close'] = () => { galView = null; rerender(); };
actions['gal-add'] = () => { const st = S.get(); galItems(); const pats = ['leaf', 'stripe', 'damask', 'dots'];
  st.gallery.unshift({ id: 'g' + Date.now(), no: '007', room: 'Кухня', kind: 'after', pat: pats[st.gallery.length % 4], at: iso(0) }); S.save(); toast('Фото добавлено'); rerender(); };
export function onSegGallery(name, value) { if (name !== 'gal-kind') return false; galKind = value; rerender(); return true; }
