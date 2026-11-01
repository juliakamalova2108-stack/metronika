// Вкладка мастера «Оформить заказ». Экраны один в один из секции «Выезды» в Figma:
// раздел «00 · Канал» (кадры 3601:2 … 3601:871). Оценка и График — следующими разделами.

import { actions, rerender, go } from './core.js?v=95';
import * as S from './store.js?v=95';
import { CHANNELS } from './seed.js?v=95';
import { esc } from './ui.js?v=95';
import { logEvent } from './zlog.js?v=95';
import { fcls, ferr, liveMark, showErrors } from './fld.js?v=95';
export { logEvent };
import { renderEstimate, estimateState, onLiveEstimate } from './ocenka.js?v=95';
import { renderSchedule, scheduleState } from './grafik.js?v=95';

export const CHEVRON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="10" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="15" width="18" height="2" rx="1" fill="#A3AEBE"/></svg>';
const ICON_BRIEFCASE = (c) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform="translate(2.1 3.1)"><path d="M16.9 3.9H2.9C1.8 3.9.9 4.8.9 5.9v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-10c0-1.1-.9-2-2-2Z" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.9 3.9V.9h8v3M.9 8.9h18M7.9 8.9v3h4v-3" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

// Источники заявки: 9 вариантов, в окне видно 4 («Прокрутка · 4 из 9»).
const SOURCES = CHANNELS.filter((c) => c !== 'Самостоятельно');
// «Оформить заказ» (мастер сам себе): только начальный этап — канал, клиент, оценка, график.
const TABS = [['channel', 'Канал'], ['client', 'Клиент'], ['estimate', 'Оценка'], ['schedule', 'График']];
// «Текущий заказ» — все вкладки секции «Выезды».
const ALL_TABS = [['channel', 'Канал'], ['client', 'Клиент'], ['estimate', 'Оценка'], ['schedule', 'График'], ['material', 'Материал'], ['smeta', 'Смета'], ['chat', 'Чат'], ['tasks', 'Задачи'], ['finance', 'Финансы'], ['history', 'История']];
export const pickers = Object.create(null);
export const toggles = Object.create(null);

let tab = 'channel';
let open = '';

function draft() {
  const st = S.get();
  st.oformit = st.oformit || {};
  const id = S.draftKey();
  if (!st.oformit[id]) st.oformit[id] = { channel: { source: 'Авито', partner: 'self', url: '', pct: 0 }, saved: false, dirty: false, editing: true };
  return st.oformit[id];
}

// Партнёры мастера: агенты, у которых он в партнёрах, и диспетчеры, в чьей он команде.
function partners() {
  const me = S.me();
  const st = S.get();
  const agents = st.partnerships.filter((p) => p.partnerId === me.id && p.status === 'active').map((p) => S.user(p.agentId));
  return [...agents, ...S.dispatchersOf(me.id)].filter(Boolean);
}
const partnerName = (id) => (id === 'self' ? 'Самостоятельно' : (S.user(id) || {}).name || 'Самостоятельно');

export function selectField(key, label, value, options, locked, st = {}) {
  if (open === key && !locked) {
    const n = options.length;
    const thumb = n > 4 ? `<span class="f-scroll"><i style="height:${(188 * 4) / n}px;top:0" data-thumb="${key}"></i></span>` : '';
    return `<div class="f-field"><span class="f-field__label">${esc(label)}</span>
      <div class="f-select${fcls(st.changed, st.err)}">
        <button type="button" class="f-select__head" data-action="f-toggle" data-key="${key}" aria-expanded="true"><span>${esc(value)}</span><span class="f-icon-btn is-up">${CHEVRON}</span></button>
        <div class="f-select__list"><div class="f-select__win" data-scroll="${key}" role="listbox" aria-label="${esc(label)}">
          ${options.map((o) => `<button type="button" class="f-option${o.label === value ? ' is-on' : ''}" role="option" aria-selected="${o.label === value}" data-action="f-pick" data-key="${key}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('')}
        </div>${thumb}</div>
      </div></div>`;
  }
  return `<div class="f-field"><span class="f-field__label">${esc(label)}</span>
    <div class="f-input f-input--list${fcls(st.changed, st.err)}" data-action="${locked ? '' : 'f-toggle'}" data-key="${key}" role="button" aria-haspopup="listbox" aria-expanded="false" tabindex="0">
      <span class="f-input__value">${esc(value)}</span><span class="f-icon-btn">${CHEVRON}</span>
    </div>${ferr(st.err)}</div>`;
}

const CH_DEFAULT = { source: 'Авито', partner: 'self', url: '', pct: 0 };
const chSnap = (d) => d.chSnap || CH_DEFAULT;
const chChanged = (d, k) => d.editing && String(d.channel[k]) !== String(chSnap(d)[k]);
function channelPlate(d) {
  const c = d.channel;
  const err = d.chErr || {};
  const locked = !d.editing;
  // Пока форма правится и не сохранена — один статус «редактирование» (жёлтый), без «не сохранено».
  const reEdit = d.dirty || (d.saved && d.editing);
  const statusHtml = reEdit ? '<span class="f-status f-status--warn"><i></i>редактирование</span>'
    : d.saved ? '<span class="f-status f-status--ok"><i></i>сохранено</span>' : '';
  return `<i class="f-one" hidden></i><section class="f-plate f-fill" aria-label="Канал">
    ${selectField('source', 'Источник заявки', c.source, SOURCES.map((s) => ({ value: s, label: s })), locked, { changed: chChanged(d, 'source') })}
    ${selectField('partner', 'Партнёр', partnerName(c.partner), [{ value: 'self', label: 'Самостоятельно' }, ...partners().map((p) => ({ value: p.id, label: p.name }))], locked, { changed: chChanged(d, 'partner') })}
    <label class="f-field" for="f-url"><span class="f-field__label">Ссылка</span>
      <span class="f-input${fcls(chChanged(d, 'url'), err.url)}"><input id="f-url" type="url" inputmode="url" placeholder="Вставьте ссылку" value="${esc(c.url)}" ${locked ? 'readonly' : ''} data-live="f-url"/></span>${ferr(err.url)}</label>
    <label class="f-field" for="f-pct"><span class="f-field__label">Вознаграждение</span>
      <span class="f-input${fcls(chChanged(d, 'pct'), err.pct)}"><input id="f-pct" inputmode="decimal" value="${esc(String(c.pct).replace('.', ','))} %" ${locked ? 'readonly' : ''} data-live="f-pct"/></span>${ferr(err.pct)}</label>
    <div class="f-btn-row">
      <button type="button" class="f-btn${locked ? ' f-btn--saved' : ''}" data-action="f-save">${locked ? 'Сохранено' : 'Сохранить'}</button>
      ${d.saved ? `<button type="button" class="f-btn${reEdit ? ' f-btn--editing' : ''}" data-action="f-edit" aria-pressed="${reEdit}">${reEdit ? 'Редактирование' : 'Редактировать'}</button>` : ''}
    </div>
    ${statusHtml}
  </section>`;
}

// Нижняя навигация «Оформить заказ» / «Текущий заказ»: «Меню» и вкладки разделов (листаются вбок, если не влезают).
function nav(tabsHtml, many, right = '') {
  return `<nav class="f-nav f-nav--tabs" aria-label="Нижнее меню">
    <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open">${ICON_MENU}<span>Меню</span></button>
    ${tabsHtml ? `<div class="f-topnav f-botnav${many ? ' f-botnav--many' : ''}"><div class="f-topnav__track" role="tablist">${tabsHtml}</div></div>` : right ? '' : '<span class="f-nav__space"></span>'}${right}
  </nav>`;
}

export function setOformitTab(t) { tab = t; }
export const getOpen = () => open;
export function setOpen(v) { open = v; }
export { draft as oformitDraft };

const sections = Object.create(null);
export function registerSection(key, render, state) { sections[key] = { render, state }; }

// opts.only — показать один раздел (правка блока заказа с доски): без вкладок других разделов,
// внизу вместо них opts.navHtml (например «← К заказу»).
export function renderOformit(mode = 'oformit', opts = {}) {
  const d = draft();
  const keepTab = tab; // свой раздел «Оформить заказ» не сбиваем
  if (opts.only) tab = opts.only;
  const tabs = opts.only ? ALL_TABS.filter(([k]) => k === opts.only) : mode === 'oformit' ? TABS : ALL_TABS; // «Оформить заказ» — 4 вкладки, «Текущий заказ» — все разделы «Выездов»
  if (!tabs.some(([k]) => k === tab)) tab = 'channel';
  const body = tab === 'channel' ? channelPlate(d)
    : tab === 'estimate' ? renderEstimate(d)
      : tab === 'schedule' ? renderSchedule(d)
        : sections[tab].render(d);
  // Точка у вкладки — как статус в карточке: жёлтая «редактирование», зелёная «сохранено».
  const stateOf = (k) => {
    if (k === 'channel') return d.dirty || (d.saved && d.editing) ? 'warn' : d.saved ? 'ok' : '';
    if (k === 'estimate') return estimateState(d);
    if (k === 'schedule') return scheduleState(d);
    return sections[k] && sections[k].state ? sections[k].state(d) : '';
  };
  if (opts.only) tab = keepTab;
  const tabsHtml = tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="f-tab${k === tab ? ' is-active' : ''}" data-action="f-tab" data-tab="${k}">${t}${((st) => (st ? `<i class="f-tab__dot${st === 'ok' ? ' f-tab__dot--ok' : ''}" aria-label="${st === 'ok' ? 'сохранено' : 'редактирование'}"></i>` : ''))(stateOf(k))}</button>`).join('');
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    ${body}
    ${nav(opts.only ? opts.navHtml || '' : tabsHtml, !opts.only && tabs.length > 4, opts.navRight || '')}`;
}

function markDirty(d) {
  if (!d.dirty) { d.dirty = true; S.save(); rerender(); return true; }
  S.save();
  return false;
}

actions['f-tab'] = (el) => { tab = el.dataset.tab; open = ''; rerender(); };
actions['f-toggle'] = (el) => {
  const d = draft();
  open = open === el.dataset.key ? '' : el.dataset.key;
  // По макету «01 · источник раскрыт»: начали править — форма уже «не сохранено».
  const key = el.dataset.key;
  if (open && (key === 'source' || key === 'partner')) { d.dirty = true; S.save(); }
  if (open && toggles[key]) toggles[key](d);
  rerender();
};
actions['f-pick'] = (el) => {
  const d = draft();
  const k = el.dataset.key === 'source' ? 'source' : 'partner';
  if (pickers[el.dataset.key]) { open = ''; pickers[el.dataset.key](el.dataset.value, d); S.save(); rerender(); return; }
  if (d.channel[k] !== el.dataset.value) { d.channel[k] = el.dataset.value; d.dirty = true; }
  if (k === 'partner' && d.chErr) delete d.chErr.pct;
  open = '';
  S.save();
  rerender();
};
actions['f-save'] = () => {
  const d = draft();
  if (!d.editing && !d.dirty) return;
  const c = d.channel; const err = {};
  if (c.url && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}/i.test(c.url)) err.url = 'Похоже, это не ссылка';
  if (c.partner !== 'self' && !(c.pct > 0)) err.pct = 'Укажите процент партнёру';
  d.chErr = err;
  if (Object.keys(err).length) { open = ''; S.save(); rerender(); showErrors(); return; }
  d.chSnap = { ...c };
  d.saved = true; d.dirty = false; d.editing = false; open = '';
  setTimeout(() => document.dispatchEvent(new CustomEvent('section-saved', { detail: 'channel' })), 0);
  logEvent(d, 'Сохранён канал', `${d.channel.source}${d.channel.partner !== 'self' ? ' · ' + partnerName(d.channel.partner) + ' · ' + d.channel.pct + ' %' : ''}`);
  S.save(); rerender();
};
actions['f-edit'] = () => { const d = draft(); if (!d.saved) return; d.editing = true; S.save(); rerender(); };

export function onLiveOformit(el) {
  if (onLiveEstimate(el)) return true;
  const k = el.dataset.live;
  if (k !== 'f-url' && k !== 'f-pct') return false;
  const d = draft();
  if (k === 'f-url') d.channel.url = el.value.trim();
  if (k === 'f-pct') {
    const raw = el.value.replace(/[^\d,.]/g, '').replace(',', '.');
    const v = parseFloat(raw);
    d.channel.pct = Number.isFinite(v) ? Math.min(100, v) : 0;
  }
  const field = k === 'f-url' ? 'url' : 'pct';
  if (d.chErr) delete d.chErr[field];
  liveMark(el, chChanged(d, field));
  const pos = el.selectionStart;
  if (markDirty(d)) {
    const again = document.getElementById(el.id);
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* поле ссылки */ } }
  }
  return true;
}

// Ползунок прокрутки списка: 4 строки в окне.
document.addEventListener('scroll', (ev) => {
  const win = ev.target;
  if (!win.dataset || !win.dataset.scroll) return;
  const thumb = document.querySelector(`[data-thumb="${win.dataset.scroll}"]`);
  if (!thumb) return;
  const max = win.scrollHeight - win.clientHeight;
  const h = thumb.offsetHeight;
  thumb.style.top = `${max > 0 ? (win.scrollTop / max) * (188 - h) : 0}px`;
}, true);

// «%» дописывается к числу: при фокусе убираем, при уходе возвращаем.
document.addEventListener('focusin', (ev) => { if (ev.target.id !== 'f-pct' || ev.target.readOnly) return; ev.target.value = ev.target.value.replace(/\s*%$/, ''); if (ev.target.value === '0') ev.target.value = ''; });
document.addEventListener('focusout', (ev) => { if (ev.target.id === 'f-pct') ev.target.value = `${ev.target.value.replace(/\s*%$/, '') || '0'} %`; });

// Карусель комнат листается свайпом по всему экрану (кроме верхней и нижней навигации):
// один свайп — одна комната. Срабатывает сразу, как только палец сдвинулся, не дожидаясь отпускания.
let swipe = null;
let suppressClick = false;
const NO_SWIPE = '.f-topnav, .f-nav, input, textarea, select, .g-tray, .f-select__win, .o-overlay, .o-dialog, .drawer, .sheet';
document.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'touch') return; // касания ведут touch-события ниже
  swipe = null; suppressClick = false;
  if (!ev.isPrimary) return;
  swipe = startSwipe(ev.target, ev.clientX, ev.clientY);
}, true);
document.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'touch' || !swipe || swipe.done) return;
  const dx = ev.clientX - swipe.x; const dy = ev.clientY - swipe.y;
  if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; } // это прокрутка списка
  if (Math.abs(dx) < 28 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  swipe.done = true;
  const btn = swipe.head.querySelector(dx < 0 ? 'button.o-back--r' : 'button.o-back--l');
  if (btn) { suppressClick = true; btn.click(); setTimeout(() => { suppressClick = false; }, 400); }
}, true);
document.addEventListener('pointerup', (ev) => { if (ev.pointerType !== 'touch') swipe = null; }, true);
// На телефонах жест ведём по касаниям: начало — touchstart, решение — первое заметное движение.
// Горизонтальный жест забираем у прокрутки (preventDefault), вертикальный оставляем спискам.
function startSwipe(target, x, y) {
  if (!document.body.classList.contains('fig')) return null;
  if (target.closest && target.closest(NO_SWIPE)) return null;
  const head = document.querySelector('#view .o-head');
  return head ? { head, x, y, done: false } : null;
}
document.addEventListener('touchstart', (ev) => {
  if (ev.touches.length !== 1) { swipe = null; return; }
  const t = ev.touches[0];
  suppressClick = false;
  swipe = startSwipe(ev.target, t.clientX, t.clientY);
}, { capture: true, passive: true });
document.addEventListener('touchmove', (ev) => {
  if (!swipe || !ev.touches[0]) return;
  const t = ev.touches[0];
  const dx = t.clientX - swipe.x; const dy = t.clientY - swipe.y;
  if (swipe.done) { if (ev.cancelable) ev.preventDefault(); return; }
  if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; } // прокрутка списка
  if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) && ev.cancelable) ev.preventDefault();
  if (Math.abs(dx) < 28) return;
  swipe.done = true;
  const btn = swipe.head.querySelector(dx < 0 ? 'button.o-back--r' : 'button.o-back--l');
  if (btn) { suppressClick = true; btn.click(); setTimeout(() => { suppressClick = false; }, 400); }
}, { capture: true, passive: false });
document.addEventListener('touchend', () => { setTimeout(() => { swipe = null; }, 0); }, true);
document.addEventListener('click', (ev) => { if (suppressClick && ev.isTrusted) { ev.stopPropagation(); ev.preventDefault(); } }, true);
