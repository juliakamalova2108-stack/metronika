// «Оформить заказ» → вкладка «Оценка». Один в один с секцией «Выезды · 02 · Оценка» в Figma:
// выбор комнат по этажам → комната → «+» услуги → объёмы → ОК → следующая комната → Итог.

import { actions, rerender } from './core.js?v=21';
import * as S from './store.js?v=21';
import { SYSTEM_PRICE } from './seed.js?v=21';
import { shiftsText, hoursFor } from './calc.js?v=21';
import { esc } from './ui.js?v=21';
import { logEvent } from './zlog.js?v=21';

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
const CALC_ICON = '<span class="o-calc-ico" aria-hidden="true"><i></i><b></b><b></b><b></b><b></b></span>';

function est(d) {
  if (!d.est) d.est = { rooms: [], view: 'pick', floor: 1, confirm: null };
  return d.est;
}
const roomOf = (e, key) => e.rooms.find((r) => r.key === key);

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
  const items = [{ key: 'pick', title: 'Выбор комнат', label: 'Выбор<br>комнат' }];
  e.rooms.forEach((r) => items.push({ key: r.key, title: r.name, sub: `${r.floor} этаж`, label: esc(r.name) }));
  if (e.rooms.length && e.rooms.every((r) => r.status === 'saved')) items.push({ key: 'total', title: 'Итог', sub: `${e.rooms.length} ${plural(e.rooms.length, 'комната', 'комнаты', 'комнат')}`, label: 'Итог' });
  return items;
}
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c);

function carousel(e, tabs) {
  const items = carouselItems(e);
  const i = Math.max(0, items.findIndex((x) => x.key === e.view));
  const cur = items[i];
  const prev = items[i - 1];
  const next = items[i + 1];
  const deeperL = items[i - 2];
  const deeperR = items[i + 2];
  return `<div class="o-head${tabs ? ' o-head--tabs' : ''}">
    ${deeperL ? '<span class="o-back o-back--deep o-back--l" aria-hidden="true"></span>' : ''}
    ${deeperR ? '<span class="o-back o-back--deep o-back--r" aria-hidden="true"></span>' : ''}
    ${prev ? `<button type="button" class="o-back o-back--l" data-action="o-view" data-key="${prev.key}"><span>${prev.label}</span></button>` : ''}
    ${next ? `<button type="button" class="o-back o-back--r" data-action="o-view" data-key="${next.key}"><span>${next.label}</span></button>` : ''}
    ${tabs || ''}
    <div class="o-cur"><b>${esc(cur.title)}</b>${cur.sub ? `<small>${esc(cur.sub)}</small>` : ''}</div>
  </div>`;
}

// ---------- переключатель ----------
const toggle = (on) => `<span class="o-tog${on ? ' is-on' : ''}" aria-hidden="true"><i></i></span>`;

// ---------- экраны ----------
function pickView(e) {
  const list = ROOMS.map(([name, color]) => {
    const on = e.rooms.some((r) => r.floor === e.floor && r.name === name);
    return `<button type="button" class="o-row" role="switch" aria-checked="${on}" data-action="o-room-toggle" data-name="${esc(name)}">
      <span class="o-row__mark" style="background:${color}"></span><span class="o-row__name">${esc(name)}</span>${toggle(on)}</button>`;
  }).join('');
  return `${carousel(e)}
    <section class="f-plate o-sheet f-fill">
      <div class="o-floors" role="tablist">${[1, 2, 3].map((f) => `<button type="button" role="tab" aria-selected="${f === e.floor}" class="o-floor${f === e.floor ? ' is-on' : ''}" data-action="o-floor" data-f="${f}">${f} этаж</button>`).join('')}</div>
      <div class="o-list">${list}</div>
      <div class="f-btn-row"><button type="button" class="f-btn" data-action="o-rooms-done">Добавить выбранные</button></div>
    </section>`;
}

function roomTabs(r) {
  const calc = r.svcs.length ? `<button type="button" class="o-ear o-ear--calc" data-action="o-calc-open" aria-label="Калькулятор">${CALC_ICON}</button>` : '';
  return `<button type="button" class="o-ear o-ear--plus${r.svcs.length ? '' : ' is-solo'}" data-action="o-svc-open" aria-label="Добавить услугу">+</button>${calc}`;
}

function servicesView(e, r) {
  const sel = r.pick || r.svcs.map((x) => x.id);
  const added = sel.filter((id) => !r.svcs.some((x) => x.id === id)).length;
  return `${carousel(e, roomTabs(r))}
    <section class="f-plate o-sheet o-sheet--svc f-fill">
      <div class="o-list o-list--svc">${SVC.map((s0) => {
        const s = svcInfo(s0.id);
        const on = sel.includes(s.id);
        return `<button type="button" class="o-row o-row--svc" role="switch" aria-checked="${on}" data-action="o-svc-toggle" data-id="${s.id}">
          <span class="o-row__text"><span>${esc(s.name)}</span><small>от ${fmt(s.price)} ₽/м²</small></span>${toggle(on)}</button>`;
      }).join('')}</div>
      <div class="f-btn-row"><button type="button" class="f-btn" data-action="o-svc-done">Добавить выбранные${added ? ` · ${added}` : ''}</button></div>
    </section>`;
}

function svcCard(l, locked) {
  return `<div class="o-card">
    <div class="o-card__head"><span>${esc(l.name)}</span><small data-o-hours="${l.id}">${l.qty ? shiftsText(l.hours) : ''}</small></div>
    <div class="o-card__row">
      <label class="o-qty${locked ? ' is-locked' : ''}"><input inputmode="decimal" value="${l.qty ? esc(numTxt(l.qty)) : ''}" placeholder="—" ${locked ? 'readonly' : ''} data-live="o-qty" data-id="${l.id}" aria-label="${esc(l.name)}, м²"/><span>м²</span></label>
      <span class="o-x">×</span><span class="o-price">${fmt(l.price)} ₽/м²</span>
      <b class="o-sum" data-o-sum="${l.id}">${l.qty ? `= ${fmt(l.sum)} ₽` : ''}</b>
    </div>
  </div>`;
}

function volumesView(e, r) {
  const t = roomTotals(r);
  const locked = r.status === 'saved';
  const filled = r.svcs.length && r.svcs.every((x) => x.qty > 0);
  const status = locked ? '<span class="f-status f-status--ok o-status"><i></i>сохранено</span>' : '<span class="f-status f-status--warn o-status"><i></i>редактирование</span>';
  return `${carousel(e, roomTabs(r))}
    <section class="f-plate o-room f-fill">
      <div class="o-room__bar">${status}</div>
      ${t.lines.map((l) => svcCard(l, locked)).join('')}
    </section>
    <section class="o-card o-total" id="o-room-total" ${filled ? '' : 'hidden'}>
      <div class="o-card__head"><span>Итог комнаты</span></div>
      <div class="o-tiles"><div class="o-tile"><small>Стоимость</small><b id="o-room-sum">${fmt(t.total)} ₽</b></div><div class="o-tile"><small>Срок</small><b id="o-room-time">${shiftsText(t.hours)}</b></div></div>
    </section>
    <div class="f-btn-row" id="o-room-ok" ${filled ? '' : 'hidden'}>
      <button type="button" class="f-btn${locked ? ' f-btn--saved' : ''}" data-action="o-ok">ОК</button>
      ${r.status !== 'new' ? `<button type="button" class="f-btn${r.status === 'editing' ? ' f-btn--editing' : ''}" data-action="o-edit">Редактировать</button>` : ''}
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

function totalView(e) {
  const blocks = e.rooms.map((r) => {
    const t = roomTotals(r);
    return `<section class="f-plate o-room o-room--sum">
      <div class="o-room__head"><span>${esc(r.name)} · ${r.floor} этаж</span><span>${fmt(t.total)} ₽</span></div>
      ${t.lines.map((l) => svcCard(l, true)).join('')}
    </section>`;
  }).join('');
  const by = new Map();
  e.rooms.forEach((r) => r.svcs.forEach((x) => { by.set(x.id, (by.get(x.id) || 0) + (x.qty || 0)); }));
  const lines = [...by.entries()].map(([id, qty]) => { const s = svcInfo(id); return { ...s, qty: Math.round(qty * 100) / 100, sum: Math.round(qty * s.price), hours: hoursFor(qty, s.norm) }; });
  const total = lines.reduce((a, l) => a + l.sum, 0);
  const hours = lines.reduce((a, l) => a + l.hours, 0);
  return `${carousel(e)}
    <div class="f-fill o-stack">${blocks}
    <section class="f-plate o-room o-room--sum">
      <div class="o-room__head"><span>Итого по видам работ</span></div>
      ${lines.map((l) => svcCard(l, true)).join('')}
      <div class="o-card o-total"><div class="o-card__head"><span>Общий итог</span></div>
        <div class="o-tiles"><div class="o-tile"><small>Стоимость</small><b>${fmt(total)} ₽</b></div><div class="o-tile"><small>Срок</small><b>${shiftsText(hours)}</b></div></div></div>
    </section></div>
    <div class="f-btn-row o-noprint"><button type="button" class="f-btn" data-action="o-pdf">Скачать PDF</button></div>`;
}

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
  if (e.view === 'total' && carouselItems(e).some((x) => x.key === 'total')) html = totalView(e);
  else {
    const r = roomOf(e, e.view);
    if (!r) { e.view = 'pick'; html = pickView(e); }
    else if (r.panel === 'services') html = servicesView(e, r);
    else if (r.panel === 'calc') html = calcView(e, r);
    else if (r.svcs.length) html = volumesView(e, r);
    else html = carousel(e, roomTabs(r));
  }
  return `<i class="f-one" hidden></i><div class="o-wrap">${html}</div>${e.confirm ? confirmDialog(e.confirm) : ''}`;
}

// ---------- действия ----------
const D = () => { const st = S.get(); return est(st.oformit[S.me().id]); };
const save = () => { S.save(); rerender(); };

actions['o-view'] = (el) => { const e = D(); e.view = el.dataset.key; const r = roomOf(e, e.view); if (r && r.panel === 'calc') r.panel = ''; save(); window.scrollTo(0, 0); };
actions['o-floor'] = (el) => { D().floor = Number(el.dataset.f); save(); };
actions['o-room-toggle'] = (el) => {
  const e = D();
  const name = el.dataset.name;
  const ex = e.rooms.find((r) => r.floor === e.floor && r.name === name);
  if (ex) { e.confirm = { kind: 'room', key: ex.key, title: 'Удалить комнату?', text: `${name} и выбранные для неё услуги будут удалены из нового заказа.` }; save(); return; }
  const color = (ROOMS.find((x) => x[0] === name) || [])[1];
  e.rooms.push({ key: 'r' + Math.random().toString(36).slice(2, 8), floor: e.floor, name, color, svcs: [], status: 'new', panel: '' });
  e.rooms.sort((a, b) => a.floor - b.floor || ROOMS.findIndex((x) => x[0] === a.name) - ROOMS.findIndex((x) => x[0] === b.name));
  save();
};
actions['o-rooms-done'] = () => { const e = D(); if (!e.rooms.length) return; e.view = e.rooms[0].key; save(); window.scrollTo(0, 0); };
actions['o-svc-open'] = () => { const e = D(); const r = roomOf(e, e.view); r.pick = r.svcs.map((x) => x.id); r.panel = 'services'; save(); };
actions['o-svc-toggle'] = (el) => {
  const e = D(); const r = roomOf(e, e.view);
  const id = el.dataset.id;
  r.pick = r.pick || r.svcs.map((x) => x.id);
  if (r.pick.includes(id)) {
    if (r.svcs.some((x) => x.id === id)) { e.confirm = { kind: 'svc', id, title: 'Удалить услугу?', text: `${svcInfo(id).name} и её объём будут удалены из комнаты.` }; save(); return; }
    r.pick = r.pick.filter((x) => x !== id);
  } else r.pick.push(id);
  save();
};
actions['o-svc-done'] = () => {
  const e = D(); const r = roomOf(e, e.view);
  const pick = r.pick || [];
  pick.filter((id) => !r.svcs.some((x) => x.id === id)).forEach((id) => r.svcs.push({ id, qty: 0 }));
  r.svcs.sort((a, b) => SVC.findIndex((s) => s.id === a.id) - SVC.findIndex((s) => s.id === b.id));
  r.pick = null; r.panel = '';
  if (r.status === 'saved') r.status = 'editing';
  save();
};
actions['o-confirm-no'] = () => { D().confirm = null; save(); };
actions['o-confirm-yes'] = () => {
  const e = D(); const c = e.confirm; e.confirm = null;
  if (c.kind === 'room') { e.rooms = e.rooms.filter((r) => r.key !== c.key); if (e.view === c.key) e.view = 'pick'; }
  if (c.kind === 'svc') { const r = roomOf(e, e.view); r.svcs = r.svcs.filter((x) => x.id !== c.id); if (r.pick) r.pick = r.pick.filter((x) => x !== c.id); if (r.status === 'saved') r.status = 'editing'; }
  save();
};
// Объём вводится без перерисовки экрана: обновляем сумму, срок и итог комнаты на месте.
export function onLiveEstimate(el) {
  if (el.dataset.live !== 'o-qty') return false;
  const e = D(); const r = roomOf(e, e.view);
  const x = r.svcs.find((s) => s.id === el.dataset.id);
  const v = parseFloat(String(el.value).replace(',', '.').replace(/\s/g, ''));
  x.qty = Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : 0;
  S.save();
  const t = roomTotals(r);
  t.lines.forEach((l) => {
    const sum = document.querySelector(`[data-o-sum="${l.id}"]`); if (sum) sum.textContent = l.qty ? `= ${fmt(l.sum)} ₽` : '';
    const h = document.querySelector(`[data-o-hours="${l.id}"]`); if (h) h.textContent = l.qty ? shiftsText(l.hours) : '';
  });
  const filled = r.svcs.every((s) => s.qty > 0);
  const box = document.getElementById('o-room-total'); const ok = document.getElementById('o-room-ok');
  if (box) box.hidden = !filled; if (ok) ok.hidden = !filled;
  const a = document.getElementById('o-room-sum'); if (a) a.textContent = `${fmt(t.total)} ₽`;
  const b = document.getElementById('o-room-time'); if (b) b.textContent = shiftsText(t.hours);
  return true;
}
actions['o-ok'] = () => {
  const e = D(); const r = roomOf(e, e.view);
  if (r.status === 'saved') return;
  r.status = 'saved';
  { const t = roomTotals(r); logEvent(S.get().oformit[S.me().id], 'Сохранена оценка комнаты', `${r.name}: ${fmt(t.total)} ₽ · ${shiftsText(t.hours)}`); }
  // ОК → следующая комната; после последней — Итог.
  const i = e.rooms.indexOf(r);
  const nextNew = e.rooms.slice(i + 1).find((x) => x.status !== 'saved') || e.rooms.find((x) => x.status !== 'saved');
  e.view = nextNew ? nextNew.key : 'total';
  save(); window.scrollTo(0, 0);
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
