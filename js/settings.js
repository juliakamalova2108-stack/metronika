// Настройки мастера — собраны из готовых компонентов экранов заказа (Figma):
// тёмные пластины f-plate, поля f-input, выпадающие списки selectField, строки-переключатели o-row + o-tog,
// кнопки f-btn, верхние вкладки и нижняя панель f-nav / f-topnav / f-tab.
// Три раздела внизу: Профиль · Работа · Система.

import { actions, changes, rerender, go, val } from './core.js?v=304';
import * as S from './store.js?v=304';
import { esc, toast } from './ui.js?v=304';
import { selectField, pickers } from './oformit.js?v=304';
import { COUNTRIES, SOON } from './phonecodes.js?v=304';
import { ROOMS, roomColor, svcList, defaultSvcList } from './ocenka.js?v=304';
import { NOTIFY_KINDS } from './more.js?v=304';

const ICON_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="10" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="15" width="18" height="2" rx="1" fill="#A3AEBE"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="#edf0e7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TRASH = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4.5 7h15M10 4h4M6.5 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-12M10 11v5.5M14 11v5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const CITIES = ['Москва', 'Санкт-Петербург', 'Уфа', 'Казань', 'Екатеринбург', 'Новосибирск', 'Нижний Новгород', 'Самара', 'Челябинск', 'Омск', 'Ростов-на-Дону', 'Красноярск', 'Пермь', 'Воронеж', 'Волгоград', 'Краснодар', 'Тюмень', 'Саратов', 'Тольятти', 'Ижевск', 'Барнаул', 'Ульяновск', 'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток', 'Томск', 'Оренбург', 'Кемерово', 'Стерлитамак', 'Набережные Челны', 'Сочи'];
const PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#64748b'];
const WD = [[1, 'Понедельник'], [2, 'Вторник'], [3, 'Среда'], [4, 'Четверг'], [5, 'Пятница'], [6, 'Суббота'], [0, 'Воскресенье']];
const TIMES = Array.from({ length: 35 }, (_, i) => { const m = 6 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${m % 60 ? '30' : '00'}`; });
const numOf = (s) => { const n = parseFloat(String(s).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : NaN; };
const num = (n) => String(n).replace('.', ',');

let group = 'profile';   // profile | work | system
let workTab = 'services'; // services | rooms | schedule
let svEdit = '';
let roomPick = '';

// ── готовые компоненты ──
const plate = (title, inner, cls = '') => `<section class="f-plate st2-plate${cls}">${title ? `<p class="z-title">${title}</p>` : ''}${inner}</section>`;
const input = (id, label, value, attrs = '', type = 'text') => `<label class="f-field" for="${id}"><span class="f-field__label">${esc(label)}</span>
  <span class="f-input"><input id="${id}" type="${type}" value="${esc(value)}" ${attrs}/></span></label>`;
const tog = (title, sub, on, attrs) => `<button type="button" class="o-row${sub ? ' o-row--svc' : ''}" role="switch" aria-checked="${on}" ${attrs}>
  ${sub ? `<span class="o-row__text"><span>${esc(title)}</span><small>${esc(sub)}</small></span>` : `<span class="o-row__name">${esc(title)}</span>`}<span class="o-tog${on ? ' is-on' : ''}" aria-hidden="true"><i></i></span></button>`;
const btn = (label, action, data = '', cls = '') => `<button type="button" class="f-btn${cls}" data-action="${action}" ${data}>${esc(label)}</button>`;
const btnRow = (...b) => `<div class="f-btn-row">${b.join('')}</div>`;
const topTabs = (items, cur, action) => `<div class="f-topnav st2-top"><div class="f-topnav__track" role="tablist">${items.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === cur}" class="f-tab${k === cur ? ' is-active' : ''}" data-action="${action}" data-k="${k}">${t}</button>`).join('')}</div></div>`;

// ── Профиль ──
function profile() {
  const me = S.me(); const st = me.settings;
  const ini = (me.name || '').split(' ').map((w) => w[0] || '').slice(0, 2).join('');
  const ctry = st.country || 'RU';
  const ctryName = (COUNTRIES[ctry] || {}).name || 'Россия';
  return plate('Профиль', `<div class="st2-me"><label class="pf-ph" aria-label="Прикрепить фото">${me.photo ? `<img src="${me.photo}" alt="">` : `<span>${esc(ini)}</span>`}<i class="pf-ph__cam">${CAM}</i><input type="file" accept="image/*" data-change="pf-photo" hidden></label>
      <div class="st2-me__t"><b>${esc(me.name)}</b><small>${me.photo ? '<button type="button" class="link-btn" data-action="pf-photo-del">Убрать фото</button>' : 'Нажмите на круг — прикрепить фото'}</small></div></div>
    ${input('set-name', 'Имя и фамилия', me.name, 'data-change="set-name"')}
    <label class="f-field"><span class="f-field__label">Телефон</span><span class="f-input"><b class="z-cc">+7</b><input value="${esc(String(me.phone || '').replace(/^(\d{3})(\d{3})(\d{2})(\d{2})$/, '($1) $2-$3-$4'))}" readonly/></span></label>`)
  + plate('Где работаю', `${selectField('st-country', 'Страна', ctryName, [...Object.entries(COUNTRIES).map(([k, c]) => ({ value: k, label: c.name })), ...SOON.map((n) => ({ value: 'soon:' + n, label: n + ' — скоро' }))], false)}
    ${input('pf-city', 'Ближайший город', st.city || '', 'list="pf-cities" data-change="pf-loc" data-k="city" autocomplete="off" placeholder="Например, Уфа"')}<datalist id="pf-cities">${CITIES.map((c) => `<option value="${c}">`).join('')}</datalist>
    ${input('pf-place', 'Населённый пункт', st.place || '', 'data-change="pf-loc" data-k="place" autocomplete="off" placeholder="Город, посёлок или село"')}`)
  + plate('', `<div class="o-row st2-kv"><span class="o-row__name">Рейтинг</span><b>${S.ratingOf(me.id).toLocaleString('ru-RU')} м²</b></div>`)
  + plate('PIN-код', `<div class="z-grid2">${input('pin-a', 'Новый PIN', '', 'inputmode="numeric" maxlength="4"', 'password')}${input('pin-b', 'Ещё раз', '', 'inputmode="numeric" maxlength="4"', 'password')}</div>${btnRow(btn('Сменить PIN', 'pin-change'))}`)
  + btnRow(btn('Выйти', 'logout')) + '<button type="button" class="link-btn st2-reset" data-action="reset-ask">Сбросить демо-данные</button>';
}

// ── Работа: услуги ──
function services() {
  const L = svcList();
  const rows = L.map((x, i) => {
    if (svEdit === x.id) return plate('', `${input(`sv-n-${i}`, 'Название', x.name)}
      <div class="z-grid2">${input(`sv-p-${i}`, 'Цена, ₽/м²', x.price == null ? '' : String(x.price), 'inputmode="numeric" placeholder="—"')}${input(`sv-r-${i}`, 'м² в час', x.norm == null ? '' : num(x.norm), 'inputmode="decimal" placeholder="—"')}</div>
      ${btnRow(btn('Удалить', 'sv-del', `data-id="${esc(x.id)}"`, ' st2-del'), btn('Сохранить', 'sv-save', `data-id="${esc(x.id)}" data-i="${i}"`))}`, ' st2-edit');
    return `<button type="button" class="o-row o-row--svc" data-action="sv-edit" data-id="${esc(x.id)}"><span class="o-row__text"><span>${esc(x.name)}</span><small>${x.price ? `${num(x.price)} ₽/м²${x.norm ? ` · ${num(x.norm)} м² в час` : ''}` : 'цена не задана'}</small></span><span class="st2-go">›</span></button>`;
  }).join('');
  return plate('Услуги', `<div class="st2-list">${rows}</div>${btnRow(btn('+ Добавить услугу', 'sv-add'))}<button type="button" class="link-btn st2-reset" data-action="sv-reset">Вернуть стандартный список (без цен)</button>`);
}
// ── Работа: комнаты (стандартные, только цвет) ──
function rooms() {
  return plate('Цвета комнат', `<div class="st2-list">${ROOMS.map(([name]) => { const c = roomColor(name); const open = roomPick === name;
    return `<button type="button" class="o-row" data-action="rc-open" data-name="${esc(name)}" aria-expanded="${open}"><span class="o-row__mark" style="background:${c}"></span><span class="o-row__name">${esc(name)}</span><span class="st2-go">${open ? '⌃' : '›'}</span></button>
      ${open ? `<div class="st2-pal">${PALETTE.map((p) => `<button type="button" class="st2-sw${p === c ? ' is-on' : ''}" style="--s:${p}" data-action="rc-set" data-name="${esc(name)}" data-c="${p}" aria-label="Цвет"></button>`).join('')}</div>` : ''}`; }).join('')}</div>
    ${btnRow(btn('Вернуть стандартные цвета', 'rc-reset'))}`);
}
// ── Работа: график ──
function schedule() {
  const st = S.me().settings; const dh = st.dayHours || {};
  const days = WD.map(([d, n]) => { const on = st.workdays.includes(d); const h = dh[d] || st.hours;
    return `<div class="st2-day">${tog(n, on ? `${h.from} – ${h.to}` : 'выходной', on, `data-action="wk-tog" data-d="${d}"`)}
      ${on ? `<div class="z-time">${selectField(`wk-f-${d}`, 'С', h.from, TIMES.map((t) => ({ value: t, label: t })), false)}<b>–</b>${selectField(`wk-t-${d}`, 'До', h.to, TIMES.map((t) => ({ value: t, label: t })), false)}</div>` : ''}</div>`; }).join('');
  const busy = (S.me().busy || []).slice().sort();
  return plate('Рабочая неделя', `<div class="st2-list">${days}</div>${btnRow(btn('Часы как в понедельник — на все дни', 'wk-copy'))}`)
    + plate('Занятые дни', `${busy.length ? `<div class="st2-list">${busy.map((d) => `<div class="o-row"><span class="o-row__name">${new Date(d + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span><button type="button" class="f-icon-btn" data-action="busy-del" data-d="${d}" aria-label="Освободить">${TRASH}</button></div>`).join('')}</div>` : ''}
      ${input('busy-new', 'Отметить день занятым', '', '', 'date')}${btnRow(btn('Отметить', 'busy-add'))}`);
}
// ── Система ──
function system() {
  const st = S.me().settings; const n = st.notify; const kinds = n.kinds || {};
  return plate('Уведомления', `${tog('Присылать уведомления', 'Новые заказы, сообщения, выплаты', n.on, 'data-action="nt-on"')}
      ${selectField('nt-remind', 'Напоминание о завтрашних выездах', n.remind || '18:00', TIMES.map((t) => ({ value: t, label: t })), !n.on)}`)
    + plate('О чём предупреждать', `<div class="st2-list${n.on ? '' : ' is-off'}">${NOTIFY_KINDS.map(([k, t, d]) => tog(t, d, n.on && kinds[k] !== false, `data-action="nt-kind" data-k="${k}"${n.on ? '' : ' disabled'}`)).join('')}</div>`);
}

export function renderSettingsFig(start) {
  if (start) group = start;
  const G = [['profile', 'Профиль'], ['work', 'Работа'], ['system', 'Система']];
  const head = group === 'work' ? topTabs([['services', 'Услуги'], ['rooms', 'Комнаты'], ['schedule', 'График']], workTab, 'st2-work') : '';
  const body = group === 'profile' ? profile() : group === 'system' ? system() : workTab === 'rooms' ? rooms() : workTab === 'schedule' ? schedule() : services();
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
    ${head}<div class="st2">${body}</div>
    <nav class="f-nav f-nav--tabs" aria-label="Нижнее меню">
      <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open" aria-label="Меню">${ICON_MENU}</button>
      <button type="button" class="f-icon-btn st2-back" data-action="st-back" aria-label="Назад">${BACK}</button>
      <div class="f-topnav f-botnav"><div class="f-topnav__track" role="tablist">${G.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === group}" class="f-tab${k === group ? ' is-active' : ''}" data-action="st2-group" data-k="${k}">${t}</button>`).join('')}</div></div>
    </nav>`;
}

// ── действия ──
const set = (patch) => S.updateSettings(patch);
actions['st2-group'] = (el) => { group = el.dataset.k; svEdit = ''; roomPick = ''; rerender(); window.scrollTo(0, 0); };
actions['st2-work'] = (el) => { workTab = el.dataset.k; svEdit = ''; roomPick = ''; rerender(); window.scrollTo(0, 0); };
pickers['st-country'] = (v) => { if (String(v).startsWith('soon:')) { toast('Эта страна скоро появится'); return; } set({ country: v }); };
for (const [d] of WD) {
  pickers[`wk-f-${d}`] = (v) => { const st = S.me().settings; const h = { ...((st.dayHours || {})[d] || st.hours), from: v }; set({ dayHours: { ...(st.dayHours || {}), [d]: h } }); };
  pickers[`wk-t-${d}`] = (v) => { const st = S.me().settings; const h = { ...((st.dayHours || {})[d] || st.hours), to: v }; set({ dayHours: { ...(st.dayHours || {}), [d]: h } }); };
}
pickers['nt-remind'] = (v) => { const n = S.me().settings.notify; set({ notify: { ...n, remind: v } }); };
actions['wk-tog'] = (el) => { const d = Number(el.dataset.d); const w = S.me().settings.workdays; set({ workdays: w.includes(d) ? w.filter((x) => x !== d) : [...w, d] }); rerender(); };
actions['nt-on'] = () => { const n = S.me().settings.notify; set({ notify: { ...n, on: !n.on } }); rerender(); };
actions['nt-kind'] = (el) => { const n = S.me().settings.notify; if (!n.on) return; const k = el.dataset.k; const kinds = { ...(n.kinds || {}) }; kinds[k] = kinds[k] === false; set({ notify: { ...n, kinds } }); rerender(); };
actions['sv-edit'] = (el) => { svEdit = el.dataset.id; rerender(); };
actions['sv-save'] = (el) => { const i = Number(el.dataset.i); const L = svcList().map((x) => ({ ...x })); const x = L[i]; if (!x) return;
  const name = val(`sv-n-${i}`).trim(); if (name.length < 2) { toast('Введите название'); return; }
  const p = numOf(val(`sv-p-${i}`)); const n = numOf(val(`sv-r-${i}`));
  x.name = name; x.price = p > 0 ? Math.round(p) : null; x.norm = n > 0 ? n : null;
  if (x.type && x.price) S.updatePrice(x.type, x.price);
  set({ svcList: L }); svEdit = ''; toast('Сохранено'); rerender(); };
actions['sv-del'] = (el) => { set({ svcList: svcList().filter((x) => x.id !== el.dataset.id) }); svEdit = ''; toast('Услуга удалена'); rerender(); };
actions['sv-add'] = () => { const id = 'c' + Date.now().toString(36); set({ svcList: [...svcList(), { id, name: 'Новая услуга', price: null, norm: null, type: '' }] }); svEdit = id; rerender(); };
actions['sv-reset'] = () => { set({ svcList: defaultSvcList(false) }); svEdit = ''; toast('Стандартный список — впишите цены'); rerender(); };
actions['rc-open'] = (el) => { roomPick = roomPick === el.dataset.name ? '' : el.dataset.name; rerender(); };
actions['rc-set'] = (el) => { set({ roomColors: { ...(S.me().settings.roomColors || {}), [el.dataset.name]: el.dataset.c } }); rerender(); };
actions['rc-reset'] = () => { set({ roomColors: {} }); roomPick = ''; toast('Стандартные цвета возвращены'); rerender(); };
actions['wk-copy'] = () => { const st = S.me().settings; const h = (st.dayHours || {})[1] || st.hours; const all = {}; WD.forEach(([d]) => { all[d] = { ...h }; }); set({ dayHours: all, hours: { ...h } }); toast('Часы применены ко всем дням'); rerender(); };
actions['st-back'] = () => { if (history.length > 1) history.back(); else go('home'); };
