// Расчёты прототипа. Чистые функции без обращения к экрану:
// их можно проверять отдельно и потом перенести в настоящее приложение.

export const ALLOWANCE_M = 0.1; // запас на подрезку полосы по высоте, м
export const AREA_SPREAD = 0.9; // нижняя граница ожидаемой площади = 90% от верхней

export const round1 = (n) => Math.round(n * 10) / 10;
export const round2 = (n) => Math.round(n * 100) / 100;

// Длина одной полосы с учётом запаса и раппорта.
export function stripLength(heightM, rapportM) {
  const base = heightM + ALLOWANCE_M;
  if (!rapportM) return round2(base);
  return round2(Math.ceil(base / rapportM - 1e-9) * rapportM);
}

// Сколько полос выходит из одного рулона.
export function stripsPerRoll(material, heightM) {
  const len = stripLength(heightM, material.rapport);
  if (len <= 0) return 0;
  return Math.floor(material.length / len + 1e-9);
}

// Сценарий «клиент уже купил рулоны»: какую площадь стен они закроют.
export function areaFromRolls(material, rolls, heightM) {
  const spr = stripsPerRoll(material, heightM);
  const strips = spr * rolls;
  const max = round1(strips * material.width * heightM);
  const min = round1(max * AREA_SPREAD);
  return { spr, strips, min, max, mid: round1((min + max) / 2), stripLen: stripLength(heightM, material.rapport) };
}

// Сценарий «клиент принёс размеры»: сколько рулонов нужно и какая площадь под оклейку.
// walls — длины стен в метрах; openings — [{w, h}] окна и двери.
export function rollsFromRoom(material, walls, heightM, openings = []) {
  const perimeter = round2(walls.reduce((s, w) => s + (Number(w) || 0), 0));
  const openingsArea = openings.reduce((s, o) => s + o.w * o.h, 0);
  const area = round1(Math.max(0, perimeter * heightM - openingsArea));
  // Полосы над и под проёмами всё равно клеятся, поэтому вычитаем только целые полосы по ширине проёма.
  const skip = openings.reduce((s, o) => s + Math.floor(o.w / material.width + 1e-9), 0);
  const stripsNeeded = Math.max(0, Math.ceil(perimeter / material.width - 1e-9) - skip);
  const spr = stripsPerRoll(material, heightM);
  const rolls = spr > 0 ? Math.ceil(stripsNeeded / spr) : 0;
  return { perimeter, area, stripsNeeded, spr, rolls, stripLen: stripLength(heightM, material.rapport) };
}

export const money = (n) => Math.round(n);

// Предварительная стоимость поклейки по цене за м².
export function prelimCost(areaM2, pricePerM2) {
  return money(areaM2 * pricePerM2);
}

export function commissionAmount(base, pct) {
  return money((base * pct) / 100);
}

// База комиссии: работы из предварительной оценки по факту, но не меньше самой оценки.
// Если фактической суммы ещё нет (замера не было), берём оценку.
export function commissionBase(prelimBase, actualBase) {
  if (actualBase == null) return prelimBase;
  return Math.max(prelimBase, actualBase);
}

// Целые календарные дни от сегодня до даты приезда (YYYY-MM-DD).
export function daysUntil(todayISO, arrivalISO) {
  const a = Date.UTC(...todayISO.slice(0, 10).split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  const b = Date.UTC(...arrivalISO.slice(0, 10).split('-').map((v, i) => (i === 1 ? v - 1 : +v)));
  return Math.round((b - a) / 86400000);
}

// Неустойка за отказ от принятого заказа по правилу концепции.
export function penalty(prelimCommission, todayISO, arrivalISO) {
  const d = daysUntil(todayISO, arrivalISO);
  if (d >= 2) return { amount: 500, rule: 'за 2 дня и раньше — 500 ₽', days: d };
  if (d === 1) return { amount: Math.max(money(prelimCommission * 0.3), 1000), rule: 'за 1 день — 30% от предварительной комиссии, не менее 1 000 ₽', days: d };
  return { amount: Math.max(money(prelimCommission * 0.5), 1500), rule: 'в день работы — 50% от предварительной комиссии, не менее 1 500 ₽', days: d };
}

// Фиксированная неустойка диспетчера, если агент сам нашёл замену после срыва.
export const REPLACEMENT_FOUND_FEE = 700;

// ---------- смета ----------
export const SHIFT_HOURS = 8;

// Срок работ по норме выработки (м² или пог. м в час): «2 смены 1 ч».
export function hoursFor(qty, normPerHour) {
  if (!normPerHour || !qty) return 0;
  return Math.ceil(qty / normPerHour);
}
export function shiftsText(hours) {
  if (!hours) return '0 ч';
  const s = Math.floor(hours / SHIFT_HOURS);
  const h = hours % SHIFT_HOURS;
  const sw = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'смена' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'смены' : 'смен');
  return [s ? `${s} ${sw(s)}` : '', h ? `${h} ч` : ''].filter(Boolean).join(' ');
}

// Площадь одной стены за вычетом проёмов.
export function wallArea(wall) {
  const gross = (Number(wall.len) || 0) * (Number(wall.height) || 0);
  const holes = (wall.openings || []).reduce((s, o) => s + (Number(o.w) || 0) * (Number(o.h) || 0), 0);
  return round2(Math.max(0, gross - holes));
}

// Объём услуги по стенам: м² — сумма площадей стен с этой услугой, пог. м — сумма длин.
export function serviceQtyFromWalls(walls, serviceId, unit) {
  return round2(walls
    .filter((w) => (w.services || []).includes(serviceId))
    .reduce((s, w) => s + (unit === 'm' ? Number(w.len) || 0 : wallArea(w)), 0));
}

// Итоговая база комиссии звена: работы из предварительной оценки по факту, не меньше оценки.
export function finalCommissionBase(prelimBase, factOfPrelimWorks) {
  return Math.max(prelimBase || 0, factOfPrelimWorks || 0);
}
