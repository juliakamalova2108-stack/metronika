// «Оформить заказ» → вкладка «Замер» (в открытом заказе — «Смета»).
// Комната → стены по кругу: длина (вручную или рулеткой), окна, двери и проёмы, работы на стене.
// Сверху полоса комнат как в «Оценке»; внутри комнаты — переключатель стен и «Итог» комнаты.
// Данные: d.sm.rooms[ключ комнаты] = { sameH, h, sameSvc, walls: [{ len, h, src, opens: [{ type, width, height, area }], svcs: [id] }], status }.

import { actions, changes, rerender } from './core.js?v=131';
import * as S from './store.js?v=131';
import { oformitDraft } from './oformit.js?v=131';
import { logEvent } from './zlog.js?v=131';
import { est, carousel, pickView, estimateRooms, roomTotals, svcInfo, SVC_LIST, SHORT, ROOMS } from './ocenka.js?v=131';
import { hoursFor, shiftsText } from './calc.js?v=131';
import { DEMO_DEVICE } from './seed.js?v=131';
import { esc, toast } from './ui.js?v=131';

// ---------- числа ----------
const r2 = (x) => Math.round(x * 100) / 100;
const n2 = (x) => Number(x || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rub = (x) => Math.round(x).toLocaleString('ru-RU') + ' ₽';
const parse = (x) => Math.max(0, parseFloat(String(x ?? '').replace(',', '.').replace(/[^\d.]/g, '')) || 0);
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c);

// ---------- данные ----------
const OPEN_TYPES = ['Окно', 'Дверь', 'Проём'];
function state(d) {
  if (!d.sm) d.sm = { view: '', rooms: {} };
  if (!d.sm.rooms) d.sm.rooms = {};
  return d.sm;
}
function roomData(s, key) {
  if (!s.rooms[key]) s.rooms[key] = { sameH: true, h: 2.7, sameSvc: false, walls: [], status: 'new' };
  const r = s.rooms[key];
  if (!r.status) r.status = r.walls.some((w) => w.len) ? 'saved' : 'new';
  // Старые записи хранили проём как { name, area } — приводим к { type, area }.
  r.walls.forEach((w) => { w.opens = (w.opens || []).map((o) => ({ ...o, type: o.type || o.name || 'Проём' })); w.svcs = w.svcs || []; });
  return r;
}
const D = () => oformitDraft();
const S0 = () => state(D());
const cur = () => { const s = S0(); return roomData(s, s.view); };
const wallOf = (r) => r.walls[Math.min(r.active || 0, r.walls.length - 1)];
const save = () => { S.save(); rerender(); };

// ---------- расчёт ----------
const heightOf = (w, r) => (r.sameH ? r.h : w.h) || 0;
const grossOf = (w, r) => r2((w.len || 0) * heightOf(w, r));
const holesOf = (w) => r2(w.opens.reduce((a, o) => a + (o.area || 0), 0));
const netOf = (w, r) => Math.max(0, r2(grossOf(w, r) - holesOf(w)));
function wallLines(w, r) {
  const a = netOf(w, r);
  return w.svcs.map((id) => { const s = svcInfo(id); return { ...s, qty: a, sum: Math.round(a * s.price) }; });
}
// Сводка комнаты: площади, работы по видам, сумма и срок.
function roomSum(r) {
  const by = new Map();
  let gross = 0; let holes = 0; let net = 0;
  r.walls.forEach((w) => {
    gross += grossOf(w, r); holes += holesOf(w); net += netOf(w, r);
    wallLines(w, r).forEach((l) => { const x = by.get(l.id) || { ...l, qty: 0, sum: 0 }; x.qty = r2(x.qty + l.qty); x.sum += l.sum; by.set(l.id, x); });
  });
  const lines = [...by.values()].map((l) => ({ ...l, hours: hoursFor(l.qty, l.norm) }));
  return { gross: r2(gross), holes: r2(holes), net: r2(net), lines, total: lines.reduce((a, l) => a + l.sum, 0), hours: lines.reduce((a, l) => a + l.hours, 0) };
}
// Что не так со стеной: нет длины или нет работ (тогда стена не попадает в смету).
const wallIssue = (w) => (!w.len ? 'нет длины' : !w.svcs.length ? 'нет работ' : '');
const estimateTotal = (estRoom) => (estRoom ? roomTotals(estRoom).total : 0);

// Состояние вкладки для точки в верхнем меню: зелёная — всё сохранено, жёлтая — есть несохранённое.
export function measurementState(d) {
  const s = d.sm; if (!s || !s.rooms) return '';
  const used = estimateRooms(d).map((x) => s.rooms[x.key]).filter((r) => r && r.walls && r.walls.length);
  if (!used.length) return '';
  return used.every((r) => r.status === 'saved') ? 'ok' : 'warn';
}

// ---------- иконки ----------
const ICON = {
  'Окно': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3.5h16v17H4zM12 3.5v17M4 11.5h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  'Дверь': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V3.5h12V21M3 21h18M14.5 12.5v1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  'Проём': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V9a6 6 0 0 1 12 0v12M3 21h18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.2" stroke-linecap="round"/></svg>',
};
const TRASH = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7h15M10 4h4M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12M10 11v5.5M14 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const LASER = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="11" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 10.5h5M14 12h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="21" cy="12" r="1.2" fill="#ff5a4f"/></svg>';
const WARN = '<i class="mw-dot" aria-hidden="true"></i>';
const tog = (on) => `<span class="o-tog${on ? ' is-on' : ''}" aria-hidden="true"><i></i></span>`;

// ---------- полоса комнат и выбор комнаты (как в «Оценке») ----------
function stripOpt(s) {
  return { view: 'mw-room', add: 'mw-pick', sumOf: (x) => (s.rooms[x.key] ? roomSum(roomData(s, x.key)).total : 0), okOf: (x) => !!s.rooms[x.key] && s.rooms[x.key].status === 'saved' };
}
function pickScreen(d, s) {
  const e = est(d);
  return pickView({ ...e, view: 'pick', floor: s.floor || 1 }, { floor: 'mw-floor', roomAdd: 'mw-add-room', noDelete: true, carousel: stripOpt(s) });
}

// ---------- рисунок стены ----------
// Стена в масштабе: заштрихована рабочая площадь цветом комнаты, окна на высоте подоконника, двери и проёмы от пола.
function wallDrawing(w, r, color, locked) {
  const L = w.len || 0; const H = heightOf(w, r) || 2.7;
  const VW = 330; const VH = 190; const padL = 34; const padT = 26; const padB = 10; const padR = 8;
  if (!L) {
    return `<svg class="mw-draw" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Стена без длины"><rect x="${padL}" y="${padT}" width="${VW - padL - padR}" height="${VH - padT - padB}" rx="4" fill="none" stroke="rgba(237,242,232,.35)" stroke-dasharray="6 5"/><text x="${(VW + padL - padR) / 2}" y="${VH / 2 + 8}" text-anchor="middle" class="mw-draw__hint">Введите длину или снимите рулеткой</text></svg>`;
  }
  const k = Math.min((VW - padL - padR) / L, (VH - padT - padB) / H);
  const ww = L * k; const hh = H * k; const x0 = padL + (VW - padL - padR - ww) / 2; const y0 = padT; const floor = y0 + hh;
  // Раскладка проёмов вдоль стены: равные промежутки; если не помещаются — сжимаем.
  const widths = w.opens.map((o) => o.width || Math.sqrt(o.area || 1) * (o.type === 'Окно' ? 1 : 0.6));
  const sumW = widths.reduce((a, x) => a + x, 0);
  const fit = sumW > L * 0.9 ? (L * 0.9) / sumW : 1;
  const gap = (L - sumW * fit) / (w.opens.length + 1);
  let pos = gap;
  const shapes = w.opens.map((o, i) => {
    const ow = widths[i] * fit; const oh = Math.min(o.height || (o.area || 1) / (widths[i] || 1), H * 0.95);
    const isWin = o.type === 'Окно';
    const bottom = isWin ? Math.min(0.9, Math.max(0, H - oh - 0.15)) : 0;
    const x = x0 + pos * k; const y = floor - (bottom + oh) * k; const pw = ow * k; const ph = oh * k;
    pos += ow + gap;
    const frame = isWin ? `<path d="M${x + pw / 2} ${y}V${y + ph}M${x} ${y + ph * 0.45}H${x + pw}" class="mw-draw__frame"/>`
      : o.type === 'Дверь' ? `<circle cx="${x + pw * 0.8}" cy="${y + ph * 0.55}" r="1.6" class="mw-draw__knob"/>` : '';
    const label = pw > 30 && ph > 18 ? `<text x="${x + pw / 2}" y="${isWin ? y + ph - 6 : y + ph / 2 + 4}" text-anchor="middle" class="mw-draw__area">${n2(o.area)}</text>` : '';
    return `<g class="mw-draw__open${o.type === 'Проём' ? ' is-gap' : ''}"${locked ? '' : ` data-action="mw-open-edit" data-k="${i}" role="button" aria-label="${esc(o.type)} ${n2(o.area)} м², изменить"`}><rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="1.5"/>${frame}${label}</g>`;
  }).join('');
  return `<svg class="mw-draw" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Стена ${n2(L)} на ${n2(H)} м" style="--rc:${color}">
    <defs><pattern id="mw-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--rc)" fill-opacity=".16"/><path d="M0 0V8" stroke="var(--rc)" stroke-opacity=".45" stroke-width="1.2"/></pattern></defs>
    <path d="M${x0} ${padT - 14}H${x0 + ww}M${x0} ${padT - 19}V${padT - 9}M${x0 + ww} ${padT - 19}V${padT - 9}" class="mw-draw__dim"/>
    <text x="${x0 + ww / 2}" y="${padT - 18}" text-anchor="middle" class="mw-draw__lbl">${n2(L)} м</text>
    <path d="M${x0 - 12} ${y0}V${floor}M${x0 - 17} ${y0}H${x0 - 7}M${x0 - 17} ${floor}H${x0 - 7}" class="mw-draw__dim"/>
    <text x="${x0 - 16}" y="${y0 + hh / 2}" text-anchor="middle" class="mw-draw__lbl" transform="rotate(-90 ${x0 - 16} ${y0 + hh / 2})">${n2(H)} м</text>
    <rect x="${x0}" y="${y0}" width="${ww}" height="${hh}" fill="url(#mw-hatch)" class="mw-draw__wall"/>
    ${shapes}
    <path d="M${x0 - 4} ${floor}H${x0 + ww + 4}" class="mw-draw__floor"/>
  </svg>`;
}

// ---------- экраны ----------
// Пластина комнаты: название, рабочая площадь; внутри — «Одинаковая высота» и «Одинаковые работы».
function roomPlate(d, s, er, r, locked) {
  const sum = roomSum(r);
  const inner = `<div class="mw-sets">
    <div class="o-svc mw-set">
      <label class="o-qty${locked || !r.sameH ? ' is-locked' : ''}"><input id="mw-room-h" inputmode="decimal" value="${r.sameH ? n2(r.h) : '—'}" ${locked || !r.sameH ? 'readonly' : ''} data-change="mw-roomheight" aria-label="Высота стен, м"/><span>м</span></label>
      <span class="o-svc__t"><span class="o-svc__n">Одинаковая высота</span><small>${r.sameH ? 'для всех стен комнаты' : 'у каждой стены своя'}</small></span>
      <button type="button" class="o-same__tog" role="switch" aria-checked="${r.sameH}" aria-label="Одинаковая высота" data-action="mw-toggle" data-key="sameH" ${locked ? 'disabled' : ''}>${tog(r.sameH)}</button>
    </div>
    <div class="o-svc mw-set">
      <span class="mw-set__ico" aria-hidden="true">${r.walls.length}<small>${plural(r.walls.length, 'стена', 'стены', 'стен')}</small></span>
      <span class="o-svc__t"><span class="o-svc__n">Одинаковые работы</span><small>${r.sameSvc ? 'на всех стенах одни и те же' : 'у каждой стены свои'}</small></span>
      <button type="button" class="o-same__tog" role="switch" aria-checked="${r.sameSvc}" aria-label="Одинаковые работы" data-action="mw-toggle" data-key="sameSvc" ${locked ? 'disabled' : ''}>${tog(r.sameSvc)}</button>
    </div>
  </div>`;
  const tabs = `<span class="mw-rhead-area"><b>${n2(sum.net)}</b><small>м² под работы</small></span>`;
  return carousel({ ...est(d), view: s.view }, tabs, inner, stripOpt(s));
}

// Переключатель стен: «Стена 1 · 2 · 3 · +», справа «Итог». Жёлтая точка — у стены нет длины или работ.
function wallNav(r, locked) {
  const items = r.walls.map((w, i) => {
    const on = !r.total && (r.active || 0) === i;
    return `<button type="button" class="mw-wtab${on ? ' is-on' : ''}" data-action="mw-wall" data-i="${i}" aria-pressed="${on}">${on ? 'Стена ' : ''}${i + 1}${wallIssue(w) ? WARN : ''}</button>`;
  }).join('');
  return `<nav class="mw-wnav" aria-label="Стены"><div class="mw-wnav__track">${items}${locked ? '' : '<button type="button" class="mw-wtab mw-wtab--add" data-action="mw-add-wall" aria-label="Добавить стену">+</button>'}</div>
    <button type="button" class="mw-wtab mw-wtab--sum${r.total ? ' is-on' : ''}" data-action="mw-total" aria-pressed="${!!r.total}">Итог</button></nav>`;
}

function wallCard(w, r, i, color, locked) {
  const lines = wallLines(w, r);
  const total = lines.reduce((a, l) => a + l.sum, 0);
  const hours = lines.reduce((a, l) => a + hoursFor(l.qty, l.norm), 0);
  const issue = wallIssue(w);
  const lenField = `<label class="mw-len${w.src === 'device' ? ' is-device' : ''}"><small>Длина</small><span class="o-qty${locked ? ' is-locked' : ''}"><input id="mw-len" inputmode="decimal" value="${w.len ? n2(w.len) : ''}" placeholder="0,00" ${locked ? 'readonly' : ''} data-change="mw-length" aria-label="Длина стены, м"/><span>м</span></span></label>`;
  const hField = r.sameH ? `<div class="mw-len"><small>Высота</small><span class="o-qty is-locked"><span class="mw-len__v">${n2(r.h)}</span><span>м</span></span></div>`
    : `<label class="mw-len"><small>Высота</small><span class="o-qty${locked ? ' is-locked' : ''}"><input inputmode="decimal" value="${w.h ? n2(w.h) : ''}" placeholder="0,00" ${locked ? 'readonly' : ''} data-change="mw-height" aria-label="Высота этой стены, м"/><span>м</span></span></label>`;
  const laser = locked ? '' : `<button type="button" class="mw-laser" data-action="mw-laser">${LASER}<span>Рулетка</span></button>`;
  const opens = w.opens.map((o, k) => `<button type="button" class="mw-orow" ${locked ? 'disabled' : `data-action="mw-open-edit" data-k="${k}"`}>
      <span class="mw-orow__ico">${ICON[o.type] || ICON['Проём']}</span><span class="mw-orow__n">${esc(o.type)}</span>
      <span class="mw-orow__d">${o.width && o.height ? `${n2(o.width)} × ${n2(o.height)}` : ''}</span><b>−${n2(o.area)} м²</b></button>`).join('');
  const works = lines.map((l) => `<div class="o-svc mw-work"><span class="o-qty is-locked"><span class="mw-len__v">${n2(l.qty)}</span><span>м²</span></span>
      <span class="o-svc__t"><span class="o-svc__n">${esc(SHORT[l.id] || l.name)}</span><small>${l.price.toLocaleString('ru-RU')} ₽/м²</small></span><b class="o-svc__s">${rub(l.sum)}</b></div>`).join('');
  return `<section class="f-plate mw-wall" style="--rc:${color}">
    <div class="mw-wall__head"><span class="mw-wall__t"><b>Стена ${i + 1}</b><small>${w.len ? `${n2(w.len)} × ${n2(heightOf(w, r))} м` : 'по кругу от двери, по часовой'}</small></span>
      ${locked ? '' : `<button type="button" class="o-ib mw-del" data-action="mw-delete-wall" aria-label="Удалить стену ${i + 1}">${TRASH}</button>`}</div>
    <div class="mw-dims">${lenField}${hField}${laser}</div>
    ${wallDrawing(w, r, color, locked)}
    <div class="mw-eq"><div class="mw-eq__t"><small>S общая</small><b>${n2(grossOf(w, r))}</b></div><span class="mw-eq__op">−</span>
      <div class="mw-eq__t"><small>S проёмов</small><b>${n2(holesOf(w))}</b></div><span class="mw-eq__op">=</span>
      <div class="mw-eq__t mw-eq__t--net"><small>S рабочая, м²</small><b>${n2(netOf(w, r))}</b></div></div>
    ${holesOf(w) > grossOf(w, r) && w.len ? '<p class="mw-warn">Проёмов больше, чем площадь стены — проверьте размеры</p>' : ''}
    <div class="mw-block"><p class="mw-sub">Окна, двери, проёмы</p>${opens || '<p class="mw-none">Нет — вся стена под работы</p>'}
      ${locked ? '' : `<div class="mw-addrow">${OPEN_TYPES.map((t) => `<button type="button" class="mw-add" data-action="mw-open-new" data-type="${t}">${ICON[t]}<span>${t}</span></button>`).join('')}</div>`}</div>
    <div class="mw-block"><p class="mw-sub">Работы${r.sameSvc ? ' · на всех стенах' : ''}</p>${works}
      ${issue === 'нет работ' ? `<p class="mw-warn">${WARN}На стене нет работ — она не попадёт в смету</p>` : ''}
      ${locked ? '' : `<button type="button" class="mw-addwork" data-action="mw-services">${w.svcs.length ? 'Изменить работы' : '+ Добавить работы'}</button>`}</div>
    <div class="mw-wtotal"><span>Итого по стене${hours ? ` · ${shiftsText(hours)}` : ''}</span><b>${rub(total)}</b></div>
    ${locked ? '' : `<button type="button" class="mw-next" data-action="mw-next">${i < r.walls.length - 1 ? `К стене ${i + 2}` : 'Следующая стена'} <span aria-hidden="true">→</span></button>`}
  </section>`;
}

// Сравнение с предварительной оценкой: сколько было со слов клиента и сколько вышло по замеру.
function compare(estSum, factSum) {
  if (!estSum) return '';
  const diff = factSum - estSum;
  return `<div class="mw-cmp"><div><small>По оценке</small><b>${rub(estSum)}</b></div><span class="mw-cmp__arrow" aria-hidden="true">→</span>
    <div><small>По замеру</small><b>${rub(factSum)}</b></div><div class="mw-cmp__diff${diff > 0 ? ' is-up' : diff < 0 ? ' is-down' : ''}"><small>Разница</small><b>${diff > 0 ? '+' : diff < 0 ? '−' : ''}${rub(Math.abs(diff))}</b></div></div>`;
}
const workTable = (lines) => `<div class="o-tline o-tline--h"><span>Работа</span><span>м²</span><span>₽/м²</span><span>Сумма</span></div>${lines.map((l) => `<div class="o-tline"><span class="o-tline__n">${esc(SHORT[l.id] || l.name)}</span><span>${n2(l.qty)}</span><span>${l.price.toLocaleString('ru-RU')}</span><b>${rub(l.sum)}</b></div>`).join('')}`;

function roomTotal(r, er, color) {
  const t = roomSum(r);
  const walls = r.walls.map((w, i) => {
    const issue = wallIssue(w); const sum = wallLines(w, r).reduce((a, l) => a + l.sum, 0);
    return `<button type="button" class="mw-wline" data-action="mw-wall" data-i="${i}"><span class="mw-wline__n"><b>Стена ${i + 1}</b><small>${w.len ? `${n2(w.len)} × ${n2(heightOf(w, r))} м` : '—'}${w.opens.length ? ` · ${w.opens.map((o) => o.type.toLowerCase()).join(', ')}` : ''}</small></span>
      <span class="mw-wline__s">${issue ? `<em>${WARN}${issue}</em>` : `<b>${rub(sum)}</b><small>${n2(netOf(w, r))} м²</small>`}</span></button>`;
  }).join('');
  return `<section class="f-plate mw-wall mw-total" style="--rc:${color}">
    <div class="mw-wall__head"><span class="mw-wall__t"><b>Итог комнаты</b><small>${r.walls.length} ${plural(r.walls.length, 'стена', 'стены', 'стен')}</small></span></div>
    <div class="mw-eq"><div class="mw-eq__t"><small>S общая</small><b>${n2(t.gross)}</b></div><span class="mw-eq__op">−</span>
      <div class="mw-eq__t"><small>S проёмов</small><b>${n2(t.holes)}</b></div><span class="mw-eq__op">=</span>
      <div class="mw-eq__t mw-eq__t--net"><small>S рабочая, м²</small><b>${n2(t.net)}</b></div></div>
    <div class="mw-block"><p class="mw-sub">Стены</p>${walls}</div>
    <div class="mw-block"><p class="mw-sub">Работы по комнате</p>${t.lines.length ? workTable(t.lines) : '<p class="mw-none">Работы пока не добавлены</p>'}</div>
    ${compare(estimateTotal(er), t.total)}
    <div class="o-tiles"><div class="o-tile"><small>Стоимость</small><b>${rub(t.total)}</b></div><div class="o-tile"><small>Срок</small><b>${shiftsText(t.hours)}</b></div></div>
  </section>`;
}

function orderTotal(d, s) {
  const rooms = estimateRooms(d);
  const by = new Map(); let total = 0; let hours = 0; let estSum = 0;
  const list = rooms.map((er) => {
    const r = roomData(s, er.key); const t = roomSum(r);
    total += t.total; estSum += estimateTotal(er);
    t.lines.forEach((l) => { const x = by.get(l.id) || { ...l, qty: 0, sum: 0 }; x.qty = r2(x.qty + l.qty); x.sum += l.sum; by.set(l.id, x); });
    const issues = r.walls.filter(wallIssue).length;
    return `<button type="button" class="o-sroom mw-sroom" style="--rc:${er.color || '#7c8f8a'}" data-action="mw-room" data-key="${er.key}">
      <span class="o-sroom__head"><span class="o-sroom__name"><b>${esc(er.name)}</b><small>${r.walls.length ? `${r.walls.length} ${plural(r.walls.length, 'стена', 'стены', 'стен')} · ${n2(t.net)} м²` : 'замера нет'}${issues ? ` · <em>${WARN}стен без работ или длины: ${issues}</em>` : ''}</small></span>
      <span class="o-sroom__sum"><b>${rub(t.total)}</b><small>${r.status === 'saved' ? 'сохранено' : r.walls.length ? 'не сохранено' : ''}</small></span></span></button>`;
  }).join('');
  const lines = [...by.values()].map((l) => ({ ...l, hours: hoursFor(l.qty, l.norm) }));
  hours = lines.reduce((a, l) => a + l.hours, 0);
  return `${carousel({ ...est(d), view: 'total' }, '', '', stripOpt(s))}
    <div class="o-stack mw-stack"><p class="o-sec">Комнаты</p>${list}
      <section class="f-plate o-bywork"><p class="o-sec o-sec--in">Итого по видам работ</p>${lines.length ? workTable(lines) : '<p class="mw-none">Пока пусто</p>'}</section>
      ${estSum ? `<section class="f-plate mw-cmp-plate">${compare(estSum, total)}</section>` : ''}
      <section class="f-plate o-grand"><p class="o-grand__t">Смета по замеру</p><b class="o-grand__sum">${rub(total)}</b>
        <p class="o-grand__x">${shiftsText(hours)} · ${rooms.length} ${plural(rooms.length, 'комната', 'комнаты', 'комнат')}</p></section>
    </div>`;
}

// Выбор работ — те же плитки, что в «Оценке».
function servicesScreen(d, s, r, w, color) {
  const sel = w.pick || w.svcs;
  const chips = SVC_LIST.map((s0) => {
    const x = svcInfo(s0.id); const on = sel.includes(x.id);
    return `<button type="button" class="o-chip o-chip--svc${on ? ' is-on' : ''}" style="--rc:${color}" role="switch" aria-checked="${on}" data-action="mw-service" data-id="${x.id}">
      <span class="o-chip__t"><span>${esc(SHORT[x.id] || x.name)}</span><small>${x.price.toLocaleString('ru-RU')} ₽/м²</small></span><i class="o-chip__ok" aria-hidden="true">✓</i></button>`;
  }).join('');
  return `${carousel({ ...est(d), view: s.view }, '', '', stripOpt(s))}
    <section class="f-plate o-sheet o-sheet--chips o-sheet--svc">
      <p class="o-chips__t">${r.sameSvc ? 'Работы на всех стенах' : `Работы на стене ${(r.active || 0) + 1}`}</p>
      <div class="o-chips o-chips--svc">${chips}</div>
      <div class="f-btn-row"><button type="button" class="f-btn" data-action="mw-services-cancel">Отмена</button><button type="button" class="f-btn" data-action="mw-services-done">Готово</button></div>
    </section>`;
}

// Окно / дверь / проём: ширина сверху, высота сбоку, площадь считается сама.
function openingDialog(r) {
  const o = r.dlg;
  const area = parse(o.width) * parse(o.height);
  return `<div class="o-overlay" data-action="mw-open-cancel"></div>
  <section class="f-plate o-dialog mw-odlg" role="dialog" aria-label="${esc(o.type)} — размеры">
    <div class="mw-odlg__types" role="tablist">${OPEN_TYPES.map((t) => `<button type="button" role="tab" aria-selected="${o.type === t}" class="o-floor${o.type === t ? ' is-on' : ''}" data-action="mw-open-type" data-type="${t}">${t}</button>`).join('')}</div>
    <div class="mw-odlg__draw">
      <label class="mw-odlg__w"><small>Ширина</small><span class="o-qty"><input id="mw-ow" inputmode="decimal" value="${o.width ? esc(String(o.width).replace('.', ',')) : ''}" placeholder="0,00" aria-label="Ширина, м"/><span>м</span></span></label>
      <label class="mw-odlg__h"><small>Высота</small><span class="o-qty"><input id="mw-oh" inputmode="decimal" value="${o.height ? esc(String(o.height).replace('.', ',')) : ''}" placeholder="0,00" aria-label="Высота, м"/><span>м</span></span></label>
      <div class="mw-odlg__fig${o.type === 'Окно' ? ' is-win' : ''}">${ICON[o.type]}</div>
    </div>
    <p class="mw-odlg__area">${area ? `Площадь <b>${n2(area)} м²</b>` : 'Площадь посчитается сама'}</p>
    ${o.error ? '<p class="mw-warn">Введите ширину и высоту больше нуля</p>' : ''}
    <div class="f-btn-row">${o.k >= 0 ? '<button type="button" class="f-btn" data-action="mw-open-del">Удалить</button>' : '<button type="button" class="f-btn" data-action="mw-open-cancel">Отмена</button>'}<button type="button" class="f-btn" data-action="mw-open-ok">ОК</button></div>
  </section>`;
}

export function renderMeasurement(d) {
  const s = state(d);
  const rooms = estimateRooms(d);
  if (s.view === 'total' && rooms.length) return `<div class="o-wrap mw-wrap">${orderTotal(d, s)}</div>`;
  // Комнаты из «Оценки» уже есть — сразу открываем первую; выбор комнаты — только по «+».
  if (s.view !== 'pick' && !rooms.some((x) => x.key === s.view)) s.view = rooms.length ? rooms[0].key : 'pick';
  const er = rooms.find((x) => x.key === s.view);
  if (!er) return `<div class="o-wrap mw-wrap">${pickScreen(d, s)}</div>`;
  const r = roomData(s, er.key);
  const color = er.color || '#7c8f8a';
  if (!r.walls.length) r.walls.push(newWall(r, er));
  r.active = Math.min(r.active || 0, r.walls.length - 1);
  const w = wallOf(r);
  if (r.panel === 'services') return `<div class="o-wrap mw-wrap">${servicesScreen(d, s, r, w, color)}</div>`;
  const locked = r.status === 'saved';
  const status = locked ? '<span class="f-status f-status--ok mw-status"><i></i>сохранено</span>' : r.status === 'editing' ? '<span class="f-status f-status--warn mw-status"><i></i>редактирование</span>' : '';
  const body = r.total ? roomTotal(r, er, color) : wallCard(w, r, r.active, color, locked);
  const buttons = `<div class="f-btn-row"><button type="button" class="f-btn${locked ? ' f-btn--saved' : ''}" data-action="mw-save">${locked ? 'Сохранено' : 'Сохранить'}</button>${r.status !== 'new' ? `<button type="button" class="f-btn${r.status === 'editing' ? ' f-btn--editing' : ''}" data-action="mw-edit">${r.status === 'editing' ? 'Редактирование' : 'Редактировать'}</button>` : ''}</div>`;
  return `<div class="o-wrap mw-wrap">${roomPlate(d, s, er, r, locked)}${wallNav(r, locked)}<div class="mw-body">${status}${body}</div>${buttons}${r.dlg ? openingDialog(r) : ''}</div>`;
}

// Новая стена: первая берёт работы комнаты из «Оценки», следующие — как у прошлой, если «Одинаковые работы».
function newWall(r, er) {
  const prev = r.walls[r.walls.length - 1];
  const svcs = prev ? (r.sameSvc ? prev.svcs.slice() : []) : (er ? er.svcs.map((x) => x.id) : []);
  return { len: 0, h: r.h, opens: [], svcs };
}

// ---------- действия ----------
const edited = (r) => { if (r.status === 'saved') r.status = 'editing'; };
// «+» в полосе: открыть выбор комнаты; повторное нажатие — вернуться туда, где были.
actions['mw-pick'] = () => {
  const s = S0();
  if (s.view !== 'pick') { s.back = s.view; s.view = 'pick'; }
  else if (s.back && (s.back === 'total' || estimateRooms(D()).some((x) => x.key === s.back))) s.view = s.back;
  save(); window.scrollTo(0, 0);
};
actions['mw-room'] = (el) => { const s = S0(); s.view = el.dataset.key; save(); window.scrollTo(0, 0); };
actions['mw-floor'] = (el) => { S0().floor = Number(el.dataset.f); save(); };
// Комната из списка: если такая уже есть в «Оценке» на этом этаже — открываем её, иначе добавляем в «Оценку».
actions['mw-add-room'] = (el) => {
  const d = D(); const s = state(d); const e = est(d); const floor = s.floor || 1; const base = el.dataset.name;
  let room = e.rooms.find((x) => (x.base || x.name) === base && x.floor === floor);
  if (!room) {
    const same = e.rooms.filter((x) => (x.base || x.name) === base).length;
    room = { key: 'r' + Math.random().toString(36).slice(2, 8), floor, base, name: same ? `${base} ${same + 1}` : base, color: (ROOMS.find((x) => x[0] === base) || [])[1], svcs: [], status: 'new', panel: '' };
    e.rooms.push(room);
  }
  s.view = room.key; save(); window.scrollTo(0, 0);
};
actions['mw-wall'] = (el) => { const r = cur(); r.active = Number(el.dataset.i); r.total = false; save(); };
actions['mw-total'] = () => { cur().total = true; save(); };
actions['mw-add-wall'] = () => {
  const s = S0(); const r = cur(); const er = estimateRooms(D()).find((x) => x.key === s.view);
  r.walls.push(newWall(r, er)); r.active = r.walls.length - 1; r.total = false; edited(r); save();
  requestAnimationFrame(() => { const t = document.querySelector('.mw-wnav__track'); if (t) t.scrollLeft = t.scrollWidth; });
};
actions['mw-next'] = () => { const r = cur(); if (r.active < r.walls.length - 1) { r.active += 1; save(); } else actions['mw-add-wall'](); };
actions['mw-delete-wall'] = () => {
  const r = cur(); r.walls.splice(r.active, 1); r.active = Math.max(0, Math.min(r.active, r.walls.length - 1)); edited(r); save();
};
actions['mw-toggle'] = (el) => {
  const r = cur(); const k = el.dataset.key; r[k] = !r[k]; edited(r);
  if (k === 'sameH' && !r.sameH) r.walls.forEach((w) => { w.h = w.h || r.h; });
  if (k === 'sameSvc' && r.sameSvc) {
    const w = wallOf(r);
    if (w.svcs.length) r.walls.forEach((x) => { x.svcs = w.svcs.slice(); });
    else { w.pick = []; r.panel = 'services'; }
  }
  save();
};
actions['mw-laser'] = () => {
  const r = cur(); const w = wallOf(r);
  const guess = w.len || 2.5 + Math.random() * 3;
  w.len = r2(guess + (Math.random() - 0.5) * 0.06); w.src = 'device'; edited(r);
  toast(`Рулетка ${DEMO_DEVICE} (демо): ${n2(w.len)} м`); save();
};
changes['mw-length'] = (el) => { const r = cur(); const w = wallOf(r); const v = parse(el.value); if (v !== w.len) { w.len = v; w.src = 'hand'; edited(r); } S.save(); };
changes['mw-height'] = (el) => { const r = cur(); wallOf(r).h = parse(el.value); edited(r); S.save(); };
changes['mw-roomheight'] = (el) => { const r = cur(); const v = parse(el.value); if (v) { r.h = v; edited(r); } S.save(); };

actions['mw-services'] = () => { const r = cur(); const w = wallOf(r); w.pick = w.svcs.slice(); r.panel = 'services'; save(); window.scrollTo(0, 0); };
actions['mw-service'] = (el) => { const w = wallOf(cur()); const id = el.dataset.id; w.pick = w.pick || w.svcs.slice(); w.pick = w.pick.includes(id) ? w.pick.filter((x) => x !== id) : [...w.pick, id]; save(); };
actions['mw-services-cancel'] = () => { const r = cur(); wallOf(r).pick = null; r.panel = ''; save(); };
actions['mw-services-done'] = () => {
  const r = cur(); const w = wallOf(r);
  w.svcs = SVC_LIST.map((x) => x.id).filter((id) => (w.pick || w.svcs).includes(id)); w.pick = null; r.panel = '';
  if (r.sameSvc) r.walls.forEach((x) => { x.svcs = w.svcs.slice(); });
  edited(r); save();
};

actions['mw-open-new'] = (el) => { const r = cur(); r.dlg = { type: el.dataset.type, width: '', height: '', k: -1 }; save(); };
actions['mw-open-edit'] = (el) => { const r = cur(); const k = Number(el.dataset.k); const o = wallOf(r).opens[k]; r.dlg = { type: o.type, width: o.width || '', height: o.height || '', k }; save(); };
// Тип меняем, не теряя уже введённые цифры.
const keepDlg = (r) => { const w = document.getElementById('mw-ow'); const h = document.getElementById('mw-oh'); if (w) r.dlg.width = w.value; if (h) r.dlg.height = h.value; };
actions['mw-open-type'] = (el) => { const r = cur(); keepDlg(r); r.dlg.type = el.dataset.type; save(); };
actions['mw-open-cancel'] = () => { cur().dlg = null; save(); };
actions['mw-open-del'] = () => { const r = cur(); wallOf(r).opens.splice(r.dlg.k, 1); r.dlg = null; edited(r); save(); };
actions['mw-open-ok'] = () => {
  const r = cur(); keepDlg(r);
  const width = parse(r.dlg.width); const height = parse(r.dlg.height);
  if (!width || !height) { r.dlg.error = true; save(); return; }
  const o = { type: r.dlg.type, width, height, area: r2(width * height) };
  const w = wallOf(r);
  if (r.dlg.k >= 0) w.opens[r.dlg.k] = o; else w.opens.push(o);
  r.dlg = null; edited(r); save();
};

// «Сохранить»: стены без длины не даём, стены без работ — предупреждаем, но сохраняем.
actions['mw-save'] = () => {
  const d = D(); const s = state(d); const r = cur();
  if (r.status === 'saved') return;
  const noLen = r.walls.findIndex((w) => !w.len);
  if (noLen >= 0) { r.active = noLen; r.total = false; save(); toast(`У стены ${noLen + 1} нет длины`); return; }
  r.status = 'saved';
  const er = estimateRooms(d).find((x) => x.key === s.view); const t = roomSum(r);
  logEvent(d, 'Обновлена смета', `${er ? er.name : 'Комната'}: ${n2(t.net)} м² · ${rub(t.total)}`);
  const empty = r.walls.filter((w) => !w.svcs.length).length;
  toast(empty ? `Замер сохранён. Стен без работ: ${empty} — в смету не вошли` : 'Замер комнаты сохранён');
  save();
};
actions['mw-edit'] = () => { cur().status = 'editing'; save(); };
