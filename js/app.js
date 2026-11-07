// Оболочка прототипа: какие экраны есть у роли, нижняя панель, меню, обработка нажатий.

import { actions, changes, setRenderer, rerender, route, go } from './core.js?v=258';
import * as S from './store.js?v=258';
import { esc, ICONS, sheet, closeSheet, toast } from './ui.js?v=258';
import { renderAuth, isUnlocked, logout, submitForm, onSeg as onSegAuth } from './auth.js?v=258';
import { renderSettlements } from './shared.js?v=258';
import { renderNewOrder, renderAgentOrders, onSegAgent, onLive } from './agent.js?v=258';
import { renderProOrders, renderProOrder, renderCurrentOrder, renderTrash, renderOwnNew, onSegPro, onLivePro, incomingCount } from './pro.js?v=258';
import { renderOrder, onSegOrder, onSegSheet } from './order.js?v=258';
import { renderOformit, onLiveOformit } from './oformit.js?v=258';
import { onLiveZakaz } from './zakaz.js?v=258';
import { renderBoard, onLiveBoard, renderBoardOrder, renderBoardEdit, renderHome, renderClients, renderGallery, onSegGallery } from './board.js?v=258';
import './kbd.js?v=258';
import { renderProfile, renderSettings, renderTeam, renderStats, brandRoute, renderCalls, renderForClient, onSegMore } from './more.js?v=258';

const VERSION = 'прототип 1.0';

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
    menu: [['new', 'Новая заявка'], ['mine', 'Мои заявки'], ['calls', 'Звонки клиентам'], ['for-client', 'Для клиента'], ['money', 'Начисления'], ['stats', 'Статистика'], ['brand', 'Бренд-зона'], ['profile', 'Профиль'], ['settings', 'Настройки']],
  },
  master: {
    start: 'home',
    nav: [['menu', 'Меню', 'menu'], ['home', 'Главная', 'briefcase'], ['orders', 'Заказы', 'inbox'], ['stats', 'Статистика', 'wallet']],
    menu: [['home', 'Главная'], ['oformit', 'Сущность'], ['orders', 'Заказы'], ['clients', 'Клиенты'], ['gallery', 'Галерея'], ['stats', 'Статистика'], ['brand', 'Бренд-зона'], ['profile', 'Профиль'], ['settings', 'Настройки']],
  },
};
SCREENS.dispatcher = { ...SCREENS.master, menu: [...SCREENS.master.menu.slice(0, 3), ['team', 'Команда'], ...SCREENS.master.menu.slice(3)] };

function screenFor(name, role) {
  if (name === 'money') return renderSettlements();
  if (name === 'profile') return renderProfile();
  if (name === 'settings') return renderSettings();
  if (name === 'stats') return renderStats();
  if (name === 'brand' || name.startsWith('brand-')) return brandRoute(name);
  if (role === 'agent') {
    if (name === 'new') return renderNewOrder();
    if (name === 'mine') return renderAgentOrders();
    if (name === 'calls') return renderCalls();
    if (name === 'for-client') return renderForClient();
    if (name.startsWith('a-order-')) return renderOrder(name.slice(8));
  } else {
    if (name === 'home') { S.setDraftKey(null); return renderHome(); }
    if (name === 'clients') { S.setDraftKey(null); return renderClients(); }
    if (name === 'gallery') return renderGallery();
    if (name === 'money') return null;
    if (name === 'orders') { S.setDraftKey(null); return renderBoard(); }
    if (name.startsWith('bd-order-')) return renderBoardOrder(name.slice(9));
    if (name.startsWith('bd-edit-')) { const [no, t] = name.slice(8).split('-'); return renderBoardEdit(no, t); }
    if (name === 'current') { S.setDraftKey(null); return renderOformit('current'); }
    if (name === 'oformit') { S.setDraftKey(null); return renderOformit('oformit'); }
    if (name === 'trash') return renderTrash();
    if (name === 'own-new') return renderOwnNew();
    if (name === 'team' && role === 'dispatcher') return renderTeam();
    if (name.startsWith('p-order-')) return renderProOrder(name.slice(8));
  }
  return null;
}

function tabbar(role, current) {
  const cfg = SCREENS[role];
  const badge = role === 'agent' ? 0 : incomingCount();
  return cfg.nav.map(([key, label, icon]) => {
    const active = key === current || (key === 'mine' && current.startsWith('a-order-')) || (key === 'orders' && (current.startsWith('p-order-') || current === 'trash' || current === 'own-new'));
    const b = key === 'orders' && badge ? `<span class="tabbar__badge">${badge}</span>` : '';
    const act = key === 'menu' ? 'data-action="menu-open"' : `data-action="go" data-to="${key}"`;
    return `<button type="button" class="tabbar__item${active ? ' is-active' : ''}" ${act} ${active ? 'aria-current="page"' : ''}><span class="tabbar__icon">${ICONS[icon]}${b}</span>${esc(label)}</button>`;
  }).join('');
}

const MENU_BARS = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="10" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="15" width="18" height="2" rx="1" fill="#A3AEBE"/></svg>';
// Иконки пунктов меню (тонкая линия, currentColor)
const MI = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const MENU_IC = {
  home: MI('<path d="M4 11l8-6.5 8 6.5"/><path d="M6 9.5V19h12V9.5"/><path d="M10 19v-5h4v5"/>'),
  oformit: MI('<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>'),
  orders: MI('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 14h4.5l1.5 2h4l1.5-2H20"/>'),
  clients: MI('<circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.5c2.3.2 3.7 1.6 4 4"/>'),
  gallery: MI('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4.5 3.5"/>'),
  stats: MI('<path d="M5 19V11M10 19V6M15 19v-5M20 19V9"/>'),
  brand: MI('<path d="M4 12.5V5h7.5L20 13.5 13.5 20z"/><circle cx="8" cy="9" r="1.4"/>'),
  profile: MI('<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>'),
  settings: MI('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/>'),
  team: MI('<circle cx="12" cy="8" r="3"/><path d="M6 19c.6-3 3-4.6 6-4.6s5.4 1.6 6 4.6"/>'),
};
function drawer(role) {
  const me = S.me();
  const cfg = SCREENS[role];
  const cur = route() || cfg.start;
  const on = (key) => cur === key || (key === 'orders' && cur.startsWith('bd-')) || (key === 'brand' && cur.startsWith('brand'));
  const ini = (me.name || '').split(' ').map((w) => w[0] || '').slice(0, 2).join('');
  return `<div class="drawer__scrim" data-action="menu-close"></div>
    <nav class="drawer__panel" aria-label="Меню">
      <div class="brand brand--mini"><div class="brand__sphere" aria-hidden="true"></div><div class="brand__word">METRONICA</div></div>
      <div class="drawer__list">${cfg.menu.map(([key, label]) => `<button type="button" class="drawer__item${on(key) ? ' is-on' : ''}" data-action="menu-go" data-to="${key}"${on(key) ? ' aria-current="page"' : ''}><span class="drawer__ic">${MENU_IC[key] || MENU_IC.home}</span><span>${esc(label)}</span></button>`).join('')}</div>
      <div class="drawer__foot">
        <button type="button" class="drawer__me" data-action="menu-go" data-to="profile"><span class="drawer__av">${me.photo ? `<img src="${me.photo}" alt="">` : esc(ini)}</span><span><b>${esc(me.name)}</b><small>${esc(me.roles.map((r) => S.ROLE_NAMES[r]).join(' и '))}</small></span></button>
        <span class="drawer__ver">Метроника · ${VERSION}</span>
      </div>
    </nav>`;
}

function render() {
  const view = document.getElementById('view');
  const bar = document.getElementById('tabbar');
  const drawerEl = document.getElementById('drawer');
  const me = S.me();
  // Вход временно убран: сразу открываем кабинет (по умолчанию — мастер Сергей).
  if (!me) { S.setSession('u-sergey'); rerender(); return; }
  if (false) {
    document.body.classList.add('is-auth');
    document.body.classList.remove('fig');
    bar.hidden = true;
    drawerEl.innerHTML = '';
    view.innerHTML = renderAuth();
    document.title = 'Метроника — вход';
    return;
  }
  document.body.classList.remove('is-auth');
  const role = roleOf(me);
  S.autoFailOverdue();
  let name = route();
  let html = name ? screenFor(name, role) : null;
  if (html == null) {
    name = SCREENS[role].start;
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    html = screenFor(name, role);
  }
  view.innerHTML = html;
  // Экраны, перенесённые из Figma один в один, рисуют свою нижнюю навигацию.
  const fig = name === 'oformit' || name === 'home' || ((name === 'current' || name === 'orders' || name.startsWith('bd-order-') || name.startsWith('bd-edit-')) && role !== 'agent');
  document.body.classList.toggle('fig', fig);
  if (fig) {
    const ft = view.querySelector('.f-tab.is-active');
    if (ft) { const tr = ft.parentElement; tr.scrollLeft = ft.offsetLeft - (tr.clientWidth - ft.offsetWidth) / 2; }
    bar.hidden = true; if (!drawerEl.classList.contains('is-on')) drawerEl.innerHTML = drawer(role); document.title = 'Метроника'; return; }
  // Мастер: нижней панели нет — как на главной, одна плавающая кнопка «три полоски» без подписи.
  const noBar = role !== 'agent';
  document.body.classList.toggle('nobar', noBar);
  if (noBar) { bar.hidden = true; bar.innerHTML = ''; view.insertAdjacentHTML('beforeend', `<button type="button" class="h-menu" data-action="menu-open" aria-label="Меню">${MENU_BARS}</button>`); }
  else { bar.hidden = false; bar.innerHTML = tabbar(role, name); }
  if (!drawerEl.classList.contains('is-on')) drawerEl.innerHTML = drawer(role);
  const activeTab = view.querySelector('.tabs__item.is-active');
  if (activeTab) {
    const strip = activeTab.parentElement;
    strip.scrollLeft = activeTab.offsetLeft - (strip.clientWidth - activeTab.offsetWidth) / 2;
  }
  document.title = 'Метроника';
}

setRenderer(render);
// Первая отрисовка тоже проходит через afterRender (см. core.js).

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
// Смена пользователя без входа: выбор из демо-аккаунтов.
const pickUser = () => {
  actions['menu-close']();
  const cur = S.me();
  sheet({
    title: 'Кем войти',
    body: `<div class="list">${S.get().users.map((u) => `<button type="button" class="btn${cur && cur.id === u.id ? ' btn--primary' : ''}" data-action="user-pick" data-id="${u.id}">${esc(u.name)} · ${esc(u.roles.map((r) => S.ROLE_NAMES[r]).join(' и '))}</button>`).join('')}</div>`,
    buttons: [{ label: 'Закрыть', action: 'sheet-close' }],
  });
};
actions['switch-user'] = pickUser;
actions['logout'] = pickUser;
actions['user-pick'] = (el) => { closeSheet(); S.setSession(el.dataset.id); location.hash = ''; rerender(); };
actions['reset-ask'] = () => {
  actions['menu-close']();
  sheet({
    title: 'Сбросить демо-данные?',
    body: '<p>Удалятся все созданные заказы, начисления и добавленные пользователи. Вернутся исходные демо-аккаунты.</p>',
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Сбросить', action: 'reset-do', primary: true }],
  });
};
actions['reset-do'] = () => { closeSheet(); S.resetDemo(); location.hash = ''; rerender(); toast('Демо-данные сброшены'); };

actions['seg'] = (el) => {
  const { seg, value } = el.dataset;
  if (onSegAuth(seg, value)) return;
  if (onSegSheet(seg, value)) return;
  if (onSegAgent(seg, value)) return;
  if (onSegOrder(seg, value)) return;
  if (onSegMore(seg, value)) return;
  if (onSegGallery(seg, value)) return;
  onSegPro(seg, value);
};

// ---------- события ----------
// Поле с data-change сохраняется при уходе из него. Если уход случился из-за нажатия кнопки,
// перерисовку откладываем до самого нажатия — иначе кнопка исчезнет из-под пальца.
let pressing = false;
let pendingRender = false;
document.addEventListener('pointerdown', () => { pressing = true; }, true);
document.addEventListener('pointerup', () => { setTimeout(() => { pressing = false; if (pendingRender) { pendingRender = false; rerender(); } }, 0); }, true);
document.addEventListener('change', (ev) => {
  const el = ev.target;
  const fn = el.dataset && el.dataset.change && changes[el.dataset.change];
  if (!fn) return;
  fn(el);
  if (pressing) pendingRender = true; else rerender();
});
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { ev.preventDefault(); pendingRender = false; fn(el, ev); }
});
document.addEventListener('input', (ev) => {
  if (!ev.target.dataset || !ev.target.dataset.live) return;
  if (onLiveBoard(ev.target)) return;
  if (onLiveZakaz(ev.target)) return;
  if (onLiveOformit(ev.target)) return;
  if (onLivePro(ev.target)) return;
  onLive(ev.target);
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
window.addEventListener('hashchange', rerender);

rerender();
