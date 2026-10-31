// Оболочка прототипа: какие экраны есть у роли, нижняя панель, меню, обработка нажатий.

import { actions, setRenderer, rerender, route, go } from './core.js';
import * as S from './store.js';
import { esc, ICONS, sheet, closeSheet, toast } from './ui.js';
import { renderAuth, isUnlocked, logout, submitForm, onSeg as onSegAuth } from './auth.js';
import { renderSettlements, renderProfile } from './shared.js';
import { renderNewOrder, renderAgentOrders, renderAgentOrder, onSegAgent, onLive } from './agent.js';
import { renderProOrders, renderProOrder, renderCurrentOrder, onSegPro, incomingCount } from './pro.js';

const VERSION = 'прототип 0.1';

function roleOf(u) {
  if (S.hasRole(u, 'agent')) return 'agent';
  if (S.hasRole(u, 'dispatcher')) return 'dispatcher';
  return 'master';
}

// Экраны по ролям. Ключ — имя в адресе после #.
const SCREENS = {
  agent: {
    start: 'new',
    nav: [['menu', 'Меню', 'menu'], ['new', 'Новая заявка', 'plus'], ['mine', 'Мои заявки', 'list'], ['money', 'Начисления', 'wallet']],
    menu: [['new', 'Новая заявка'], ['mine', 'Мои заявки'], ['money', 'Начисления'], ['profile', 'Профиль']],
  },
  master: {
    start: 'orders',
    nav: [['menu', 'Меню', 'menu'], ['current', 'Текущий заказ', 'briefcase'], ['orders', 'Заказы', 'inbox'], ['money', 'Начисления', 'wallet']],
    menu: [['current', 'Текущий заказ'], ['orders', 'Заказы'], ['money', 'Начисления'], ['profile', 'Профиль']],
  },
};
SCREENS.dispatcher = SCREENS.master;

function screenFor(name, role) {
  if (name === 'money') return renderSettlements();
  if (name === 'profile') return renderProfile();
  if (role === 'agent') {
    if (name === 'new') return renderNewOrder();
    if (name === 'mine') return renderAgentOrders();
    if (name.startsWith('a-order-')) return renderAgentOrder(name.slice(8));
  } else {
    if (name === 'orders') return renderProOrders();
    if (name === 'current') return renderCurrentOrder();
    if (name.startsWith('p-order-')) return renderProOrder(name.slice(8));
  }
  return null;
}

function tabbar(role, current) {
  const cfg = SCREENS[role];
  const badge = role === 'agent' ? 0 : incomingCount();
  return cfg.nav.map(([key, label, icon]) => {
    const active = key === current || (key === 'mine' && current.startsWith('a-order-')) || (key === 'orders' && current.startsWith('p-order-'));
    const b = key === 'orders' && badge ? `<span class="tabbar__badge">${badge}</span>` : '';
    const act = key === 'menu' ? 'data-action="menu-open"' : `data-action="go" data-to="${key}"`;
    return `<button type="button" class="tabbar__item${active ? ' is-active' : ''}" ${act} ${active ? 'aria-current="page"' : ''}><span class="tabbar__icon">${ICONS[icon]}${b}</span>${esc(label)}</button>`;
  }).join('');
}

function drawer(role) {
  const me = S.me();
  const cfg = SCREENS[role];
  return `<div class="drawer__scrim" data-action="menu-close"></div>
    <nav class="drawer__panel" aria-label="Меню">
      <div class="brand"><div class="brand__sphere" aria-hidden="true"></div><div class="brand__word">METRONICA</div><div class="brand__sub">Единая среда для профессионалов</div></div>
      ${cfg.menu.map(([key, label]) => `<button type="button" class="btn drawer__item" data-action="menu-go" data-to="${key}">${esc(label)}</button>`).join('')}
      <div class="drawer__foot">
        <span>${esc(me.name)} · ${esc(me.roles.map((r) => S.ROLE_NAMES[r]).join(' и '))}</span>
        <button type="button" class="btn btn--ghost" data-action="switch-user">Сменить пользователя</button>
        <button type="button" class="btn btn--ghost" data-action="reset-ask">Сбросить демо-данные</button>
        <span>Метроника · ${VERSION}</span>
        <span>Ещё не собрано: график комнат, материал, смета, чат, задачи, финансы заказа, команда диспетчера, статистика, настройки.</span>
      </div>
    </nav>`;
}

function render() {
  const view = document.getElementById('view');
  const bar = document.getElementById('tabbar');
  const drawerEl = document.getElementById('drawer');
  const me = S.me();
  if (!me || !isUnlocked()) {
    document.body.classList.add('is-auth');
    bar.hidden = true;
    drawerEl.innerHTML = '';
    view.innerHTML = renderAuth();
    document.title = 'Метроника — вход';
    return;
  }
  document.body.classList.remove('is-auth');
  const role = roleOf(me);
  let name = route();
  let html = name ? screenFor(name, role) : null;
  if (html == null) {
    name = SCREENS[role].start;
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    html = screenFor(name, role);
  }
  view.innerHTML = html;
  bar.hidden = false;
  bar.innerHTML = tabbar(role, name);
  if (!drawerEl.classList.contains('is-on')) drawerEl.innerHTML = drawer(role);
  const activeTab = view.querySelector('.tabs__item.is-active');
  if (activeTab) {
    const strip = activeTab.parentElement;
    strip.scrollLeft = activeTab.offsetLeft - (strip.clientWidth - activeTab.offsetWidth) / 2;
  }
  document.title = 'Метроника';
}

setRenderer(render);

// ---------- действия оболочки ----------
actions['menu-open'] = () => {
  const el = document.getElementById('drawer');
  el.innerHTML = drawer(roleOf(S.me()));
  el.classList.add('is-on');
  const first = el.querySelector('.drawer__item');
  if (first) first.focus();
};
actions['menu-close'] = () => document.getElementById('drawer').classList.remove('is-on');
actions['menu-go'] = (el) => { actions['menu-close'](); go(el.dataset.to); };
actions['switch-user'] = () => { actions['menu-close'](); logout(); location.hash = ''; rerender(); };
actions['logout'] = () => { logout(); location.hash = ''; rerender(); };
actions['reset-ask'] = () => {
  actions['menu-close']();
  sheet({
    title: 'Сбросить демо-данные?',
    body: '<p>Удалятся все созданные заказы, начисления и добавленные пользователи. Вернутся исходные демо-аккаунты.</p>',
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Сбросить', action: 'reset-do', primary: true }],
  });
};
actions['reset-do'] = () => { closeSheet(); S.resetDemo(); logout(); location.hash = ''; rerender(); toast('Демо-данные сброшены'); };

actions['seg'] = (el) => {
  const { seg, value } = el.dataset;
  if (onSegAuth(seg, value)) return;
  if (onSegAgent(seg, value)) return;
  onSegPro(seg, value);
};

// ---------- события ----------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});
document.addEventListener('input', (ev) => {
  if (ev.target.dataset && ev.target.dataset.live) onLive(ev.target);
});
document.addEventListener('submit', (ev) => { ev.preventDefault(); submitForm(ev.target); });
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { closeSheet(); actions['menu-close'](); }
  // Enter в одиночном поле входа отправляет форму.
  if (ev.key === 'Enter' && ev.target.tagName === 'INPUT') {
    const form = ev.target.closest('form[data-form]');
    if (form) { ev.preventDefault(); submitForm(form); }
  }
});
window.addEventListener('hashchange', render);

render();
