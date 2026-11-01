// Мастер и диспетчер: канбан заказов, входящие предложения, новый свой заказ, корзина, текущий заказ.

import { actions, changes, rerender, go, val } from './core.js?v=67';
import * as S from './store.js?v=67';
import { prelimCost, commissionAmount, shiftsText } from './calc.js?v=67';
import { SERVICES, UNIT, CHANNELS, WALLPAPER_TYPES } from './seed.js?v=67';
import { esc, rub, num, kv, status, field, select, btnRow, seg, dateRu, dateTimeRu, sheet, closeSheet, toast, ICONS } from './ui.js?v=67';
import { topbar, orderStatus, typeName } from './shared.js?v=67';
import { renderOrder, openOrderTab } from './order.js?v=67';

let column = null;
let columnFor = '';
let query = '';

const incomingLinks = (me) => S.get().links.filter((l) => l.toId === me.id && l.status === 'proposed');
export const incomingCount = () => { const me = S.me(); return me ? incomingLinks(me).length : 0; };

const COLUMNS = [
  ['incoming', 'Входящие'], ['measure', 'Замер'], ['approval', 'Согласование'], ['queue', 'Очередь'], ['work', 'В работе'], ['done', 'Выполнено'], ['archive', 'Архив'],
];
const ARCHIVE = ['closed', 'cancelled', 'failed', 'declined'];

function nextDate(o, me) {
  const today = S.todayISO();
  const v = o.visits.filter((x) => (!x.masterId || x.masterId === me.id || o.leadId === me.id) && x.date >= today && !x.geo).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  return v ? `${v.type === 'measure' ? 'Замер' : 'Работы'} · ${dateTimeRu(`${v.date}T${v.time}`)}` : '';
}

function orderCard(o, me) {
  const rooms = S.roomsFor(o, me);
  const sum = (S.lastSmeta(o) && o.leadId === me.id) ? S.lastSmeta(o).total : S.estimateOf(o, rooms.map((r) => r.id)).total || (o.prelim ? o.prelim.base : 0);
  const nd = nextDate(o, me);
  const role = o.leadId === me.id ? '' : '<span class="chip">мои комнаты</span>';
  return `<button type="button" class="plate card-btn order-card" data-action="go" data-to="p-order-${o.id}">
    <div class="order-card__top"><span class="order-card__no">№ ${o.no} · ${esc(o.client.name)}</span>${orderStatus(o)}</div>
    ${kv('Адрес', esc(`${o.client.street}, ${o.client.house}${o.client.flat ? ', кв. ' + o.client.flat : ''}`))}
    ${kv('Комнаты', rooms.length ? esc(rooms.map((r) => r.name).join(', ')) : '—')}
    ${nd ? kv('Ближайший выезд', esc(nd)) : ''}
    ${kv('Сумма', rub(sum), true)}
    ${o.searching ? `<p class="small">${status('warn', 'нужен мастер на часть комнат')}</p>` : ''}${role}
  </button>`;
}

function offerCard(l, me) {
  const o = S.order(l.orderId);
  const p = o.prelim;
  const fromAgent = S.hasRole(S.user(l.fromId), 'agent');
  let body = '';
  if (fromAgent && p) {
    const mat = S.material(p.barcode);
    const myPrice = S.priceFor(me, o.materialType);
    const cost = prelimCost(p.areaMid, myPrice);
    body = `${kv('Обои', mat ? `${esc(mat.brand)}, ${esc(typeName(mat.type).toLowerCase())}` : '—')}
      ${kv('Рулонов и площадь', `${p.rolls} шт. · ${p.areaMin === p.areaMax ? num(p.areaMid) : `${num(p.areaMin)}–${num(p.areaMax)}`} м²`)}
      ${kv('По вашему прайсу', `${myPrice} ₽/м² → ${rub(cost)}`)}
      ${kv('Процент партнёру', `${num(l.pct)}% · ≈ ${rub(commissionAmount(cost, l.pct))}`, true)}`;
  } else {
    const rooms = l.roomIds ? o.rooms.filter((r) => l.roomIds.includes(r.id)) : o.rooms;
    const est = S.estimateOf(o, rooms.map((r) => r.id));
    body = `${kv('Комнаты', rooms.length ? esc(rooms.map((r) => `${r.name} (${r.floor} эт.)`).join(', ')) : 'весь заказ, комнаты по замеру')}
      ${est.total ? kv('Работы по оценке', `${rub(est.total)} · ${shiftsText(est.hours)}`) : p ? kv('Предварительно', rub(l.base)) : ''}
      ${kv('Цены', 'по прайсу диспетчера')}
      ${kv('Процент диспетчеру', `${num(l.pct)}% · ≈ ${rub(commissionAmount(l.base, l.pct))}`, true)}`;
  }
  return `<article class="plate order-card">
    <div class="order-card__top"><span class="order-card__no">№ ${o.no} · ${esc(o.client.street)}, ${esc(o.client.house)}</span>${status('idle', 'новое')}</div>
    ${kv('От кого', esc(S.displayName(me, l.fromId, o.id)))}
    ${kv('Приезд', esc(dateTimeRu(l.arrival)))}
    ${body}
    <p class="small">Принимая заказ, вы соглашаетесь с датой и процентом. После принятия процент не меняется, а отказ стоит неустойку.</p>
    ${btnRow([{ label: 'Отклонить', action: 'offer-decline', data: `data-id="${l.id}"` }, { label: 'Принять', action: 'offer-accept', data: `data-id="${l.id}"`, primary: true }])}
  </article>`;
}

export function renderProOrders() {
  const me = S.me();
  const inc = incomingLinks(me);
  const all = S.ordersForPro(me);
  if (columnFor !== me.id) { columnFor = me.id; column = null; query = ''; }
  if (!column) column = inc.length ? 'incoming' : (all.find((o) => o.status === 'work') ? 'work' : 'measure');
  const q = query.trim().toLowerCase();
  const match = (o) => !q || [o.no, o.client.name, o.client.phone, o.client.street, o.client.house].join(' ').toLowerCase().includes(q);
  const inCol = (o, c) => (c === 'archive' ? ARCHIVE.includes(o.status) : o.status === c);
  const count = (c) => (c === 'incoming' ? inc.length : all.filter((o) => inCol(o, c)).length);
  let body;
  if (column === 'incoming') {
    body = inc.length ? inc.slice().reverse().map((l) => offerCard(l, me)).join('') : '<section class="plate"><p class="empty">Новых предложений нет. Войдите как агент Алина и передайте заказ — он появится здесь.</p></section>';
  } else {
    const list = all.filter((o) => inCol(o, column) && match(o)).sort((a, b) => b.no - a.no);
    body = list.length ? list.map((o) => orderCard(o, me)).join('') : `<section class="plate"><p class="empty">${q ? 'Ничего не нашлось' : 'В этой колонке пусто'}</p></section>`;
  }
  const trash = S.trashFor(me).length;
  return `${topbar('Заказы', { right: `<button type="button" class="icon-btn" data-action="go" data-to="trash" aria-label="Корзина">${ICONS.trash}${trash ? `<span class="tabbar__badge">${trash}</span>` : ''}</button>` })}
    <section class="plate">
      <label class="field" for="kb-search"><span class="field__box"><input id="kb-search" type="search" placeholder="Поиск: номер, клиент, телефон, адрес" value="${esc(query)}" data-live="kb-search"/></span></label>
      ${btnRow([{ label: '+ Новый заказ', action: 'own-new', primary: true }])}
    </section>
    <nav class="plate topbar" style="padding:0 12px" aria-label="Колонки"><div class="tabs" role="tablist">${COLUMNS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === column}" class="tabs__item${k === column ? ' is-active' : ''}" data-action="seg" data-seg="kanban" data-value="${k}">${t}${count(k) ? ` · ${count(k)}` : ''}</button>`).join('')}</div></nav>
    <div class="list">${body}</div>`;
}
export function onLivePro(el) {
  if (el.dataset.live !== 'kb-search') return false;
  query = el.value;
  const pos = el.selectionStart;
  rerender();
  const again = document.getElementById('kb-search');
  if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* поле поиска */ } }
  return true;
}

export function onSegPro(name, value) {
  if (name === 'kanban') { column = value; rerender(); return true; }
  if (name === 'own-floor') { draft.floor = Number(value); rerender(); return true; }
  return false;
}

actions['offer-accept'] = (el) => {
  const l = S.link(el.dataset.id);
  sheet({
    title: 'Принять заказ?',
    body: `<p>Процент ${num(l.pct)}% и приезд ${esc(dateTimeRu(l.arrival))} зафиксируются. Отказаться потом можно, но с неустойкой.</p>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Принять', action: 'offer-accept-do', data: `data-id="${l.id}"`, primary: true }],
  });
};
actions['offer-accept-do'] = (el) => {
  const l = S.link(el.dataset.id);
  S.acceptLink(l.id);
  closeSheet();
  toast('Заказ принят');
  column = S.order(l.orderId).status;
  openOrderTab(l.orderId, 'channel');
  go(`p-order-${l.orderId}`);
};
actions['offer-decline'] = (el) => {
  sheet({
    title: 'Отклонить предложение?',
    body: '<p>Вы ещё не принимали заказ, поэтому отклонить можно без неустойки.</p>',
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Отклонить', action: 'offer-decline-do', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['offer-decline-do'] = (el) => { S.declineLink(el.dataset.id); closeSheet(); toast('Предложение отклонено'); rerender(); };

export function renderProOrder(id) { return renderOrder(id); }

// Текущий заказ — тот, где ближайший выезд сегодня или позже, либо идут работы.
export function renderCurrentOrder() {
  const me = S.me();
  const today = S.todayISO();
  const active = S.ordersForPro(me).filter((o) => !ARCHIVE.includes(o.status));
  const score = (o) => {
    const v = o.visits.filter((x) => (x.masterId === me.id || (!x.masterId && o.leadId === me.id)) && !x.geo && x.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
    if (o.status === 'work') return '0' + (v ? v.date : today);
    return v ? '1' + v.date + v.time : '9';
  };
  const cur = active.slice().sort((a, b) => score(a).localeCompare(score(b)))[0];
  if (!cur) return `${topbar('Текущий заказ')}<section class="plate"><p class="empty">Активных заказов нет</p>${btnRow([{ label: 'К заказам', action: 'go', data: 'data-to="orders"', primary: true }])}</section>`;
  return renderOrder(cur.id);
}

// ---------- корзина ----------
export function renderTrash() {
  const me = S.me();
  const list = S.trashFor(me);
  return `${topbar('Корзина', { back: 'orders' })}
    <section class="plate"><p class="small">Сюда попадают удалённые свои заказы. Отсюда их можно вернуть или удалить навсегда.</p></section>
    <div class="list">${list.length ? list.map((o) => `<article class="plate order-card">
      <div class="order-card__top"><span class="order-card__no">№ ${o.no} · ${esc(o.client.name)}</span>${orderStatus(o)}</div>
      ${kv('Адрес', esc(`${o.client.street}, ${o.client.house}`))}
      ${btnRow([{ label: 'Удалить навсегда', action: 'trash-forever', data: `data-id="${o.id}"` }, { label: 'Восстановить', action: 'trash-restore', data: `data-id="${o.id}"`, primary: true }])}
    </article>`).join('') : '<section class="plate"><p class="empty">Корзина пуста</p></section>'}</div>`;
}
actions['trash-restore'] = (el) => { S.restoreOrder(el.dataset.id); toast('Заказ восстановлен'); rerender(); };
actions['trash-forever'] = (el) => {
  sheet({ title: 'Удалить навсегда?', body: '<p>Заказ и его история исчезнут без возможности вернуть.</p>', buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Удалить', action: 'trash-forever-do', data: `data-id="${el.dataset.id}"`, primary: true }] });
};
actions['trash-forever-do'] = (el) => { S.deleteForever(el.dataset.id); closeSheet(); rerender(); };

// ---------- новый свой заказ ----------
let draft = null;
const freshDraft = () => ({
  step: 1, floor: 1, rooms: [], room: '', materialType: 'flizelin',
  source: 'Авито', detail: '', url: '',
  client: { name: '', phone: '', street: '', house: '', entrance: '', flat: '', floor: '', comment: '' },
  date: '', hour: '10', minute: '00', errors: {},
});

actions['own-new'] = () => { draft = freshDraft(); go('own-new'); };

function ownRooms(me) {
  const names = (me.settings && me.settings.rooms) || [];
  return `<section class="plate">
    <h2 class="plate__title">Выбор комнат</h2>
    ${seg('own-floor', [1, 2, 3].map((f) => ({ value: String(f), label: `${f} этаж` })), String(draft.floor))}
    <div class="chips">${names.map((n) => `<button type="button" class="chip-btn" data-action="own-room-add" data-name="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
  </section>
  <section class="plate">
    <div class="plate__head"><h2 class="plate__title">В заказе</h2><span class="small">${draft.rooms.length}</span></div>
    ${draft.rooms.length ? draft.rooms.map((r, i) => `<div class="kv"><span>${esc(r.name)} · ${r.floor} этаж</span><button type="button" class="icon-btn" data-action="own-room-del" data-i="${i}" aria-label="Убрать ${esc(r.name)}">${ICONS.trash}</button></div>`).join('') : '<p class="empty">Нажмите на комнаты выше</p>'}
    ${draft.errors.rooms ? `<p class="field__error">${esc(draft.errors.rooms)}</p>` : ''}
  </section>
  ${btnRow([{ label: 'Отмена', action: 'go', data: 'data-to="orders"' }, { label: 'Дальше', action: 'own-next', primary: true }])}`;
}

function ownEstimate() {
  if (!draft.rooms.some((r) => r.key === draft.room)) draft.room = draft.rooms[0].key;
  const r = draft.rooms.find((x) => x.key === draft.room);
  const fake = { priceSnap: S.priceSnapshotFor(S.me().id), materialType: draft.materialType, rooms: draft.rooms.map((x) => ({ id: x.key, name: x.name, est: x.est })) };
  const est = S.estimateOf(fake);
  const pr = est.perRoom.find((x) => x.room.id === r.key);
  return `<section class="plate">
    ${select({ id: 'own-type', label: 'Тип обоев (для цены поклейки)', value: draft.materialType, options: WALLPAPER_TYPES.map((t) => ({ value: t.id, label: t.name })), attrs: 'data-change="own-type"' })}
    <div class="tabs room-tabs" role="tablist">${draft.rooms.map((x) => `<button type="button" role="tab" aria-selected="${x.key === r.key}" class="tabs__item${x.key === r.key ? ' is-active' : ''}" data-action="own-room-pick" data-key="${x.key}">${esc(x.name)}<small class="room-floor">${x.floor} этаж</small></button>`).join('')}</div>
  </section>
  <section class="plate">
    <h2 class="plate__title">Услуги · ${esc(r.name)}</h2>
    <div class="chips">${SERVICES.map((s) => { const on = r.est.some((e) => e.svc === s.id); return `<button type="button" class="chip-btn${on ? ' is-on' : ''}" aria-pressed="${on}" data-action="own-svc" data-svc="${s.id}">${esc(s.name)}</button>`; }).join('')}</div>
    ${pr.lines.map((l) => `<div class="well svc-line">
      <div class="plate__head"><b>${esc(l.name)}</b><span class="small">${shiftsText(l.hours)}</span></div>
      <div class="svc-line__calc">
        <span class="field__box svc-qty"><input id="oq-${l.svc}" inputmode="decimal" value="${l.qty ? esc(num(l.qty)) : ''}" placeholder="0" data-change="own-qty" data-svc="${l.svc}" aria-label="Объём, ${UNIT[l.unit]}"/><span class="field__suffix">${UNIT[l.unit]}</span></span>
        <span class="small">× ${l.price} ₽</span><b class="svc-sum">= ${rub(l.sum)}</b>
      </div>
      ${l.unit === 'm2' ? `<button type="button" class="link-btn" data-action="own-calc" data-svc="${l.svc}">Калькулятор: длина × ширина</button>` : ''}
    </div>`).join('') || '<p class="empty">Отметьте услуги выше</p>'}
    <div class="tiles"><div class="tile"><span>Комната</span><b>${rub(pr.total)}</b></div><div class="tile"><span>Срок</span><b>${shiftsText(pr.hours)}</b></div></div>
  </section>
  <section class="plate">${kv('Общий итог', rub(est.total), true)}${kv('Срок', shiftsText(est.hours))}
    <p class="small">Это предварительная оценка по телефону. Точная смета — после замера по стенам.</p></section>
  ${btnRow([{ label: 'Назад', action: 'own-prev' }, { label: 'Дальше', action: 'own-next', primary: true }])}`;
}

function ownClient() {
  const c = draft.client;
  const e = draft.errors;
  const hours = Array.from({ length: 13 }, (_, i) => String(8 + i).padStart(2, '0'));
  const dup = c.phone.replace(/\D/g, '').length >= 10 && c.street && c.house ? S.findDuplicate({ ...c, phone: c.phone.replace(/\D/g, '').slice(-10) }) : null;
  return `<section class="plate">
    <h2 class="plate__title">Канал</h2>
    ${select({ id: 'own-source', label: 'Источник заявки', value: draft.source, options: CHANNELS.map((x) => ({ value: x, label: x })) })}
    ${field({ id: 'own-detail', label: 'Уточнение', value: draft.detail, placeholder: 'Например, объявление «Поклейка обоев»' })}
    ${field({ id: 'own-url', label: 'Ссылка', value: draft.url, type: 'url', placeholder: 'Вставьте ссылку' })}
  </section>
  <section class="plate">
    <h2 class="plate__title">Клиент</h2>
    ${field({ id: 'own-name', label: 'Имя', value: c.name, error: e.name })}
    ${field({ id: 'own-phone', label: 'Телефон', value: c.phone, type: 'tel', inputmode: 'tel', placeholder: '+7', error: e.phone })}
    ${field({ id: 'own-street', label: 'Улица', value: c.street, error: e.street })}
    <div class="grid-4">${field({ id: 'own-house', label: 'Дом', value: c.house, error: e.house })}${field({ id: 'own-entrance', label: 'Подъезд', value: c.entrance, inputmode: 'numeric' })}${field({ id: 'own-flat', label: 'Кв', value: c.flat, inputmode: 'numeric' })}${field({ id: 'own-cfloor', label: 'Этаж', value: c.floor, inputmode: 'numeric' })}</div>
    <label class="field" for="own-comment"><span class="field__label">Комментарий</span><span class="field__box"><textarea id="own-comment">${esc(c.comment)}</textarea></span></label>
    ${dup ? `<div class="well"><div class="plate__head"><b>Похоже на дубль</b>${status('warn', `заказ № ${dup.no}`)}</div><p class="small">Такой клиент и адрес уже есть. Заказ создастся с пометкой «дубль».</p></div>` : ''}
  </section>
  <section class="plate">
    <h2 class="plate__title">Дата и время замера</h2>
    ${field({ id: 'own-date', label: 'Дата', value: draft.date, type: 'date', error: e.date })}
    <div class="grid-2">${select({ id: 'own-hour', label: 'Часы', value: draft.hour, options: hours.map((h) => ({ value: h, label: h })) })}${select({ id: 'own-minute', label: 'Минуты', value: draft.minute, options: ['00', '15', '30', '45'].map((m) => ({ value: m, label: m })) })}</div>
    <p class="small">Дата нужна для записи на замер. Если клиент ещё думает — отправьте на согласование, если замер не нужен — сразу в очередь.</p>
  </section>
  ${btnRow([{ label: 'Назад', action: 'own-prev' }, { label: 'На согласование', action: 'own-save', data: 'data-branch="approval"' }])}
  ${btnRow([{ label: 'В очередь', action: 'own-save', data: 'data-branch="queue"' }, { label: 'На замер', action: 'own-save', data: 'data-branch="measure"', primary: true }])}`;
}

export function renderOwnNew() {
  const me = S.me();
  if (!draft) draft = freshDraft();
  const steps = ['Комнаты', 'Оценка', 'Клиент'];
  return `${topbar('Новый заказ', { back: 'orders' })}
    <section class="plate"><div class="steps">${steps.map((_, i) => `<i class="${i < draft.step ? 'is-done' : ''}"></i>`).join('')}</div><p class="small">Шаг ${draft.step} из 3 · ${steps[draft.step - 1]}</p></section>
    ${draft.step === 1 ? ownRooms(me) : draft.step === 2 ? ownEstimate() : ownClient()}`;
}

function readOwnClient() {
  if (!document.getElementById('own-name')) return;
  draft.source = val('own-source'); draft.detail = val('own-detail'); draft.url = val('own-url');
  Object.assign(draft.client, { name: val('own-name'), phone: val('own-phone'), street: val('own-street'), house: val('own-house'), entrance: val('own-entrance'), flat: val('own-flat'), floor: val('own-cfloor'), comment: val('own-comment') });
  draft.date = val('own-date'); draft.hour = val('own-hour'); draft.minute = val('own-minute');
}

actions['own-room-add'] = (el) => {
  const n = draft.rooms.filter((r) => r.name === el.dataset.name || r.name.startsWith(el.dataset.name + ' ')).length;
  draft.rooms.push({ key: 'k' + Math.random().toString(36).slice(2, 7), floor: draft.floor, name: n ? `${el.dataset.name} ${n + 1}` : el.dataset.name, est: [{ svc: 'paste', qty: 0 }] });
  draft.errors = {};
  rerender();
};
actions['own-room-del'] = (el) => { draft.rooms.splice(Number(el.dataset.i), 1); rerender(); };
actions['own-room-pick'] = (el) => { draft.room = el.dataset.key; rerender(); };
actions['own-svc'] = (el) => {
  const r = draft.rooms.find((x) => x.key === draft.room);
  const i = r.est.findIndex((e) => e.svc === el.dataset.svc);
  if (i >= 0) r.est.splice(i, 1); else r.est.push({ svc: el.dataset.svc, qty: 0 });
  rerender();
};
const numOf = (s) => { const n = parseFloat(String(s).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : NaN; };
changes['own-qty'] = (el) => {
  const r = draft.rooms.find((x) => x.key === draft.room);
  const e = r.est.find((x) => x.svc === el.dataset.svc);
  const v = numOf(el.value);
  if (e) e.qty = Number.isNaN(v) ? 0 : Math.max(0, v);
};
changes['own-type'] = (el) => { draft.materialType = el.value; };
actions['own-calc'] = (el) => {
  sheet({
    title: 'Калькулятор комнаты',
    body: `<div class="grid-2">${field({ id: 'k-a', label: 'Длина, м', inputmode: 'decimal', value: '4' })}${field({ id: 'k-b', label: 'Ширина или высота, м', inputmode: 'decimal', value: '3' })}</div>`,
    buttons: [{ label: 'Закрыть', action: 'sheet-close' }, { label: 'Применить', action: 'own-calc-do', data: `data-svc="${el.dataset.svc}"`, primary: true }],
  });
};
actions['own-calc-do'] = (el) => {
  const a = numOf(val('k-a')); const b = numOf(val('k-b'));
  if (!(a > 0 && b > 0)) { toast('Введите два положительных числа'); return; }
  const r = draft.rooms.find((x) => x.key === draft.room);
  const e = r.est.find((x) => x.svc === el.dataset.svc);
  e.qty = Math.round(a * b * 100) / 100;
  closeSheet(); rerender();
};
actions['own-prev'] = () => { readOwnClient(); draft.step = Math.max(1, draft.step - 1); draft.errors = {}; rerender(); window.scrollTo(0, 0); };
actions['own-next'] = () => {
  if (draft.step === 1 && !draft.rooms.length) { draft.errors = { rooms: 'Добавьте хотя бы одну комнату' }; rerender(); return; }
  draft.step += 1; draft.errors = {}; rerender(); window.scrollTo(0, 0);
};
actions['own-save'] = (el) => {
  readOwnClient();
  const c = draft.client;
  const phone = c.phone.replace(/\D/g, '').slice(-10);
  const e = {};
  if (c.name.length < 2) e.name = 'Введите имя';
  if (phone.length < 10) e.phone = 'Нужно 10 цифр после +7';
  if (!c.street) e.street = 'Введите улицу';
  if (!c.house) e.house = 'Дом';
  if (el.dataset.branch === 'measure' && !draft.date) e.date = 'Выберите дату замера';
  draft.errors = e;
  if (Object.keys(e).length) { rerender(); toast('Проверьте поля, отмеченные красным'); return; }
  const o = S.createOwnOrder({
    rooms: draft.rooms.map((r) => ({ floor: r.floor, name: r.name, est: r.est })), branch: el.dataset.branch,
    source: draft.source, detail: draft.detail, url: draft.url, client: { ...c, phone },
    date: draft.date, time: `${draft.hour}:${draft.minute}`, materialType: draft.materialType,
  });
  draft = null;
  column = o.status;
  toast(`Заказ № ${o.no} создан`);
  openOrderTab(o.id, o.status === 'measure' ? 'schedule' : 'estimate');
  go(`p-order-${o.id}`);
};
