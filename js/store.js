// Данные прототипа и все действия над ними. Хранятся только в этом браузере (localStorage).
// Модель повторяет «Скелет системы»: заказ → звенья передачи → начисления; комнаты → стены → смета.

import { makeSeed, SYSTEM_PRICE, SERVICES, defaultSettings, isoDay, DEMO_DEVICE } from './seed.js?v=32';
import { commissionAmount, penalty, wallArea, serviceQtyFromWalls, hoursFor, finalCommissionBase, REPLACEMENT_FOUND_FEE, round2 } from './calc.js?v=32';

const KEY = 'metronika-prototype-v2';
let state;
state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === 2) return s;
    }
  } catch (e) { /* хранилище недоступно — работаем в памяти */ }
  return freshState();
}

function freshState() {
  const s = makeSeed();
  state = s;
  // Демо-заказам Сергея нужны готовые сметы и платежи, посчитанные теми же функциями, что и живые.
  const o1031 = s.orders.find((o) => o.id === 'o-1031');
  pushSmetaVersion(o1031, isoStamp(-6, 14));
  const o1027 = s.orders.find((o) => o.id === 'o-1027');
  pushSmetaVersion(o1027, isoStamp(-21, 12));
  const total = o1027.smeta[0].total;
  o1027.payments[1].amount = total - o1027.payments[0].amount;
  s.credits[0].m2 = pasteQty(o1027, null);
  s.events.find((e) => e.orderId === 'o-1027' && e.action === 'Заказ закрыт').detail = `В рейтинг зачтено ${String(s.credits[0].m2).replace('.', ',')} м²`;
  return s;
}

function isoStamp(dayOffset, hh) {
  return new Date(`${isoDay(dayOffset)}T${String(hh).padStart(2, '0')}:00:00`).toISOString();
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* без сохранения */ }
}
export function resetDemo() { state = freshState(); save(); }
export const get = () => state;

const p2 = (n) => String(n).padStart(2, '0');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
export const nowLocal = () => { const d = new Date(); return `${todayISO()}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const nowStamp = () => new Date().toISOString();
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dateWords = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS_GEN[Number(iso.slice(5, 7)) - 1]}${iso.length > 10 ? ', ' + iso.slice(11, 16) : ''}`;
const rubText = (n) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;

// ================= люди =================
export const user = (id) => state.users.find((u) => u.id === id);
export const me = () => user(state.session.userId);
export const findByPhone = (digits) => state.users.find((u) => u.phone === digits);
export const hasRole = (u, r) => !!u && u.roles.includes(r);
export const ROLE_NAMES = { agent: 'Агент', dispatcher: 'Диспетчер', master: 'Мастер' };

export function setSession(userId) { state.session.userId = userId; save(); }
export function setPin(userId, pin) { state.session.pins[userId] = pin; save(); }
export const pinOf = (userId) => state.session.pins[userId];

export function register({ name, phone, role }) {
  const id = uid('u-');
  const roles = role === 'dispatcher' ? ['dispatcher', 'master'] : [role];
  const u = { id, phone, name, roles, ratingBase: 0, busy: [], settings: defaultSettings() };
  if (role === 'agent') u.agent = { kind: 'Продавец', shop: '', promo: '', plan: 'free' };
  else u.price = { ...SYSTEM_PRICE };
  if (role === 'dispatcher') u.plan = { seats: 3 };
  state.users.push(u);
  save();
  return u;
}

export function updateProfile(fields) { Object.assign(me(), fields); save(); }

export const ratingOf = (userId) => round2((user(userId)?.ratingBase || 0) + state.credits.filter((c) => c.masterId === userId).reduce((s, c) => s + c.m2, 0));

// ================= сеть =================
export function partnersOf(agentId) {
  return state.partnerships.filter((p) => p.agentId === agentId && p.status === 'active').map((p) => user(p.partnerId)).filter(Boolean);
}
export const partnerLimit = (agent) => (agent.agent && agent.agent.plan === 'sub' ? 3 : 1);

export function addPartner(phone) {
  const agent = me();
  const p = findByPhone(phone);
  if (!p) return 'Пользователь с таким номером не найден';
  if (hasRole(p, 'agent')) return 'Партнёром может быть только мастер или диспетчер';
  if (partnersOf(agent.id).some((x) => x.id === p.id)) return 'Этот партнёр уже добавлен';
  const list = partnersOf(agent.id);
  const limit = partnerLimit(agent);
  if (list.length >= limit) return agent.agent.plan === 'sub' ? 'По подписке — не больше 3 партнёров. Больше мастеров — через диспетчера' : 'Бесплатно — один мастер. Для диспетчеров и до 3 партнёров нужна подписка';
  if (agent.agent.plan !== 'sub' && hasRole(p, 'dispatcher')) return 'Работа с диспетчерами — по подписке';
  state.partnerships.push({ agentId: agent.id, partnerId: p.id, status: 'active' });
  save();
  return '';
}
export function removePartner(partnerId) {
  const agent = me();
  const rec = state.partnerships.find((x) => x.agentId === agent.id && x.partnerId === partnerId && x.status === 'active');
  if (rec) rec.status = 'ended';
  save();
}
export function setAgentPlan(plan) { me().agent.plan = plan; save(); }

export const teamOf = (dispatcherId) => state.team.filter((t) => t.dispatcherId === dispatcherId && t.status === 'active').map((t) => user(t.masterId)).filter(Boolean);
export const dispatchersOf = (masterId) => state.team.filter((t) => t.masterId === masterId && t.status === 'active').map((t) => user(t.dispatcherId));

export function inviteMaster(phone) {
  const d = me();
  const m = findByPhone(phone);
  if (!m) return 'Мастер с таким номером не найден. Пусть сначала зарегистрируется';
  if (!hasRole(m, 'master')) return 'В команду можно добавить только мастера';
  if (m.id === d.id) return 'Вы уже работаете сами как мастер';
  if (teamOf(d.id).some((x) => x.id === m.id)) return 'Этот мастер уже в команде';
  const seats = (d.plan && d.plan.seats) || 0;
  if (teamOf(d.id).length >= seats) return `В подписке ${seats} мест за мастеров — добавьте место`;
  state.team.push({ dispatcherId: d.id, masterId: m.id, status: 'active', since: todayISO() });
  save();
  return '';
}
export function removeFromTeam(masterId) {
  const rec = state.team.find((t) => t.dispatcherId === me().id && t.masterId === masterId && t.status === 'active');
  if (rec) { rec.status = 'left'; rec.until = todayISO(); }
  save();
}
export function addSeat() { const d = me(); d.plan = d.plan || { seats: 0 }; d.plan.seats += 1; save(); }

// Свободные даты: выходные по графику работы, отмеченные занятые дни и уже взятые выезды.
export function freeDates(person, days = 14) {
  const out = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const workdays = (person.settings && person.settings.workdays) || [1, 2, 3, 4, 5, 6];
  for (let i = 1; i <= days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const off = !workdays.includes(d.getDay());
    const busy = off || (person.busy || []).includes(iso) || isTaken(person.id, iso);
    out.push({ iso, busy, off, weekday: d.getDay() });
  }
  return out;
}
function isTaken(personId, iso) {
  return state.links.some((l) => l.toId === personId && ['proposed', 'accepted'].includes(l.status) && l.arrival.slice(0, 10) === iso)
    || state.orders.some((o) => !['closed', 'cancelled', 'failed', 'declined'].includes(o.status) && (o.visits || []).some((v) => v.masterId === personId && v.date === iso));
}

// ================= материалы =================
export const material = (barcode) => state.materials.find((m) => m.barcode === barcode);
export function addMaterial(m) {
  const exists = material(m.barcode);
  if (exists) return exists;
  const rec = { ...m, source: 'user', status: 'user', addedBy: me()?.id };
  state.materials.push(rec);
  save();
  return rec;
}
export const reviewsOf = (barcode) => state.reviews.filter((r) => r.barcode === barcode).slice().reverse();
export function addReview(barcode, text) { state.reviews.push({ barcode, authorId: me().id, text, at: nowStamp() }); save(); }

// ================= цены =================
export function priceSnapshotFor(userId) {
  const u = user(userId);
  const types = { ...(u && u.price ? u.price : SYSTEM_PRICE) };
  const svc = JSON.parse(JSON.stringify((u && u.settings && u.settings.services) || defaultSettings().services));
  return { types, svc };
}
export function priceFor(partnerOrNull, type) {
  if (partnerOrNull && partnerOrNull.price) return partnerOrNull.price[type];
  return SYSTEM_PRICE[type];
}
export function svcInfo(o, svcId) {
  const def = SERVICES.find((s) => s.id === svcId);
  if (svcId === 'paste') return { ...def, price: (o.priceSnap && o.priceSnap.types[o.materialType]) || SYSTEM_PRICE[o.materialType] || 350 };
  const s = (o.priceSnap && o.priceSnap.svc[svcId]) || { price: def.price, norm: def.norm };
  return { ...def, price: s.price, norm: s.norm };
}

// ================= заказы: чтение =================
export const order = (id) => state.orders.find((o) => o.id === id);
export const linksOf = (orderId) => state.links.filter((l) => l.orderId === orderId);
export const link = (id) => state.links.find((l) => l.id === id);
export const settlementsOfLink = (linkId) => state.settlements.filter((s) => s.linkId === linkId);
export const eventsOf = (orderId) => state.events.filter((e) => e.orderId === orderId).slice().reverse();
export const activeLink = (orderId) => linksOf(orderId).filter((l) => !['declined', 'refused'].includes(l.status)).slice(-1)[0];
export const upstreamLink = (o) => linksOf(o.id).find((l) => l.toId === o.leadId && l.status === 'accepted');

function logEvent(orderId, actorId, role, action, detail = '') {
  state.events.push({ orderId, actorId, role, action, detail, at: nowStamp() });
}
const roleKey = (u) => (hasRole(u, 'agent') ? 'agent' : hasRole(u, 'dispatcher') ? 'dispatcher' : 'master');

// Комнаты, которые ведёт этот человек: ведущий видит все, мастер от диспетчера — свои.
export const wholeLinkOf = (o, viewerId) => linksOf(o.id).find((l) => l.toId === viewerId && l.fromId === o.leadId && !l.roomIds && ['accepted', 'done'].includes(l.status));
export function roomsFor(o, viewer) {
  if (!viewer || viewer.id === o.leadId || hasRole(viewer, 'agent') || wholeLinkOf(o, viewer.id)) return o.rooms;
  return o.rooms.filter((r) => r.assignee === viewer.id);
}
export const roomIdsOf = (o, viewer) => roomsFor(o, viewer).map((r) => r.id);

// Какие работы считаются «из предварительной оценки» — от них считается комиссия.
export function prelimSet(o) {
  if (o.prelim) return new Set(['paste']);
  const s = new Set();
  o.rooms.forEach((r) => r.est.forEach((e) => s.add(e.svc)));
  return s;
}

export function estimateOf(o, roomIds = null) {
  const rooms = o.rooms.filter((r) => !roomIds || roomIds.includes(r.id));
  let total = 0; let hours = 0;
  const perRoom = rooms.map((r) => {
    const lines = r.est.map((e) => {
      const s = svcInfo(o, e.svc);
      const sum = Math.round(e.qty * s.price);
      const h = hoursFor(e.qty, s.norm);
      return { ...e, name: s.name, unit: s.unit, price: s.price, sum, hours: h };
    });
    const rt = lines.reduce((a, x) => a + x.sum, 0);
    const rh = lines.reduce((a, x) => a + x.hours, 0);
    total += rt; hours += rh;
    return { room: r, lines, total: rt, hours: rh };
  });
  return { perRoom, total, hours };
}

// Смета «вживую» из стен: объёмы по услугам, отмеченным на стенах.
export function smetaOf(o, roomIds = null) {
  const pre = prelimSet(o);
  const rooms = o.rooms.filter((r) => !roomIds || roomIds.includes(r.id));
  const items = [];
  rooms.forEach((r) => {
    const used = [...new Set(r.walls.flatMap((w) => w.services || []))];
    SERVICES.filter((s) => used.includes(s.id)).forEach((def) => {
      const s = svcInfo(o, def.id);
      const qty = serviceQtyFromWalls(r.walls, def.id, def.unit);
      if (!qty) return;
      items.push({ roomId: r.id, room: r.name, svc: def.id, name: s.name, unit: def.unit, qty, price: s.price, sum: Math.round(qty * s.price), hours: hoursFor(qty, s.norm), fromPrelim: pre.has(def.id) });
    });
  });
  return { items, total: items.reduce((a, x) => a + x.sum, 0), hours: items.reduce((a, x) => a + x.hours, 0) };
}
export const lastSmeta = (o) => (o.smeta && o.smeta.length ? o.smeta[o.smeta.length - 1] : null);

function pasteQty(o, roomIds) {
  return round2(o.rooms.filter((r) => !roomIds || roomIds.includes(r.id)).reduce((s, r) => s + serviceQtyFromWalls(r.walls, 'paste', 'm2'), 0));
}
export const wallsAreaOf = (room) => round2(room.walls.reduce((s, w) => s + wallArea(w), 0));

// Факт по работам из оценки — для итоговой комиссии.
export function factOfPrelimWorks(o, roomIds) {
  const sm = lastSmeta(o) || smetaOf(o);
  return sm.items.filter((i) => i.fromPrelim && (!roomIds || roomIds.includes(i.roomId))).reduce((a, i) => a + i.sum, 0);
}

// Что нужно для зачёта метров в рейтинг.
export function checklist(o, masterId = null) {
  const rooms = o.rooms.filter((r) => !masterId || r.assignee === masterId);
  const walls = rooms.flatMap((r) => r.walls);
  const visits = (o.visits || []).filter((v) => !masterId || v.masterId === masterId || v.type === 'measure');
  const c = o.client;
  return [
    { key: 'client', label: 'Заказ заполнен: клиент, комнаты, график', ok: !!(c.name && c.phone && c.street && c.house) && rooms.length > 0 && rooms.every((r) => r.start) },
    { key: 'geo-measure', label: 'Геоотметка на замере', ok: visits.some((v) => v.type === 'measure' && v.geo) },
    { key: 'geo-work', label: 'Геоотметка на работах', ok: visits.some((v) => v.type === 'work' && v.geo) },
    { key: 'device', label: 'Замер снят рулеткой', ok: walls.length > 0 && walls.every((w) => w.src === 'device') },
    { key: 'smeta', label: 'Смета собрана из замера и отправлена', ok: (o.smeta || []).length > 0 },
  ];
}

// Какие заказы видит исполнитель: свои, переданные ему и те, где ему дали комнаты.
export function ordersForPro(viewer) {
  return state.orders.filter((o) => !o.trashed && (o.leadId === viewer.id || state.links.some((l) => l.orderId === o.id && l.toId === viewer.id && l.status === 'accepted')));
}
export const trashFor = (viewer) => state.orders.filter((o) => o.trashed && o.createdBy === viewer.id);

// ================= дубли =================
const normPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const normAddr = (c) => [c.street, c.house, c.flat].map((v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
export function findDuplicate(client, exceptId = null) {
  const phone = normPhone(client.phone);
  const addr = normAddr(client);
  return state.orders.find((o) => o.id !== exceptId && !['cancelled'].includes(o.status) && !o.duplicateOf && !o.trashed
    && normPhone(o.client.phone) === phone && normAddr(o.client) === addr);
}

// ================= создание заказов =================
function baseOrder(fields) {
  return { rooms: [], visits: [], smeta: [], chat: [], tasks: [], payments: [], expenses: [], trashed: false, duplicateOf: null, ...fields };
}

// Агент передаёт заказ партнёру.
export function createAgentOrder(d) {
  const agent = me();
  const partner = user(d.partnerId);
  const dup = findDuplicate(d.client);
  const no = state.nextOrderNo++;
  const id = 'o-' + no;
  const price = priceFor(partner, d.material.type);
  const prelimBase = Math.round(d.areaMid * price);
  const o = baseOrder({
    id, no, createdAt: nowStamp(), createdBy: agent.id, leadId: null, status: 'offered',
    channel: { source: 'Партнёр', detail: d.channel === 'card' ? 'Визитка (промокод)' : 'Торговая точка', url: '' },
    client: { ...d.client }, arrival: d.arrival, materialType: d.material.type, priceOwnerId: partner.id, priceSnap: null,
    prelim: {
      authorId: agent.id, mode: d.mode, barcode: d.material.barcode, rolls: d.rolls, height: d.height, walls: d.walls || null, openings: d.openings || null,
      areaMin: d.areaMin, areaMax: d.areaMax, areaMid: d.areaMid, pricePerM2: price, priceOwner: partner.id, base: prelimBase,
    },
    duplicateOf: dup ? dup.id : null,
  });
  state.orders.push(o);
  newLink(o, agent.id, partner.id, d.pct, d.arrival, null, prelimBase, !dup);
  logEvent(id, agent.id, 'agent', 'Создан заказ', `№ ${no}, предварительная стоимость ${rubText(prelimBase)}`);
  logEvent(id, agent.id, 'agent', 'Заказ передан', `${partner.name}, ${d.pct}%`);
  if (dup) logEvent(id, agent.id, 'agent', 'Найден дубль', `Клиент уже передан в заказе № ${dup.no} — комиссия тому, кто отправил первым`);
  save();
  return o;
}

function newLink(o, fromId, toId, pct, arrival, roomIds, base, withCommission = true) {
  const n = linksOf(o.id).length + 1;
  const l = { id: `l-${o.no}-${n}`, orderId: o.id, fromId, toId, pct, arrival, roomIds, base, status: 'proposed', createdAt: nowStamp() };
  state.links.push(l);
  if (withCommission) {
    state.settlements.push({ id: `s-${o.no}-${n}`, linkId: l.id, orderId: o.id, type: 'commission', payerId: toId, payeeId: fromId, base, pct, amount: commissionAmount(base, pct), status: 'estimate' });
  }
  return l;
}

// Мастер или диспетчер заводит свой заказ (Авито, сайт, рекомендация…).
export function createOwnOrder(d) {
  const u = me();
  const no = state.nextOrderNo++;
  const id = 'o-' + no;
  const rooms = d.rooms.map((r, i) => ({ id: 'r' + (i + 1), floor: r.floor, name: r.name, est: r.est.filter((e) => e.qty > 0), walls: [], materials: [], start: '', end: '', assignee: u.id, done: false }));
  const status = d.branch === 'measure' ? 'measure' : d.branch === 'queue' ? 'queue' : 'approval';
  const o = baseOrder({
    id, no, createdAt: nowStamp(), createdBy: u.id, leadId: u.id, status,
    channel: { source: d.source, detail: d.detail || '', url: d.url || '' }, client: { ...d.client },
    arrival: d.date ? `${d.date}T${d.time || '10:00'}` : '', materialType: d.materialType || 'flizelin', priceOwnerId: u.id, priceSnap: priceSnapshotFor(u.id),
    prelim: null, rooms, duplicateOf: (findDuplicate(d.client) || {}).id || null,
  });
  if (d.branch === 'measure' && d.date) o.visits.push({ id: uid('v'), type: 'measure', date: d.date, time: d.time || '10:00', roomIds: null, masterId: u.id, geo: null });
  state.orders.push(o);
  const est = estimateOf(o);
  logEvent(id, u.id, roleKey(u), 'Создан заказ', `Источник: ${d.source}. Оценка ${rubText(est.total)}`);
  logEvent(id, u.id, roleKey(u), status === 'measure' ? 'Записан на замер' : status === 'queue' ? 'Поставлен в очередь' : 'Отправлен на согласование', d.date ? dateWords(`${d.date}T${d.time || '10:00'}`) : '');
  save();
  return o;
}

// ================= звенья =================
export function acceptLink(linkId) {
  const l = link(linkId);
  const u = me();
  const o = order(l.orderId);
  l.status = 'accepted';
  l.acceptedAt = nowStamp();
  if (!o.leadId || hasRole(user(l.fromId), 'agent')) {
    // Принял заказ от агента — становится ведущим, цены фиксируются по его прайсу.
    o.leadId = u.id;
    o.priceOwnerId = u.id;
    o.priceSnap = priceSnapshotFor(u.id);
    o.status = 'measure';
    if (!o.visits.some((v) => v.type === 'measure')) o.visits.push({ id: uid('v'), type: 'measure', date: l.arrival.slice(0, 10), time: l.arrival.slice(11, 16), roomIds: null, masterId: u.id, geo: null });
  } else {
    // Мастер принял комнаты от диспетчера.
    (l.roomIds ? o.rooms.filter((r) => l.roomIds.includes(r.id)) : o.rooms).forEach((r) => { r.assignee = u.id; r.pendingFor = null; });
    o.searching = o.rooms.some((r) => !r.assignee && !r.pendingFor);
    if (!l.roomIds) o.visits.filter((v) => v.type === 'measure' && !v.geo).forEach((v) => { v.masterId = u.id; });
    o.visits.filter((v) => v.type === 'work' && v.masterId === null && (!l.roomIds || (v.roomIds || []).some((id) => l.roomIds.includes(id)))).forEach((v) => { v.masterId = u.id; });
  }
  logEvent(o.id, u.id, roleKey(u), 'Заказ принят', `процент ${l.pct}% зафиксирован, приезд ${dateWords(l.arrival)}`);
  save();
}

export function declineLink(linkId) {
  const l = link(linkId);
  const u = me();
  const o = order(l.orderId);
  l.status = 'declined';
  state.settlements.filter((s) => s.linkId === l.id).forEach((s) => { s.status = 'cancelled'; });
  if (!o.leadId) o.status = 'declined';
  else releaseRooms(o, l);
  logEvent(o.id, u.id, roleKey(u), 'Предложение отклонено', 'без неустойки: заказ ещё не был принят');
  save();
}

function releaseRooms(o, l) {
  (l.roomIds ? o.rooms.filter((r) => l.roomIds.includes(r.id)) : o.rooms).forEach((r) => { if (r.assignee === l.toId) r.assignee = null; if (r.pendingFor === l.toId) r.pendingFor = null; });
  if (!l.roomIds) o.visits.filter((v) => v.type === 'measure' && !v.geo && v.masterId === l.toId).forEach((v) => { v.masterId = o.leadId; });
  o.searching = true;
}

export function previewPenalty(linkId) {
  const l = link(linkId);
  const est = state.settlements.find((s) => s.linkId === l.id && s.type === 'commission');
  return penalty(est ? est.amount : commissionAmount(l.base || 0, l.pct), todayISO(), l.arrival);
}

// Отказ от принятого заказа: неустойка тому, у кого взяли, по времени до приезда.
export function refuseLink(linkId, reason = '') {
  const l = link(linkId);
  const u = me();
  const o = order(l.orderId);
  const p = previewPenalty(linkId);
  l.status = 'refused';
  l.refusedAt = nowStamp();
  state.settlements.filter((s) => s.linkId === l.id && s.type === 'commission').forEach((s) => { s.status = 'cancelled'; });
  state.settlements.push({ id: `s-${l.id}-pen`, linkId: l.id, orderId: o.id, type: 'penalty', payerId: l.toId, payeeId: l.fromId, base: Math.round(p.amount), rule: p.rule, amount: p.amount, status: 'due', dueAt: nowStamp() });
  if (l.toId === o.leadId) {
    // Отказался ведущий — заказ сорван для того, кто его передал.
    o.status = 'failed';
    o.leadId = null;
    o.failedBy = l.toId;
    linksOf(o.id).filter((x) => x.fromId === l.toId && ['proposed', 'accepted'].includes(x.status)).forEach((x) => { x.status = 'cancelled'; state.settlements.filter((s) => s.linkId === x.id && s.status === 'estimate').forEach((s) => { s.status = 'cancelled'; }); });
  } else {
    releaseRooms(o, l);
    o.visits.filter((v) => v.masterId === l.toId && !v.geo).forEach((v) => { v.masterId = null; });
  }
  logEvent(o.id, u.id, roleKey(u), 'Отказ от заказа', `неустойка ${rubText(p.amount)} (${p.rule})${reason ? '. ' + reason : ''}`);
  save();
  return p;
}

// Диспетчер не нашёл замену: заказ уходит от него к агенту с неустойкой.
export function dispatcherGiveUp(orderId, auto = false) {
  const o = order(orderId);
  const up = upstreamLink(o);
  if (!up) return null;
  const was = state.session.userId;
  state.session.userId = up.toId;
  const p = refuseLink(up.id, auto ? 'Время приезда наступило, замену не нашли — заказ закрыт автоматически' : 'Диспетчер не нашёл замену');
  state.session.userId = was;
  save();
  return p;
}

// Автозакрытие: время приезда наступило, а комнаты так и остались без мастера.
export function autoFailOverdue() {
  const now = nowLocal();
  state.orders.filter((o) => o.searching && o.leadId && hasRole(user(o.leadId), 'dispatcher') && o.arrival && o.arrival <= now && ['measure', 'approval', 'queue'].includes(o.status) && upstreamLink(o))
    .forEach((o) => dispatcherGiveUp(o.id, true));
}

// Диспетчер передаёт мастеру весь заказ или часть комнат.
export function assignToMaster(orderId, masterId, roomIds, arrival, pct) {
  const o = order(orderId);
  const d = me();
  let base;
  const est = estimateOf(o, roomIds);
  if (est.total > 0) base = est.total;
  else if (o.prelim) base = Math.round(o.prelim.base * (roomIds && o.rooms.length ? roomIds.length / o.rooms.length : 1));
  else base = 0;
  const l = newLink(o, d.id, masterId, pct, arrival, roomIds, base, true);
  (roomIds ? o.rooms.filter((r) => roomIds.includes(r.id)) : o.rooms).forEach((r) => { r.assignee = null; r.pendingFor = masterId; });
  o.visits.filter((v) => v.type === 'work' && !v.geo && (!roomIds || (v.roomIds || []).some((id) => roomIds.includes(id)))).forEach((v) => { v.masterId = null; });
  o.searching = o.rooms.some((r) => !r.assignee && !r.pendingFor);
  logEvent(o.id, d.id, 'dispatcher', 'Передано мастеру', `${user(masterId).name}: ${roomIds ? o.rooms.filter((r) => roomIds.includes(r.id)).map((r) => r.name).join(', ') : 'весь заказ'}, ${pct}%`);
  save();
  return l;
}

// Диспетчер берёт комнаты на себя — как мастер, без звена и процента.
export function takeRooms(orderId, roomIds) {
  const o = order(orderId);
  const u = me();
  o.rooms.filter((r) => !roomIds || roomIds.includes(r.id)).forEach((r) => { r.assignee = u.id; r.pendingFor = null; });
  o.visits.filter((v) => v.type === 'work' && !v.geo && !v.masterId).forEach((v) => { v.masterId = u.id; });
  o.searching = o.rooms.some((r) => !r.assignee && !r.pendingFor);
  touch(o, 'Комнаты взял на себя', o.rooms.filter((r) => !roomIds || roomIds.includes(r.id)).map((r) => r.name).join(', '));
}

// Агент передаёт отклонённый или сорванный заказ другому исполнителю.
export function resendOrder(orderId, partnerId, arrival, pct) {
  const o = order(orderId);
  const agent = me();
  const partner = user(partnerId);
  const price = priceFor(partner, o.materialType);
  o.prelim.pricePerM2 = price;
  o.prelim.priceOwner = partner.id;
  o.prelim.base = Math.round(o.prelim.areaMid * price);
  // Если сорвал диспетчер, а агент нашёл замену сам — неустойка диспетчера становится 700 ₽.
  const failed = linksOf(o.id).filter((l) => l.status === 'refused' && hasRole(user(l.toId), 'dispatcher'));
  failed.forEach((l) => {
    const pen = state.settlements.find((s) => s.linkId === l.id && s.type === 'penalty' && s.status === 'due' && !s.replaced);
    if (pen) { pen.amount = REPLACEMENT_FOUND_FEE; pen.rule = 'агент сам нашёл замену — 700 ₽'; pen.replaced = true; }
  });
  o.rooms.forEach((r) => { r.assignee = null; });
  o.visits = o.visits.filter((v) => v.geo);
  newLink(o, agent.id, partnerId, pct, arrival, null, o.prelim.base, !o.duplicateOf);
  o.status = 'offered';
  o.arrival = arrival;
  logEvent(orderId, agent.id, 'agent', 'Заказ передан повторно', `${partner.name}, ${pct}%${failed.length ? '. Замена найдена — неустойка диспетчера 700 ₽' : ''}`);
  save();
}

// ================= работа с заказом =================
function touch(o, action, detail = '') { const u = me(); logEvent(o.id, u.id, roleKey(u), action, detail); save(); }

export function updateClient(orderId, client, arrival) {
  const o = order(orderId);
  o.client = { ...o.client, ...client };
  if (arrival) {
    o.arrival = arrival;
    const mv = o.visits.find((v) => v.type === 'measure' && !v.geo);
    if (mv) { mv.date = arrival.slice(0, 10); mv.time = arrival.slice(11, 16); }
  }
  touch(o, 'Сохранены данные клиента', 'Контакты и адрес заказа');
}
export function updateChannel(orderId, ch) { const o = order(orderId); o.channel = { ...o.channel, ...ch }; touch(o, 'Изменён канал', ch.source || ''); }

export function addRooms(orderId, floor, names) {
  const o = order(orderId);
  const u = me();
  const whole = u.id === o.leadId ? linksOf(o.id).find((l) => l.fromId === o.leadId && !l.roomIds && l.status === 'accepted') : null;
  const assignee = whole ? whole.toId : u.id;
  names.forEach((name) => {
    const n = o.rooms.filter((r) => r.name === name || r.name.startsWith(name + ' ')).length;
    o.rooms.push({ id: uid('r'), floor, name: n ? `${name} ${n + 1}` : name, est: [], walls: [], materials: [], start: '', end: '', assignee, done: false });
  });
  touch(o, 'Добавлены комнаты', names.join(', '));
}
export function removeRoom(orderId, roomId) {
  const o = order(orderId);
  const r = o.rooms.find((x) => x.id === roomId);
  o.rooms = o.rooms.filter((x) => x.id !== roomId);
  touch(o, 'Удалена комната', r ? r.name : '');
}
export function setRoomServices(orderId, roomId, svcIds) {
  const o = order(orderId);
  const r = o.rooms.find((x) => x.id === roomId);
  const keep = r.est.filter((e) => svcIds.includes(e.svc));
  svcIds.filter((id) => !keep.some((e) => e.svc === id)).forEach((id) => keep.push({ svc: id, qty: 0 }));
  r.est = keep;
  save();
}
export function setEstQty(orderId, roomId, svc, qty) {
  const r = order(orderId).rooms.find((x) => x.id === roomId);
  const e = r.est.find((x) => x.svc === svc);
  if (e) e.qty = qty;
  save();
}
export function saveEstimate(orderId) { const o = order(orderId); touch(o, 'Обновлена оценка', `Итого ${rubText(estimateOf(o).total)}`); }

export function setRoomDates(orderId, roomId, start, end) {
  const o = order(orderId);
  const r = o.rooms.find((x) => x.id === roomId);
  const before = r.start ? `${dateWords(r.start)}–${dateWords(r.end)}` : 'без даты';
  r.start = start; r.end = end || start;
  // Выезд на работы по комнате следует за датой.
  let v = o.visits.find((x) => x.type === 'work' && (x.roomIds || []).length === 1 && x.roomIds[0] === roomId);
  if (!start) { if (v && !v.geo) o.visits = o.visits.filter((x) => x !== v); }
  else if (!v) o.visits.push({ id: uid('v'), type: 'work', date: start, time: '09:00', roomIds: [roomId], masterId: r.assignee || null, geo: null });
  else if (!v.geo) v.date = start;
  touch(o, 'Изменён график', `${r.name}: ${before} → ${start ? `${dateWords(start)}–${dateWords(r.end)}` : 'без даты'}`);
}
export function setMeasureDate(orderId, date, time) {
  const o = order(orderId);
  let v = o.visits.find((x) => x.type === 'measure');
  if (!v) { v = { id: uid('v'), type: 'measure', date, time, roomIds: null, masterId: o.leadId, geo: null }; o.visits.push(v); }
  else { v.date = date; v.time = time; }
  o.arrival = `${date}T${time}`;
  touch(o, 'Замер назначен', dateWords(o.arrival));
}

export function checkIn(orderId, visitId, coords) {
  const o = order(orderId);
  const v = o.visits.find((x) => x.id === visitId);
  v.geo = { at: nowStamp(), lat: coords.lat, lng: coords.lng, demo: !!coords.demo };
  if (v.type === 'work' && o.status === 'queue') o.status = 'work';
  touch(o, 'Геоотметка на объекте', `${v.type === 'measure' ? 'Замер' : 'Работы'} · ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}${coords.demo ? ' (демо)' : ''}`);
}

// ---- стены ----
export function addWall(orderId, roomId, wallData) {
  const r = order(orderId).rooms.find((x) => x.id === roomId);
  const prev = r.walls[r.walls.length - 1];
  r.walls.push({ id: uid('w'), len: wallData.len ?? 0, height: wallData.height ?? (prev ? prev.height : 2.7), attic: false, openings: [], services: prev ? prev.services.slice() : r.est.map((e) => e.svc), src: wallData.src || 'manual' });
  save();
}
export function updateWall(orderId, roomId, wallId, patch) {
  const r = order(orderId).rooms.find((x) => x.id === roomId);
  const w = r.walls.find((x) => x.id === wallId);
  if ('len' in patch && Number(patch.len) !== Number(w.len)) w.src = patch.src || 'manual';
  Object.assign(w, patch);
  save();
}
export function removeWall(orderId, roomId, wallId) {
  const r = order(orderId).rooms.find((x) => x.id === roomId);
  r.walls = r.walls.filter((x) => x.id !== wallId);
  save();
}
// Замер рулеткой: в прототипе прибор имитируется — значение рядом с введённым или заявленным.
export function measureWall(orderId, roomId, wallId) {
  const o = order(orderId);
  const r = o.rooms.find((x) => x.id === roomId);
  const w = r.walls.find((x) => x.id === wallId);
  const guess = Number(w.len) || 2.5 + Math.random() * 3;
  w.len = Math.round((guess + (Math.random() - 0.5) * 0.06) * 100) / 100;
  w.src = 'device';
  if (o.status === 'offered') o.status = 'measure';
  touch(o, 'Замер стены', `${r.name}: ${String(w.len).replace('.', ',')} м · рулетка ${DEMO_DEVICE}`);
  return w.len;
}
export function toggleWallService(orderId, roomId, wallId, svcId) {
  const w = order(orderId).rooms.find((x) => x.id === roomId).walls.find((x) => x.id === wallId);
  w.services = w.services.includes(svcId) ? w.services.filter((s) => s !== svcId) : [...w.services, svcId];
  save();
}
export function setServiceOnAllWalls(orderId, roomId, svcId, on) {
  order(orderId).rooms.find((x) => x.id === roomId).walls.forEach((w) => {
    const has = w.services.includes(svcId);
    if (on && !has) w.services.push(svcId);
    if (!on && has) w.services = w.services.filter((s) => s !== svcId);
  });
  save();
}
export function addOpening(orderId, roomId, wallId, type) {
  const w = order(orderId).rooms.find((x) => x.id === roomId).walls.find((x) => x.id === wallId);
  w.openings.push(type === 'door' ? { type, w: 0.8, h: 2.0 } : { type, w: 1.2, h: 1.4 });
  save();
}
export function updateOpening(orderId, roomId, wallId, i, patch) {
  const w = order(orderId).rooms.find((x) => x.id === roomId).walls.find((x) => x.id === wallId);
  Object.assign(w.openings[i], patch);
  save();
}
export function removeOpening(orderId, roomId, wallId, i) {
  const w = order(orderId).rooms.find((x) => x.id === roomId).walls.find((x) => x.id === wallId);
  w.openings.splice(i, 1);
  save();
}

function pushSmetaVersion(o, at) {
  const sm = smetaOf(o);
  o.smeta.push({ v: o.smeta.length + 1, at: at || nowStamp(), items: sm.items, total: sm.total, hours: sm.hours });
}
export function sendSmeta(orderId) {
  const o = order(orderId);
  const before = lastSmeta(o);
  pushSmetaVersion(o);
  const now = lastSmeta(o);
  if (['measure', 'offered'].includes(o.status)) o.status = 'approval';
  touch(o, 'Смета отправлена клиенту', before ? `Версия ${now.v}: ${rubText(before.total)} → ${rubText(now.total)}` : `Версия 1: ${rubText(now.total)}`);
  return now;
}

// ---- статусы ----
export function clientAgreed(orderId) { const o = order(orderId); o.status = 'queue'; touch(o, 'Клиент согласовал смету', 'Заказ в очереди'); }
export function startWork(orderId) { const o = order(orderId); o.status = 'work'; touch(o, 'Работы начаты'); }
export function markRoomsDone(orderId, roomIds) {
  const o = order(orderId);
  o.rooms.filter((r) => roomIds.includes(r.id)).forEach((r) => { r.done = true; });
  linksOf(o.id).filter((l) => l.toId === me().id && l.status === 'accepted' && l.fromId !== null && hasRole(user(l.fromId), 'dispatcher')).forEach((l) => { l.doneAt = nowStamp(); });
  if (o.rooms.every((r) => r.done)) o.status = 'done';
  touch(o, 'Комнаты выполнены', o.rooms.filter((r) => roomIds.includes(r.id)).map((r) => r.name).join(', '));
}
export function finishWork(orderId) {
  const o = order(orderId);
  o.rooms.forEach((r) => { r.done = true; });
  o.status = 'done';
  touch(o, 'Работы выполнены');
}
export function cancelOrder(orderId, reason) {
  const o = order(orderId);
  o.status = 'cancelled';
  state.settlements.filter((s) => s.orderId === o.id && s.status === 'estimate').forEach((s) => { s.status = 'cancelled'; });
  linksOf(o.id).filter((l) => ['proposed', 'accepted'].includes(l.status)).forEach((l) => { l.status = 'cancelled'; });
  touch(o, 'Заказ отменён клиентом', `${reason ? reason + '. ' : ''}Неустоек нет, комиссии отменены`);
}

// Закрытие: итоговые комиссии по всем звеньям и зачёт метров в рейтинг.
export function closeOrder(orderId) {
  const o = order(orderId);
  const lines = [];
  linksOf(o.id).filter((l) => l.status === 'accepted').forEach((l) => {
    const fact = factOfPrelimWorks(o, l.roomIds);
    const base = finalCommissionBase(l.base, fact);
    const s = state.settlements.find((x) => x.linkId === l.id && x.type === 'commission');
    if (s) {
      s.base = base; s.amount = commissionAmount(base, l.pct); s.status = 'due'; s.fact = fact; s.prelimBase = l.base; s.dueAt = nowStamp();
      lines.push(`${user(l.toId).name} → ${user(l.fromId).name}: ${rubText(s.amount)}`);
    }
    l.status = 'done';
  });
  const masters = [...new Set(o.rooms.map((r) => r.assignee).filter(Boolean))];
  const credited = [];
  masters.forEach((mId) => {
    if (checklist(o, mId).every((c) => c.ok)) {
      const m2 = pasteQty(o, o.rooms.filter((r) => r.assignee === mId).map((r) => r.id));
      if (m2 > 0 && !state.credits.some((c) => c.orderId === o.id && c.masterId === mId)) {
        state.credits.push({ orderId: o.id, masterId: mId, m2, at: nowStamp() });
        credited.push(`${user(mId).name}: ${String(m2).replace('.', ',')} м²`);
      }
    }
  });
  o.status = 'closed';
  o.closedAt = nowStamp();
  if (o.prelim) o.callDue = isoDayFrom(todayISO(), 3);
  touch(o, 'Заказ закрыт', [lines.length ? 'Комиссии: ' + lines.join('; ') : 'Комиссий нет', credited.length ? 'В рейтинг: ' + credited.join('; ') : 'В рейтинг не зачтено: не выполнены условия'].join('. '));
}
function isoDayFrom(iso, add) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + add); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }

// ---- материал комнаты ----
export function addRoomMaterial(orderId, roomId, barcode, qty) {
  const o = order(orderId);
  const r = o.rooms.find((x) => x.id === roomId);
  const m = material(barcode);
  const ex = r.materials.find((x) => x.barcode === barcode);
  if (ex) ex.qty += qty; else r.materials.push({ barcode, qty, note: '' });
  if (m && !o.prelim) o.materialType = m.type;
  touch(o, 'Материал добавлен', `${r.name}: ${m ? m.brand + ' «' + m.name + '»' : barcode} × ${qty}`);
}
export function removeRoomMaterial(orderId, roomId, barcode) {
  const r = order(orderId).rooms.find((x) => x.id === roomId);
  r.materials = r.materials.filter((x) => x.barcode !== barcode);
  save();
}

// ---- чат, задачи, деньги ----
export function addChat(orderId, text) { const o = order(orderId); o.chat.push({ authorId: me().id, text, at: nowStamp() }); save(); }
export function addTask(orderId, t) { const o = order(orderId); o.tasks.push({ id: uid('t'), done: false, ...t }); touch(o, 'Добавлена задача', t.text); }
export function toggleTask(orderId, id) { const t = order(orderId).tasks.find((x) => x.id === id); t.done = !t.done; save(); }
export function addPayment(orderId, p) { const o = order(orderId); o.payments.push({ id: uid('pay'), ...p }); touch(o, p.kind === 'Аванс' ? 'Получен аванс' : 'Получена оплата', `${rubText(p.amount)} · ${p.method}`); }
export function addExpense(orderId, e) { const o = order(orderId); o.expenses.push({ id: uid('ex'), ...e }); touch(o, 'Добавлен расход', `${e.name} · ${rubText(e.amount)}`); }

// ---- корзина ----
export function trashOrder(orderId) { const o = order(orderId); o.trashed = true; o.trashedAt = nowStamp(); touch(o, 'Заказ удалён в корзину'); }
export function restoreOrder(orderId) { const o = order(orderId); o.trashed = false; touch(o, 'Заказ восстановлен'); }
export function deleteForever(orderId) {
  state.orders = state.orders.filter((o) => o.id !== orderId);
  state.events = state.events.filter((e) => e.orderId !== orderId);
  save();
}

// ---- звонок контроля ----
export function markCall(orderId, result, comment) {
  const o = order(orderId);
  o.call = { result, comment, at: nowStamp() };
  touch(o, 'Звонок клиенту', `${result}${comment ? ': ' + comment : ''}`);
}

// ---- начисления ----
export function markPaid(settlementId) { const s = state.settlements.find((x) => x.id === settlementId); s.status = 'paid'; s.paidAt = nowStamp(); save(); }
export function markReceived(settlementId) { const s = state.settlements.find((x) => x.id === settlementId); s.status = 'received'; s.receivedAt = nowStamp(); save(); }
// Показатель надёжности: выплаты, которые ждут больше 7 дней.
export function overdueOf(userId) {
  const lim = Date.now() - 7 * 864e5;
  return state.settlements.filter((s) => s.payerId === userId && s.status === 'due' && s.dueAt && Date.parse(s.dueAt) < lim).length;
}

// ---- настройки ----
export function updateSettings(patch) { const u = me(); u.settings = { ...u.settings, ...patch }; save(); }
export function updateService(id, patch) { const u = me(); u.settings.services[id] = { ...u.settings.services[id], ...patch }; save(); }
export function updatePrice(type, value) { const u = me(); u.price[type] = value; save(); }

// ================= как показать участника =================
// Мастер, получивший заказ от диспетчера, видит агента как «Контролёр»: без имени и контактов.
export function displayName(viewer, personId, orderId) {
  if (!viewer || viewer.id === personId) return 'Вы';
  const person = user(personId);
  if (!person) return '—';
  if (orderId && hasRole(person, 'agent') && !hasRole(viewer, 'agent') && !linksOf(orderId).some((l) => (l.fromId === personId && l.toId === viewer.id))) return 'Контролёр';
  return person.name;
}
export const SERVICES_LIST = SERVICES;
