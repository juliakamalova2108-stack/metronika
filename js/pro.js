// Мастер и диспетчер: входящие предложения, принятие или отказ, карточка заказа с вкладками из «Выездов».

import { actions, rerender, go } from './core.js';
import * as S from './store.js';
import { prelimCost, commissionAmount } from './calc.js';
import { esc, rub, num, kv, status, btnRow, seg, dateTimeRu, sheet, closeSheet, toast, phoneRu } from './ui.js';
import { topbar, orderStatus, prelimBlock, historyBlock, typeName } from './shared.js';

let listTab = 'incoming';

const incomingLinks = (me) => S.get().links.filter((l) => l.toId === me.id && l.status === 'proposed');
const myLinks = (me, statuses) => S.get().links.filter((l) => l.toId === me.id && statuses.includes(l.status));
export const incomingCount = () => { const me = S.me(); return me ? incomingLinks(me).length : 0; };

function offerCard(l, me) {
  const o = S.order(l.orderId);
  const p = o.prelim;
  const mat = S.material(p.barcode);
  const myPrice = S.priceFor(me, mat ? mat.type : 'flizelin');
  const cost = prelimCost(p.areaMid, myPrice);
  return `<article class="plate order-card">
    <div class="order-card__top"><span class="order-card__no">№ ${o.no} · ${esc(o.client.street)}, ${esc(o.client.house)}</span>${status('idle', 'новое')}</div>
    ${kv('От кого', esc(S.displayName(me, l.fromId, o.id)))}
    ${kv('Приезд', esc(dateTimeRu(l.arrival)))}
    ${kv('Обои', mat ? `${esc(mat.brand)}, ${esc(typeName(mat.type).toLowerCase())}` : '—')}
    ${kv('Рулонов и площадь', `${p.rolls} шт. · ${p.areaMin === p.areaMax ? num(p.areaMid) : `${num(p.areaMin)}–${num(p.areaMax)}`} м²`)}
    ${kv('По вашему прайсу', `${myPrice} ₽/м² → ${rub(cost)}`)}
    ${kv('Процент партнёру', `${num(l.pct)}% · ≈ ${rub(commissionAmount(cost, l.pct))}`, true)}
    <p class="small">Принимая заказ, вы соглашаетесь с датой и процентом. После принятия процент не меняется, а отказ стоит неустойку.</p>
    ${btnRow([{ label: 'Отклонить', action: 'offer-decline', data: `data-id="${l.id}"` }, { label: 'Принять', action: 'offer-accept', data: `data-id="${l.id}"`, primary: true }])}
  </article>`;
}

function workCard(l, me) {
  const o = S.order(l.orderId);
  const stMap = { accepted: ['ok', 'в работе'], refused: ['bad', 'вы отказались'], declined: ['idle', 'отклонено'] };
  const st = stMap[l.status] || ['idle', l.status];
  return `<button type="button" class="plate card-btn order-card" data-action="go" data-to="p-order-${o.id}">
    <div class="order-card__top"><span class="order-card__no">№ ${o.no} · ${esc(o.client.name)}</span>${status(st[0], st[1])}</div>
    ${kv('Адрес', esc(`${o.client.street}, ${o.client.house}${o.client.flat ? ', кв. ' + o.client.flat : ''}`))}
    ${kv('Приезд', esc(dateTimeRu(l.arrival)))}
  </button>`;
}

export function renderProOrders() {
  const me = S.me();
  const inc = incomingLinks(me);
  const work = myLinks(me, ['accepted']);
  const done = myLinks(me, ['refused', 'declined']);
  const body = listTab === 'incoming'
    ? (inc.length ? inc.slice().reverse().map((l) => offerCard(l, me)).join('') : '<section class="plate"><p class="empty">Новых предложений нет. Войдите как агент Алина и передайте заказ — он появится здесь.</p></section>')
    : listTab === 'work'
      ? (work.length ? work.slice().reverse().map((l) => workCard(l, me)).join('') : '<section class="plate"><p class="empty">Принятых заказов пока нет</p></section>')
      : (done.length ? done.slice().reverse().map((l) => workCard(l, me)).join('') : '<section class="plate"><p class="empty">Здесь будут отклонённые заказы и отказы</p></section>');
  return `${topbar('Заказы')}
    ${seg('pro-list', [{ value: 'incoming', label: `Входящие${inc.length ? ' · ' + inc.length : ''}` }, { value: 'work', label: 'В работе' }, { value: 'done', label: 'Архив' }], listTab)}
    <div class="list">${body}</div>`;
}

export function onSegPro(name, value) {
  if (name === 'pro-list') { listTab = value; rerender(); return true; }
  if (name === 'order-tab') { orderTab = value; rerender(); return true; }
  return false;
}

actions['offer-accept'] = (el) => {
  const l = S.get().links.find((x) => x.id === el.dataset.id);
  sheet({
    title: 'Принять заказ?',
    body: `<p>Процент ${num(l.pct)}% и приезд ${esc(dateTimeRu(l.arrival))} зафиксируются. Отказаться потом можно, но с неустойкой.</p>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Принять', action: 'offer-accept-do', data: `data-id="${l.id}"`, primary: true }],
  });
};
actions['offer-accept-do'] = (el) => {
  const l = S.get().links.find((x) => x.id === el.dataset.id);
  S.acceptLink(l.id);
  closeSheet();
  toast('Заказ принят');
  orderTab = 'channel';
  go(`p-order-${l.orderId}`);
};
actions['offer-decline'] = (el) => {
  sheet({
    title: 'Отклонить предложение?',
    body: '<p>Вы ещё не принимали заказ, поэтому отклонить можно без неустойки. Агент передаст его другому исполнителю.</p>',
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Отклонить', action: 'offer-decline-do', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['offer-decline-do'] = (el) => { S.declineLink(el.dataset.id); closeSheet(); toast('Предложение отклонено'); rerender(); };

// ---------- карточка заказа ----------
let orderTab = 'channel';
const TABS = [
  ['channel', 'Канал'], ['client', 'Клиент'], ['estimate', 'Оценка'], ['schedule', 'График'], ['material', 'Материал'],
  ['smeta', 'Смета'], ['chat', 'Чат'], ['tasks', 'Задачи'], ['finance', 'Финансы'], ['history', 'История'],
];
const NEXT_STAGE = { material: 'Материал', smeta: 'Смета', chat: 'Чат', tasks: 'Задачи', finance: 'Финансы' };

function myLinkFor(o, me) {
  return S.linksOf(o.id).filter((l) => l.toId === me.id).slice(-1)[0];
}

function tabBody(o, me, l) {
  const c = o.client;
  if (orderTab === 'channel') {
    const est = S.settlementsOfLink(l.id).find((s) => s.type === 'commission');
    const pen = S.settlementsOfLink(l.id).find((s) => s.type === 'penalty');
    return `<section class="plate">
      <h2 class="plate__title">Канал</h2>
      ${kv('Источник заявки', 'Партнёр')}
      ${kv('Партнёр', esc(S.displayName(me, l.fromId, o.id)))}
      ${kv('Уточнение', o.channel === 'card' ? 'Визитка (промокод)' : 'Торговая точка')}
      ${kv('Вознаграждение партнёру', `${num(l.pct)}% · зафиксировано`)}
      ${est && est.status !== 'cancelled' ? kv('Ориентировочно', rub(est.amount), true) : ''}
      ${pen ? kv('Неустойка за отказ', rub(pen.amount), true) : ''}
      <p class="small">Процент берётся с работ из предварительной оценки по факту замера, но не меньше суммы оценки. Работы, которые вы добавите сами, — ваши деньги без процента.</p>
    </section>`;
  }
  if (orderTab === 'client') {
    return `<section class="plate">
      <div class="plate__head"><h2 class="plate__title">Клиент</h2>${status('ok', 'сохранено')}</div>
      ${kv('Имя', esc(c.name))}${kv('Телефон', esc(phoneRu(c.phone)))}${kv('Улица', esc(c.street))}
      <div class="grid-4">${[['Дом', c.house], ['Подъезд', c.entrance], ['Кв', c.flat], ['Этаж', c.floor]].map(([k, v]) => `<div class="tile"><span>${k}</span><b style="font-size:16px">${esc(v || '—')}</b></div>`).join('')}</div>
      ${kv('Время приезда', esc(dateTimeRu(l.arrival)))}
      ${c.comment ? kv('Комментарий', esc(c.comment)) : ''}
      <p class="small">Приложение внутреннее: клиенту из него никто не пишет. Связь с клиентом — по телефону.</p>
    </section>`;
  }
  if (orderTab === 'estimate') return prelimBlock(o, me);
  if (orderTab === 'schedule') {
    return `<section class="plate">
      <h2 class="plate__title">График</h2>
      <div class="well">${kv('Замер', esc(dateTimeRu(l.arrival)))}${kv('Длительность', '2 часа')}<p class="small">Замер — всегда отдельный выезд. Геоотметка обязательна и на замере, и на работах.</p></div>
      <p class="small">Распределение комнат по датам из макета «График» собирается в этапе 3.</p>
    </section>`;
  }
  if (orderTab === 'history') return historyBlock(o, me);
  return `<section class="plate"><h2 class="plate__title">${NEXT_STAGE[orderTab]}</h2>
    <p class="muted">Эта вкладка собирается в этапе 3 по готовому макету из секции «Выезды».</p></section>`;
}

export function renderProOrder(id) {
  const me = S.me();
  const o = S.order(id);
  const l = o && myLinkFor(o, me);
  if (!o || !l) return `${topbar('Заказ', { back: 'orders' })}<section class="plate"><p class="empty">Заказ не найден</p></section>`;
  const canRefuse = l.status === 'accepted';
  return `${topbar(`Заказ № ${o.no}`, { back: 'orders', right: orderStatus(o) })}
    <nav class="plate topbar" style="padding:0 12px"><div class="tabs" role="tablist">${TABS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === orderTab}" class="tabs__item${k === orderTab ? ' is-active' : ''}" data-action="seg" data-seg="order-tab" data-value="${k}">${t}</button>`).join('')}</div></nav>
    ${tabBody(o, me, l)}
    ${canRefuse ? btnRow([{ label: 'Отказаться от заказа', action: 'refuse-open', data: `data-id="${l.id}"` }]) : ''}`;
}

actions['refuse-open'] = (el) => {
  const p = S.previewPenalty(el.dataset.id);
  const l = S.get().links.find((x) => x.id === el.dataset.id);
  const me = S.me();
  sheet({
    title: 'Отказаться от заказа?',
    body: `<p>До приезда ${p.days > 0 ? `${p.days} дн.` : 'меньше суток'}. Правило: ${esc(p.rule)}.</p>
      <div class="well">${kv('Неустойка', rub(p.amount), true)}${kv('Кому', esc(S.displayName(me, l.fromId, l.orderId)))}</div>
      <p class="small">Неустойка попадёт в начисления. Деньги переводятся напрямую, вне приложения.</p>`,
    buttons: [{ label: 'Не отказываться', action: 'sheet-close' }, { label: 'Отказаться', action: 'refuse-do', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['refuse-do'] = (el) => {
  const p = S.refuseLink(el.dataset.id);
  closeSheet();
  toast(`Отказ оформлен, неустойка ${rub(p.amount)}`);
  rerender();
};

export function renderCurrentOrder() {
  const me = S.me();
  const l = myLinks(me, ['accepted']).slice().sort((a, b) => a.arrival.localeCompare(b.arrival))[0];
  if (!l) return `${topbar('Текущий заказ')}<section class="plate"><p class="empty">Ближайшего заказа нет. Примите предложение во входящих.</p>${btnRow([{ label: 'К заказам', action: 'go', data: 'data-to="orders"', primary: true }])}</section>`;
  return renderProOrder(l.orderId);
}
