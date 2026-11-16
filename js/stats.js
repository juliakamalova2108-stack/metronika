// Статистика мастера: 5 разделов — Финансы, Воронка, Объекты, Услуги, Время.
// Содержимое разделов пока пустое (в разработке). Прежние расчёты и графики удалены.
import { actions, rerender } from './core.js?v=524';
import { ICON_MENU } from './ui.js?v=524';

const TABS = [['fin', 'Финансы'], ['funnel', 'Воронка'], ['obj', 'Объекты'], ['serv', 'Услуги'], ['time', 'Время']];
let tab = 'fin';

actions['sd2-tab'] = (el) => { const k = el.dataset.k; if (TABS.some(([t]) => t === k)) { tab = k; rerender(); } };

export function renderStatsMaster() {
  const title = (TABS.find(([k]) => k === tab) || TABS[0])[1];
  const body = `<section class="sd-empty"><p class="sd-empty__t">${title}</p><p class="sd-empty__s">Раздел пока пустой</p></section>`;
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    <div class="h-page sd"><header class="sd-hd"><h1>Статистика</h1></header>${body}</div>
    <nav class="f-nav f-nav--otabs f-nav--txt" aria-label="Нижнее меню">
      <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open" aria-label="Меню">${ICON_MENU}<span>Меню</span></button>
      ${TABS.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === tab}" class="f-nav__tab${k === tab ? ' is-on' : ''}" data-action="sd2-tab" data-k="${k}"><span>${t}</span></button>`).join('')}
    </nav>`;
}
