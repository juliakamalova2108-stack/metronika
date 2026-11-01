// «Заказы» мастера — доска по дням. Одна карточка = одна комната заказа на один рабочий день.
// Слева язычок-листок календаря с датой, в карточке: клиент, адрес, время, сумма, номер заказа;
// внизу ярлык комнаты (полоска цвета комнаты) и линия смен: пройденные — точки, текущая — капсула.
// Пока показ на примерных заказах (даты от сегодняшнего дня), позже — из настоящих заказов.

import { actions, rerender, go } from './core.js?v=96';
import * as S from './store.js?v=96';
import { renderOformit, oformitDraft } from './oformit.js?v=96';
import { roomTotals, svcInfo } from './ocenka.js?v=96';
import { smetaTotals } from './zakaz.js?v=96';
import { SHIFT_HOURS, shiftsText } from './calc.js?v=96';
import { esc, toast } from './ui.js?v=96';

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
};
const CL = { '004': P, '007': A, '011': I, '014': H };
// Участники заказа (кроме мастера): кто передал заказ, кто ещё работает по нему.
const PARTS = { '004': [['u-agent', 'Алина Смирнова', 'Агент']], '007': [['shop', 'Продавец «Обои+»', 'Передал материал']], '011': [], '014': [] };
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
  const head = '';
  const mid = `<div class="bd-ohead bd-ohead--nav"><button type="button" class="f-icon-btn bd-back" data-action="bd-back" aria-label="К заказам">${BACK}</button><span><b>${esc(c.name || '')}</b><small>Заказ №${no} · Очередь</small></span></div>`;
  const client = block('Клиент', no, 'client', `<div class="bd-cl"><div><b>${esc(c.phone || '')}</b><small>${esc(addr)}${c.entrance ? ` · подъезд ${esc(c.entrance)}` : ''}${c.floor ? ` · этаж ${esc(c.floor)}` : ''}</small><small>Приезд <em>с ${esc(c.hour || '—')}:${esc(c.min || '00')}</em></small></div>
    <span class="bd-cl__ic"><a class="f-icon-btn" href="tel:${esc((c.phone || '').replace(/[^+\d]/g, ''))}" aria-label="Позвонить">${PH}</a><a class="f-icon-btn" href="https://yandex.ru/maps/?text=${encodeURIComponent(addr)}" target="_blank" rel="noopener" aria-label="Маршрут">${RT}</a></span></div>${c.comment ? `<p class="bd-note">${esc(c.comment)}</p>` : ''}`);
  const roomsHtml = rooms.map((r) => { const t = roomTotals(r); const on = openRooms.has(r.key);
    return `<div class="o-sroom${on ? ' is-open' : ''}" style="--rc:${r.color}"><button type="button" class="o-sroom__head" data-action="bd-room" data-key="${r.key}" aria-expanded="${on}">
      <span class="o-sroom__name"><b>${esc(r.name)}</b><small>${r.floor} этаж · ${t.lines.length} усл.</small></span><span class="o-sroom__sum"><b>${fmt(t.total)} ₽</b><small>${shiftsText(t.hours)}</small></span><span class="o-sroom__chev">${CHEV}</span></button>
      <div class="o-sroom__list">${t.lines.map((l) => `<div class="o-line"><span class="o-line__n">${esc(l.name)}</span><span class="o-line__q">${String(l.qty).replace('.', ',')} м²</span><b class="o-line__s">${fmt(l.sum)} ₽</b></div>`).join('')}</div></div>`; }).join('');
  const est = block('Комнаты и работы', no, 'estimate', `<div class="bd-rooms">${roomsHtml || '<p class="bd-note">Оценки пока нет</p>'}</div>`);
  const sched = block('Дни работ', no, 'schedule', days.length ? `<div class="bd-days">${days.map((x, i) => `<div class="bd-day"><span class="bd-day__d"><b>${x.date.getDate()}</b><small>${WD[x.date.getDay()]}</small></span><span class="bd-day__r">${x.parts.map((p) => `<span class="bd-room" style="--c:${p.r.color}">${esc(p.r.name)}${p.h < SHIFT_HOURS - 1e-6 ? `<small>${Math.round(p.h)} ч</small>` : ''}</span>`).join('')}</span><span class="bd-day__n">${i + 1}-й день</span></div>`).join('')}</div>` : '<p class="bd-note">Даты не назначены</p>');
  const sum = block('Итог', no, '', `<div class="bd-total"><div><small>Стоимость</small><b>${fmt(tot.sum)} ₽</b></div><div><small>Срок</small><b>${shiftsText(tot.h)}</b></div></div><p class="bd-range">${range}</p>`);
  const chan = block('Откуда заказ', no, 'channel', `<p class="bd-line"><b>${esc(d.channel ? d.channel.source : '')}</b><small>${d.channel && d.channel.partner !== 'self' ? 'через партнёра' : 'самостоятельно'}</small></p>`);
  // Остальные разделы — только если в них что-то есть (материал от продавца, смета с замера, оплаты, чат, задачи).
  const extra = [];
  const matRooms = d.mat ? Object.entries(d.mat.rooms || {}).filter(([, r]) => r.added) : [];
  if (matRooms.length) extra.push(block('Материал', no, 'material', matRooms.map(([k, r]) => { const room = rooms.find((x) => x.key === k); return `<p class="bd-line"><b>${esc(r.added.brand)}</b><small>${esc(r.added.type)}${room ? ' · ' + esc(room.name) : ''}</small></p>${r.note ? `<p class="bd-note">${esc(r.note)}</p>` : ''}`; }).join('')));
  const smt = d.sm ? smetaTotals(d) : null;
  if (smt && smt.total) extra.push(block('Смета', no, 'smeta', `${smt.rooms.filter((x) => x.total).map((x) => `<p class="bd-line bd-line--sum"><b>${esc(x.room.name)}</b><small>${x.lines.map((l) => `${esc(l.name.split(' ')[0])} ${String(Math.round(l.qty * 10) / 10).replace('.', ',')} м²`).join(' · ')}</small><em>${fmt(x.total)} ₽</em></p>`).join('')}<p class="bd-range">Итого по смете: ${fmt(smt.total)} ₽</p>`));
  const pays = d.fin ? d.fin.pays.reduce((a, x) => a + x.amount, 0) : 0;
  const exps = d.fin ? d.fin.exps.reduce((a, x) => a + x.amount, 0) : 0;
  if (pays || exps) extra.push(block('Финансы', no, 'finance', `<div class="bd-total"><div><small>Получено</small><b>${fmt(pays)} ₽</b></div><div><small>Остаток</small><b>${fmt(Math.max(0, tot.sum - pays))} ₽</b></div></div>${exps ? `<p class="bd-range">Расходы: ${fmt(exps)} ₽</p>` : ''}`));
  const openTasks = (d.tasks || []).filter((t) => !t.done);
  if (openTasks.length) extra.push(block('Задачи', no, 'tasks', openTasks.slice(0, 3).map((t) => `<p class="bd-line"><b>${esc(t.text)}</b>${t.due ? `<small>до ${esc(t.due)}</small>` : ''}</p>`).join('')));
  const more = extra.join('');
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>${head}${client}${est}${sched}${sum}${chan}${more}
    <nav class="f-nav f-nav--tabs" aria-label="Нижнее меню"><button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open">${ICON_MENU}<span>Меню</span></button>${mid}${chatBtn(no, d)}</nav>`;
}
// Правка блока — та же форма, что при оформлении; «назад» возвращает в сводку заказа.
// Чат заказа — кнопка справа в нижней навигации; красная цифра — непрочитанные сообщения не от мастера.
const CHAT = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5h16v10.5H9.5L5 19.5V16H4z" stroke="#A3AEBE" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" stroke="#A3AEBE" stroke-width="1.6" stroke-linecap="round"/></svg>';
const unread = (d) => (d.chat || []).filter((m) => m.who !== S.me().id && !m.read).length;
const chatBtn = (no, d) => { const n = unread(d); return `<button type="button" class="f-nav__tab f-nav__chat" data-action="bd-edit" data-no="${no}" data-tab="chat" aria-label="Чат заказа">${CHAT}${n ? `<b class="f-nav__badge">${n}</b>` : ''}<span>Чат</span></button>`; };
// Правка блока — только этот раздел (та же форма, что при оформлении), без вкладок других разделов.
const TAB_T = { client: 'Клиент', estimate: 'Оценка', schedule: 'График', channel: 'Канал', material: 'Материал', smeta: 'Смета', chat: 'Чат', tasks: 'Задачи', finance: 'Финансы', history: 'История' };
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
  const mid = `<div class="bd-ohead bd-ohead--nav"><button type="button" class="f-icon-btn bd-back" data-action="bd-to-order" data-no="${no}" aria-label="К заказу">${BACK}</button><span><b>${esc(c.n)}</b><small>Заказ №${no} · Очередь</small></span></div>`;
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
  editSnap = null;
  setTimeout(() => bigNote(same ? 'Без изменений' : '✓ Сохранено'), ev.detail === 'estimate' ? 30 : 0);
  setTimeout(() => { go('bd-order-' + m[1]); setTimeout(hideBig, 400); }, 650);
});
actions['bd-cancel'] = (el) => {
  const d = oformitDraft();
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
  const mid = `<div class="bd-ohead bd-ohead--nav"><button type="button" class="f-icon-btn bd-back" data-action="bd-to-order" data-no="${no}" aria-label="К заказу">${BACK}</button><span><b>${esc(c.n)}</b><small>Заказ №${no} · Очередь</small></span></div>`;
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
