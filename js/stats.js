// Статистика мастера: 5 разделов — Финансы, Воронка, Объекты, Услуги, Время.
// Содержимое разделов пока пустое (в разработке). Прежние расчёты и графики удалены.
import { actions, rerender } from './core.js?v=547';
import { ICON_MENU } from './ui.js?v=547';

// Иконки разделов (в стиле навигации заказа: обводка, без заливки).
const IC = {
  fin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3M8.5 13.5h4"/></svg>',
  funnel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z"/></svg>',
  obj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V8l6-4 6 4M4 21h16M4 21V10m16 11V8l-4-2.7M9 21v-5h3v5"/><path d="M20 21V8"/></svg>',
  serv: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/></svg>',
  time: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  exp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.2 7 20l5-2.6L17 20l-1.5-6.8"/></svg>',
};
const TABS = [['fin', 'Финансы'], ['funnel', 'Воронка'], ['obj', 'Объекты'], ['serv', 'Услуги'], ['time', 'Время'], ['exp', 'Опыт']];
let tab = 'fin';

actions['sd2-tab'] = (el) => { const k = el.dataset.k; if (TABS.some(([t]) => t === k)) { tab = k; rerender(); } };

export function renderStatsMaster() {
  const title = (TABS.find(([k]) => k === tab) || TABS[0])[1];
  const body = `<section class="sd-empty"><p class="sd-empty__t">${title}</p><p class="sd-empty__s">Раздел пока пустой</p></section>`;
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    <div class="h-page sd"><header class="sd-hd"><h1>Статистика</h1></header>${body}</div>
    <nav class="f-nav f-nav--otabs" aria-label="Нижнее меню">
      <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open" aria-label="Меню">${ICON_MENU}<span>Меню</span></button>
      ${TABS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="f-nav__tab${k === tab ? ' is-on' : ''}" data-action="sd2-tab" data-k="${k}">${IC[k] || ''}<span>${t}</span></button>`).join('')}
    </nav>`;
}
