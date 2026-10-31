// Состояние прототипа и действия над ним.
// Данные хранятся только в этом браузере (localStorage). Это тестовая среда, а не сервер.

import { makeSeed, SYSTEM_PRICE } from './seed.js';
import { commissionAmount, penalty } from './calc.js';

const KEY = 'metronika-prototype-v1';
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 1) return s;
    }
  } catch (e) { /* хранилище недоступно — работаем в памяти */ }
  return makeSeed();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* без сохранения */ }
}

export function resetDemo() {
  state = makeSeed();
  save();
}

export const get = () => state;

export const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const nowStamp = () => new Date().toISOString();
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const arrivalRu = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS_GEN[Number(iso.slice(5, 7)) - 1]}, ${iso.slice(11, 16)}`;

// ---------- люди ----------
export const user = (id) => state.users.find((u) => u.id === id);
export const me = () => user(state.session.userId);
export const findByPhone = (digits) => state.users.find((u) => u.phone === digits);

export function setSession(userId) {
  state.session.userId = userId;
  save();
}

export function setPin(userId, pin) {
  state.session.pins[userId] = pin;
  save();
}
export const pinOf = (userId) => state.session.pins[userId];

export function register({ name, phone, role }) {
  const id = 'u-' + Math.random().toString(36).slice(2, 8);
  const roles = role === 'dispatcher' ? ['dispatcher', 'master'] : [role];
  const u = { id, phone, name, roles, rating: 0, busy: [] };
  if (role === 'agent') u.agent = { kind: 'Продавец', shop: '', promo: '', plan: 'free' };
  else u.price = { ...SYSTEM_PRICE };
  state.users.push(u);
  save();
  return u;
}

export const hasRole = (u, r) => !!u && u.roles.includes(r);

// Партнёры агента: мастера и диспетчеры, с которыми он связан.
export function partnersOf(agentId) {
  return state.partnerships
    .filter((p) => p.agentId === agentId && p.status === 'active')
    .map((p) => user(p.partnerId))
    .filter(Boolean);
}

export function partnerLimit(agent) {
  return agent.agent && agent.agent.plan === 'sub' ? 3 : 1;
}

// Свободные даты исполнителя на две недели вперёд.
export function freeDates(partner, days = 14) {
  const out = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = 1; i <= days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const p = (n) => String(n).padStart(2, '0');
    const iso = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    const busy = (partner.busy || []).includes(iso) || isTaken(partner.id, iso);
    out.push({ iso, busy, weekday: d.getDay() });
  }
  return out;
}

function isTaken(partnerId, iso) {
  return state.links.some((l) => l.toId === partnerId && ['proposed', 'accepted'].includes(l.status) && l.arrival.slice(0, 10) === iso);
}

// ---------- материалы ----------
export const material = (barcode) => state.materials.find((m) => m.barcode === barcode);

export function addMaterial(m) {
  const exists = material(m.barcode);
  if (exists) return exists;
  const rec = { ...m, source: 'user', status: 'user' };
  state.materials.push(rec);
  save();
  return rec;
}

// ---------- заказы ----------
export const order = (id) => state.orders.find((o) => o.id === id);
export const linksOf = (orderId) => state.links.filter((l) => l.orderId === orderId);
export const activeLink = (orderId) => linksOf(orderId).filter((l) => l.status !== 'declined' && l.status !== 'refused' && l.status !== 'cancelled').slice(-1)[0];
export const settlementsOfLink = (linkId) => state.settlements.filter((s) => s.linkId === linkId);
export const eventsOf = (orderId) => state.events.filter((e) => e.orderId === orderId).slice().reverse();

function logEvent(orderId, actorId, role, action, detail = '') {
  state.events.push({ orderId, actorId, role, action, detail, at: nowStamp() });
}

const normPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const normAddr = (c) => [c.street, c.house, c.flat].map((v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ')).join('|');

// Правило дублей: комиссия тому, кто отправил заказ первым.
export function findDuplicate(client) {
  const phone = normPhone(client.phone);
  const addr = normAddr(client);
  return state.orders.find((o) => o.status !== 'cancelled' && !o.duplicateOf &&
    normPhone(o.client.phone) === phone && normAddr(o.client) === addr);
}

export function priceFor(partnerOrNull, type) {
  if (partnerOrNull && partnerOrNull.price) return partnerOrNull.price[type];
  return SYSTEM_PRICE[type];
}

// Агент передаёт заказ исполнителю.
export function createAgentOrder(draft) {
  const agent = me();
  const partner = user(draft.partnerId);
  const dup = findDuplicate(draft.client);
  const no = state.nextOrderNo++;
  const id = 'o-' + no;
  const price = priceFor(partner, draft.material.type);
  const prelimBase = Math.round(draft.areaMid * price);
  const o = {
    id, no, createdAt: nowStamp(), createdBy: agent.id,
    status: 'offered',
    channel: draft.channel,
    client: { ...draft.client },
    prelim: {
      authorId: agent.id, mode: draft.mode, barcode: draft.material.barcode, rolls: draft.rolls,
      height: draft.height, walls: draft.walls || null, openings: draft.openings || null,
      areaMin: draft.areaMin, areaMax: draft.areaMax, areaMid: draft.areaMid,
      pricePerM2: price, priceOwner: partner ? partner.id : 'system', base: prelimBase,
    },
    duplicateOf: dup ? dup.id : null,
  };
  state.orders.push(o);
  const link = {
    id: 'l-' + no + '-1', orderId: id, fromId: agent.id, toId: partner.id,
    pct: draft.pct, arrival: draft.arrival, status: 'proposed', createdAt: nowStamp(),
  };
  state.links.push(link);
  if (!dup) {
    state.settlements.push({
      id: 's-' + no + '-1', linkId: link.id, orderId: id, type: 'commission',
      payerId: partner.id, payeeId: agent.id, base: prelimBase, pct: draft.pct,
      amount: commissionAmount(prelimBase, draft.pct), status: 'estimate',
    });
  }
  logEvent(id, agent.id, 'agent', 'Создан заказ', `№ ${no}, предварительная стоимость ${prelimBase.toLocaleString('ru-RU')} ₽`);
  logEvent(id, agent.id, 'agent', 'Заказ передан', `${partner.name}, ${draft.pct}%`);
  if (dup) logEvent(id, agent.id, 'agent', 'Найден дубль', `Клиент уже передан в заказе № ${dup.no} — комиссия тому, кто отправил первым`);
  save();
  return o;
}

export function acceptLink(linkId) {
  const l = state.links.find((x) => x.id === linkId);
  const u = me();
  l.status = 'accepted';
  l.acceptedAt = nowStamp();
  const o = order(l.orderId);
  o.status = 'accepted';
  logEvent(o.id, u.id, roleLabelKey(u), 'Заказ принят', `процент ${l.pct}% зафиксирован, приезд ${arrivalRu(l.arrival)}`);
  save();
}

export function declineLink(linkId) {
  const l = state.links.find((x) => x.id === linkId);
  const u = me();
  l.status = 'declined';
  const o = order(l.orderId);
  o.status = 'declined';
  state.settlements.filter((s) => s.linkId === l.id).forEach((s) => { s.status = 'cancelled'; });
  logEvent(o.id, u.id, roleLabelKey(u), 'Предложение отклонено', 'без неустойки: заказ ещё не был принят');
  save();
}

// Отказ от уже принятого заказа: неустойка тому, у кого взяли заказ.
export function refuseLink(linkId) {
  const l = state.links.find((x) => x.id === linkId);
  const u = me();
  const est = state.settlements.find((s) => s.linkId === l.id && s.type === 'commission');
  const prelimCommission = est ? est.amount : 0;
  const p = penalty(prelimCommission, todayISO(), l.arrival);
  l.status = 'refused';
  l.refusedAt = nowStamp();
  if (est) est.status = 'cancelled';
  state.settlements.push({
    id: 's-' + l.id + '-pen', linkId: l.id, orderId: l.orderId, type: 'penalty',
    payerId: l.toId, payeeId: l.fromId, base: prelimCommission, rule: p.rule, amount: p.amount, status: 'due',
  });
  const o = order(l.orderId);
  o.status = 'failed';
  logEvent(o.id, u.id, roleLabelKey(u), 'Отказ от заказа', `неустойка ${p.amount} ₽ (${p.rule})`);
  save();
  return p;
}

export function previewPenalty(linkId) {
  const l = state.links.find((x) => x.id === linkId);
  const est = state.settlements.find((s) => s.linkId === l.id && s.type === 'commission');
  return penalty(est ? est.amount : 0, todayISO(), l.arrival);
}

// Агент передаёт отклонённый или сорванный заказ другому исполнителю.
export function resendOrder(orderId, partnerId, arrival, pct) {
  const o = order(orderId);
  const agent = me();
  const partner = user(partnerId);
  const n = linksOf(orderId).length + 1;
  const price = priceFor(partner, o.prelim ? materialType(o) : 'flizelin');
  o.prelim.pricePerM2 = price;
  o.prelim.priceOwner = partner.id;
  o.prelim.base = Math.round(o.prelim.areaMid * price);
  const link = { id: `l-${o.no}-${n}`, orderId, fromId: agent.id, toId: partnerId, pct, arrival, status: 'proposed', createdAt: nowStamp() };
  state.links.push(link);
  if (!o.duplicateOf) {
    state.settlements.push({
      id: `s-${o.no}-${n}`, linkId: link.id, orderId, type: 'commission', payerId: partnerId, payeeId: agent.id,
      base: o.prelim.base, pct, amount: commissionAmount(o.prelim.base, pct), status: 'estimate',
    });
  }
  o.status = 'offered';
  logEvent(orderId, agent.id, 'agent', 'Заказ передан повторно', `${partner.name}, ${pct}%`);
  save();
}

export function materialType(o) {
  const m = material(o.prelim.barcode);
  return m ? m.type : 'flizelin';
}

export function markPaid(settlementId) {
  const s = state.settlements.find((x) => x.id === settlementId);
  s.status = 'paid';
  save();
}
export function markReceived(settlementId) {
  const s = state.settlements.find((x) => x.id === settlementId);
  s.status = 'received';
  save();
}

function roleLabelKey(u) {
  if (u.roles.includes('agent')) return 'agent';
  if (u.roles.includes('dispatcher')) return 'dispatcher';
  return 'master';
}

export const ROLE_NAMES = { agent: 'Агент', dispatcher: 'Диспетчер', master: 'Мастер' };

// Как показать участника тому, кто смотрит. Мастер, получивший заказ от диспетчера, агента не видит.
export function displayName(viewer, personId, orderId) {
  if (!viewer || viewer.id === personId) return 'Вы';
  const person = user(personId);
  if (!person) return '—';
  if (orderId && hasRole(person, 'agent') && !viewerTalksToAgentDirectly(viewer.id, personId, orderId)) {
    return 'Контролёр';
  }
  return person.name;
}

function viewerTalksToAgentDirectly(viewerId, agentId, orderId) {
  return linksOf(orderId).some((l) => (l.fromId === agentId && l.toId === viewerId) || (l.toId === agentId && l.fromId === viewerId));
}
