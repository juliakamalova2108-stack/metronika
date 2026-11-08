// Профиль, настройки, команда диспетчера, статистика, бренд-зона, звонки и материалы агента для клиента.

import { actions, changes, rerender, go, val } from './core.js?v=313';
import * as S from './store.js?v=313';
import { WALLPAPER_TYPES, SERVICES, UNIT, ROOM_NAMES, SYSTEM_PRICE } from './seed.js?v=313';
import { esc, rub, num, kv, status, field, select, btnRow, seg, dateRu, phoneRu, sheet, closeSheet, toast, ICONS } from './ui.js?v=313';
import { topbar, typeName, renderSettlements } from './shared.js?v=313';
import { ROOMS, roomColor, svcList, defaultSvcList } from './ocenka.js?v=313';
import { COUNTRIES, SOON } from './phonecodes.js?v=313';

const numOf = (s) => { const n = parseFloat(String(s).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : NaN; };
const navRow = (to, label, icon, note = '') => `<button type="button" class="well card-btn nav-row" data-action="go" data-to="${to}"><span class="nav-row__icon">${ICONS[icon] || ''}</span><span><b>${esc(label)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span><span class="nav-row__chev">${ICONS.chevron}</span></button>`;

// ================= профиль =================
const PF_CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const PF_CITIES = ['Москва', 'Санкт-Петербург', 'Уфа', 'Казань', 'Екатеринбург', 'Новосибирск', 'Нижний Новгород', 'Самара', 'Челябинск', 'Омск', 'Ростов-на-Дону', 'Красноярск', 'Пермь', 'Воронеж', 'Волгоград', 'Краснодар', 'Тюмень', 'Саратов', 'Тольятти', 'Ижевск', 'Барнаул', 'Ульяновск', 'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток', 'Махачкала', 'Томск', 'Оренбург', 'Кемерово', 'Стерлитамак', 'Набережные Челны', 'Сочи'];
export function renderProfile() {
  const me = S.me();
  const isAgent = S.hasRole(me, 'agent');
  const roles = me.roles.map((r) => S.ROLE_NAMES[r]).join(' и ');
  const overdue = S.overdueOf(me.id);
  const rel = overdue ? status('warn', `просрочено выплат: ${overdue}`) : status('ok', 'выплаты вовремя');
  let body;
  if (isAgent) {
    const partners = S.partnersOf(me.id);
    body = `<section class="plate">
      <h2 class="plate__title">Агент</h2>
      ${kv('Кто', esc(me.agent.kind))}${kv('Торговая точка', esc(me.agent.shop || '—'))}${kv('Промокод для визиток', esc(me.agent.promo || '—'))}
      ${kv('Тариф', me.agent.plan === 'sub' ? 'Подписка: до 3 партнёров, диспетчеры' : 'Бесплатный: 1 мастер')}
      ${kv('Партнёры', esc(partners.map((p) => p.name).join(', ') || 'нет'))}
    </section>
    <section class="plate"><div class="list">
      ${navRow('calls', 'Звонки клиентам', 'phone', 'Контроль качества после работ')}
      ${navRow('for-client', 'Для клиента', 'list', 'Предложение, памятка, визитка')}
      ${navRow('stats', 'Статистика', 'chart')}
      ${navRow('brand', 'Бренд-зона', 'briefcase', 'Производители, каталог, советы')}
      ${navRow('settings', 'Настройки', 'user', 'Тариф, партнёры, промокод, PIN')}
    </div></section>`;
  } else {
    const disp = S.dispatchersOf(me.id);
    body = `<section class="plate">
      <div class="plate__head"><h2 class="plate__title">Рейтинг</h2><span class="big-num">${S.ratingOf(me.id).toLocaleString('ru-RU')} м²</span></div>
    </section>
    ${disp.length ? `<section class="plate"><h2 class="plate__title">Работаю с диспетчерами</h2>${disp.map((d) => kv(esc(d.name), esc(phoneRu(d.phone)))).join('')}<p class="small">Заказы от диспетчера — по его ценам. Свои заказы — по вашим.</p></section>` : ''}
    ${S.hasRole(me, 'dispatcher') ? `<section class="plate"><div class="list">${navRow('team', 'Команда', 'users', `${S.teamOf(me.id).length} из ${(me.plan && me.plan.seats) || 0} мест`)}</div></section>` : ''}`;
  }
  const st = me.settings;
  const ini = (me.name || '').split(' ').map((w) => w[0] || '').slice(0, 2).join('');
  return `${topbar('Профиль')}
    <section class="plate pf-head">
      <label class="pf-ph" aria-label="Прикрепить фото">${me.photo ? `<img src="${me.photo}" alt="">` : `<span>${esc(ini)}</span>`}<i class="pf-ph__cam">${PF_CAM}</i>
        <input type="file" accept="image/*" data-change="pf-photo" hidden></label>
      <div class="pf-who">${field({ id: 'set-name', label: 'Имя и фамилия', value: me.name, attrs: 'data-change="set-name"' })}
        <p class="pf-meta"><span class="chip">${esc(roles)}</span><span>${esc(phoneRu(me.phone))}</span></p>
        ${me.photo ? '<button type="button" class="link-btn" data-action="pf-photo-del">Убрать фото</button>' : '<p class="small">Нажмите на круг, чтобы прикрепить фото</p>'}</div>
    </section>
    <section class="plate">
      <h2 class="plate__title">Где работаю</h2>
      ${select({ id: 'set-country', label: 'Страна', value: st.country || 'RU', options: [...Object.entries(COUNTRIES).map(([k, c]) => ({ value: k, label: c.name })), ...SOON.map((n) => ({ value: 'soon:' + n, label: n + ' — скоро' }))], attrs: 'data-change="set-country"' })}
      ${field({ id: 'pf-city', label: 'Ближайший город', value: st.city || '', placeholder: 'Например, Уфа', attrs: 'list="pf-cities" data-change="pf-loc" data-k="city" autocomplete="off"' })}
      <datalist id="pf-cities">${PF_CITIES.map((c) => `<option value="${c}">`).join('')}</datalist>
      ${field({ id: 'pf-place', label: 'Населённый пункт', value: st.place || '', placeholder: 'Город, посёлок или село', attrs: 'data-change="pf-loc" data-k="place" autocomplete="off"' })}
    </section>
    ${body}
    <section class="plate">
      <h2 class="plate__title">PIN-код</h2>
      <div class="grid-2">${field({ id: 'pin-a', label: 'Новый PIN', type: 'password', inputmode: 'numeric', attrs: 'maxlength="4"' })}${field({ id: 'pin-b', label: 'Ещё раз', type: 'password', inputmode: 'numeric', attrs: 'maxlength="4"' })}</div>
      ${btnRow([{ label: 'Сменить PIN', action: 'pin-change' }])}
    </section>
    <section class="plate">
      ${btnRow([{ label: 'Выйти', action: 'logout' }])}
      <button type="button" class="link-btn pf-reset" data-action="reset-ask">Сбросить демо-данные</button>
    </section>`;
}

// ================= настройки =================
let setTab = 'profile';
const SI = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS_ST = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="10" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="15" width="18" height="2" rx="1" fill="#A3AEBE"/></svg>',
  back: SI('<path d="M15 5l-7 7 7 7"/>'),
  profile: SI('<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>'),
  work: SI('<rect x="3.5" y="7" width="17" height="12" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>'),
  system: SI('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/>'),
};
actions['st-back'] = () => { if (history.length > 1) history.back(); else go('home'); };
export function renderProfileTab() { setTab = 'profile'; history.replaceState(null, '', '#settings'); return renderSettings(); }
const NOTIFY_PLATE = (st) => `<section class="plate">
      <h2 class="plate__title">Уведомления</h2>
      <label class="toggle-row"><span><b>Присылать уведомления</b><small>Новые заказы, сообщения в чате, выплаты</small></span><input type="checkbox" class="switch" data-change="set-notify" ${st.notify.on ? 'checked' : ''}/></label>
      ${field({ id: 'set-remind', label: 'Напоминание о завтрашних выездах', type: 'time', value: st.notify.remind, attrs: 'data-change="set-remind"' })}
    </section>`;
// Виды уведомлений колокольчика (ключи — как в board.js)
export const NOTIFY_KINDS = [
  ['meas', 'Замеры', 'Сегодня и завтра — время и адрес'],
  ['visit', 'Выезды', 'Выезд завтра, старт заказа через 2–3 дня'],
  ['chat', 'Сообщения', 'Новые сообщения в чатах заказов'],
  ['money', 'Аванс', 'Аванс не внесён, а выезд скоро'],
  ['doc', 'Смета', 'Смета не отправлена клиенту после замера'],
  ['roll', 'Материал', 'Материал не добавлен, опыт по обоям не записан'],
];
export function renderSettings() {
  const me = S.me();
  const isAgent = S.hasRole(me, 'agent');
  const tabs = isAgent ? [['profile', 'Профиль'], ['general', 'Уведомления'], ['agent', 'Агент']] : [['profile', 'Профиль'], ['notify', 'Уведомления'], ['services', 'Услуги'], ['rooms', 'Комнаты'], ['schedule', 'График']];
  if (!tabs.some(([k]) => k === setTab)) setTab = 'profile';
  const st = me.settings;
  let body = '';
  if (setTab === 'profile') {
    const pf = renderProfile(); body = pf.slice(pf.indexOf('<section'));
  } else if (setTab === 'general') {
    body = NOTIFY_PLATE(st);
  } else if (setTab === 'notify') {
    const kinds = st.notify.kinds || {};
    body = `${NOTIFY_PLATE(st)}
    <section class="plate">
      <h2 class="plate__title">О чём предупреждать</h2>
      <p class="small">Эти уведомления собираются в колокольчике на главной.</p>
      ${NOTIFY_KINDS.map(([k, t, d]) => `<label class="toggle-row"><span><b>${t}</b><small>${d}</small></span><input type="checkbox" class="switch" data-change="set-notify-kind" data-k="${k}" ${kinds[k] !== false ? 'checked' : ''} ${st.notify.on ? '' : 'disabled'}/></label>`).join('')}
    </section>`;
  } else if (setTab === 'services') {
    // Свой список услуг: название, цена за м², норма (м² в час). Стандартные названия уже есть — цены вписывает мастер.
    const L = svcList();
    body = `<section class="plate sv">
      <h2 class="plate__title">Услуги</h2>
      <p class="small">Цена и норма выработки — сколько м² успеваете за час (из неё считается срок по 8 часов в день). Нажмите «изменить», чтобы поправить, или добавьте свою услугу.</p>
      <div class="sv-list">${L.map((x, i) => { const open = svEdit === x.id;
        return open ? `<div class="sv-card is-open">
          ${field({ id: `sv-n-${i}`, label: 'Название', value: x.name })}
          <div class="grid-2">${field({ id: `sv-p-${i}`, label: 'Цена, ₽/м²', value: x.price == null ? '' : String(x.price), inputmode: 'numeric', placeholder: '—' })}${field({ id: `sv-r-${i}`, label: 'м² в час', value: x.norm == null ? '' : num(x.norm), inputmode: 'decimal', placeholder: '—' })}</div>
          <div class="sv-act"><button type="button" class="link-btn sv-del" data-action="sv-del" data-id="${esc(x.id)}">${ICONS.trash} Удалить</button><button type="button" class="btn btn--primary btn--sm" data-action="sv-save" data-id="${esc(x.id)}" data-i="${i}">Сохранить</button></div></div>`
        : `<button type="button" class="sv-card" data-action="sv-edit" data-id="${esc(x.id)}"><span class="sv-card__n">${esc(x.name)}</span>
          <span class="sv-card__v">${x.price ? `<b>${num(x.price)} ₽</b><small>${x.norm ? `${num(x.norm)} м²/ч` : 'норма —'}</small>` : '<em>цена не задана</em>'}</span><span class="sv-card__go">изменить</span></button>`; }).join('')}</div>
      ${btnRow([{ label: '+ Добавить услугу', action: 'sv-add', primary: true }])}
      <button type="button" class="link-btn sv-reset" data-action="sv-reset">Вернуть стандартный список (без цен)</button>
    </section>`;
  } else if (setTab === 'rooms') {
    // Комнаты стандартные: название не меняется, удалить нельзя — только цвет метки (им комната видна в оценке, графике, календаре).
    body = `<section class="plate">
      <h2 class="plate__title">Цвета комнат</h2>
      <p class="small">Комнаты стандартные для всех мастеров. Выберите цвет — им комната будет отмечена в оценке, плане работ и календаре.</p>
      <div class="rc-grid">${ROOMS.map(([name]) => { const c = roomColor(name); const open = roomPick === name;
        return `<div class="rc-card${open ? ' is-open' : ''}" style="--c:${c}">
          <button type="button" class="rc-card__hd" data-action="rc-open" data-name="${esc(name)}" aria-expanded="${open}"><i class="rc-dot"></i><b>${esc(name)}</b>${open ? '<span class="rc-edit">готово</span>' : ''}</button>
          ${open ? `<div class="rc-pal">${RC_PALETTE.map((p) => `<button type="button" class="rc-sw${p === c ? ' is-on' : ''}" style="--s:${p}" data-action="rc-set" data-name="${esc(name)}" data-c="${p}" aria-label="Цвет ${p}"></button>`).join('')}</div>` : ''}</div>`; }).join('')}</div>
      ${btnRow([{ label: 'Вернуть стандартные цвета', action: 'rc-reset' }])}
    </section>`;
  } else if (setTab === 'schedule') {
    const wd = [[1, 'Пн'], [2, 'Вт'], [3, 'Ср'], [4, 'Чт'], [5, 'Пт'], [6, 'Сб'], [0, 'Вс']];
    const busy = (me.busy || []).slice().sort();
    const WDF = { 1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница', 6: 'Суббота', 0: 'Воскресенье' };
    const dh = st.dayHours || {};
    const cnt = st.workdays.length;
    body = `<section class="plate">
      <h2 class="plate__title">Рабочая неделя</h2>
      <p class="small">Рабочих дней: ${cnt}. Агенты и клиенты видят только свободные рабочие дни и часы.</p>
      <div class="wk">${wd.map(([d]) => { const on = st.workdays.includes(d); const h = dh[d] || st.hours;
        return `<div class="wk-card${on ? ' is-on' : ''}">
          <div class="wk-card__hd"><span class="wk-card__d"><b>${WDF[d]}</b><small>${on ? `${h.from} – ${h.to}` : 'выходной'}</small></span>
            <label class="wk-tog"><span>${on ? 'Рабочий' : 'Выходной'}</span><input type="checkbox" class="switch" data-change="wk-day" data-d="${d}" ${on ? 'checked' : ''} aria-label="${WDF[d]}: рабочий день"/></label></div>
          ${on ? `<div class="wk-card__h">${field({ id: `wh-f-${d}`, label: 'С', type: 'time', value: h.from, attrs: `data-change="wk-hours" data-d="${d}"` })}${field({ id: `wh-t-${d}`, label: 'До', type: 'time', value: h.to, attrs: `data-change="wk-hours" data-d="${d}"` })}</div>` : ''}
        </div>`; }).join('')}</div>
      ${btnRow([{ label: 'Часы как в понедельник — на все рабочие дни', action: 'wk-copy' }])}
    </section>
    <section class="plate">
      <h2 class="plate__title">Занятые дни</h2>
      ${busy.length ? busy.map((d) => `<div class="kv"><span>${esc(dateRu(d))}</span><button type="button" class="icon-btn" data-action="busy-del" data-d="${d}" aria-label="Освободить ${esc(dateRu(d))}">${ICONS.trash}</button></div>`).join('') : '<p class="empty">Нет</p>'}
      ${field({ id: 'busy-new', label: 'Отметить день занятым', type: 'date' })}
      ${btnRow([{ label: 'Отметить', action: 'busy-add' }])}
    </section>`;
  } else if (setTab === 'agent') {
    const partners = S.partnersOf(me.id);
    body = `<section class="plate">
      <h2 class="plate__title">О себе</h2>
      ${select({ id: 'ag-kind', label: 'Кто вы', value: me.agent.kind, options: ['Продавец', 'Дизайнер', 'Прораб', 'Другое'].map((x) => ({ value: x, label: x })), attrs: 'data-change="ag-field" data-k="kind"' })}
      ${field({ id: 'ag-shop', label: 'Торговая точка или студия', value: me.agent.shop, attrs: 'data-change="ag-field" data-k="shop"' })}
      ${field({ id: 'ag-promo', label: 'Промокод для визиток', value: me.agent.promo, hint: 'Клиент называет промокод — вы вводите его в заявке, и видно, что клиент от вас. Скидку по промокоду даёт исполнитель.', attrs: 'data-change="ag-field" data-k="promo"' })}
    </section>
    <section class="plate">
      <h2 class="plate__title">Тариф</h2>
      ${seg('ag-plan', [{ value: 'free', label: 'Бесплатный' }, { value: 'sub', label: 'Подписка' }], me.agent.plan)}
      <p class="small">${me.agent.plan === 'sub' ? 'До 3 партнёров, можно работать с диспетчерами.' : 'Один мастер. Больше мастеров и диспетчеры — по подписке.'} Метроника берёт плату только за пользование приложением, комиссии идут напрямую.</p>
    </section>
    <section class="plate">
      <div class="plate__head"><h2 class="plate__title">Партнёры</h2><span class="small">${partners.length} из ${S.partnerLimit(me)}</span></div>
      ${partners.map((p) => `<div class="well"><div class="order-card__top"><b>${esc(p.name)}</b><span class="chip">${S.hasRole(p, 'dispatcher') ? 'Диспетчер' : 'Мастер'}</span></div>
        ${kv('Рейтинг', `${S.ratingOf(p.id).toLocaleString('ru-RU')} м²`)}${kv('Флизелин / винил / бумага', `${p.price.flizelin} / ${p.price.vinyl} / ${p.price.paper} ₽`)}
        ${S.overdueOf(p.id) ? `<p class="small">${status('warn', 'есть просроченные выплаты')}</p>` : ''}
        <button type="button" class="link-btn" data-action="partner-del" data-id="${p.id}">Убрать из партнёров</button></div>`).join('') || '<p class="empty">Партнёров нет</p>'}
      ${field({ id: 'pt-phone', label: 'Телефон мастера или диспетчера', type: 'tel', inputmode: 'tel', placeholder: '900 222-22-22' })}
      <p class="small">Демо: Сергей 900 222-22-22, Иван 900 333-33-33, Андрей 900 444-44-44, Олег 900 555-55-55.</p>
      ${btnRow([{ label: 'Добавить партнёра', action: 'partner-add', primary: true }])}
    </section>`;
  }
  // Три раздела внизу: Профиль · Работа · Система; внутри раздела — вкладки сверху, если их несколько.
  const groups = isAgent ? [['profile', 'Профиль', ['profile']], ['work', 'Агент', ['agent']], ['system', 'Система', ['general']]]
    : [['profile', 'Профиль', ['profile']], ['work', 'Работа', ['services', 'rooms', 'schedule']], ['system', 'Система', ['notify']]];
  const grp = groups.find((g) => g[2].includes(setTab)) || groups[0];
  const sub = tabs.filter(([k]) => grp[2].includes(k));
  const GI = { profile: ICONS_ST.profile, work: ICONS_ST.work, system: ICONS_ST.system };
  return `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div><div class="st">
    <header class="st-hd"><h1>${grp[1]}</h1><span>Настройки</span></header>
    ${sub.length > 1 ? `<nav class="st-sub" role="tablist" aria-label="Разделы">${sub.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === setTab}" class="st-sub__t${k === setTab ? ' is-on' : ''}" data-action="seg" data-seg="set-tab" data-value="${k}">${t}</button>`).join('')}</nav>` : ''}
    ${body}</div>
    <nav class="st-nav" aria-label="Разделы настроек">
      <button type="button" class="st-nav__sq" data-action="menu-open" aria-label="Меню">${ICONS_ST.menu}</button>
      <button type="button" class="st-nav__sq" data-action="st-back" aria-label="Назад">${ICONS_ST.back}</button>
      <div class="st-nav__tabs" role="tablist">${groups.map(([k, t, ks]) => `<button type="button" role="tab" aria-selected="${grp[0] === k}" class="st-nav__tab${grp[0] === k ? ' is-on' : ''}" data-action="seg" data-seg="set-tab" data-value="${ks[0]}">${GI[k]}<span>${t}</span></button>`).join('')}</div>
    </nav>`;
}

changes['set-country'] = (el) => {
  if (el.value.startsWith('soon:')) { toast(`${el.value.slice(5)}: коды пока не собраны`); return; }
  S.updateSettings({ country: el.value }); toast('Страна сохранена');
};
changes['pf-loc'] = (el) => { S.updateSettings({ [el.dataset.k]: el.value.trim() }); };
changes['pf-photo'] = (el) => { const f = el.files && el.files[0]; if (!f) return;
  const img = new Image(); const rd = new FileReader();
  rd.onload = () => { img.onload = () => { const c = document.createElement('canvas'); const n = 240; const k = Math.max(n / img.width, n / img.height); c.width = n; c.height = n;
    c.getContext('2d').drawImage(img, (n - img.width * k) / 2, (n - img.height * k) / 2, img.width * k, img.height * k);
    S.updateProfile({ photo: c.toDataURL('image/jpeg', 0.85) }); toast('Фото прикреплено'); rerender(); }; img.src = rd.result; };
  rd.readAsDataURL(f); };
actions['pf-photo-del'] = () => { S.updateProfile({ photo: '' }); rerender(); };
changes['set-name'] = (el) => { if (el.value.trim().length >= 2) { S.updateProfile({ name: el.value.trim() }); toast('Имя сохранено'); } };
changes['set-notify'] = (el) => { S.updateSettings({ notify: { ...S.me().settings.notify, on: el.checked } }); toast(el.checked ? 'Уведомления включены' : 'Уведомления выключены'); rerender(); };
changes['set-notify-kind'] = (el) => { const n = S.me().settings.notify; S.updateSettings({ notify: { ...n, kinds: { ...(n.kinds || {}), [el.dataset.k]: el.checked } } }); };
changes['set-remind'] = (el) => { S.updateSettings({ notify: { ...S.me().settings.notify, remind: el.value } }); };
changes['set-price'] = (el) => { const v = Math.round(numOf(el.value)); if (v > 0) { S.updatePrice(el.dataset.type, v); toast('Цена сохранена'); } };
let svEdit = '';
const svSave = (list) => S.updateSettings({ svcList: list });
actions['sv-edit'] = (el) => { svEdit = el.dataset.id; rerender(); const f = document.getElementById(`sv-n-${svcList().findIndex((x) => x.id === svEdit)}`); if (f) f.closest('.sv-card').scrollIntoView({ block: 'center' }); };
actions['sv-save'] = (el) => { const i = Number(el.dataset.i); const L = svcList().map((x) => ({ ...x })); const x = L[i]; if (!x) return;
  const name = val(`sv-n-${i}`).trim(); if (name.length < 2) { toast('Введите название'); return; }
  const p = numOf(val(`sv-p-${i}`)); const n = numOf(val(`sv-r-${i}`));
  x.name = name; x.price = p > 0 ? Math.round(p) : null; x.norm = n > 0 ? n : null;
  if (x.type && x.price) S.updatePrice(x.type, x.price);
  svSave(L); svEdit = ''; toast('Сохранено'); rerender(); };
actions['sv-del'] = (el) => { svSave(svcList().filter((x) => x.id !== el.dataset.id)); svEdit = ''; toast('Услуга удалена'); rerender(); };
actions['sv-add'] = () => { const id = 'c' + Date.now().toString(36); svSave([...svcList(), { id, name: 'Новая услуга', price: null, norm: null, type: '' }]); svEdit = id; rerender(); };
actions['sv-reset'] = () => { svSave(defaultSvcList(false)); svEdit = ''; toast('Стандартный список — цены нужно вписать'); rerender(); };
changes['set-paste-norm'] = (el) => { const v = numOf(el.value); if (v > 0) { const st = S.me().settings; S.updateSettings({ pasteNorms: { ...(st.pasteNorms || {}), [el.dataset.type]: v } }); toast('Сохранено'); } };
changes['set-svc'] = (el) => { const v = numOf(el.value); if (v > 0) { S.updateService(el.dataset.svc, { [el.dataset.k]: el.dataset.k === 'price' ? Math.round(v) : v }); toast('Сохранено'); } };
changes['wk-day'] = (el) => { const d = Number(el.dataset.d); const w = S.me().settings.workdays; S.updateSettings({ workdays: el.checked ? [...new Set([...w, d])] : w.filter((x) => x !== d) }); rerender(); };
changes['wk-hours'] = (el) => { const d = el.dataset.d; const st = S.me().settings; const h = { ...((st.dayHours || {})[d] || st.hours) }; h[el.id.startsWith('wh-f') ? 'from' : 'to'] = el.value; S.updateSettings({ dayHours: { ...(st.dayHours || {}), [d]: h } }); rerender(); };
actions['wk-copy'] = () => { const st = S.me().settings; const h = (st.dayHours || {})[1] || st.hours; const all = {}; [0, 1, 2, 3, 4, 5, 6].forEach((d) => { all[d] = { ...h }; }); S.updateSettings({ dayHours: all, hours: { ...h } }); toast('Часы применены ко всем дням'); rerender(); };
changes['set-hours'] = () => { S.updateSettings({ hours: { from: val('h-from'), to: val('h-to') } }); };
changes['ag-field'] = (el) => { const me = S.me(); me.agent[el.dataset.k] = el.value.trim(); S.save(); toast('Сохранено'); };
actions['pin-change'] = () => {
  const a = val('pin-a'); const b = val('pin-b');
  if (!/^\d{4}$/.test(a)) { toast('PIN — 4 цифры'); return; }
  if (a !== b) { toast('PIN-коды не совпадают'); return; }
  S.setPin(S.me().id, a); toast('PIN изменён'); rerender();
};
let roomPick = '';
const RC_PALETTE = ['#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#8b5cf6', '#6366f1', '#64748b'];
actions['rc-open'] = (el) => { roomPick = roomPick === el.dataset.name ? '' : el.dataset.name; rerender(); };
actions['rc-set'] = (el) => { const own = { ...(S.me().settings.roomColors || {}), [el.dataset.name]: el.dataset.c }; S.updateSettings({ roomColors: own }); rerender(); };
actions['rc-reset'] = () => { S.updateSettings({ roomColors: {} }); roomPick = ''; toast('Стандартные цвета возвращены'); rerender(); };
actions['room-name-add'] = () => { const n = val('room-new'); if (n.length < 2) { toast('Введите название'); return; } const st = S.me().settings; if (st.rooms.includes(n)) { toast('Такая комната уже есть'); return; } S.updateSettings({ rooms: [...st.rooms, n] }); rerender(); };
actions['room-name-del'] = (el) => { const r = S.me().settings.rooms.slice(); r.splice(Number(el.dataset.i), 1); S.updateSettings({ rooms: r }); rerender(); };
actions['room-names-reset'] = () => { S.updateSettings({ rooms: ROOM_NAMES.slice() }); rerender(); };
actions['wd-toggle'] = (el) => { const d = Number(el.dataset.d); const w = S.me().settings.workdays; S.updateSettings({ workdays: w.includes(d) ? w.filter((x) => x !== d) : [...w, d] }); rerender(); };
actions['busy-add'] = () => { const d = val('busy-new'); if (!d) { toast('Выберите дату'); return; } const me = S.me(); me.busy = [...new Set([...(me.busy || []), d])]; S.save(); rerender(); };
actions['busy-del'] = (el) => { const me = S.me(); me.busy = (me.busy || []).filter((x) => x !== el.dataset.d); S.save(); rerender(); };
actions['partner-add'] = () => { const err = S.addPartner(val('pt-phone').replace(/\D/g, '').slice(-10)); if (err) { toast(err); return; } toast('Партнёр добавлен'); rerender(); };
actions['partner-del'] = (el) => { S.removePartner(el.dataset.id); toast('Партнёр убран'); rerender(); };

// ================= команда диспетчера =================
export function renderTeam() {
  const me = S.me();
  if (!S.hasRole(me, 'dispatcher')) return null;
  const team = S.teamOf(me.id);
  const seats = (me.plan && me.plan.seats) || 0;
  const active = (m) => S.get().orders.filter((o) => !['closed', 'cancelled', 'failed'].includes(o.status) && o.rooms.some((r) => r.assignee === m.id || r.pendingFor === m.id)).length;
  return `${topbar('Команда', { back: 'profile' })}
    <section class="plate">
      <div class="tiles"><div class="tile"><span>Мастеров</span><b>${team.length}</b></div><div class="tile"><span>Мест в подписке</span><b>${seats}</b></div></div>
      <p class="small">Подписку за мастера платит каждый диспетчер, с которым мастер работает. Себя как мастера вы не оплачиваете.</p>
      ${btnRow([{ label: '+ Место в подписке', action: 'seat-add' }])}
    </section>
    <section class="plate">
      <h2 class="plate__title">Мастера</h2>
      ${team.map((m) => `<div class="well">
        <div class="order-card__top"><b>${esc(m.name)}</b><span class="small">${S.ratingOf(m.id).toLocaleString('ru-RU')} м²</span></div>
        ${kv('Телефон', esc(phoneRu(m.phone)))}${kv('Активных заказов', String(active(m)))}
        ${kv('Ближайший свободный день', esc(dateRu((S.freeDates(m).find((x) => !x.busy) || {}).iso)))}
        ${S.overdueOf(m.id) ? `<p class="small">${status('warn', 'просрочены выплаты')}</p>` : ''}
        <button type="button" class="link-btn" data-action="team-del" data-id="${m.id}">Убрать из команды</button>
      </div>`).join('') || '<p class="empty">В команде пока никого</p>'}
    </section>
    <section class="plate">
      <h2 class="plate__title">Пригласить мастера</h2>
      ${field({ id: 'tm-phone', label: 'Телефон мастера', type: 'tel', inputmode: 'tel', placeholder: '900 222-22-22' })}
      <p class="small">Мастер должен быть зарегистрирован. Демо: Сергей 900 222-22-22.</p>
      ${btnRow([{ label: 'Добавить в команду', action: 'team-add', primary: true }])}
    </section>`;
}
actions['seat-add'] = () => { S.addSeat(); toast('Место добавлено (демо, без оплаты)'); rerender(); };
actions['team-add'] = () => { const err = S.inviteMaster(val('tm-phone').replace(/\D/g, '').slice(-10)); if (err) { toast(err); return; } toast('Мастер в команде'); rerender(); };
actions['team-del'] = (el) => {
  const m = S.user(el.dataset.id);
  sheet({ title: `Убрать ${m.name}?`, body: '<p>Новые заказы ему передавать будет нельзя. Уже принятые им заказы остаются у него. Место в подписке освободится.</p>', buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Убрать', action: 'team-del-do', data: `data-id="${m.id}"`, primary: true }] });
};
actions['team-del-do'] = (el) => { S.removeFromTeam(el.dataset.id); closeSheet(); rerender(); };

// ================= статистика =================
let period = 'month';
function range(p) {
  const d = new Date();
  if (p === 'year') return [new Date(d.getFullYear(), 0, 1), new Date(d.getFullYear() + 1, 0, 1)];
  if (p === 'prev') return [new Date(d.getFullYear(), d.getMonth() - 1, 1), new Date(d.getFullYear(), d.getMonth(), 1)];
  return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 1)];
}
const inRange = (iso, [a, b]) => { if (!iso) return false; const t = Date.parse(iso.length <= 10 ? iso + 'T12:00:00' : iso); return t >= +a && t < +b; };
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function proIncome(o, me) {
  const ids = S.roomIdsOf(o, me);
  if (o.leadId === me.id && S.lastSmeta(o)) return S.lastSmeta(o).total;
  const sm = S.smetaOf(o, ids);
  return sm.total || S.estimateOf(o, ids).total;
}

function chart(values, labels) {
  const max = Math.max(1, ...values);
  return `<div class="chart" style="--n:${values.length}" role="img" aria-label="${labels.map((l, i) => `${l}: ${Math.round(values[i])}`).join(', ')}">${values.map((v, i) => `<div class="chart__col"><i style="height:${Math.round((v / max) * 100)}%"></i><span>${labels[i]}</span></div>`).join('')}</div>`;
}
function bars(rows) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return rows.map(([k, v, txt]) => `<div class="kv"><span>${esc(k)}</span><b>${txt || v}</b></div><div class="bar"><i style="width:${Math.round((v / max) * 100)}%"></i></div>`).join('');
}

let statTab = 'stats';
export function renderStats() {
  const me = S.me();
  const st = S.get();
  const r = range(period);
  const isAgent = S.hasRole(me, 'agent');
  let body;
  if (isAgent) {
    const mine = st.orders.filter((o) => o.createdBy === me.id);
    const created = mine.filter((o) => inRange(o.createdAt, r));
    const accepted = created.filter((o) => S.linksOf(o.id).some((l) => ['accepted', 'done'].includes(l.status)));
    const closed = mine.filter((o) => o.status === 'closed' && inRange(o.closedAt, r));
    const inc = st.settlements.filter((s) => s.payeeId === me.id && s.status !== 'cancelled');
    const earned = inc.filter((s) => ['due', 'paid', 'received'].includes(s.status) && inRange(s.dueAt, r)).reduce((a, s) => a + s.amount, 0);
    const expected = inc.filter((s) => s.status === 'estimate').reduce((a, s) => a + s.amount, 0);
    const byCh = {};
    created.forEach((o) => { byCh[o.channel.detail || o.channel.source] = (byCh[o.channel.detail || o.channel.source] || 0) + 1; });
    const byP = {};
    created.forEach((o) => { const l = S.linksOf(o.id).filter((x) => x.fromId === me.id).slice(-1)[0]; if (l) byP[S.user(l.toId).name] = (byP[S.user(l.toId).name] || 0) + 1; });
    body = `<section class="plate"><div class="tiles">
        <div class="tile"><span>Заявок передано</span><b>${created.length}</b></div><div class="tile"><span>Принято</span><b>${accepted.length}</b></div>
        <div class="tile"><span>Закрыто</span><b>${closed.length}</b></div><div class="tile"><span>Конверсия</span><b>${created.length ? Math.round((accepted.length / created.length) * 100) : 0}%</b></div>
      </div></section>
      <section class="plate">${kv('Начислено за период', rub(earned), true)}${kv('Ожидается по текущим заказам', rub(expected))}<p class="small">Комиссии и неустойки, которые вам должны исполнители.</p></section>
      <section class="plate"><h2 class="plate__title">Откуда клиенты</h2>${Object.keys(byCh).length ? bars(Object.entries(byCh).map(([k, v]) => [k, v])) : '<p class="empty">Нет заявок за период</p>'}</section>
      <section class="plate"><h2 class="plate__title">Кому передавали</h2>${Object.keys(byP).length ? bars(Object.entries(byP).map(([k, v]) => [k, v])) : '<p class="empty">Нет заявок за период</p>'}</section>`;
  } else {
    const all = st.orders.filter((o) => o.leadId === me.id || o.rooms.some((x) => x.assignee === me.id) || S.linksOf(o.id).some((l) => l.toId === me.id && ['accepted', 'done'].includes(l.status)));
    const closed = all.filter((o) => o.status === 'closed' && inRange(o.closedAt, r));
    const income = closed.reduce((a, o) => a + proIncome(o, me), 0);
    const exp = closed.reduce((a, o) => a + o.expenses.filter((e) => o.leadId === me.id || e.by === me.id).reduce((x, e) => x + e.amount, 0), 0);
    const paid = st.settlements.filter((s) => s.payerId === me.id && ['due', 'paid', 'received'].includes(s.status) && inRange(s.dueAt, r)).reduce((a, s) => a + s.amount, 0);
    const got = st.settlements.filter((s) => s.payeeId === me.id && ['due', 'paid', 'received'].includes(s.status) && inRange(s.dueAt, r)).reduce((a, s) => a + s.amount, 0);
    const m2 = st.credits.filter((c) => c.masterId === me.id && inRange(c.at, r)).reduce((a, c) => a + c.m2, 0);
    const created = all.filter((o) => o.leadId === me.id && inRange(o.createdAt, r));
    const byCh = {};
    created.forEach((o) => { byCh[o.channel.source] = (byCh[o.channel.source] || 0) + 1; });
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
    const perMonth = months.map((m) => all.filter((o) => o.status === 'closed' && inRange(o.closedAt, [m, new Date(m.getFullYear(), m.getMonth() + 1, 1)])).reduce((a, o) => a + proIncome(o, me), 0));
    const pipeline = all.filter((o) => ['measure', 'approval', 'queue', 'work', 'done'].includes(o.status));
    body = `<section class="plate"><div class="tiles">
        <div class="tile"><span>Закрыто заказов</span><b>${closed.length}</b></div><div class="tile"><span>Метров в рейтинг</span><b>${num(Math.round(m2 * 10) / 10)}</b></div>
        <div class="tile"><span>Новых заказов</span><b>${created.length}</b></div><div class="tile"><span>В работе сейчас</span><b>${pipeline.length}</b></div>
      </div></section>
      <section class="plate">
        <h2 class="plate__title">Деньги за период</h2>
        ${kv('Работы по закрытым заказам', rub(income))}${kv('Расходы', '− ' + rub(exp))}${kv('Проценты и неустойки партнёрам', '− ' + rub(paid))}${got ? kv('Получено от партнёров', '+ ' + rub(got)) : ''}
        ${kv('Чистый заработок', rub(income - exp - paid + got), true)}
      </section>
      <section class="plate"><h2 class="plate__title">Выручка по месяцам</h2>${chart(perMonth, months.map((m) => MONTHS[m.getMonth()]))}</section>
      <section class="plate"><h2 class="plate__title">Каналы новых заказов</h2>${Object.keys(byCh).length ? bars(Object.entries(byCh).map(([k, v]) => [k, v])) : '<p class="empty">Нет новых заказов за период</p>'}</section>
      ${S.hasRole(me, 'dispatcher') ? `<section class="plate"><h2 class="plate__title">Мастера команды</h2>${bars(S.teamOf(me.id).map((m) => { const v = st.credits.filter((c) => c.masterId === m.id && inRange(c.at, r)).reduce((a, c) => a + c.m2, 0); return [m.name, v, `${num(Math.round(v * 10) / 10)} м²`]; }))}</section>` : ''}`;
  }
  const tabs = isAgent ? '' : seg('stat-tab', [{ value: 'stats', label: 'Статистика' }, { value: 'fin', label: 'Финансы' }], statTab);
  if (!isAgent && statTab === 'fin') { const f = renderSettlements(); return `${topbar('Статистика')}${tabs}${f.slice(f.indexOf('<section'))}`; }
  return `${topbar('Статистика')}${tabs}
    ${seg('stat-period', [{ value: 'month', label: 'Этот месяц' }, { value: 'prev', label: 'Прошлый' }, { value: 'year', label: 'Год' }], period)}
    ${body}`;
}

// ================= бренд-зона =================
let makerId = '';
export function renderBrand() {
  const me = S.me();
  const makers = S.get().makers;
  const mk = makers.find((m) => m.id === makerId);
  if (!mk) {
    return `${topbar('Бренд-зона')}
      <section class="plate"><p class="small">Раздел производителей: каталог с параметрами рулонов, советы по поклейке и новинки. Производители сами загружают свои данные.</p></section>
      <div class="list">${makers.map((m) => `<button type="button" class="plate card-btn maker" data-action="maker-open" data-id="${m.id}">
        <div class="order-card__top"><b>${esc(m.name)}</b><span class="small">${S.get().materials.filter((x) => x.makerId === m.id).length} в каталоге</span></div>
        <span class="small">${esc(m.about)}</span></button>`).join('')}</div>`;
  }
  const mats = S.get().materials.filter((x) => x.makerId === mk.id);
  return `${topbar(mk.name, { back: 'brand' })}
    <section class="plate"><p>${esc(mk.about)}</p></section>
    ${(mk.news || []).length ? `<section class="plate"><h2 class="plate__title">Новости</h2>${mk.news.map((n) => `<div class="well"><b>${esc(n.title)}</b><p class="small">${esc(n.text)}</p></div>`).join('')}</section>` : ''}
    <section class="plate"><h2 class="plate__title">Советы по поклейке</h2>${(mk.tips || []).map((t) => `<div class="kv"><span>${esc(t)}</span></div>`).join('')}</section>
    <section class="plate"><h2 class="plate__title">Каталог</h2>${mats.map((m) => {
      const rv = S.reviewsOf(m.barcode);
      return `<div class="well">
        <div class="order-card__top"><b>«${esc(m.name)}»</b><span class="small">${esc(typeName(m.type))}</span></div>
        ${kv('Рулон', `${num(m.width)} × ${num(m.length)} м`)}${kv('Раппорт', m.rapport ? `${num(m.rapport)} м` : 'без подбора')}${kv('Штрихкод', esc(m.barcode))}
        <details class="details"><summary>Опыт мастеров · ${rv.length}</summary>
          ${rv.map((x) => `<p class="small"><b>${esc(S.displayName(me, x.authorId))}</b>: ${esc(x.text)}</p>`).join('') || '<p class="small">Пока никто не делился</p>'}
          ${S.hasRole(me, 'agent') ? '' : `<label class="field" for="rv-${m.barcode}"><span class="field__box"><textarea id="rv-${m.barcode}" placeholder="Как материал ведёт себя в работе"></textarea></span></label>${btnRow([{ label: 'Мой опыт', action: 'review-add', data: `data-code="${m.barcode}"` }])}`}
        </details></div>`;
    }).join('')}</section>`;
}
actions['maker-open'] = (el) => { makerId = el.dataset.id; go('brand-' + makerId); };

export function brandRoute(name) {
  if (name === 'brand') { makerId = ''; return renderBrand(); }
  if (name.startsWith('brand-')) { makerId = name.slice(6); return renderBrand(); }
  return null;
}

// ================= агент: звонки и материалы для клиента =================
export function renderCalls() {
  const me = S.me();
  const today = S.todayISO();
  const list = S.get().orders.filter((o) => o.createdBy === me.id && o.status === 'closed');
  const due = list.filter((o) => !o.call);
  const done = list.filter((o) => o.call);
  const card = (o) => `<article class="plate order-card">
    <div class="order-card__top"><span class="order-card__no">№ ${o.no} · ${esc(o.client.name)}</span>${o.call ? status(o.call.result === 'Всё хорошо' ? 'ok' : 'warn', o.call.result) : o.callDue && o.callDue <= today ? status('warn', 'пора звонить') : status('idle', `с ${dateRu(o.callDue)}`)}</div>
    ${kv('Телефон', `<a class="link-btn" href="tel:+7${esc(o.client.phone)}">${esc(phoneRu(o.client.phone))}</a>`)}
    ${kv('Исполнитель', esc(S.user((S.linksOf(o.id).find((l) => l.fromId === me.id && l.status === 'done') || {}).toId)?.name || '—'))}
    ${o.call ? (o.call.comment ? `<p class="small">${esc(o.call.comment)}</p>` : '') : btnRow([{ label: 'Отметить звонок', action: 'call-open', data: `data-id="${o.id}"`, primary: true }])}
  </article>`;
  return `${topbar('Звонки клиентам', { back: 'profile' })}
    <section class="plate"><p class="small">Через 3 дня после закрытия заказа позвоните клиенту: всё ли понравилось. Результат звонка видят исполнители — это контроль качества. На рейтинг в метрах он не влияет.</p></section>
    <section class="plate"><h2 class="plate__title">Позвонить · ${due.length}</h2><div class="list">${due.map(card).join('') || '<p class="empty">Звонить пока некому</p>'}</div></section>
    ${done.length ? `<section class="plate"><h2 class="plate__title">Уже позвонили</h2><div class="list">${done.map(card).join('')}</div></section>` : ''}`;
}
actions['call-open'] = (el) => {
  sheet({
    title: 'Как прошёл звонок?',
    body: `${select({ id: 'call-res', label: 'Результат', value: 'Всё хорошо', options: ['Всё хорошо', 'Есть замечания', 'Не дозвонился'].map((x) => ({ value: x, label: x })) })}
      <label class="field" for="call-com"><span class="field__label">Комментарий</span><span class="field__box"><textarea id="call-com" placeholder="Что сказал клиент"></textarea></span></label>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Сохранить', action: 'call-save', data: `data-id="${el.dataset.id}"`, primary: true }],
  });
};
actions['call-save'] = (el) => { S.markCall(el.dataset.id, val('call-res'), val('call-com')); closeSheet(); toast('Звонок отмечен'); rerender(); };

let docTab = 'offer';
export function renderForClient() {
  const me = S.me();
  const a = me.agent;
  const partners = S.partnersOf(me.id);
  const p = partners[0];
  const texts = {
    offer: `Поклейка обоев под ключ\n\nВы купили обои — мы их поклеим. Мастер приедет на замер, снимет размеры лазерной рулеткой и посчитает точную смету по стенам.\n\nОриентир по цене: от ${p ? p.price.flizelin : SYSTEM_PRICE.flizelin} ₽ за м² (флизелин), от ${p ? p.price.vinyl : SYSTEM_PRICE.vinyl} ₽ (винил).\n${a.promo ? `Промокод ${a.promo} — скидка 5% на работы.\n` : ''}\nЗапись: ${a.shop || 'ваш продавец'}, ${me.name}, ${phoneRu(me.phone)}`,
    memo: 'Памятка: как подготовиться к поклейке\n\n1. Проверьте, что на всех рулонах одинаковый номер партии.\n2. Не распаковывайте рулоны до приезда мастера.\n3. Освободите стены: снимите картины, полки, отодвиньте мебель на 1 м.\n4. За сутки до работ закройте окна — сквозняки портят обои.\n5. После поклейки 48 часов не открывайте окна и не включайте кондиционер.',
    card: `${a.shop || 'Поклейка обоев'}\n${me.name}\n${phoneRu(me.phone)}\n${a.promo ? `Промокод ${a.promo} · скидка 5% на поклейку` : ''}\nНазовите промокод при записи — и мастер приедет на замер.`,
  };
  return `${topbar('Для клиента', { back: 'profile' })}
    ${seg('doc-tab', [{ value: 'offer', label: 'Предложение' }, { value: 'memo', label: 'Памятка' }, { value: 'card', label: 'Визитка' }], docTab)}
    <section class="plate">
      <div class="copybox" id="doc-text">${esc(texts[docTab])}</div>
      <p class="small">Скопируйте текст и отправьте клиенту в мессенджер или распечатайте из своего редактора.</p>
      ${btnRow([{ label: 'Скопировать текст', action: 'copy', data: 'data-src="doc-text"', primary: true }])}
    </section>`;
}

export function onSegMore(name, value) {
  if (name === 'set-tab') { setTab = value; rerender(); return true; }
  if (name === 'stat-period') { period = value; rerender(); return true; }
  if (name === 'stat-tab') { statTab = value; rerender(); return true; }
  if (name === 'doc-tab') { docTab = value; rerender(); return true; }
  if (name === 'ag-plan') { S.setAgentPlan(value); rerender(); return true; }
  return false;
}
