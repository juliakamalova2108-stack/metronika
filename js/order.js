// Карточка заказа — вкладки из секции «Выезды»: Канал, Клиент, Оценка, График, Материал, Смета, Чат, Задачи, Финансы, История.
// Одна карточка для всех ролей: ведущий (мастер или диспетчер) редактирует всё, мастер от диспетчера — свои комнаты,
// агент смотрит заказ целиком и пишет в чат.

import { actions, changes, rerender, go, val, numVal } from './core.js?v=41';
import * as S from './store.js?v=41';
import { SERVICES, UNIT, CHANNELS, EXPENSE_CATS, DEMO_BARCODES, DEMO_DEVICE, WALLPAPER_TYPES } from './seed.js?v=41';
import { shiftsText, wallArea, penalty as penaltyRule, commissionAmount } from './calc.js?v=41';
import { esc, rub, num, kv, status, field, select, btnRow, seg, dateRu, dateTimeRu, phoneRu, sheet, closeSheet, toast, ICONS } from './ui.js?v=41';
import { topbar, typeName, orderStatus, prelimBlock, historyBlock } from './shared.js?v=41';

let tab = 'channel';
let lastId = '';
let roomSel = '';
let finTab = 'income';
let taskTab = 'open';

export const STAGES = [
  ['measure', 'Замер'], ['approval', 'Согласование'], ['queue', 'Очередь'], ['work', 'В работе'], ['done', 'Выполнено'], ['closed', 'Закрыт'],
];
const STAGE_HINT = {
  offered: 'Ждёт, когда исполнитель примет заказ',
  measure: 'Снимите замер рулеткой и соберите смету по стенам',
  approval: 'Смета у клиента. Когда он согласится — заказ встанет в очередь',
  queue: 'Даты комнат в графике. Работы начнутся с геоотметки на объекте',
  work: 'Идут работы. Отмечайтесь на объекте каждый выезд',
  done: 'Работы выполнены. Закройте заказ — посчитаются комиссии и рейтинг',
  closed: 'Заказ закрыт',
  failed: 'Заказ сорван',
  cancelled: 'Клиент отказался',
  declined: 'Исполнитель отклонил предложение',
};

export function viewerMode(o, me) {
  if (S.hasRole(me, 'agent')) return 'agent';
  if (o.leadId === me.id) return 'lead';
  return 'master';
}
const canEditRoom = (o, me, r) => viewerMode(o, me) === 'lead' || (r && r.assignee === me.id);
const visibleRooms = (o, me) => (viewerMode(o, me) === 'master' ? S.roomsFor(o, me) : o.rooms);
const isFinal = (o) => ['closed', 'cancelled', 'failed', 'declined'].includes(o.status);

const TABS = {
  lead: ['channel', 'client', 'estimate', 'schedule', 'material', 'smeta', 'chat', 'tasks', 'finance', 'history'],
  master: ['channel', 'client', 'estimate', 'schedule', 'material', 'smeta', 'chat', 'tasks', 'finance', 'history'],
  agent: ['channel', 'client', 'estimate', 'schedule', 'material', 'smeta', 'chat', 'history'],
};
const TAB_NAMES = { channel: 'Канал', client: 'Клиент', estimate: 'Оценка', schedule: 'График', material: 'Материал', smeta: 'Смета', chat: 'Чат', tasks: 'Задачи', finance: 'Финансы', history: 'История' };

function roomPicker(o, me, rooms) {
  if (!rooms.length) return '';
  if (!rooms.some((r) => r.id === roomSel)) roomSel = rooms[0].id;
  return `<div class="tabs room-tabs" role="tablist">${rooms.map((r) => `<button type="button" role="tab" aria-selected="${r.id === roomSel}" class="tabs__item${r.id === roomSel ? ' is-active' : ''}" data-action="room-pick" data-id="${r.id}">${esc(r.name)}<small class="room-floor">${r.floor} этаж</small></button>`).join('')}</div>`;
}
actions['room-pick'] = (el) => { roomSel = el.dataset.id; rerender(); };

// ================= вкладки =================
function tabChannel(o, me, mode) {
  const links = S.linksOf(o.id);
  const up = links.filter((l) => l.toId === me.id).slice(-1)[0];
  const parts = [];
  if (mode === 'lead' && !o.prelim && !links.some((l) => l.toId === me.id)) {
    parts.push(`<section class="plate">
      <div class="plate__head"><h2 class="plate__title">Канал</h2></div>
      ${select({ id: 'ch-source', label: 'Источник заявки', value: o.channel.source, options: CHANNELS.map((c) => ({ value: c, label: c })) })}
      ${field({ id: 'ch-detail', label: 'Уточнение', value: o.channel.detail, placeholder: 'Например, объявление «Поклейка обоев»' })}
      ${field({ id: 'ch-url', label: 'Ссылка', value: o.channel.url, placeholder: 'Вставьте ссылку', type: 'url' })}
      ${isFinal(o) ? '' : btnRow([{ label: 'Сохранить', action: 'ch-save', data: `data-id="${o.id}"`, primary: true }])}
    </section>`);
  } else {
    parts.push(`<section class="plate"><h2 class="plate__title">Канал</h2>
      ${kv('Источник', esc(o.channel.source))}${o.channel.detail ? kv('Уточнение', esc(o.channel.detail)) : ''}
      ${up ? kv('Кто передал', esc(S.displayName(me, up.fromId, o.id))) + kv('Вознаграждение', `${num(up.pct)}% · зафиксировано`) : ''}
    </section>`);
  }
  // Звенья, которые видит этот человек: свои входящие и исходящие.
  const mine = links.filter((l) => (l.toId === me.id || l.fromId === me.id) || mode === 'agent');
  if (mine.length) {
    parts.push(`<section class="plate"><h2 class="plate__title">Договорённости</h2>${mine.map((l) => linkCard(o, me, l)).join('')}
      <p class="small">Процент берётся с работ из предварительной оценки по факту замера, но не меньше оценки. Работы, добавленные сверх неё, — деньги исполнителя без процента.</p></section>`);
  }
  if (mode === 'lead' && S.hasRole(me, 'dispatcher')) parts.push(dispatchBlock(o, me));
  if (mode === 'agent' && ['declined', 'failed'].includes(o.status)) parts.push(btnRow([{ label: 'Передать другому исполнителю', action: 'resend-open', data: `data-id="${o.id}"`, primary: true }]));
  return parts.join('');
}

function linkCard(o, me, l) {
  const st = { proposed: ['idle', 'ждёт ответа'], accepted: ['ok', 'принято'], declined: ['bad', 'отклонено'], refused: ['bad', 'отказ'], done: ['ok', 'выполнено'], cancelled: ['idle', 'отменено'] }[l.status] || ['idle', l.status];
  const ss = S.settlementsOfLink(l.id).filter((s) => s.status !== 'cancelled');
  const rooms = l.roomIds ? o.rooms.filter((r) => l.roomIds.includes(r.id)).map((r) => r.name).join(', ') : 'весь заказ';
  return `<div class="well">
    <div class="order-card__top"><b>${esc(S.displayName(me, l.fromId, o.id))} → ${esc(S.displayName(me, l.toId, o.id))}</b>${status(st[0], st[1])}</div>
    ${kv('Что', esc(rooms))}${kv('Приезд', esc(dateTimeRu(l.arrival)))}${kv('Процент', `${num(l.pct)}% от ${rub(l.base)}`)}
    ${ss.map((s) => kv(s.type === 'penalty' ? 'Неустойка' : s.status === 'estimate' ? 'Комиссия ориентировочно' : 'Комиссия итоговая', `${rub(s.amount)}${s.type === 'commission' && s.fact != null ? ` · факт ${rub(s.fact)}` : ''}`)).join('')}
  </div>`;
}

function dispatchBlock(o, me) {
  const unassigned = o.rooms.filter((r) => !r.pendingFor && (!r.assignee || r.assignee === me.id));
  const pending = S.linksOf(o.id).filter((l) => l.fromId === me.id && l.status === 'proposed');
  return `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Мастера</h2>${o.searching ? status('warn', 'ищем замену') : ''}</div>
    ${o.rooms.length ? o.rooms.map((r) => kv(`${esc(r.name)} · ${r.floor} эт.`, r.assignee ? esc(S.displayName(me, r.assignee, o.id)) : r.pendingFor ? `ждём: ${esc(S.user(r.pendingFor).name)}` : '<span class="status status--warn"><i></i>без мастера</span>')).join('') : '<p class="small">Комнат пока нет. Можно передать мастеру весь заказ — комнаты он добавит сам, или сначала заполнить «Оценку».</p>'}
    ${pending.length ? `<p class="small">Ждут ответа: ${pending.map((l) => esc(S.user(l.toId).name)).join(', ')}</p>` : ''}
    ${o.searching ? `<p class="small">Мастер отказался. Найдите замену до ${esc(dateTimeRu(o.arrival))}, иначе заказ закроется автоматически и вы заплатите неустойку агенту.</p>` : ''}
    ${isFinal(o) ? '' : btnRow([{ label: 'Передать мастеру', action: 'assign-open', data: `data-id="${o.id}"`, primary: true, disabled: o.rooms.length > 0 && unassigned.length === 0 }])}
    ${o.searching && S.upstreamLink(o) ? btnRow([{ label: 'Замену не нашёл — закрыть', action: 'giveup-open', data: `data-id="${o.id}"` }]) : ''}
  </section>`;
}

function tabClient(o, me, mode) {
  const c = o.client;
  const editable = mode === 'lead' && !isFinal(o);
  if (!editable) {
    return `<section class="plate">
      <div class="plate__head"><h2 class="plate__title">Клиент</h2>${status('ok', 'сохранено')}</div>
      ${kv('Имя', esc(c.name))}${kv('Телефон', esc(phoneRu(c.phone)))}${kv('Улица', esc(c.street))}
      <div class="grid-4">${[['Дом', c.house], ['Подъезд', c.entrance], ['Кв', c.flat], ['Этаж', c.floor]].map(([k, v]) => `<div class="tile"><span>${k}</span><b style="font-size:16px">${esc(v || '—')}</b></div>`).join('')}</div>
      ${kv('Время приезда', esc(dateTimeRu(o.arrival)))}${c.comment ? kv('Комментарий', esc(c.comment)) : ''}
      <p class="small">Приложение внутреннее: клиенту из него никто не пишет. Связь с клиентом — по телефону.</p>
    </section>`;
  }
  const hours = Array.from({ length: 13 }, (_, i) => String(8 + i).padStart(2, '0'));
  return `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Клиент</h2>${status('ok', 'сохранено')}</div>
    ${field({ id: 'cl-name', label: 'Имя', value: c.name })}
    ${field({ id: 'cl-phone', label: 'Телефон', value: phoneRu(c.phone), type: 'tel', inputmode: 'tel' })}
    ${field({ id: 'cl-street', label: 'Улица', value: c.street })}
    <div class="grid-4">${field({ id: 'cl-house', label: 'Дом', value: c.house })}${field({ id: 'cl-entrance', label: 'Подъезд', value: c.entrance, inputmode: 'numeric' })}${field({ id: 'cl-flat', label: 'Кв', value: c.flat, inputmode: 'numeric' })}${field({ id: 'cl-floor', label: 'Этаж', value: c.floor, inputmode: 'numeric' })}</div>
    ${field({ id: 'cl-date', label: 'Дата приезда на замер', value: o.arrival ? o.arrival.slice(0, 10) : '', type: 'date' })}
    <div class="grid-2">
      ${select({ id: 'cl-hour', label: 'Часы', value: o.arrival ? o.arrival.slice(11, 13) : '10', options: hours.map((h) => ({ value: h, label: h })) })}
      ${select({ id: 'cl-min', label: 'Минуты', value: o.arrival ? o.arrival.slice(14, 16) : '00', options: ['00', '15', '30', '45'].map((m) => ({ value: m, label: m })) })}
    </div>
    <label class="field" for="cl-comment"><span class="field__label">Комментарий</span><span class="field__box"><textarea id="cl-comment">${esc(c.comment)}</textarea></span></label>
    ${btnRow([{ label: 'Сохранить', action: 'cl-save', data: `data-id="${o.id}"`, primary: true }])}
  </section>`;
}

function tabEstimate(o, me, mode) {
  const rooms = visibleRooms(o, me);
  const est = S.estimateOf(o, rooms.map((r) => r.id));
  const editableAny = !isFinal(o) && mode !== 'agent';
  const r = rooms.find((x) => x.id === roomSel) || rooms[0];
  const roomEst = r ? est.perRoom.find((x) => x.room.id === r.id) : null;
  const canEdit = r && editableAny && canEditRoom(o, me, r);
  return `${o.prelim ? prelimBlock(o, me) : ''}
  <section class="plate">
    <div class="plate__head"><h2 class="plate__title">Оценка по комнатам</h2>${o.materialType ? `<span class="small">${esc(typeName(o.materialType))}</span>` : ''}</div>
    ${rooms.length ? roomPicker(o, me, rooms) : '<p class="empty">Комнат пока нет</p>'}
    ${editableAny && mode === 'lead' ? btnRow([{ label: '+ Комнаты', action: 'rooms-open', data: `data-id="${o.id}"` }, ...(r ? [{ label: 'Услуги', action: 'svc-open', data: `data-id="${o.id}" data-room="${r.id}"`, disabled: !canEdit }] : [])]) : ''}
    ${editableAny && mode === 'master' && S.wholeLinkOf(o, me.id) ? btnRow([{ label: '+ Комнаты', action: 'rooms-open', data: `data-id="${o.id}"` }, ...(r ? [{ label: 'Услуги', action: 'svc-open', data: `data-id="${o.id}" data-room="${r.id}"`, disabled: !canEdit }] : [])]) : ''}
    ${editableAny && mode === 'master' && !S.wholeLinkOf(o, me.id) && r ? btnRow([{ label: 'Услуги комнаты', action: 'svc-open', data: `data-id="${o.id}" data-room="${r.id}"`, disabled: !canEdit }]) : ''}
  </section>
  ${r ? `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">${esc(r.name)} · ${r.floor} этаж</h2>${canEdit && mode === 'lead' && o.rooms.length > 1 ? `<button type="button" class="icon-btn" data-action="room-del" data-id="${o.id}" data-room="${r.id}" aria-label="Удалить комнату">${ICONS.trash}</button>` : ''}</div>
    ${roomEst.lines.length ? roomEst.lines.map((l) => `<div class="well svc-line">
      <div class="plate__head"><b>${esc(l.name)}</b><span class="small">${shiftsText(l.hours)}</span></div>
      <div class="svc-line__calc">
        <span class="field__box svc-qty"><input id="q-${r.id}-${l.svc}" inputmode="decimal" value="${l.qty ? esc(num(l.qty)) : ''}" placeholder="0" ${canEdit ? '' : 'disabled'} data-change="est-qty" data-id="${o.id}" data-room="${r.id}" data-svc="${l.svc}" aria-label="Объём, ${UNIT[l.unit]}"/><span class="field__suffix">${UNIT[l.unit]}</span></span>
        <span class="small">× ${l.price} ₽</span>
        <b class="svc-sum">= ${rub(l.sum)}</b>
      </div>
      ${canEdit && l.unit === 'm2' ? `<button type="button" class="link-btn" data-action="calc-open" data-id="${o.id}" data-room="${r.id}" data-svc="${l.svc}">Калькулятор: длина × ширина</button>` : ''}
    </div>`).join('') : '<p class="empty">Услуги не выбраны</p>'}
    <div class="tiles"><div class="tile"><span>Стоимость</span><b>${rub(roomEst.total)}</b></div><div class="tile"><span>Срок</span><b>${shiftsText(roomEst.hours)}</b></div></div>
  </section>` : ''}
  ${rooms.length ? `<section class="plate">
    <h2 class="plate__title">Итог · ${rooms.length} ${rooms.length === 1 ? 'комната' : rooms.length < 5 ? 'комнаты' : 'комнат'}</h2>
    ${byService(est).map((x) => kv(`${esc(x.name)} · ${num(x.qty)} ${UNIT[x.unit]}`, rub(x.sum))).join('')}
    ${kv('Общий итог', rub(est.total), true)}${kv('Срок', shiftsText(est.hours))}
    ${editableAny ? btnRow([{ label: 'Сохранить оценку', action: 'est-save', data: `data-id="${o.id}"` }]) : ''}
  </section>` : ''}`;
}

function byService(est) {
  const m = new Map();
  est.perRoom.forEach((pr) => pr.lines.forEach((l) => {
    const x = m.get(l.svc) || { name: l.name, unit: l.unit, qty: 0, sum: 0 };
    x.qty = Math.round((x.qty + l.qty) * 100) / 100; x.sum += l.sum; m.set(l.svc, x);
  }));
  return [...m.values()];
}

function tabSchedule(o, me, mode) {
  const lead = mode === 'lead' && !isFinal(o);
  const mv = o.visits.find((v) => v.type === 'measure');
  const rooms = visibleRooms(o, me);
  const visits = o.visits.filter((v) => mode !== 'master' || v.masterId === me.id || v.type === 'measure');
  const hours = Array.from({ length: 13 }, (_, i) => String(8 + i).padStart(2, '0'));
  return `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Замер</h2>${mv && mv.geo ? status('ok', 'отметка есть') : status('idle', '2 часа')}</div>
    ${lead && !(mv && mv.geo) ? `${field({ id: 'm-date', label: 'Дата', value: mv ? mv.date : '', type: 'date' })}
      <div class="grid-2">${select({ id: 'm-hour', label: 'Часы', value: mv ? mv.time.slice(0, 2) : '10', options: hours.map((h) => ({ value: h, label: h })) })}${select({ id: 'm-min', label: 'Минуты', value: mv ? mv.time.slice(3, 5) : '00', options: ['00', '15', '30', '45'].map((x) => ({ value: x, label: x })) })}</div>
      ${btnRow([{ label: mv ? 'Перенести замер' : 'Назначить замер', action: 'measure-save', data: `data-id="${o.id}"` }])}`
      : kv('Когда', mv ? esc(dateTimeRu(`${mv.date}T${mv.time}`)) : 'без даты')}
  </section>
  <section class="plate">
    <h2 class="plate__title">Комнаты</h2>
    ${rooms.length ? rooms.map((r) => `<div class="well">
      <div class="order-card__top"><b>${esc(r.name)} · ${r.floor} эт.</b>${r.done ? status('ok', 'выполнено') : r.start ? status('ok', 'в графике') : status('warn', 'без даты')}</div>
      ${kv('Мастер', r.assignee ? esc(S.displayName(me, r.assignee, o.id)) : '—')}
      ${canEditRoom(o, me, r) && !isFinal(o) && mode !== 'agent' && !r.done ? `<div class="grid-2">${field({ id: `rs-${r.id}`, label: 'С', value: r.start, type: 'date' })}${field({ id: `re-${r.id}`, label: 'По', value: r.end, type: 'date' })}</div>
        ${btnRow([{ label: 'Снять с даты', action: 'room-dates-clear', data: `data-id="${o.id}" data-room="${r.id}"`, disabled: !r.start }, { label: 'Сохранить', action: 'room-dates', data: `data-id="${o.id}" data-room="${r.id}"`, primary: true }])}`
      : kv('Даты', r.start ? `${esc(dateRu(r.start))}${r.end && r.end !== r.start ? ' – ' + esc(dateRu(r.end)) : ''}` : 'не назначены')}
    </div>`).join('') : '<p class="empty">Добавьте комнаты во вкладке «Оценка»</p>'}
  </section>
  <section class="plate">
    <h2 class="plate__title">Выезды и геоотметки</h2>
    <p class="small">Геоотметка обязательна и на замере, и на работах — без неё метры не пойдут в рейтинг.</p>
    ${visits.length ? visits.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((v) => `<div class="well">
      <div class="order-card__top"><b>${v.type === 'measure' ? 'Замер' : 'Работы'} · ${esc(dateTimeRu(`${v.date}T${v.time}`))}</b>${v.geo ? status('ok', 'на объекте') : status('idle', 'нет отметки')}</div>
      ${v.roomIds ? kv('Комнаты', esc(o.rooms.filter((r) => v.roomIds.includes(r.id)).map((r) => r.name).join(', '))) : ''}
      ${kv('Кто', v.masterId ? esc(S.displayName(me, v.masterId, o.id)) : '—')}
      ${v.geo ? kv('Отметка', `${esc(dateTimeRu(localIso(v.geo.at)))}${v.geo.demo ? ' · демо' : ''}`) : ''}
      ${!v.geo && v.masterId === me.id && !isFinal(o) ? btnRow([{ label: 'Отметиться на объекте', action: 'checkin', data: `data-id="${o.id}" data-visit="${v.id}"`, primary: true }]) : ''}
    </div>`).join('') : '<p class="empty">Выездов пока нет</p>'}
  </section>`;
}

function localIso(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function tabMaterial(o, me, mode) {
  const rooms = visibleRooms(o, me);
  const r = rooms.find((x) => x.id === roomSel) || rooms[0];
  const canEdit = r && !isFinal(o) && mode !== 'agent' && canEditRoom(o, me, r);
  const prelimMat = o.prelim ? S.material(o.prelim.barcode) : null;
  return `${prelimMat ? `<section class="plate"><h2 class="plate__title">Продано агентом</h2>${kv(`${esc(prelimMat.brand)} «${esc(prelimMat.name)}»`, `${o.prelim.rolls} рул.`)}</section>` : ''}
  <section class="plate">
    <h2 class="plate__title">Материал по комнатам</h2>
    ${rooms.length ? roomPicker(o, me, rooms) : '<p class="empty">Сначала добавьте комнаты во вкладке «Оценка»</p>'}
    ${r ? (r.materials.length ? r.materials.map((m) => {
      const mat = S.material(m.barcode);
      const reviews = S.reviewsOf(m.barcode);
      return `<div class="well">
        <div class="order-card__top"><b>${mat ? `${esc(mat.brand)} «${esc(mat.name)}»` : esc(m.barcode)}</b>${mat ? status(mat.status === 'confirmed' ? 'ok' : 'warn', mat.status === 'confirmed' ? 'в базе' : 'добавлен мастером') : ''}</div>
        ${mat ? kv('Тип и рулон', `${esc(typeName(mat.type))}, ${num(mat.width)} × ${num(mat.length)} м`) : ''}
        ${kv('Количество', `${m.qty} рул.`)}
        <details class="details"><summary>Мой опыт и отзывы мастеров · ${reviews.length}</summary>
          ${reviews.map((rv) => `<p class="small"><b>${esc(S.displayName(me, rv.authorId))}</b>: ${esc(rv.text)}</p>`).join('')}
          ${mode !== 'agent' ? `<label class="field" for="rv-${m.barcode}"><span class="field__box"><textarea id="rv-${m.barcode}" placeholder="Напишите, как материал ведёт себя в работе"></textarea></span></label>
          ${btnRow([{ label: 'Поделиться опытом', action: 'review-add', data: `data-code="${m.barcode}"` }])}` : ''}
        </details>
        ${canEdit ? `<button type="button" class="link-btn" data-action="mat-del" data-id="${o.id}" data-room="${r.id}" data-code="${m.barcode}">Убрать из комнаты</button>` : ''}
      </div>`;
    }).join('') : '<p class="empty">В этой комнате материала пока нет</p>') : ''}
  </section>
  ${canEdit ? `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Сканирование</h2>${ICONS.barcode.replace('<svg', '<svg style="width:26px;height:22px"')}</div>
    <div class="grid-2">${field({ id: 'mt-code', label: 'Штрихкод', inputmode: 'numeric', placeholder: '13 цифр' })}${field({ id: 'mt-qty', label: 'Рулонов', value: '1', inputmode: 'numeric' })}</div>
    <div class="chips">${DEMO_BARCODES.map((b) => `<button type="button" class="chip-btn" data-action="mt-demo" data-code="${b.code}">${b.code}<small>${esc(b.hint)}</small></button>`).join('')}</div>
    ${btnRow([{ label: 'Добавить в комнату', action: 'mat-add', data: `data-id="${o.id}" data-room="${r.id}"`, primary: true }])}
  </section>` : ''}`;
}

function tabSmeta(o, me, mode) {
  const rooms = visibleRooms(o, me);
  const r = rooms.find((x) => x.id === roomSel) || rooms[0];
  const canEdit = r && !isFinal(o) && mode !== 'agent' && canEditRoom(o, me, r);
  const sm = S.smetaOf(o, rooms.map((x) => x.id));
  const last = S.lastSmeta(o);
  const roomSvcs = r ? [...new Set([...r.est.map((e) => e.svc), ...r.walls.flatMap((w) => w.services)])] : [];
  const compare = o.prelim ? (() => {
    const fact = sm.items.filter((i) => i.svc === 'paste').reduce((a, i) => a + i.qty, 0);
    const low = o.prelim.areaMin * 0.85;
    const kind = !fact ? 'idle' : fact < low ? 'warn' : 'ok';
    return `<section class="plate"><div class="plate__head"><h2 class="plate__title">Ожидалось / замерено</h2>${status(kind, !fact ? 'ждём замер' : fact < low ? 'заметно меньше' : 'в пределах')}</div>
      ${kv('По проданным обоям', o.prelim.areaMin === o.prelim.areaMax ? `${num(o.prelim.areaMid)} м²` : `${num(o.prelim.areaMin)}–${num(o.prelim.areaMax)} м²`)}${kv('По замеру, поклейка', `${num(Math.round(fact * 10) / 10)} м²`)}
      <p class="small">Расхождение — сигнал, а не блокировка: клиент мог купить обои с запасом или клеить часть сам.</p></section>`;
  })() : '';
  return `${compare}<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Смета по стенам</h2>${last ? status('ok', `отправлена · v${last.v}`) : status('idle', 'не отправлена')}</div>
    ${rooms.length ? roomPicker(o, me, rooms) : '<p class="empty">Сначала добавьте комнаты во вкладке «Оценка»</p>'}
  </section>
  ${r ? `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">${esc(r.name)}</h2><span class="small">стены: ${num(S.wallsAreaOf(r))} м²</span></div>
    ${r.walls.map((w, i) => wallCard(o, r, w, i, canEdit, roomSvcs)).join('') || '<p class="empty">Стен пока нет. Добавьте первую и снимите длину рулеткой.</p>'}
    ${canEdit ? btnRow([{ label: '+ Стена', action: 'owall-add', data: `data-id="${o.id}" data-room="${r.id}"`, primary: true }]) : ''}
    ${canEdit ? `<details class="details"><summary>Услуги на все стены комнаты</summary>
      <div class="chips">${SERVICES.map((s) => { const on = r.walls.length && r.walls.every((w) => w.services.includes(s.id)); return `<button type="button" class="chip-btn${on ? ' is-on' : ''}" data-action="svc-all" data-id="${o.id}" data-room="${r.id}" data-svc="${s.id}" data-on="${on ? 0 : 1}" aria-pressed="${on}">${esc(s.name)}</button>`; }).join('')}</div></details>` : ''}
  </section>` : ''}
  <section class="plate">
    <h2 class="plate__title">Итог сметы</h2>
    ${sm.items.length ? sm.items.map((i) => `<div class="kv"><span>${esc(i.room)} · ${esc(i.name)} · ${num(i.qty)} ${UNIT[i.unit]} × ${i.price} ₽${i.fromPrelim ? '' : ' · <em>сверх оценки</em>'}</span><b>${rub(i.sum)}</b></div>`).join('') : '<p class="empty">Пока пусто: отметьте услуги на стенах</p>'}
    ${kv('Итого', rub(sm.total), true)}${kv('Срок', shiftsText(sm.hours))}
    ${last && last.total !== sm.total ? `<p class="small">Изменилось после отправки: было ${rub(last.total)}. Отправьте новую версию клиенту.</p>` : ''}
    ${mode !== 'agent' && !isFinal(o) ? btnRow([{ label: 'Смета для клиента', action: 'smeta-pdf', data: `data-id="${o.id}"`, disabled: !sm.items.length }, { label: last ? 'Отправить новую версию' : 'Отправить клиенту', action: 'smeta-send', data: `data-id="${o.id}"`, primary: true, disabled: !sm.items.length || (mode === 'master') }]) : btnRow([{ label: 'Смета для клиента', action: 'smeta-pdf', data: `data-id="${o.id}"`, disabled: !(last || sm.items.length) }])}
    ${mode === 'master' ? '<p class="small">Клиенту смету отправляет диспетчер — он видит ваши стены и объёмы.</p>' : ''}
    ${o.smeta.length ? `<details class="details"><summary>Версии сметы · ${o.smeta.length}</summary>${o.smeta.slice().reverse().map((v) => kv(`v${v.v} · ${esc(dateTimeRu(localIso(v.at)))}`, rub(v.total))).join('')}<p class="small">Отправленные версии не меняются — любая правка идёт новой версией.</p></details>` : ''}
  </section>`;
}

function wallCard(o, r, w, i, canEdit, roomSvcs) {
  const svcs = SERVICES.filter((s) => roomSvcs.includes(s.id) || w.services.includes(s.id));
  const dis = canEdit ? '' : 'disabled';
  const d = `data-id="${o.id}" data-room="${r.id}" data-wall="${w.id}"`;
  return `<div class="well wall">
    <div class="plate__head"><b>Стена ${i + 1}</b>${w.src === 'device' ? status('ok', 'с рулетки') : status('warn', 'вручную')}</div>
    <div class="wall__row">
      <label class="field" for="wl-${w.id}"><span class="field__label">Длина, м</span><span class="field__box"><input id="wl-${w.id}" inputmode="decimal" value="${w.len ? esc(num(w.len)) : ''}" placeholder="0" ${dis} data-change="wall-len" ${d}/></span></label>
      <label class="field" for="wh-${w.id}"><span class="field__label">Высота, м</span><span class="field__box"><input id="wh-${w.id}" inputmode="decimal" value="${esc(num(w.height))}" ${dis} data-change="wall-h" ${d}/></span></label>
      ${canEdit ? `<button type="button" class="btn wall__tape" data-action="tape" ${d} aria-label="Снять длину рулеткой">${ICONS.tape}<span>Рулетка</span></button>` : ''}
    </div>
    ${w.openings.map((op, k) => `<div class="wall__open"><span class="small">${op.type === 'door' ? 'Дверь' : 'Окно'}</span>
      <span class="field__box"><input inputmode="decimal" value="${esc(num(op.w))}" aria-label="Ширина проёма" ${dis} data-change="op-w" ${d} data-i="${k}"/></span>
      <span class="small">×</span>
      <span class="field__box"><input inputmode="decimal" value="${esc(num(op.h))}" aria-label="Высота проёма" ${dis} data-change="op-h" ${d} data-i="${k}"/></span>
      ${canEdit ? `<button type="button" class="icon-btn" data-action="op-del" ${d} data-i="${k}" aria-label="Убрать проём">${ICONS.trash}</button>` : ''}</div>`).join('')}
    <div class="plate__head"><span class="small">Площадь ${num(wallArea(w))} м²</span>${canEdit ? `<span><button type="button" class="link-btn" data-action="op-add" ${d} data-type="window">+ окно</button> · <button type="button" class="link-btn" data-action="op-add" ${d} data-type="door">+ дверь</button></span>` : ''}</div>
    <div class="chips">${svcs.map((s) => `<button type="button" class="chip-btn${w.services.includes(s.id) ? ' is-on' : ''}" data-action="wall-svc" ${d} data-svc="${s.id}" aria-pressed="${w.services.includes(s.id)}" ${dis}>${esc(s.name)}</button>`).join('')}</div>
    ${canEdit ? `<button type="button" class="link-btn" data-action="owall-del" ${d}>Удалить стену</button>` : ''}
  </div>`;
}

function tabChat(o, me) {
  return `<section class="plate">
    <h2 class="plate__title">Чат заказа</h2>
    <p class="small">Только участники заказа. Клиента здесь нет.</p>
    <div class="chat">${o.chat.length ? o.chat.map((m) => `<div class="msg${m.authorId === me.id ? ' msg--me' : ''}"><span class="small">${esc(S.displayName(me, m.authorId, o.id))} · ${esc(dateTimeRu(localIso(m.at)))}</span><p>${esc(m.text)}</p></div>`).join('') : '<p class="empty">Сообщений пока нет</p>'}</div>
    <label class="field" for="chat-text"><span class="field__box"><textarea id="chat-text" placeholder="Сообщение участникам"></textarea></span></label>
    ${btnRow([{ label: 'Отправить', action: 'chat-send', data: `data-id="${o.id}"`, primary: true }])}
  </section>`;
}

function participants(o) {
  const ids = new Set([o.leadId, ...o.rooms.map((r) => r.assignee), ...S.linksOf(o.id).filter((l) => l.status === 'accepted').map((l) => l.toId)].filter(Boolean));
  return [...ids];
}

function tabTasks(o, me) {
  const list = o.tasks.filter((t) => (taskTab === 'open' ? !t.done : t.done));
  return `<section class="plate">
    ${seg('task-tab', [{ value: 'open', label: 'Текущие' }, { value: 'done', label: 'Выполненные' }], taskTab)}
    ${list.length ? list.map((t) => `<div class="well">
      <div class="order-card__top"><b>${esc(t.text)}</b>${t.done ? status('ok', 'выполнено') : t.due && t.due < S.todayISO() ? status('bad', 'просрочено') : status('idle', t.due ? dateRu(t.due) : 'без срока')}</div>
      ${kv('Ответственный', esc(S.displayName(me, t.assigneeId, o.id)))}
      ${btnRow([{ label: t.done ? 'Вернуть в работу' : 'Выполнено', action: 'task-toggle', data: `data-id="${o.id}" data-task="${t.id}"` }])}
    </div>`).join('') : `<p class="empty">${taskTab === 'open' ? 'Задач пока нет. Добавьте поручение: например, купить клей или забрать материалы.' : 'Выполненных задач пока нет'}</p>`}
    ${isFinal(o) ? '' : btnRow([{ label: '+ Добавить задачу', action: 'task-open', data: `data-id="${o.id}"`, primary: true }])}
  </section>`;
}

function tabFinance(o, me, mode) {
  const rooms = visibleRooms(o, me);
  const last = S.lastSmeta(o);
  const smeta = S.smetaOf(o, rooms.map((r) => r.id));
  const income = last && mode === 'lead' ? last.total : smeta.total || S.estimateOf(o, rooms.map((r) => r.id)).total;
  const paid = o.payments.reduce((a, p) => a + p.amount, 0);
  const comm = S.get().settlements.filter((s) => s.orderId === o.id && s.payerId === me.id && s.status !== 'cancelled');
  const commSum = comm.reduce((a, s) => a + s.amount, 0);
  const exp = mode === 'lead' ? o.expenses : o.expenses.filter((e) => e.by === me.id);
  const expSum = exp.reduce((a, e) => a + e.amount, 0);
  let body = '';
  if (finTab === 'income') {
    body = `<div class="well">${kv('Доход по смете', rub(income), true)}<p class="small">${last && mode === 'lead' ? `Из отправленной сметы v${last.v}` : 'Автоматически из сметы или оценки заказа'}</p></div>
      ${mode === 'lead' ? `<div class="tiles"><div class="tile"><span>Получено</span><b>${rub(paid)}</b></div><div class="tile"><span>Осталось</span><b>${rub(Math.max(0, income - paid))}</b></div></div>
      ${o.payments.length ? o.payments.map((p) => kv(`${esc(p.kind)} · ${esc(p.method)} · ${esc(dateRu(p.date))}`, rub(p.amount))).join('') : '<p class="empty">Оплат пока нет</p>'}
      ${btnRow([{ label: '+ Оплата', action: 'pay-open', data: `data-id="${o.id}"`, primary: true }])}`
      : '<p class="small">Оплату клиента принимает диспетчер. Здесь — доход по вашим комнатам.</p>'}`;
  } else if (finTab === 'expense') {
    body = `${comm.map((s) => `<div class="well">${kv(s.type === 'penalty' ? 'Неустойка' : 'Агентские / процент партнёру', rub(s.amount), true)}<p class="small">${s.type === 'penalty' ? esc(s.rule) : `${num(s.pct)}% от ${rub(s.base)} · ${s.status === 'estimate' ? 'ориентировочно' : 'итог'} · ${esc(S.displayName(me, s.payeeId, o.id))}`}</p></div>`).join('')}
      ${exp.map((e) => kv(`${esc(e.name)} · ${esc(e.cat)}`, rub(e.amount))).join('') || (comm.length ? '' : '<p class="empty">Расходов пока нет</p>')}
      ${kv('Всего расходов', rub(expSum + commSum), true)}
      ${isFinal(o) && o.status !== 'closed' ? '' : btnRow([{ label: '+ Добавить расход', action: 'exp-open', data: `data-id="${o.id}"`, primary: true }])}`;
  } else {
    const inSum = S.get().settlements.filter((x) => x.orderId === o.id && x.payeeId === me.id && x.status !== 'cancelled').reduce((a, x) => a + x.amount, 0);
    body = `${kv('Стоимость работ', rub(income))}${inSum ? kv('Проценты от мастеров', '+ ' + rub(inSum)) : ''}${kv('Покупки и прочее', '− ' + rub(expSum))}${kv('Проценты и неустойки', '− ' + rub(commSum))}
      <div class="well">${kv('Чистый заработок', rub(income + inSum - expSum - commSum), true)}<p class="small">${inSum ? 'Работы и проценты от мастеров минус все расходы. Работы мастеров оплачивает клиент — их доля уходит мастерам по договорённости.' : 'Стоимость работ минус все расходы'}</p></div>`;
  }
  return `<section class="plate">${seg('fin-tab', [{ value: 'income', label: 'Доходы' }, { value: 'expense', label: 'Расходы' }, { value: 'total', label: 'Итог' }], finTab)}${body}</section>`;
}

// ================= полоса этапа и действия =================
function stageBar(o, me, mode) {
  const idx = STAGES.findIndex(([k]) => k === o.status);
  const strip = idx >= 0 ? `<div class="steps">${STAGES.map((_, i) => `<i class="${i <= idx ? 'is-done' : ''}"></i>`).join('')}</div>` : '';
  const btns = [];
  const up = S.linksOf(o.id).find((l) => l.toId === me.id && l.status === 'accepted');
  if (mode === 'lead' && !isFinal(o)) {
    if (o.status === 'approval') btns.push({ label: 'Клиент согласовал', action: 'st-agree', data: `data-id="${o.id}"`, primary: true });
    if (o.status === 'queue') btns.push({ label: 'Начать работы', action: 'st-start', data: `data-id="${o.id}"`, primary: true });
    if (o.status === 'work') btns.push({ label: 'Работы выполнены', action: 'st-finish', data: `data-id="${o.id}"`, primary: true });
    if (o.status === 'done') btns.push({ label: 'Закрыть заказ', action: 'close-open', data: `data-id="${o.id}"`, primary: true });
  }
  if (mode === 'master' && !isFinal(o)) {
    const mine = S.roomsFor(o, me).filter((r) => !r.done);
    if (mine.length && ['queue', 'work'].includes(o.status)) btns.push({ label: 'Мои комнаты выполнены', action: 'my-done', data: `data-id="${o.id}"`, primary: true });
  }
  const extra = [];
  if (up && !isFinal(o) && !['done'].includes(o.status)) extra.push({ label: 'Отказаться', action: 'refuse-open', data: `data-id="${up.id}"` });
  if (mode === 'lead' && !isFinal(o) && o.status !== 'done') extra.push({ label: 'Клиент отказался', action: 'cancel-open', data: `data-id="${o.id}"` });
  if (mode === 'lead' && !S.linksOf(o.id).length && isFinal(o) === false && o.status !== 'work') extra.push({ label: 'В корзину', action: 'trash-do', data: `data-id="${o.id}"` });
  return `<section class="plate stage">
    ${strip}
    <div class="plate__head"><b>${esc((STAGES.find(([k]) => k === o.status) || [, ORDER_WORD[o.status] || o.status])[1])}</b>${o.duplicateOf ? status('warn', 'дубль') : ''}</div>
    <p class="small">${esc(STAGE_HINT[o.status] || '')}</p>
    ${btns.length ? btnRow(btns) : ''}
    ${extra.length ? `<div class="stage__extra">${extra.map((b) => `<button type="button" class="link-btn" data-action="${b.action}" ${b.data}>${esc(b.label)}</button>`).join('')}</div>` : ''}
  </section>`;
}
const ORDER_WORD = { offered: 'Предложен', failed: 'Сорван', cancelled: 'Отменён', declined: 'Отклонён' };

export function renderOrder(id) {
  const me = S.me();
  const o = S.order(id);
  const back = S.hasRole(me, 'agent') ? 'mine' : 'orders';
  if (!o) return `${topbar('Заказ', { back })}<section class="plate"><p class="empty">Заказ не найден</p></section>`;
  const mode = viewerMode(o, me);
  const allowed = mode === 'agent' ? o.createdBy === me.id : (o.leadId === me.id || S.linksOf(o.id).some((l) => l.toId === me.id));
  if (!allowed) return `${topbar('Заказ', { back })}<section class="plate"><p class="empty">У вас нет доступа к этому заказу</p></section>`;
  if (lastId !== id) { lastId = id; tab = 'channel'; roomSel = ''; }
  const tabs = TABS[mode];
  if (!tabs.includes(tab)) tab = 'channel';
  const body = {
    channel: tabChannel, client: tabClient, estimate: tabEstimate, schedule: tabSchedule, material: tabMaterial,
    smeta: tabSmeta, chat: tabChat, tasks: tabTasks, finance: tabFinance, history: (oo, mm) => historyBlock(oo, mm),
  }[tab](o, me, mode);
  return `${topbar(`Заказ № ${o.no}`, { back, right: orderStatus(o) })}
    <nav class="plate topbar" style="padding:0 12px" aria-label="Разделы заказа"><div class="tabs" role="tablist">${tabs.map((k) => `<button type="button" role="tab" aria-selected="${k === tab}" class="tabs__item${k === tab ? ' is-active' : ''}" data-action="seg" data-seg="order-tab" data-value="${k}">${TAB_NAMES[k]}</button>`).join('')}</div></nav>
    ${stageBar(o, me, mode)}
    ${body}`;
}

export function onSegOrder(name, value) {
  if (name === 'order-tab') { tab = value; rerender(); return true; }
  if (name === 'fin-tab') { finTab = value; rerender(); return true; }
  if (name === 'task-tab') { taskTab = value; rerender(); return true; }
  return false;
}
export function openOrderTab(id, t) { lastId = id; tab = t; roomSel = ''; }

// ================= действия =================
const numOf = (s) => { const n = parseFloat(String(s).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : NaN; };

actions['ch-save'] = (el) => { S.updateChannel(el.dataset.id, { source: val('ch-source'), detail: val('ch-detail'), url: val('ch-url') }); toast('Канал сохранён'); rerender(); };

actions['cl-save'] = (el) => {
  const phone = val('cl-phone').replace(/\D/g, '').slice(-10);
  if (val('cl-name').length < 2 || phone.length < 10 || !val('cl-street') || !val('cl-house')) { toast('Заполните имя, телефон из 10 цифр, улицу и дом'); return; }
  const date = val('cl-date');
  S.updateClient(el.dataset.id, { name: val('cl-name'), phone, street: val('cl-street'), house: val('cl-house'), entrance: val('cl-entrance'), flat: val('cl-flat'), floor: val('cl-floor'), comment: val('cl-comment') }, date ? `${date}T${val('cl-hour')}:${val('cl-min')}` : '');
  toast('Данные клиента сохранены');
  rerender();
};

actions['rooms-open'] = (el) => {
  const me = S.me();
  const names = (me.settings && me.settings.rooms) || [];
  sheet({
    title: 'Выбор комнат',
    body: `${seg('rooms-floor', [{ value: '1', label: '1 этаж' }, { value: '2', label: '2 этаж' }, { value: '3', label: '3 этаж' }], '1')}
      <input type="hidden" id="rooms-floor-val" value="1"/>
      <div class="chips">${names.map((n) => `<label class="chip-check"><input type="checkbox" value="${esc(n)}" name="room-name"/> <span>${esc(n)}</span></label>`).join('')}</div>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Добавить выбранные', action: 'rooms-add', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['rooms-add'] = (el) => {
  const names = [...document.querySelectorAll('input[name="room-name"]:checked')].map((x) => x.value);
  if (!names.length) { toast('Отметьте хотя бы одну комнату'); return; }
  S.addRooms(el.dataset.id, Number(val('rooms-floor-val')) || 1, names);
  closeSheet();
  const o = S.order(el.dataset.id);
  roomSel = o.rooms[o.rooms.length - names.length].id;
  rerender();
};
export function onSegSheet(name, value) {
  if (name !== 'rooms-floor') return false;
  document.getElementById('rooms-floor-val').value = value;
  document.querySelectorAll('[data-seg="rooms-floor"]').forEach((b) => { const on = b.dataset.value === value; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
  return true;
}

actions['room-del'] = (el) => {
  const o = S.order(el.dataset.id);
  const r = o.rooms.find((x) => x.id === el.dataset.room);
  sheet({ title: 'Удалить комнату?', body: `<p>${esc(r.name)} и выбранные для неё услуги, стены и материалы будут удалены из заказа.</p>`, buttons: [{ label: 'Назад', action: 'sheet-close' }, { label: 'Удалить', action: 'room-del-do', data: `data-id="${o.id}" data-room="${r.id}"`, primary: true }] });
};
actions['room-del-do'] = (el) => { S.removeRoom(el.dataset.id, el.dataset.room); roomSel = ''; closeSheet(); rerender(); };

actions['svc-open'] = (el) => {
  const o = S.order(el.dataset.id);
  const r = o.rooms.find((x) => x.id === el.dataset.room);
  sheet({
    title: `Услуги · ${r.name}`,
    body: `<div class="list">${SERVICES.map((s) => { const info = S.svcInfo(o, s.id); const on = r.est.some((e) => e.svc === s.id); return `<label class="toggle-row"><span><b>${esc(s.name)}</b><small>от ${info.price} ₽/${UNIT[s.unit]}</small></span><input type="checkbox" class="switch" value="${s.id}" name="svc-pick" ${on ? 'checked' : ''}/></label>`; }).join('')}</div>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Готово', action: 'svc-save', data: `data-id="${o.id}" data-room="${r.id}"`, primary: true }],
  });
};
actions['svc-save'] = (el) => {
  const ids = [...document.querySelectorAll('input[name="svc-pick"]:checked')].map((x) => x.value);
  S.setRoomServices(el.dataset.id, el.dataset.room, ids);
  closeSheet(); rerender();
};

changes['est-qty'] = (el) => {
  const v = numOf(el.value);
  S.setEstQty(el.dataset.id, el.dataset.room, el.dataset.svc, Number.isNaN(v) ? 0 : Math.max(0, v));
};
actions['est-save'] = (el) => { S.saveEstimate(el.dataset.id); toast('Оценка сохранена'); rerender(); };

actions['calc-open'] = (el) => {
  sheet({
    title: 'Калькулятор комнаты',
    body: `<div class="grid-2">${field({ id: 'k-a', label: 'Длина, м', inputmode: 'decimal', value: '4' })}${field({ id: 'k-b', label: 'Ширина или высота, м', inputmode: 'decimal', value: '3' })}</div><p class="small">Расчёт применяется только к этой услуге в этой комнате</p>`,
    buttons: [{ label: 'Закрыть', action: 'sheet-close' }, { label: 'Применить', action: 'calc-apply', data: `data-id="${el.dataset.id}" data-room="${el.dataset.room}" data-svc="${el.dataset.svc}"`, primary: true }],
  });
};
actions['calc-apply'] = (el) => {
  const a = numOf(val('k-a')); const b = numOf(val('k-b'));
  if (!(a > 0 && b > 0)) { toast('Введите два положительных числа'); return; }
  S.setEstQty(el.dataset.id, el.dataset.room, el.dataset.svc, Math.round(a * b * 100) / 100);
  closeSheet(); rerender();
};

actions['measure-save'] = (el) => {
  if (!val('m-date')) { toast('Выберите дату замера'); return; }
  S.setMeasureDate(el.dataset.id, val('m-date'), `${val('m-hour')}:${val('m-min')}`);
  toast('Замер назначен'); rerender();
};
actions['room-dates'] = (el) => {
  const s = val(`rs-${el.dataset.room}`); let e = val(`re-${el.dataset.room}`);
  if (!s) { toast('Выберите дату начала'); return; }
  if (!e || e < s) e = s;
  S.setRoomDates(el.dataset.id, el.dataset.room, s, e);
  toast('Даты сохранены'); rerender();
};
actions['room-dates-clear'] = (el) => { S.setRoomDates(el.dataset.id, el.dataset.room, '', ''); rerender(); };

actions['checkin'] = (el) => {
  const done = (coords) => { S.checkIn(el.dataset.id, el.dataset.visit, coords); toast('Геоотметка поставлена'); rerender(); };
  const demo = () => done({ lat: 55.7512 + Math.random() * 0.01, lng: 37.6184 + Math.random() * 0.01, demo: true });
  try {
    if (!navigator.geolocation) { demo(); return; }
    navigator.geolocation.getCurrentPosition((p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, demo: false }), demo, { timeout: 6000, maximumAge: 60000 });
  } catch (e) { demo(); }
};

// ---- материал ----
actions['mt-demo'] = (el) => { document.getElementById('mt-code').value = el.dataset.code; };
actions['mat-add'] = (el) => {
  const code = val('mt-code').replace(/\D/g, '');
  const qty = Math.max(1, Math.round(numOf(val('mt-qty')) || 1));
  if (!/^(\d{8}|\d{12,14})$/.test(code)) { toast('Штрихкод не считан: нужно 8, 12, 13 или 14 цифр'); return; }
  if (!S.material(code)) {
    sheet({
      title: 'Нет в базе — добавьте',
      body: `<p class="small">Штрихкод ${esc(code)}. Заполните с этикетки.</p>
        ${field({ id: 'nm2-brand', label: 'Бренд', placeholder: 'Например, Marburg' })}${field({ id: 'nm2-name', label: 'Коллекция' })}
        ${select({ id: 'nm2-type', label: 'Тип', value: 'flizelin', options: WALLPAPER_TYPES.map((t) => ({ value: t.id, label: t.name })) })}
        <div class="grid-2">${field({ id: 'nm2-w', label: 'Ширина, м', value: '1,06', inputmode: 'decimal' })}${field({ id: 'nm2-l', label: 'Длина, м', value: '10,05', inputmode: 'decimal' })}</div>
        ${field({ id: 'nm2-r', label: 'Раппорт, м', value: '0', inputmode: 'decimal' })}`,
      buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Добавить', action: 'mat-new-do', data: `data-id="${el.dataset.id}" data-room="${el.dataset.room}" data-code="${code}" data-qty="${qty}"`, primary: true }],
    });
    return;
  }
  S.addRoomMaterial(el.dataset.id, el.dataset.room, code, qty);
  toast('Материал добавлен'); rerender();
};
actions['mat-new-do'] = (el) => {
  const w = numOf(val('nm2-w')); const l = numOf(val('nm2-l')); const r = numOf(val('nm2-r'));
  if (!val('nm2-brand') || !(w > 0) || !(l > 0) || !(r >= 0)) { toast('Нужны бренд, ширина, длина и раппорт'); return; }
  S.addMaterial({ barcode: el.dataset.code, brand: val('nm2-brand'), name: val('nm2-name') || 'без названия', type: val('nm2-type'), width: w, length: l, rapport: r });
  S.addRoomMaterial(el.dataset.id, el.dataset.room, el.dataset.code, Number(el.dataset.qty));
  closeSheet(); toast('Материал добавлен в базу и в комнату'); rerender();
};
actions['mat-del'] = (el) => { S.removeRoomMaterial(el.dataset.id, el.dataset.room, el.dataset.code); rerender(); };
actions['review-add'] = (el) => {
  const t = val(`rv-${el.dataset.code}`);
  if (t.length < 3) { toast('Напишите хотя бы пару слов'); return; }
  S.addReview(el.dataset.code, t); toast('Спасибо — отзыв увидят другие мастера'); rerender();
};

// ---- смета ----
actions['owall-add'] = (el) => { S.addWall(el.dataset.id, el.dataset.room, {}); rerender(); };
actions['owall-del'] = (el) => { S.removeWall(el.dataset.id, el.dataset.room, el.dataset.wall); rerender(); };
actions['tape'] = (el) => {
  const len = S.measureWall(el.dataset.id, el.dataset.room, el.dataset.wall);
  toast(`Рулетка ${DEMO_DEVICE} (демо): ${num(len)} м`);
  rerender();
};
changes['wall-len'] = (el) => { const v = numOf(el.value); S.updateWall(el.dataset.id, el.dataset.room, el.dataset.wall, { len: Number.isNaN(v) ? 0 : v }); };
changes['wall-h'] = (el) => { const v = numOf(el.value); if (v > 0) S.updateWall(el.dataset.id, el.dataset.room, el.dataset.wall, { height: v }); };
changes['op-w'] = (el) => { const v = numOf(el.value); S.updateOpening(el.dataset.id, el.dataset.room, el.dataset.wall, Number(el.dataset.i), { w: Number.isNaN(v) ? 0 : v }); };
changes['op-h'] = (el) => { const v = numOf(el.value); S.updateOpening(el.dataset.id, el.dataset.room, el.dataset.wall, Number(el.dataset.i), { h: Number.isNaN(v) ? 0 : v }); };
actions['op-add'] = (el) => { S.addOpening(el.dataset.id, el.dataset.room, el.dataset.wall, el.dataset.type); rerender(); };
actions['op-del'] = (el) => { S.removeOpening(el.dataset.id, el.dataset.room, el.dataset.wall, Number(el.dataset.i)); rerender(); };
actions['wall-svc'] = (el) => { S.toggleWallService(el.dataset.id, el.dataset.room, el.dataset.wall, el.dataset.svc); rerender(); };
actions['svc-all'] = (el) => { S.setServiceOnAllWalls(el.dataset.id, el.dataset.room, el.dataset.svc, el.dataset.on === '1'); rerender(); };

actions['smeta-send'] = (el) => {
  const o = S.order(el.dataset.id);
  const manual = o.rooms.flatMap((r) => r.walls).filter((w) => w.src !== 'device').length;
  sheet({
    title: 'Отправить смету клиенту?',
    body: `<p>Версия зафиксируется и больше не изменится. Любая правка — новая версия, её увидят все участники.</p>
      ${manual ? `<p class="small">${manual} ${manual === 1 ? 'стена введена' : 'стен введено'} вручную — такой заказ не пойдёт в рейтинг. Снимите длины рулеткой.</p>` : ''}
      <p class="small">Клиенту смету вы передаёте сами: покажите экран «Смета для клиента» или скопируйте текст.</p>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Отправить', action: 'smeta-send-do', data: `data-id="${o.id}"`, primary: true }],
  });
};
actions['smeta-send-do'] = (el) => { const v = S.sendSmeta(el.dataset.id); closeSheet(); toast(`Смета v${v.v} отправлена: ${rub(v.total)}`); rerender(); };

function smetaText(o) {
  const sm = S.lastSmeta(o) || S.smetaOf(o);
  const lines = [`Смета № ${o.no}${sm.v ? ' · версия ' + sm.v : ''}`, `${o.client.name}, ${o.client.street}, д. ${o.client.house}${o.client.flat ? ', кв. ' + o.client.flat : ''}`, ''];
  let room = '';
  sm.items.forEach((i) => {
    if (i.room !== room) { room = i.room; lines.push(room); }
    lines.push(`  ${i.name}: ${num(i.qty)} ${UNIT[i.unit]} × ${i.price} ₽ = ${Math.round(i.sum).toLocaleString('ru-RU')} ₽`);
  });
  lines.push('', `Итого: ${Math.round(sm.total).toLocaleString('ru-RU')} ₽`, `Срок: ${shiftsText(sm.hours)}`, 'Замер снят лазерной рулеткой.');
  return lines.join('\n');
}
actions['smeta-pdf'] = (el) => {
  const o = S.order(el.dataset.id);
  const sm = S.lastSmeta(o) || S.smetaOf(o);
  const lead = S.user(o.leadId);
  sheet({
    title: `Смета № ${o.no}`,
    body: `<div class="doc">
      <p class="small">${esc(o.client.name)} · ${esc(o.client.street)}, д. ${esc(o.client.house)}${o.client.flat ? ', кв. ' + esc(o.client.flat) : ''}</p>
      <table class="doc__table"><thead><tr><th>Работа</th><th>Объём</th><th>Сумма</th></tr></thead><tbody>
      ${sm.items.map((i) => `<tr><td>${esc(i.room)} · ${esc(i.name)}</td><td>${num(i.qty)} ${UNIT[i.unit]}</td><td>${rub(i.sum)}</td></tr>`).join('')}
      </tbody></table>
      ${kv('Итого', rub(sm.total), true)}${kv('Срок', shiftsText(sm.hours))}
      <p class="small">Исполнитель: ${esc(lead ? lead.name : '')}${lead ? ', ' + esc(phoneRu(lead.phone)) : ''}. Замер снят лазерной рулеткой.</p>
    </div><textarea id="smeta-copy" class="visually-hidden" readonly>${esc(smetaText(o))}</textarea>`,
    buttons: [{ label: 'Закрыть', action: 'sheet-close' }, { label: 'Скопировать текст', action: 'copy', data: 'data-src="smeta-copy"', primary: true }],
  });
};

// ---- чат и задачи ----
actions['chat-send'] = (el) => { const t = val('chat-text'); if (!t) return; S.addChat(el.dataset.id, t); rerender(); };
actions['task-open'] = (el) => {
  const o = S.order(el.dataset.id);
  const me = S.me();
  const people = participants(o);
  sheet({
    title: 'Новая задача',
    body: `${field({ id: 'tk-text', label: 'Что нужно сделать', placeholder: 'Купить клей для обоев' })}
      ${select({ id: 'tk-who', label: 'Ответственный', value: me.id, options: people.map((id) => ({ value: id, label: S.displayName(me, id, o.id) })) })}
      ${field({ id: 'tk-due', label: 'Срок', type: 'date', value: S.todayISO() })}`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Создать', action: 'task-add', data: `data-id="${o.id}"`, primary: true }],
  });
};
actions['task-add'] = (el) => {
  if (val('tk-text').length < 2) { toast('Опишите задачу'); return; }
  S.addTask(el.dataset.id, { text: val('tk-text'), assigneeId: val('tk-who'), due: val('tk-due') });
  closeSheet(); taskTab = 'open'; rerender();
};
actions['task-toggle'] = (el) => { S.toggleTask(el.dataset.id, el.dataset.task); rerender(); };

// ---- деньги ----
actions['pay-open'] = (el) => {
  sheet({
    title: 'Добавить оплату',
    body: `${field({ id: 'pay-date', label: 'Дата', type: 'date', value: S.todayISO() })}
      ${field({ id: 'pay-sum', label: 'Сумма', inputmode: 'numeric', suffix: '₽' })}
      <div class="grid-2">${select({ id: 'pay-kind', label: 'Тип', value: 'Оплата', options: ['Аванс', 'Оплата'].map((x) => ({ value: x, label: x })) })}${select({ id: 'pay-method', label: 'Способ оплаты', value: 'Перевод', options: ['Наличные', 'Перевод', 'Карта'].map((x) => ({ value: x, label: x })) })}</div>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Сохранить', action: 'pay-add', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['pay-add'] = (el) => {
  const a = Math.round(numOf(val('pay-sum')));
  if (!(a > 0)) { toast('Введите сумму'); return; }
  S.addPayment(el.dataset.id, { amount: a, kind: val('pay-kind'), method: val('pay-method'), date: val('pay-date') || S.todayISO() });
  closeSheet(); rerender();
};
actions['exp-open'] = (el) => {
  sheet({
    title: 'Новый расход',
    body: `${field({ id: 'ex-name', label: 'Название расхода', placeholder: 'Клей для обоев' })}${field({ id: 'ex-sum', label: 'Сумма', inputmode: 'numeric', suffix: '₽' })}
      ${select({ id: 'ex-cat', label: 'Категория', value: EXPENSE_CATS[0], options: EXPENSE_CATS.map((x) => ({ value: x, label: x })) })}${field({ id: 'ex-comment', label: 'Комментарий' })}`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Сохранить', action: 'exp-add', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['exp-add'] = (el) => {
  const a = Math.round(numOf(val('ex-sum')));
  if (!val('ex-name') || !(a > 0)) { toast('Нужны название и сумма'); return; }
  S.addExpense(el.dataset.id, { name: val('ex-name'), amount: a, cat: val('ex-cat'), comment: val('ex-comment'), date: S.todayISO(), by: S.me().id });
  closeSheet(); rerender();
};

// ---- статусы ----
actions['st-agree'] = (el) => { S.clientAgreed(el.dataset.id); toast('Заказ в очереди'); tab = 'schedule'; rerender(); };
actions['st-start'] = (el) => { S.startWork(el.dataset.id); rerender(); };
actions['st-finish'] = (el) => { S.finishWork(el.dataset.id); rerender(); };
actions['my-done'] = (el) => { const o = S.order(el.dataset.id); S.markRoomsDone(o.id, S.roomsFor(o, S.me()).map((r) => r.id)); toast('Отмечено: ваши комнаты выполнены'); rerender(); };
actions['close-open'] = (el) => {
  const o = S.order(el.dataset.id);
  const lead = S.user(o.leadId);
  const masters = [...new Set(o.rooms.map((r) => r.assignee).filter(Boolean))];
  const links = S.linksOf(o.id).filter((l) => l.status === 'accepted');
  const rows = links.map((l) => {
    const fact = S.factOfPrelimWorks(o, l.roomIds);
    const base = Math.max(l.base, fact);
    return kv(`${S.user(l.toId).name} → ${S.user(l.fromId).name}`, `${num(l.pct)}% от ${rub(base)} = ${rub(commissionAmount(base, l.pct))}`) + `<p class="small">Оценка ${rub(l.base)}, факт по этим работам ${rub(fact)} — берём большее.</p>`;
  }).join('');
  const checks = masters.map((m) => `<div class="well"><b>${esc(S.user(m).name)}</b>${S.checklist(o, m).map((c) => `<div class="kv"><span>${esc(c.label)}</span><b>${c.ok ? '<span class="status status--ok"><i></i>да</span>' : '<span class="status status--bad"><i></i>нет</span>'}</b></div>`).join('')}</div>`).join('');
  sheet({
    title: `Закрыть заказ № ${o.no}?`,
    body: `${rows ? `<h3 class="plate__title">Итоговые комиссии</h3>${rows}` : '<p class="small">Заказ без партнёров — комиссий нет.</p>'}
      <h3 class="plate__title">Метры в рейтинг</h3>${checks || '<p class="small">Нет мастеров по комнатам</p>'}
      <p class="small">Если какое-то условие не выполнено, метры этого мастера в рейтинг не пойдут.${lead && S.hasRole(lead, 'dispatcher') ? '' : ''}</p>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Закрыть заказ', action: 'close-do', data: `data-id="${o.id}"`, primary: true }],
  });
};
actions['close-do'] = (el) => { S.closeOrder(el.dataset.id); closeSheet(); toast('Заказ закрыт'); tab = 'history'; rerender(); };
actions['cancel-open'] = (el) => {
  sheet({
    title: 'Клиент отказался?',
    body: `${field({ id: 'cancel-reason', label: 'Причина', placeholder: 'Например, передумал делать ремонт' })}<p class="small">По отмене из-за клиента никто никому не платит: ориентировочные комиссии отменяются.</p>`,
    buttons: [{ label: 'Назад', action: 'sheet-close' }, { label: 'Отменить заказ', action: 'cancel-do', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['cancel-do'] = (el) => { S.cancelOrder(el.dataset.id, val('cancel-reason')); closeSheet(); rerender(); };
actions['trash-do'] = (el) => { S.trashOrder(el.dataset.id); toast('Заказ в корзине'); go('orders'); };

actions['refuse-open'] = (el) => {
  const l = S.link(el.dataset.id);
  const me = S.me();
  const p = S.previewPenalty(l.id);
  const isDispatcherLead = S.hasRole(me, 'dispatcher') && S.order(l.orderId).leadId === me.id;
  sheet({
    title: 'Отказаться от заказа?',
    body: `<p>До приезда: ${p.days > 0 ? `${p.days} дн.` : 'меньше суток'}<br>Правило: ${esc(p.rule)}</p>
      <div class="well">${kv('Неустойка', rub(p.amount), true)}${kv('Кому', esc(S.displayName(me, l.fromId, l.orderId)))}</div>
      ${isDispatcherLead ? '<p class="small">Вы диспетчер: если мастер отказался, сначала попробуйте найти замену в блоке «Мастера» — тогда платить не придётся.</p>' : ''}
      <p class="small">Неустойка попадёт в начисления. Деньги переводятся напрямую, вне приложения.</p>`,
    buttons: [{ label: 'Не отказываться', action: 'sheet-close' }, { label: 'Отказаться', action: 'refuse-do', data: `data-id="${l.id}"`, primary: true }],
  });
};
actions['refuse-do'] = (el) => {
  const l = S.link(el.dataset.id);
  const p = S.refuseLink(l.id);
  closeSheet();
  toast(`Отказ оформлен, неустойка ${rub(p.amount)}`);
  go('orders');
};

// ---- диспетчер ----
actions['assign-open'] = (el) => {
  const o = S.order(el.dataset.id);
  const me = S.me();
  const team = [me, ...S.teamOf(me.id)];
  const free = o.rooms.filter((r) => !r.pendingFor && (!r.assignee || r.assignee === me.id));
  const date = (free.find((r) => r.start) || {}).start || (o.arrival || '').slice(0, 10) || S.todayISO();
  sheet({
    title: 'Передать мастеру',
    body: `${select({ id: 'as-master', label: 'Мастер', value: team[1] ? team[1].id : me.id, options: team.map((u) => ({ value: u.id, label: u.id === me.id ? `${u.name} (сам)` : `${u.name} · ${S.ratingOf(u.id).toLocaleString('ru-RU')} м²` })) })}
      ${o.rooms.length ? `<div class="field"><span class="field__label">Комнаты</span><div class="chips">${free.map((r) => `<label class="chip-check"><input type="checkbox" name="as-room" value="${r.id}" checked/> <span>${esc(r.name)} · ${r.floor} эт.</span></label>`).join('')}</div>
        <p class="small">Большой заказ можно разделить: каждому мастеру — свои комнаты.</p></div>` : '<p class="small">Комнат нет — передаётся весь заказ.</p>'}
      <div class="grid-2">${field({ id: 'as-date', label: 'Дата', type: 'date', value: date })}${field({ id: 'as-time', label: 'Время', type: 'time', value: '09:00' })}</div>
      ${field({ id: 'as-pct', label: 'Ваш процент', value: '5', inputmode: 'decimal', suffix: '%' })}
      <p class="small">Мастер платит процент вам. Агенту вы платите свой — это вас с мастером не касается.</p>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Передать', action: 'assign-do', data: `data-id="${o.id}"`, primary: true }],
  });
};
actions['assign-do'] = (el) => {
  const o = S.order(el.dataset.id);
  const me = S.me();
  const pct = numOf(val('as-pct'));
  const master = val('as-master');
  const roomIds = o.rooms.length ? [...document.querySelectorAll('input[name="as-room"]:checked')].map((x) => x.value) : null;
  if (roomIds && !roomIds.length) { toast('Отметьте комнаты'); return; }
  if (!val('as-date')) { toast('Выберите дату'); return; }
  const arrival = `${val('as-date')}T${val('as-time') || '09:00'}`;
  if (master === me.id) {
    S.takeRooms(o.id, roomIds);
    closeSheet(); toast('Комнаты за вами'); rerender();
    return;
  }
  if (!(pct >= 0 && pct <= 50)) { toast('Процент — от 0 до 50'); return; }
  S.assignToMaster(o.id, master, roomIds, arrival, pct);
  closeSheet(); toast('Предложение отправлено мастеру'); rerender();
};
actions['giveup-open'] = (el) => {
  const o = S.order(el.dataset.id);
  const up = S.upstreamLink(o);
  const p = S.previewPenalty(up.id);
  sheet({
    title: 'Замену не нашли?',
    body: `<p>Заказ вернётся агенту, вы заплатите неустойку: ${esc(p.rule)}.</p><div class="well">${kv('Неустойка агенту', rub(p.amount), true)}</div>
      <p class="small">Если агент сам найдёт замену, неустойка станет 700 ₽.</p>`,
    buttons: [{ label: 'Ещё поищу', action: 'sheet-close' }, { label: 'Закрыть заказ', action: 'giveup-do', data: `data-id="${o.id}"`, primary: true }],
  });
};
actions['giveup-do'] = (el) => { S.dispatcherGiveUp(el.dataset.id); closeSheet(); toast('Заказ возвращён агенту'); go('orders'); };

export { smetaText, penaltyRule };
