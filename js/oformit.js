// Вкладка мастера «Оформить заказ». Экраны один в один из секции «Выезды» в Figma:
// Разделы регистрации: Оценка, План, Клиент.

import { actions, rerender, go } from './core.js?v=570';
import * as S from './store.js?v=570';
import { esc, toast, ICON_MENU } from './ui.js?v=570';
import { logEvent } from './zlog.js?v=570';
import { fcls, ferr } from './fld.js?v=570';
export { logEvent };
import { renderEstimate, estimateState, onLiveEstimate, estimateOnTotal, estimateRooms, roomTotals } from './ocenka.js?v=570';
import { renderSchedule, scheduleState, scheduleSummary } from './grafik.js?v=570';

export const CHEVRON = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_BRIEFCASE = (c) => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><g transform="translate(2.1 3.1)"><path d="M16.9 3.9H2.9C1.8 3.9.9 4.8.9 5.9v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-10c0-1.1-.9-2-2-2Z" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.9 3.9V.9h8v3M.9 8.9h18M7.9 8.9v3h4v-3" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

// Регистрация нового заказа — только вводные разделы. Замер/Материал/Финансы/Чат появляются при исполнении.
// По важности слева направо: Оценка, План, Клиент.
const TABS = [['estimate', 'Оценка'], ['schedule', 'План'], ['client', 'Клиент']];
// «Текущий заказ» — все вкладки секции «Выезды».
const ALL_TABS = [['client', 'Клиент'], ['estimate', 'Оценка'], ['schedule', 'План'], ['chat', 'Чат'], ['tasks', 'Задачи'], ['history', 'История']];
export const pickers = Object.create(null);
export const toggles = Object.create(null);

let tab = 'estimate';
let open = '';

function draft() {
  const st = S.get();
  st.oformit = st.oformit || {};
  const id = S.draftKey();
  if (!st.oformit[id]) st.oformit[id] = {};
  return st.oformit[id];
}

export function selectField(key, label, value, options, locked, st = {}) {
  if (open === key && !locked) {
    const n = options.length;
    const thumb = n > 4 ? `<span class="f-scroll"><i style="height:${(188 * 4) / n}px;top:0" data-thumb="${key}"></i></span>` : '';
    return `<div class="f-field"><span class="f-field__label">${esc(label)}</span>
      <div class="f-select${fcls(st.changed, st.err)}">
        <button type="button" class="f-select__head" data-action="f-toggle" data-key="${key}" aria-expanded="true"><span>${st.vhtml || esc(value)}</span><span class="f-icon-btn is-up">${CHEVRON}</span></button>
        <div class="f-select__list"><div class="f-select__win" data-scroll="${key}" role="listbox" aria-label="${esc(label)}">
          ${options.map((o) => `<button type="button" class="f-option${o.label === value ? ' is-on' : ''}" role="option" aria-selected="${o.label === value}" data-action="f-pick" data-key="${key}" data-value="${esc(o.value)}">${o.html || esc(o.label)}</button>`).join('')}
        </div>${thumb}</div>
      </div></div>`;
  }
  return `<div class="f-field"><span class="f-field__label">${esc(label)}</span>
    <div class="f-input f-input--list${fcls(st.changed, st.err)}" data-action="${locked ? '' : 'f-toggle'}" data-key="${key}" role="button" aria-haspopup="listbox" aria-expanded="false" tabindex="0">
      <span class="f-input__value">${st.vhtml || esc(value)}</span><span class="f-icon-btn">${CHEVRON}</span>
    </div>${ferr(st.err)}</div>`;
}

// Нижняя навигация «Оформить заказ» / «Текущий заказ»: «Меню» и вкладки разделов (листаются вбок, если не влезают).
// Нижняя навигация правки раздела — в стиле открытого заказа (f-nav--otabs). Старый трек (f-topnav/f-tab) удалён.
function nav(left, _many, right = '') {
  return `<nav class="f-nav f-nav--otabs" aria-label="Нижнее меню">
    <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open">${ICON_MENU}<span>Меню</span></button>${left || (right ? '' : '<span class="f-nav__space"></span>')}${right}
  </nav>`;
}

export function setOformitTab(t) { tab = t; }
export const getOpen = () => open;
export function setOpen(v) { open = v; }
export { draft as oformitDraft };

const sections = Object.create(null);
export function registerSection(key, render, state) { sections[key] = { render, state }; }

// Единая сущность «Итог / Инф» — ОДИН источник для регистрации и для вкладки «Инф» заказа.
// Два шага:
//   1) обычный вид комнат (e.view — комната): только Оценка (комнаты + расчёт), как раньше — без календаря и прочего;
//   2) «Итог комнат» (нажата плитка «Итог», e.view==='total'): гармошка из трёх шагов — Итог → План → Клиент.
//      Активен один шаг (развёрнут), остальные — узкие плашки-сводки. «Далее» переводит на следующий;
//      на шаге «Клиент» вместо «Далее» — кнопки исхода (В очередь / Согласование / Отказ).
// Каждый раздел несёт свой .f-one/.f-fill — снимаем их, скроллом управляет общий контейнер обёртки.
const stripFOne = (h) => h.replace(/<i class="f-one" hidden><\/i>/g, '').replace(/ f-fill\b/g, '');
const REG_STEPS = ['estimate', 'schedule', 'client'];
const REG_TITLE = { estimate: 'Итог', schedule: 'План', client: 'Клиент' };
const REG_COLOR = { estimate: '#9fd15a', schedule: '#56a7e0', client: '#f59e0b' };
const REG_ICON = {
  estimate: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M7 10h6M10 7v6"/></svg>',
  schedule: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="14" height="13" rx="2.5"/><path d="M3 8.5h14M7 2v4M13 2v4"/></svg>',
  client:   '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="7.5" r="3.5"/><path d="M3.5 17.5c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5"/></svg>'
};
function regCardInfo(d, key) {
  if (key === 'estimate') {
    const rooms = estimateRooms(d);
    const total = rooms.reduce((a, r) => a + roomTotals(r).total, 0);
    const names = rooms.map(r => r.name || 'Комната').join(', ');
    return { main: `${total.toLocaleString('ru-RU')} ₽`, sub: `${rooms.length} комн. · ${names}` };
  }
  if (key === 'schedule') {
    const sum = scheduleSummary(d);
    const mode = d.sched?.mode === 'measure' ? 'Замер' : 'График';
    return { main: sum, sub: mode };
  }
  const c = d.cl || {};
  if (!c.name) return { main: 'не заполнен', sub: '' };
  const parts = [c.phone, [c.street, c.house].filter(Boolean).join(' ')].filter(Boolean);
  return { main: c.name, sub: parts.join(' · ') };
}
const regCard = (d, key) => {
  const info = regCardInfo(d, key);
  const color = REG_COLOR[key];
  return `<section class="reg-card" style="--rc:${color}" data-action="reg-step" data-step="${key}" role="button" tabindex="0">
    <span class="reg-card__icon">${REG_ICON[key]}</span>
    <span class="reg-card__body">
      <span class="reg-card__title">${REG_TITLE[key]}</span>
      <span class="reg-card__main">${esc(info.main)}</span>
      ${info.sub ? `<span class="reg-card__sub">${esc(info.sub)}</span>` : ''}
    </span>
    <span class="reg-card__chev">${CHEVRON}</span>
  </section>`;
};
const regFooter = (key) => key === 'client'
  ? `<div class="reg-out">
      <button type="button" class="g-act g-act--next" data-action="f-create" data-stage="queue">В очередь</button>
      <button type="button" class="g-act g-act--soglas" data-action="f-create" data-stage="approval">Согласование</button>
      <button type="button" class="g-act g-act--no" data-action="f-create" data-stage="refused">Отказ</button>
    </div>`
  : `<div class="reg-nav"><button type="button" class="o-grand__next reg-next" data-action="reg-next">Далее</button></div>`;
export function renderInfoStack(d, extra = '') {
  if (!estimateOnTotal(d)) return renderEstimate(d); // шаг 1 — только комнаты + расчёт
  const isReg = !String(S.draftKey()).startsWith('ord-');
  // Открытый заказ («Инф»): просто стопка разделов без шагов-исходов (у Плана/Клиента свои ОК/Сохранить).
  if (!isReg) {
    const stacked = [renderEstimate(d), renderSchedule(d), sections['client'].render(d)]
      .map((sc) => `<div class="reg-sec">${stripFOne(sc)}</div>`).join('');
    return `<i class="f-one" hidden></i><div class="o-wrap"><div class="o-stack f-fill reg-scroll">${stacked}${extra}</div></div>`;
  }
  // Регистрация: гармошка шагов Итог → План → Клиент.
  // Прогрессивное появление: regMax — самый дальний достигнутый шаг (0=Итог, 1=План, 2=Клиент).
  const step = REG_STEPS.includes(d.regStep) ? d.regStep : 'estimate';
  const stepIdx = REG_STEPS.indexOf(step);
  const maxIdx = typeof d.regMax === 'number' ? Math.max(d.regMax, stepIdx) : stepIdx;
  if (d.regMax !== maxIdx) { d.regMax = maxIdx; S.save(); }
  const visible = REG_STEPS.slice(0, maxIdx + 1);
  const full = { estimate: () => renderEstimate(d), schedule: () => renderSchedule(d), client: () => sections['client'].render(d) };
  const stacked = visible.map((key) => key === step
    ? `<div class="reg-sec reg-sec--open">${stripFOne(full[key]())}${regFooter(key)}</div>`
    : regCard(d, key)).join('');
  return `<i class="f-one" hidden></i><div class="o-wrap"><div class="o-stack f-fill reg-scroll">${stacked}${extra}</div></div>`;
}
const regGoto = (step) => { const d = draft(); d.regStep = step; const i = REG_STEPS.indexOf(step);
  if (typeof d.regMax !== 'number' || i > d.regMax) d.regMax = i;
  S.save(); rerender();
  requestAnimationFrame(() => { const el = document.querySelector('.reg-sec--open'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); };
actions['reg-step'] = (el) => regGoto(el.dataset.step);
actions['reg-next'] = () => { const d = draft(); const i = REG_STEPS.indexOf(d.regStep || 'estimate');
  const next = Math.min(i + 1, REG_STEPS.length - 1);
  d.regMax = typeof d.regMax === 'number' ? Math.max(d.regMax, next) : next;
  regGoto(REG_STEPS[next]); };

// opts.only — показать один раздел (правка блока заказа с доски): без вкладок других разделов,
// внизу вместо них opts.navHtml (например «← К заказу»).
export function renderOformit(mode = 'oformit', opts = {}) {
  const d = draft();
  const keepTab = tab; // свой раздел «Оформить заказ» не сбиваем
  if (opts.only) tab = opts.only;
  const tabs = opts.only ? ALL_TABS.filter(([k]) => k === opts.only) : mode === 'oformit' ? TABS : ALL_TABS; // «Сущность» (бывш. «Оформить заказ») — все разделы, «Текущий заказ» — все разделы «Выездов»
  if (!tabs.some(([k]) => k === tab)) tab = tabs[0][0];
  // Регистрация — вкладка «Итог»: все разделы одной «портянкой» (Оценка → План → Клиент)
  // и внизу кнопки исхода — всё в одном скролле (.o-wrap/.f-fill, как в открытом заказе).
  const isReg = mode === 'oformit' && !opts.only;
  let body;
  if (isReg) {
    // Шаг 1 — только комнаты + расчёт; шаг 2 — «Итог комнат»: на пластине «Общий итог» кнопки «Далее»/«Отказ»,
    // ниже План/Клиент. Кнопки исхода — на пластине под календарём «Плана» (см. grafik.js).
    body = renderInfoStack(d);
  } else {
    body = tab === 'estimate' ? renderEstimate(d)
      : tab === 'schedule' ? renderSchedule(d)
        : sections[tab].render(d);
  }
  // Точка у вкладки — как статус в карточке: жёлтая «редактирование», зелёная «сохранено».
  const stateOf = (k) => {
    if (k === 'estimate') return estimateState(d);
    if (k === 'schedule') return scheduleState(d);
    return sections[k] && sections[k].state ? sections[k].state(d) : '';
  };
  if (opts.only) tab = keepTab;
  // Нижнее меню регистрации — в том же стиле, что открытый заказ (f-nav--otabs: иконка + подпись).
  const O_IC = {
    estimate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M8.5 7.5h7M8.5 11.5h7M8.5 15.5h4"/></svg>',
    schedule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="16" rx="2.2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/></svg>',
    client: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5"/></svg>',
  };
  const otabs = tabs.map(([k, t]) => { const st = stateOf(k);
    return `<button type="button" role="tab" aria-selected="${k === tab}" class="f-nav__tab${k === tab ? ' is-on' : ''}" data-action="f-tab" data-tab="${k}">${O_IC[k] || ''}<span>${t}</span>${st ? `<i class="f-nav__dot${st === 'ok' ? ' f-nav__dot--ok' : ''}"></i>` : ''}</button>`; }).join('');
  const regNav = `<nav class="f-nav f-nav--otabs" aria-label="Разделы заказа" role="tablist"><button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open">${ICON_MENU}<span>Меню</span></button>${otabs}</nav>`;
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    ${body}
    ${opts.only ? nav(opts.navHtml || '', false, opts.navRight || '') : isReg ? `<button type="button" class="h-menu bd-fab" data-action="menu-open" aria-label="Меню">${ICON_MENU}</button>` : regNav}`;
}

let creating = false;
const STAGE_NAME = { measure: 'Замер', approval: 'Согласование', queue: 'Очередь', refused: 'Отказ' };
actions['f-create'] = (el) => {
  // Двойное нажатие не создаёт второй (пустой) заказ: черновик уже ушёл, а замок держит повтор.
  if (creating) return;
  const st0 = S.get();
  if (!st0.oformit || !st0.oformit[S.draftKey()]) return;
  creating = true; setTimeout(() => { creating = false; }, 1200);
  const st = S.get(), d = draft();
  let n = 1000 + (st.myOrders || []).length + 21; while (st.oformit['ord-' + n]) n++;
  const no = String(n);
  // Исход разговора задаёт этап, в столбец которого заказ попадёт в «Заказах».
  const stage = (el && el.dataset.stage) || (d.sched && d.sched.mode === 'measure' ? 'measure' : 'queue');
  const o = JSON.parse(JSON.stringify(d)); o.flow = { st: stage, chk: {}, shift: {}, done: {}, day: 1 };
  st.oformit['ord-' + no] = o; (st.myOrders = st.myOrders || []).push(no);
  delete st.oformit[S.draftKey()]; tab = 'estimate'; S.save();
  toast(`Заказ №${no} → «${STAGE_NAME[stage] || stage}»`);
  go('bd-order-' + no);
};
actions['f-tab'] = (el) => { tab = el.dataset.tab; open = ''; rerender(); };
actions['f-toggle'] = (el) => {
  const d = draft();
  open = open === el.dataset.key ? '' : el.dataset.key;
  const key = el.dataset.key;
  if (open && toggles[key]) toggles[key](d);
  rerender();
};
actions['f-pick'] = (el) => {
  const d = draft();
  if (pickers[el.dataset.key]) { open = ''; pickers[el.dataset.key](el.dataset.value, d); S.save(); rerender(); }
};

export function onLiveOformit(el) {
  return onLiveEstimate(el);
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

// Карусель комнат листается свайпом по всему экрану (кроме верхней и нижней навигации):
// один свайп — одна комната. Срабатывает сразу, как только палец сдвинулся, не дожидаясь отпускания.
let swipe = null;
let suppressClick = false;
const NO_SWIPE = '.gt-scroll, .z-rvs, .f-topnav, .f-nav, input, textarea, select, .g-tray, .f-select__win, .o-overlay, .o-dialog, .drawer, .sheet';
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
