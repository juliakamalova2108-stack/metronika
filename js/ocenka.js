// «Оформить заказ» → вкладка «Оценка». Один в один с секцией «Выезды · 02 · Оценка» в Figma:
// «+» → выбрали комнату (она встаёт в полосу и открывается) → работы → объёмы → «Сохранить» → «+» следующая.
// Комнаты сверху — карточки-превью «стекло», между ними можно листать свайпом.

import { actions, changes, rerender } from './core.js?v=217';
import * as S from './store.js?v=217';
import { SYSTEM_PRICE } from './seed.js?v=217';
import { shiftsText, hoursFor } from './calc.js?v=217';
import { esc, toast } from './ui.js?v=217';
import { logEvent } from './zlog.js?v=217';

// Комнаты и цвета меток — как в макете «02 · Выбор комнат».
export const ROOMS = [
  ['Спальня', '#3b82f6'], ['Гостиная', '#f59e0b'], ['Кухня', '#ef4444'], ['Коридор', '#10b981'], ['Детская', '#8b5cf6'],
  ['Прихожая', '#f97316'], ['Санузел', '#3b82f6'], ['Балкон', '#10b981'], ['Кабинет', '#f59e0b'], ['Гардеробная', '#f59e0b'],
  ['Столовая', '#f59e0b'], ['Кладовая', '#f59e0b'], ['Постирочная', '#f59e0b'],
];
// Услуги — список и порядок из кадра «05 · Выбор услуг в комнате». norm — м² в час (срок в сменах по 8 ч).
const SVC = [
  { id: 'prime', name: 'Грунтовка стен', price: 100, norm: 8 },
  { id: 'paste-flizelin', name: 'Поклейка флизелиновых обоев', type: 'flizelin', norm: 2.4 },
  { id: 'paste-paper', name: 'Поклейка бумажных обоев', type: 'paper', norm: 2.4 },
  { id: 'strip', name: 'Демонтаж старых обоев', price: 150, norm: 4.5 },
  { id: 'putty', name: 'Шпаклёвка стен', price: 200, norm: 3 },
  { id: 'level', name: 'Выравнивание стен', price: 300, norm: 2 },
  { id: 'paint', name: 'Покраска стен', price: 250, norm: 6 },
  { id: 'strip-paint', name: 'Снятие краски со стен', price: 200, norm: 3 },
  { id: 'strip-plaster', name: 'Снятие декоративной штукатурки', price: 250, norm: 2.5 },
  { id: 'cracks', name: 'Заделка трещин', price: 150, norm: 4 },
  { id: 'sand', name: 'Шлифовка стен', price: 100, norm: 6 },
  { id: 'mesh', name: 'Монтаж малярной сетки', price: 180, norm: 5 },
  { id: 'paste-glass', name: 'Поклейка стеклообоев', type: 'glass', norm: 2.4 },
  { id: 'paste-photo', name: 'Поклейка фотообоев', type: 'photo', norm: 2.4 },
  { id: 'paintwp', name: 'Окраска обоев', price: 250, norm: 6 },
];
export const SVC_LIST = SVC;
// Цена и норма — из прайса мастера (Настройки), иначе рекомендованные значения из макета.
export function svcInfo(id) {
  const s = SVC.find((x) => x.id === id);
  const me = S.me();
  let price = s.price;
  let norm = s.norm;
  if (s.type) price = (me.price && me.price[s.type]) || SYSTEM_PRICE[s.type];
  else {
    const own = me.settings && me.settings.services && me.settings.services[id];
    if (own) { price = own.price; norm = own.norm || norm; }
  }
  return { ...s, price, norm };
}

const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
const numTxt = (n) => String(n).replace('.', ',');
const TRASH = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7h15M10 4h4M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12M10 11v5.5M14 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CALC_ICON = '<span class="o-calc-ico" aria-hidden="true"><i></i><b></b><b></b><b></b><b></b></span>';

function est(d) {
  if (!d.est) d.est = { rooms: [], view: 'pick', floor: 1, confirm: null };
  return d.est;
}
const roomOf = (e, key) => e.rooms.find((r) => r.key === key);

// Объём изменён и не сохранён «ОК» — жёлтая кромка у поля.
const qtyChanged = (r, id) => r.status !== 'saved' && (r.svcs.find((x) => x.id === id) || {}).qty !== ((r.snap || {})[id] ?? 0);
export function roomTotals(r) {
  const lines = r.svcs.map((x) => {
    const s = svcInfo(x.id);
    const sum = Math.round((x.qty || 0) * s.price);
    return { ...s, qty: x.qty || 0, sum, hours: hoursFor(x.qty || 0, s.norm) };
  });
  return { lines, total: lines.reduce((a, l) => a + l.sum, 0), hours: lines.reduce((a, l) => a + l.hours, 0) };
}
export function estimateState(d) {
  const e = d.est; if (!e || !e.rooms.length) return '';
  if (estimateDirty(d)) return 'warn';
  return e.rooms.every((r) => r.status === 'saved') ? 'ok' : '';
}
export function estimateDirty(d) { const e = d.est; return !!e && e.rooms.some((r) => r.status === 'editing' || (r.status === 'new' && r.svcs.length)); }
export function estimateRooms(d) { return (d.est && d.est.rooms) || []; }

// ---------- карусель комнат ----------
function carouselItems(e) {
  const items = e.rooms.map((r) => ({ key: r.key, title: r.name, sub: `${r.floor} этаж`, label: esc(r.name) }));
  if (e.rooms.length) items.push({ key: 'total', title: 'Итог', sub: `${e.rooms.length} ${plural(e.rooms.length, 'комната', 'комнаты', 'комнат')}`, label: 'Итог' });
  return items;
}
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c);

// Полоса сверху: слева «+» (добавить комнату), дальше комнаты карточками-превью «стекло»
// (название, метры, сумма) и «Итог». Выбранная приподнята и обведена цветом комнаты.
// Название на плитке — двумя строками: тип комнаты и номер или уточнение («Спальня» / «2», «Спальня» / «мальчика»).
const roomLines = (r) => { if (!r.custom) { const m = /^(.*) (\d+)$/.exec(r.name); return m ? [m[1], m[2]] : [r.name, '']; } const t = r.base || r.name;
  return r.name.toLowerCase().startsWith(t.toLowerCase() + ' ') ? [t, r.name.slice(t.length + 1)] : [t, r.name]; };
const PEN = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10.8 2.6l2.6 2.6M2.5 13.5l.7-3.2 7.6-7.6 2.6 2.6-7.6 7.6-3.3.6z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
function carousel(e, tabs, inner = '') {
  const adding = e.view === 'pick';
  // Комнаты на разных этажах — на плитке метка этажа («2 эт»); всё на одном этаже — метка не нужна.
  const floors = new Set(e.rooms.map((r) => r.floor)).size > 1;
  const cards = e.rooms.map((r) => {
    const t = roomTotals(r);
    return `<button type="button" class="o-pv${e.view === r.key ? ' is-on' : ''}" style="--rc:${r.color || '#7c8f8a'}" data-action="o-view" data-key="${r.key}">
      <b class="o-pv__n">${esc(roomLines(r)[0])}</b>${roomLines(r)[1] ? `<em class="o-pv__note">${esc(roomLines(r)[1])}</em>` : ''}<span class="o-pv__m">${t.total ? fmt(t.total) : '—'}<small> ₽</small></span>${floors ? `<i class="o-pv__fl">${r.floor} эт</i>` : ''}${r.status === 'saved' ? '<i class="o-pv__ok" aria-label="сохранена">✓</i>' : ''}</button>`;
  }).join('');
  const total = e.rooms.length ? (() => { const sum = e.rooms.reduce((a, r) => a + roomTotals(r).total, 0);
    return `<button type="button" class="o-pv o-pv--sum${e.view === 'total' ? ' is-on' : ''}" style="--rc:#c8d9a8" data-action="o-view" data-key="total"><b class="o-pv__n">Итог</b><span class="o-pv__m">${fmt(sum)}<small> ₽</small></span></button>`; })() : '';
  const r = roomOf(e, e.view);
  // Пластина комнаты: сверху палочка цвета комнаты, название, «+ работа» и калькулятор; внутри — поле «Одинаковый объём».
  const head = tabs && r ? `<section class="f-plate o-rplate" style="--rc:${r.color || '#7c8f8a'}"><div class="o-rhead"><span class="o-rhead__t"><b>${esc(r.name)}<span class="o-pen o-pen--h" role="button" aria-label="Переименовать комнату" data-action="o-rename" data-key="${r.key}">${PEN}</span></b><small>${r.floor} этаж</small></span><span class="o-rhead__b">${tabs}</span></div>${inner}</section>` : '';
  return `<div class="o-pvbar"><button type="button" class="o-pv-add${adding ? ' is-open' : ''}" data-action="o-add" aria-label="${adding ? 'Закрыть выбор комнаты' : 'Добавить комнату'}"><span>+</span></button>
    <div class="o-pvs" id="o-pvs">${cards}${total}</div></div>${head}${e.rename ? renameDialog(e) : ''}`;
}

// ---------- переключатель ----------
const toggle = (on) => `<span class="o-tog${on ? ' is-on' : ''}" aria-hidden="true"><i></i></span>`;

// ---------- экраны ----------
// Пустая оценка: одна большая кнопка «Добавить комнату» по центру.
function startView(e) {
  return `<button type="button" class="o-start" data-action="o-start"><span class="o-start__plus">+</span><b>Добавить комнату</b><small>Зайдите в комнату и выберите её — сразу заполните работы и объёмы</small></button>`;
}
actions['o-start'] = () => { const e = D(); e.picking = true; save(); };
// «Замер»: пока комнат нет — тот же стартовый экран «Добавить комнату», что в «Оценке».
export function measurementStart(d) { const e = est(d); return !e.rooms.length && !e.picking ? `<i class="f-one" hidden></i><div class="o-wrap">${startView(e)}</div>` : ''; }
export function measurementClosePick(d) { const e = est(d); if (!e.rooms.length) e.picking = false; }

function pickView(e) {
  // Нет такой комнаты на этаже — одна плитка с типом. Есть — по плитке на каждую комнату («Спальня 1», «Спальня 2»…),
  // у каждой своя корзина. Переименованная — двумя строками: тип и уточнение («Спальня / мальчика»).
  // Нажатие на любую плитку типа добавляет ещё одну такую комнату.
  const chip = (type, color, room) => {
    // «Спальня 1» в узкой плитке с корзиной не помещается — номер уходит второй строкой, как уточнение.
    const [top, note] = room ? roomLines(room) : [type, ''];
    const label = note ? `<span class="o-chip__two"><b>${esc(top)}</b><em>${esc(note)}</em></span>` : `<span>${esc(top)}</span>`;
    return `<div class="o-chip${room ? ' is-on' : ''}" style="--rc:${color}"><button type="button" class="o-chip__add" data-action="o-room-add" data-name="${esc(type)}" aria-label="Добавить: ${esc(type)}"><i></i>${label}</button>${room ? `<button type="button" class="o-chip__del" data-action="o-room-del" data-key="${room.key}" aria-label="Удалить ${esc(room.name)}">${TRASH}</button>` : ''}</div>`;
  };
  const list = ROOMS.map(([type, color]) => {
    const has = e.rooms.filter((r) => r.floor === e.floor && (r.base || r.name) === type);
    return has.length ? has.map((r) => chip(type, r.color || color, r)).join('') : chip(type, color, null);
  }).join('');
  return `${carousel(e)}
    <section class="f-plate o-sheet o-sheet--chips">
      <p class="o-chips__t">${e.rooms.length ? 'Какую комнату добавить?' : 'В какой комнате вы стоите?'}</p>
      <div class="o-floors" role="tablist">${[1, 2, 3].map((f) => `<button type="button" role="tab" aria-selected="${f === e.floor}" class="o-floor${f === e.floor ? ' is-on' : ''}" data-action="o-floor" data-f="${f}">${f} этаж</button>`).join('')}</div>
      <div class="o-chips">${list}</div>
    </section>`;
}

function roomTabs(r) {
  const calc = r.svcs.length ? `<button type="button" class="o-ib${r.panel === 'calc' ? ' is-on' : ''}" data-action="${r.panel === 'calc' ? 'o-calc-close' : 'o-calc-open'}" aria-label="Калькулятор">${CALC_ICON}</button>` : '';
  return `<button type="button" class="o-ib o-ib--plus${r.panel === 'services' ? ' is-on' : ''}" data-action="o-svc-open" aria-label="Добавить работу">+</button>${calc}`;
}

function servicesView(e, r) {
  const sel = r.pick || r.svcs.map((x) => x.id);
  const added = sel.filter((id) => !r.svcs.some((x) => x.id === id)).length;
  return `${carousel(e, roomTabs(r))}
    <section class="f-plate o-sheet o-sheet--chips o-sheet--svc">
      <p class="o-chips__t">Какие работы в комнате?</p>
      <div class="o-chips o-chips--svc">${SVC.map((s0) => {
        const s = svcInfo(s0.id);
        const on = sel.includes(s.id);
        return `<button type="button" class="o-chip o-chip--svc${on ? ' is-on' : ''}" style="--rc:${r.color || '#7c8f8a'}" role="switch" aria-checked="${on}" data-action="o-svc-toggle" data-id="${s.id}">
          <span class="o-chip__t"><span>${esc(SHORT[s.id] || s.name)}</span><small>${fmt(s.price)} ₽/м²</small></span><i class="o-chip__ok" aria-hidden="true">✓</i></button>`;
      }).join('')}</div>
      <div class="f-btn-row"><button type="button" class="f-btn" data-action="o-svc-done">${added ? `Добавить · ${added}` : 'Готово'}</button></div>
    </section>`;
}

// Короткие названия для строк ввода: строки одной высоты, название в одну строку.
const SHORT = { 'paste-flizelin': 'Поклейка флиз. обоев', 'paste-paper': 'Поклейка бум. обоев', strip: 'Демонтаж обоев', 'strip-paint': 'Снятие краски', 'strip-plaster': 'Снятие штукатурки', mesh: 'Малярная сетка', 'paste-glass': 'Поклейка стеклообоев', 'paste-photo': 'Поклейка фотообоев' };
export const SHORT_NAMES = SHORT;
// Строка услуги: слева поле м² (под левую руку), в середине название и цена, справа сумма.
function svcCard(l, locked, changed = false, err = false) {
  return `<div class="o-svc">
    <label class="o-qty${locked ? ' is-locked' : ''}${err ? ' is-error' : changed ? ' is-changed' : ''}"><input inputmode="decimal" value="${l.qty ? esc(numTxt(l.qty)) : ''}" placeholder="—" ${locked ? 'readonly' : ''} data-live="o-qty" data-id="${l.id}" aria-label="${esc(l.name)}, м²"/><span>м²</span></label>
    <span class="o-svc__t"><span class="o-svc__n">${esc(SHORT[l.id] || l.name)}</span><small>${fmt(l.price)} ₽/м²<span data-o-hours="${l.id}">${l.qty ? ' · ' + shiftsText(l.hours) : ''}</span></small></span>
    <b class="o-svc__s" data-o-sum="${l.id}">${l.qty ? `${fmt(l.sum)} ₽` : ''}</b>
  </div>`;
}
// «Одинаковая высота»: введённая цифра заливается во все услуги комнаты; любую услугу потом можно поправить в её строке.
const sameOn = (r) => r.same !== false;
function sameCard(r, locked) {
  const on = sameOn(r); const ro = locked || !on;
  return `<div class="o-same-wrap" style="--rc:${r.color || '#7c8f8a'}"><section class="o-same o-same--v2${on ? '' : ' is-off'}" style="--rc:${r.color || '#7c8f8a'}">
    <div class="o-svc">
      <label class="o-qty${ro ? ' is-locked' : ''}"><input id="o-same-q" inputmode="decimal" value="${r.sameQty ? esc(numTxt(r.sameQty)) : ''}" placeholder="—" ${ro ? 'readonly' : ''} data-live="o-same" aria-label="Одинаковая высота"/><span>м²</span></label>
      <span class="o-svc__t"><span class="o-svc__n">Одинаковая высота</span><small>${on ? 'заливается во все работы' : 'выключена — каждая работа отдельно'}</small></span>
      <button type="button" class="o-same__tog" role="switch" aria-checked="${on}" aria-label="Одинаковая высота" data-action="o-same-tog" ${locked ? 'disabled' : ''}>${toggle(on)}</button>
    </div>
  </section></div>`;
}

function volumesView(e, r) {
  const t = roomTotals(r);
  const locked = r.status === 'saved';
  const filled = r.svcs.length && r.svcs.every((x) => x.qty > 0);
  const status = locked ? '<span class="f-status f-status--ok o-status"><i></i>сохранено</span>' : '<span class="f-status f-status--warn o-status"><i></i>редактирование</span>';
  return `${carousel(e, roomTabs(r), sameCard(r, locked))}
    <section class="f-plate o-room o-room--rows f-fill${sameOn(r) ? ' is-same' : ''}" style="--rc:${r.color || '#7c8f8a'}">
      <div class="o-room__bar">${status}</div>
      ${t.lines.map((l) => svcCard(l, locked, qtyChanged(r, l.id), !l.qty && (r.qtyErr || []).includes(l.id))).join('')}
    </section>
    <section class="o-card o-total" id="o-room-total" ${filled ? '' : 'hidden'}>
      <div class="o-card__head"><span>Итог комнаты</span></div>
      <div class="o-tiles"><div class="o-tile"><small>Стоимость</small><b id="o-room-sum">${fmt(t.total)} ₽</b></div><div class="o-tile"><small>Срок</small><b id="o-room-time">${shiftsText(t.hours)}</b></div></div>
    </section>
    <div class="f-btn-row" id="o-room-ok">
      <button type="button" class="f-btn${locked ? ' f-btn--saved' : ''}" data-action="o-ok">${locked ? 'Сохранено' : 'Сохранить'}</button>
      ${r.status !== 'new' ? `<button type="button" class="f-btn${r.status === 'editing' ? ' f-btn--editing' : ''}" data-action="o-edit">${r.status === 'editing' ? 'Редактирование' : 'Редактировать'}</button>` : ''}
    </div>`;
}

function calcView(e, r) {
  const c = r.calc || { expr: '', res: '' };
  const keys = [['C', 'op'], ['⌫', 'op'], ['÷', 'op'], ['×', 'op'], ['7'], ['8'], ['9'], ['−', 'op'], ['4'], ['5'], ['6'], ['+', 'op'], ['1'], ['2'], ['3'], ['=', 'op'], ['0'], [','], ['(', 'dim'], [')', 'dim']];
  return `${carousel(e, roomTabs(r))}
    <section class="f-plate o-calc f-fill">
      <div class="o-calc__screen"><small>${esc(c.res !== '' ? c.expr : '') || '&nbsp;'}</small><b>${esc(c.res !== '' ? c.res : c.expr || '0')}</b></div>
      <div class="o-calc__keys">${keys.map(([k, t]) => `<button type="button" class="o-key${t ? ' o-key--' + t : ''}" data-action="o-key" data-k="${k}">${k}</button>`).join('')}</div>
    </section>
    <p class="o-note">Расчёт применяется только к этой комнате</p>
    <div class="f-btn-row"><button type="button" class="f-btn" data-action="o-calc-close">Закрыть</button></div>`;
}

// «Итог»: комнаты — свёрнутые плашки с цветной полосой (нажатие раскрывает услуги строками),
// затем «Итого по видам работ» строками, внизу общий итог и «Скачать PDF».
const openSum = new Set();
const SUM_CHEV = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Итог — табличкой: Работа · Объём · Цена за м² · Сумма. Колонки выровнены, сверху мелкие подписи.
const sumHead = '<div class="o-tline o-tline--h"><span>Работа</span><span>м²</span><span>₽/м²</span><span>Сумма</span></div>';
const sumLine = (l) => `<div class="o-tline"><span class="o-tline__n">${esc(SHORT[l.id] || l.name)}</span><span>${numTxt(l.qty)}</span><span>${fmt(l.price)}</span><b>${fmt(l.sum)} ₽</b></div>`;
function totalView(e) {
  const rooms = e.rooms.map((r) => {
    const t = roomTotals(r);
    const on = openSum.has(r.key);
    return `<section class="o-sroom${on ? ' is-open' : ''}" style="--rc:${r.color || '#7c8f8a'}">
      <button type="button" class="o-sroom__head" data-action="o-sum-toggle" data-key="${r.key}" aria-expanded="${on}">
        <span class="o-sroom__name"><b>${esc(r.name)}</b><small>${r.floor} этаж · ${t.lines.length} ${plural(t.lines.length, 'услуга', 'услуги', 'услуг')}</small></span>
        <span class="o-sroom__sum"><b>${fmt(t.total)} ₽</b><small>${shiftsText(t.hours)}</small></span>
        <span class="o-sroom__chev">${SUM_CHEV}</span>
      </button>
      <div class="o-sroom__list">${sumHead}${t.lines.map(sumLine).join('')}</div>
    </section>`;
  }).join('');
  const by = new Map();
  e.rooms.forEach((r) => r.svcs.forEach((x) => { by.set(x.id, (by.get(x.id) || 0) + (x.qty || 0)); }));
  const lines = [...by.entries()].map(([id, qty]) => { const s = svcInfo(id); return { ...s, qty: Math.round(qty * 100) / 100, sum: Math.round(qty * s.price), hours: hoursFor(qty, s.norm) }; });
  const total = lines.reduce((a, l) => a + l.sum, 0);
  const hours = lines.reduce((a, l) => a + l.hours, 0);
  const n = e.rooms.length;
  return `${carousel(e)}
    <div class="f-fill o-stack">
      <p class="o-sec">Комнаты</p>
      ${rooms}
      <section class="f-plate o-bywork"><p class="o-sec o-sec--in">Итого по видам работ</p>${sumHead}${lines.map(sumLine).join('')}</section>
      <section class="f-plate o-grand"><p class="o-grand__t">Общий итог</p><b class="o-grand__sum">${fmt(total)} ₽</b>
        <p class="o-grand__x">${shiftsText(hours)} · ${n} ${plural(n, 'комната', 'комнаты', 'комнат')}</p></section>
    </div>
    <div class="f-btn-row o-noprint"><button type="button" class="f-btn" data-action="o-pdf">Скачать PDF</button></div>`;
}
actions['o-sum-toggle'] = (el) => { const k = el.dataset.key; if (openSum.has(k)) openSum.delete(k); else openSum.add(k); rerender(); };

// Переименование комнаты (карандаш рядом с названием).
const RENAME_HINTS = { 'Спальня': ['Спальня для гостей', 'Спальня родителей', 'Детская'], 'Санузел': ['Ванная', 'Гостевой санузел', 'Туалет'],
  'Гостиная': ['Зал', 'Гостиная-столовая'], 'Детская': ['Детская Маши', 'Игровая'], 'Кабинет': ['Мастерская', 'Библиотека'], 'Кухня': ['Кухня-гостиная'] };
function renameDialog(e) {
  const r = roomOf(e, e.rename.key); if (!r) return '';
  const hints = (RENAME_HINTS[r.base] || []).filter((h) => h !== r.name);
  return `<div class="o-overlay" data-action="o-rename-no"></div>
    <div class="f-plate o-dialog o-rename" role="dialog" aria-labelledby="o-ren-t" style="--rc:${r.color || '#7c8f8a'}">
      <p class="o-dialog__t" id="o-ren-t">Название комнаты</p>
      <input id="o-ren-in" class="o-ren__in" type="text" data-change="o-rename-save" value="${esc(r.name)}" maxlength="40" autocomplete="off" aria-label="Название комнаты">
      ${hints.length ? `<div class="o-ren__hints">${hints.map((h) => `<button type="button" class="o-ren__hint" data-action="o-rename-hint" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}
      <div class="f-btn-row"><button type="button" class="f-btn" data-action="o-rename-no">Отмена</button><button type="button" class="f-btn f-btn--lit" data-action="o-rename-yes">Сохранить</button></div>
    </div>`;
}
// Окно открывается без клавиатуры: сразу видны подсказки и «Сохранить»; нажали на поле — клавиатура, её «OK» сохраняет.
actions['o-rename'] = (el) => { const e = D(); e.rename = { key: el.dataset.key }; save(); };
actions['o-rename-no'] = () => { D().rename = null; save(); };
// «OK» на клавиатуре приложения — тоже сохранить.
changes['o-rename-save'] = () => { if (D().rename) actions['o-rename-yes'](); };
actions['o-rename-hint'] = (el) => { const i = document.getElementById('o-ren-in'); if (i) { i.value = el.dataset.v; i.focus(); } };
actions['o-rename-yes'] = () => {
  const e = D(); const r = e.rename && roomOf(e, e.rename.key); e.rename = null;
  const v = (document.getElementById('o-ren-in')?.value || '').trim();
  if (r && v && v !== r.name) { r.name = v; r.custom = true; }
  save();
};
document.addEventListener('keydown', (ev) => { if (ev.target && ev.target.id === 'o-ren-in' && ev.key === 'Enter') { ev.preventDefault(); actions['o-rename-yes'](); } });

function confirmDialog(c) {
  return `<div class="o-overlay" data-action="o-confirm-no"></div>
    <div class="f-plate o-dialog" role="alertdialog" aria-labelledby="o-dlg-t">
      <p class="o-dialog__t" id="o-dlg-t">${esc(c.title)}</p><p class="o-dialog__x">${esc(c.text)}</p>
      <div class="f-btn-row"><button type="button" class="f-btn" data-action="o-confirm-no">Назад</button><button type="button" class="f-btn" data-action="o-confirm-yes">Удалить</button></div>
    </div>`;
}

export function renderEstimate(d) {
  const e = est(d);
  let html;
  let one = false; // один экран без прокрутки — выбор комнат, выбор услуг и пустая комната с одной кнопкой «+»
  if (e.view === 'total' && carouselItems(e).some((x) => x.key === 'total')) html = totalView(e);
  else {
    const r = roomOf(e, e.view);
    if (!e.rooms.length && !e.picking) { e.view = 'pick'; html = startView(e); one = true; }
    else if (!r) { e.view = 'pick'; html = pickView(e); }
    else if (r.panel === 'services') html = servicesView(e, r); // плитки работ — экран прокручивается до кнопки
    else if (r.panel === 'calc') html = calcView(e, r);
    else if (r.svcs.length) html = volumesView(e, r);
    else { html = `${carousel(e, roomTabs(r))}<p class="o-empty">Нажмите «+» справа, чтобы выбрать работы</p>`; one = true; }
  }
  // Внутри комнаты (услуги, объёмы, калькулятор, итог) прокручивается весь экран, а не блок внутри.
  if (!one) html = html.replace(/ f-fill\b/g, '');
  if (transit) { const r = roomOf(e, e.view); html = r ? carousel(e, roomTabs(r)) : carousel(e); one = true; }
  const anim = (slide ? ` o-anim--${slide}` : '') + (reveal && !transit ? ' o-reveal' : ''); slide = ''; if (!transit) reveal = false;
  return `${one ? '<i class="f-one" hidden></i>' : ''}<div class="o-wrap${anim}">${html}</div>${e.confirm ? confirmDialog(e.confirm) : ''}`;
}

// ---------- действия ----------
const D = () => { const st = S.get(); return est(st.oformit[S.draftKey()]); };
const save = () => { S.save(); rerender(); };

// Переход между комнатами — с анимацией: шапка и содержимое уезжают в сторону листания,
// новая комната выезжает с другой стороны, её название на мгновение подсвечивается.
let slide = '';
let transit = 0; // 1 — «сохранена», 2 — название следующей комнаты; содержимое комнаты в это время скрыто
let reveal = false; // после перехода содержимое плавно появляется
function showNote(html, color) {
  let el = document.getElementById('o-note-big');
  if (!el) { el = document.createElement('div'); el.id = 'o-note-big'; el.className = 'o-note-big'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  // С цветом комнаты — стеклянная карточка, как превью в полосе: матовое стекло и размытое пятно цвета комнаты.
  el.classList.toggle('o-note-big--glass', !!color); if (color) el.style.setProperty('--rc', color);
  el.innerHTML = `<div class="o-note-big__plate">${html}</div>`;
  el.classList.remove('is-in'); void el.offsetWidth; el.classList.add('is-in');
}
function hideNote() { const el = document.getElementById('o-note-big'); if (el) el.remove(); }
function goView(e, key) {
  const items = carouselItems(e);
  const a = items.findIndex((x) => x.key === e.view); const b = items.findIndex((x) => x.key === key);
  slide = b === a ? '' : b > a ? 'next' : 'prev';
  e.view = key;
  const r = roomOf(e, e.view); if (r && r.panel === 'calc') r.panel = '';
}
actions['o-view'] = (el) => { const e = D(); goView(e, el.dataset.key); save(); window.scrollTo(0, 0); requestAnimationFrame(scrollStrip); };
// Докручиваем полосу ровно настолько, чтобы выбранная карточка была видна целиком — без заезда под «+».
function scrollStrip() {
  const s = document.getElementById('o-pvs'); const on = s && s.querySelector('.o-pv.is-on'); if (!on) return;
  const sr = s.getBoundingClientRect(); const r = on.getBoundingClientRect(); const pad = 4;
  if (r.left < sr.left + pad) s.scrollBy({ left: r.left - sr.left - pad, behavior: 'smooth' });
  else if (r.right > sr.right - pad) s.scrollBy({ left: r.right - sr.right + pad, behavior: 'smooth' });
}
// Свайп по комнате влево/вправо — соседняя комната (после последней — «Итог»).
let sx = null; let sy = null;
document.addEventListener('touchstart', (ev) => { const w = ev.target.closest && ev.target.closest('.o-wrap'); if (!w || ev.target.closest('.o-pvbar, .kb, input, .o-calc')) { sx = null; return; } sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; }, { passive: true });
document.addEventListener('touchend', (ev) => {
  if (sx === null) return; const dx = ev.changedTouches[0].clientX - sx; const dy = ev.changedTouches[0].clientY - sy; sx = null;
  if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const e = D(); if (!e || e.view === 'pick') return;
  const items = carouselItems(e); const i = items.findIndex((x) => x.key === e.view); const n = items[i + (dx < 0 ? 1 : -1)];
  if (!n) return; goView(e, n.key); save(); window.scrollTo(0, 0); requestAnimationFrame(scrollStrip);
});
// Куда вести после сохранённой комнаты: следующая несохранённая, иначе любая несохранённая, иначе «Итог».
function nextAfter(e, r) {
  const i = e.rooms.indexOf(r);
  const n = e.rooms.slice(i + 1).find((x) => x.status !== 'saved') || e.rooms.find((x) => x.status !== 'saved');
  return n ? { key: n.key, name: n.name } : { key: 'total', name: 'Итог' };
}
actions['o-floor'] = (el) => { D().floor = Number(el.dataset.f); save(); };
// «+» в полосе: открыть выбор комнаты (или закрыть его и вернуться в комнату, где были).
actions['o-add'] = () => {
  const e = D();
  if (e.view === 'pick' && !e.rooms.length) { e.picking = false; save(); return; }
  if (e.view === 'pick') { if (e.rooms.length) { e.view = roomOf(e, e.back) || e.back === 'total' ? e.back : e.rooms[e.rooms.length - 1].key; } }
  else { e.back = e.view; e.view = 'pick'; }
  save(); window.scrollTo(0, 0);
};
// Выбрали комнату — она встаёт в полосу и сразу открывается со списком работ.
// Номера: одна спальня — «Спальня»; появилась вторая — первая становится «Спальня 1», новая «Спальня 2».
// Дальше — следующий номер после самого большого. При удалении ничего не перенумеровывается; название можно поменять карандашом.
function nextRoomName(e, base) {
  const re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' (\\d+)$');
  const taken = e.rooms.filter((r) => r.name === base || re.test(r.name));
  if (!taken.length) return base;                                   // такого названия ещё нет
  const plain = taken.find((r) => r.name === base);
  if (plain && !plain.custom) plain.name = `${base} 1`;              // «Спальня» → «Спальня 1»
  const max = taken.reduce((m, r) => { const k = re.exec(r.name); return k ? Math.max(m, +k[1]) : Math.max(m, 1); }, 0);
  return `${base} ${max + 1}`;
}
actions['o-room-add'] = (el) => {
  const e = D();
  const base = el.dataset.name;
  const like = e.rooms.find((x) => x.name === base || (x.base || x.name) === base);
  const color = (ROOMS.find((x) => x[0] === base) || [])[1] || (like && like.color);
  const r = { key: 'r' + Math.random().toString(36).slice(2, 8), floor: e.floor, base, name: nextRoomName(e, base), color, svcs: [], status: 'new', panel: 'services', pick: [] };
  e.rooms.push(r);
  slide = 'next'; e.view = r.key;
  save(); window.scrollTo(0, 0);
  requestAnimationFrame(scrollStrip);
};
// Корзина на карточке комнаты (видна, пока открыт «+»): спрашиваем и удаляем комнату вместе с работами.
actions['o-room-del'] = (el) => {
  const e = D(); const r = roomOf(e, el.dataset.key); if (!r) return;
  e.confirm = { kind: 'room', key: r.key, title: 'Удалить комнату?', text: `«${r.name}» и её работы будут удалены из оценки.` }; save();
};
actions['o-svc-open'] = () => { const e = D(); const r = roomOf(e, e.view); if (r.panel === 'services' && r.svcs.length) { r.pick = null; r.panel = ''; save(); return; } r.pick = r.svcs.map((x) => x.id); r.panel = 'services'; save(); };
// Нажатие на плитку работы — меняем только эту плитку и надпись на кнопке, без перерисовки экрана (быстро).
actions['o-svc-toggle'] = (el) => {
  const e = D(); const r = roomOf(e, e.view);
  const id = el.dataset.id;
  r.pick = r.pick || r.svcs.map((x) => x.id);
  if (r.pick.includes(id)) {
    if (r.svcs.some((x) => x.id === id)) { e.confirm = { kind: 'svc', id, title: 'Удалить услугу?', text: `${svcInfo(id).name} и её объём будут удалены из комнаты.` }; save(); return; }
    r.pick = r.pick.filter((x) => x !== id);
  } else r.pick.push(id);
  const on = r.pick.includes(id);
  el.classList.toggle('is-on', on); el.setAttribute('aria-checked', String(on));
  const added = r.pick.filter((x) => !r.svcs.some((s) => s.id === x)).length;
  const btn = document.querySelector('[data-action="o-svc-done"]'); if (btn) btn.textContent = added ? `Добавить · ${added}` : 'Готово';
};
actions['o-svc-done'] = () => {
  const e = D(); const r = roomOf(e, e.view);
  const pick = r.pick || [];
  pick.filter((id) => !r.svcs.some((x) => x.id === id)).forEach((id) => r.svcs.push({ id, qty: sameOn(r) && r.sameQty ? r.sameQty : 0 }));
  r.svcs.sort((a, b) => SVC.findIndex((s) => s.id === a.id) - SVC.findIndex((s) => s.id === b.id));
  r.pick = null; r.panel = '';
  if (r.status === 'saved') r.status = 'editing';
  save();
};
actions['o-confirm-no'] = () => { D().confirm = null; save(); };
actions['o-confirm-yes'] = () => {
  const e = D(); const c = e.confirm; e.confirm = null;
  if (c.kind === 'room') {
    const gone = roomOf(e, c.key);
    e.rooms = e.rooms.filter((r) => r.key !== c.key); if (e.view === c.key) e.view = 'pick'; if (!e.rooms.length) e.picking = false; if (e.back === c.key) e.back = '';
    if (gone) { showNote(`<i class="o-note-big__ico o-note-big__ico--del">✓</i><b>${esc(gone.name)}</b><span>удалена</span>`, gone.color || '#7c8f8a'); setTimeout(hideNote, 1000); }
    save();
    // Удаление комнаты меняет объём — как сохранение (в правке заказа с доски это ведёт в «График»).
    if (gone && e.rooms.length) setTimeout(() => document.dispatchEvent(new CustomEvent('section-saved', { detail: 'estimate' })), 900);
    return;
  }
  if (c.kind === 'svc') { const r = roomOf(e, e.view); r.svcs = r.svcs.filter((x) => x.id !== c.id); if (r.pick) r.pick = r.pick.filter((x) => x !== c.id); if (r.status === 'saved') r.status = 'editing'; }
  save();
};
// Объём вводится без перерисовки экрана: обновляем сумму, срок и итог комнаты на месте.
const parseQty = (v) => { const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
// Обновить на экране суммы, сроки, подсветку и итог комнаты — без перерисовки (поле в фокусе не теряется).
function refreshRoom(r) {
  const t = roomTotals(r);
  t.lines.forEach((l) => {
    const sum = document.querySelector(`[data-o-sum="${l.id}"]`); if (sum) sum.textContent = l.qty ? `${fmt(l.sum)} ₽` : '';
    const h = document.querySelector(`[data-o-hours="${l.id}"]`); if (h) h.textContent = l.qty ? ' · ' + shiftsText(l.hours) : '';
    const box = document.querySelector(`[data-live="o-qty"][data-id="${l.id}"]`)?.closest('.o-qty');
    if (box) { box.classList.toggle('is-changed', qtyChanged(r, l.id)); if (l.qty) box.classList.remove('is-error'); }
  });
  if (r.qtyErr) r.qtyErr = r.qtyErr.filter((id) => !(r.svcs.find((x) => x.id === id) || {}).qty);
  const filled = r.svcs.every((s) => s.qty > 0);
  const box = document.getElementById('o-room-total'); if (box) box.hidden = !filled;
  const a = document.getElementById('o-room-sum'); if (a) a.textContent = `${fmt(t.total)} ₽`;
  const b = document.getElementById('o-room-time'); if (b) b.textContent = shiftsText(t.hours);
  const pv = document.querySelector(`.o-pv[data-key="${r.key}"]`);
  if (pv) pv.querySelector('.o-pv__m').innerHTML = `${t.total ? fmt(t.total) : '—'}<small> ₽</small>`;
}
export function onLiveEstimate(el) {
  const k = el.dataset.live;
  if (k !== 'o-qty' && k !== 'o-same') return false;
  const e = D(); const r = roomOf(e, e.view);
  if (k === 'o-same') {
    r.sameQty = parseQty(el.value);
    if (sameOn(r) && r.sameQty) {
      r.svcs.forEach((x) => { x.qty = r.sameQty; });
      document.querySelectorAll('[data-live="o-qty"]').forEach((inp) => { inp.value = numTxt(r.sameQty); });
    }
  } else {
    const x = r.svcs.find((s) => s.id === el.dataset.id);
    x.qty = parseQty(el.value);
  }
  S.save();
  refreshRoom(r);
  return true;
}
actions['o-same-tog'] = () => {
  const e = D(); const r = roomOf(e, e.view);
  if (r.status === 'saved') return;
  r.same = !sameOn(r);
  if (r.same && r.sameQty) r.svcs.forEach((x) => { x.qty = r.sameQty; });
  save();
};
actions['o-ok'] = () => {
  const e = D(); const r = roomOf(e, e.view);
  if (r.status === 'saved') return;
  // Объём не введён — не сохраняем: сообщение с названиями услуг, пустые поля красные, прокрутка к первому.
  const empty = r.svcs.filter((x) => !(x.qty > 0));
  if (empty.length) {
    r.qtyErr = empty.map((x) => x.id);
    save();
    toast(`Не введён объём: ${empty.map((x) => svcInfo(x.id).name).join(', ')}`);
    requestAnimationFrame(() => { const f = document.querySelector('#view .o-qty.is-error'); if (f) f.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
    return;
  }
  r.qtyErr = [];
  r.status = 'saved';
  r.snap = Object.fromEntries(r.svcs.map((x) => [x.id, x.qty]));
  { const t = roomTotals(r); logEvent(S.get().oformit[S.draftKey()], 'Сохранена оценка комнаты', `${r.name}: ${fmt(t.total)} ₽ · ${shiftsText(t.hours)}`); }
  // «Сохранить» → короткое сообщение «✓ Спальня сохранена» на 1 секунду. Никуда не перекидывает —
  // ни на следующую комнату, ни в «Итог»: мастер листает сам.
  showNote(`<i class="o-note-big__ico">✓</i><b>${esc(r.name)}</b><span>сохранена · ${fmt(roomTotals(r).total)} ₽</span>`, r.color || '#7c8f8a');
  save();
  document.dispatchEvent(new CustomEvent('section-saved', { detail: 'estimate' }));
  setTimeout(hideNote, 1000);
};
actions['o-edit'] = () => { const e = D(); const r = roomOf(e, e.view); if (r.status === 'saved') { r.status = 'editing'; save(); } };
actions['o-calc-open'] = () => { const e = D(); const r = roomOf(e, e.view); r.panel = 'calc'; r.calc = r.calc || { expr: '', res: '' }; save(); };
actions['o-calc-close'] = () => { const e = D(); const r = roomOf(e, e.view); r.panel = ''; save(); };
actions['o-key'] = (el) => {
  const e = D(); const r = roomOf(e, e.view); const c = r.calc;
  const k = el.dataset.k;
  if (k === 'C') { c.expr = ''; c.res = ''; }
  else if (k === '⌫') { if (c.res !== '') c.res = ''; c.expr = c.expr.slice(0, -1).trimEnd(); }
  else if (k === '=') {
    const js = c.expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.').replace(/\s/g, '');
    if (/^[\d+\-*/().]+$/.test(js)) {
      try { const v = Function(`"use strict";return (${js})`)(); if (Number.isFinite(v)) c.res = numTxt(Math.round(v * 100) / 100); } catch (err) { c.res = ''; }
    }
  } else {
    if (c.res !== '') { c.expr = /[\d,]/.test(k) ? '' : c.res; c.res = ''; }
    c.expr += /[+×÷−]/.test(k) ? ` ${k} ` : k;
  }
  save();
};
actions['o-pdf'] = () => { try { window.print(); } catch (err) { /* печать недоступна */ } };

// Shared room selection markup for the measurement section.
export function measurementRoomPicker(d, s) {
  const e = est(d);
  return pickView({...e, view:'pick', floor:s.floor||1})
    .replace(/data-action="o-view"/g,'data-action="mw-room"')
    .replace(/data-action="o-add"/g,'data-action="mw-pick"')
    .replace(/data-action="o-floor"/g,'data-action="mw-floor"')
    .replace(/data-action="o-room-add"/g,'data-action="mw-add-room"')
    + (e.confirm ? confirmDialog(e.confirm) : '');   // удаление комнаты — то же окно, что в «Оценке»
}
actions['mw-floor'] = el => { const d=S.get().oformit[S.draftKey()]; d.sm.floor=Number(el.dataset.f); S.save(); rerender(); };
actions['mw-add-room'] = el => {
  const d=S.get().oformit[S.draftKey()],e=est(d),s=d.sm;
  e.floor=s.floor||1;
  actions['o-room-add'](el);
  s.view=e.view;S.save();rerender();
};


// Reuse the exact estimate service tiles and room strip in measurement.
export function measurementServices(d, s, w) {
  const e=est(d), original=roomOf(e,s.view);
  const r={...original, panel:'services', svcs:w.svcs.map(id=>({id,qty:0})), pick:w.pick||w.svcs.slice()};
  return servicesView({...e,view:s.view},r)
    .replace(carousel({...e,view:s.view}),measurementStrip(d,s))
    .replace(/data-action="o-view"/g,'data-action="mw-room"')
    .replace(/data-action="o-add"/g,'data-action="mw-pick"')
    .replace(/data-action="o-svc-open"/g,'data-action="mw-close"')
    .replace(/data-action="o-svc-toggle"/g,'data-action="mw-service"')
    .replace(/data-action="o-svc-done"/g,'data-action="mw-services-done"')
    .replace(/<button[^>]*aria-label="Калькулятор"[\s\S]*?<\/button>/g,'');
}
export function measurementStrip(d,s) {
  const e=est(d);
  const rooms=e.rooms.map(r=>{const R=s.rooms[r.key], quantities=new Map();
    if(R)R.walls.forEach(w=>{const q=Math.max(0,w.len*(R.sameH?R.h:w.h)-w.opens.reduce((a,o)=>a+o.area,0));w.svcs.forEach(id=>quantities.set(id,(quantities.get(id)||0)+q));});
    return {...r,status:'new',svcs:Array.from(quantities,([id,qty])=>({id,qty}))};});
  return carousel({...e,rooms,view:s.view}).replace(/data-action="o-view"/g,'data-action="mw-room"').replace(/data-action="o-add"/g,'data-action="mw-pick"');
}

// «Материал»: та же полоса комнат и пластина комнаты, что в «Оценке» и «Замере».
// На плитках вместо денег — сколько материалов добавлено, в углу — статус отзывов мастера:
// оранжевый значок с числом материалов без отзыва или зелёная ✓, когда отзывы есть на все.
export function materialStrip(d, view, stat, right, inner = '') {
  const e = est(d);
  const html = carousel({ ...e, view }, view === 'total' ? '' : right, inner)
    .replace(/data-action="o-view"/g, 'data-action="z-mat-view"')
    .replace(/<button type="button" class="o-pv-add[\s\S]*?<\/button>/, '')
    .replace(/<i class="o-pv__ok"[^>]*>✓<\/i>/g, '');
  // На плитке — строки «последние 4 цифры штрихкода — сколько рулонов»: «7890 — 4». Больше двух — «+N ещё».
  const cnt = (x) => { if (!x || !x.list || !x.list.length) return '—';
    const ln = (l) => `<span class="z-pvl"><b>${esc(l.code.slice(-4))}</b> — ${l.rolls || 0}<small> шт.</small></span>`;
    return x.list.slice(0, 2).map(ln).join('') + (x.list.length > 2 ? `<span class="z-pvl z-pvl--more">+${x.list.length - 2} ещё</span>` : ''); };
  const badge = (x) => (!x || !x.n ? '' : x.miss ? `<i class="z-rvbadge" aria-label="Без опыта: ${x.miss}">${x.miss}</i>` : '<i class="z-rvbadge z-rvbadge--ok" aria-label="Опыт добавлен по всем материалам">✓</i>');
  return html.replace(/(data-key="([^"]+)">)([\s\S]*?<span class="o-pv__m">)[\s\S]*?(<\/span>)/g, (m0, a, key, mid, c) => a + badge(stat[key]) + mid.replace('class="o-pv__m"', 'class="o-pv__m z-pvm"') + cnt(stat[key]) + c);
}

export function measurementSettings(original, r) {
  const base={color:original.color};
  const height=sameCard({...base,same:r.sameH,sameQty:Math.round(r.h*100)},false)
    .replace('id="o-same-q"','id="mw-room-height"')
    .replace('data-live="o-same"','data-change="mw-roomheight"')
    .replace('data-action="o-same-tog"','data-action="mw-toggle" data-key="sameH"')
    .replace('<span>м²</span>','<span>см</span>').replace('inputmode="decimal"','inputmode="numeric"')
    .replace('заливается во все работы','для всех стен комнаты')
    .replace('выключена — каждая работа отдельно','высота каждой стены отдельно');
  const services=sameCard({...base,same:r.sameSvc},false)
    .replace(/<label class="o-qty[\s\S]*?<\/label>/,'')
    .replace('class="o-svc"','class="o-svc mw-same-services"').replace(/Одинаковая высота/g,'Одинаковые услуги')
    .replace('data-action="o-same-tog"','data-action="mw-toggle" data-key="sameSvc"')
    .replace('заливается во все работы','для всех стен комнаты')
    .replace('выключена — каждая работа отдельно','услуги каждой стены отдельно');
  // Пластина комнаты — как в «Оценке»: название с карандашом и этаж, внутри два переключателя.
  return `<section class="f-plate o-rplate mw-rplate" style="--rc:${original.color || '#7c8f8a'}"><div class="o-rhead"><span class="o-rhead__t"><b>${esc(original.name)}<span class="o-pen o-pen--h" role="button" aria-label="Переименовать комнату" data-action="o-rename" data-key="${original.key}">${PEN}</span></b><small>${original.floor} этаж</small></span></div>${height}${services}</section>`;
}
