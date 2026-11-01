// Профиль, настройки, команда диспетчера, статистика, бренд-зона, звонки и материалы агента для клиента.

import { actions, changes, rerender, go, val } from './core.js?v=81';
import * as S from './store.js?v=81';
import { WALLPAPER_TYPES, SERVICES, UNIT, ROOM_NAMES, SYSTEM_PRICE } from './seed.js?v=81';
import { esc, rub, num, kv, status, field, select, btnRow, seg, dateRu, phoneRu, sheet, closeSheet, toast, ICONS } from './ui.js?v=81';
import { topbar, typeName } from './shared.js?v=81';
import { COUNTRIES, SOON } from './phonecodes.js?v=81';

const numOf = (s) => { const n = parseFloat(String(s).replace(',', '.').replace(/\s/g, '')); return Number.isFinite(n) ? n : NaN; };
const navRow = (to, label, icon, note = '') => `<button type="button" class="well card-btn nav-row" data-action="go" data-to="${to}"><span class="nav-row__icon">${ICONS[icon] || ''}</span><span><b>${esc(label)}</b>${note ? `<small>${esc(note)}</small>` : ''}</span><span class="nav-row__chev">${ICONS.chevron}</span></button>`;

// ================= профиль =================
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
      <p class="small">Только подтверждённые метры поклейки: заказ заполнен, геоотметки на замере и работах, замер с рулетки, смета из замера, заказ закрыт. Рейтинг остаётся с мастером.</p>
      <div class="plate__head"><span class="small">Надёжность по выплатам</span>${rel}</div>
    </section>
    ${disp.length ? `<section class="plate"><h2 class="plate__title">Работаю с диспетчерами</h2>${disp.map((d) => kv(esc(d.name), esc(phoneRu(d.phone)))).join('')}<p class="small">Заказы от диспетчера — по его ценам. Свои заказы — по вашим.</p></section>` : ''}
    <section class="plate"><div class="list">
      ${S.hasRole(me, 'dispatcher') ? navRow('team', 'Команда', 'users', `${S.teamOf(me.id).length} из ${(me.plan && me.plan.seats) || 0} мест`) : ''}
      ${navRow('stats', 'Статистика', 'chart')}
      ${navRow('brand', 'Бренд-зона', 'briefcase', 'Производители, каталог, советы')}
      ${navRow('settings', 'Настройки', 'user', 'Прайс, услуги, комнаты, график, PIN')}
    </div></section>`;
  }
  return `${topbar('Профиль')}
    <section class="plate">
      <div class="plate__head"><h2 class="plate__title">${esc(me.name)}</h2><span class="chip">${esc(roles)}</span></div>
      ${kv('Телефон', esc(phoneRu(me.phone)))}
    </section>
    ${body}
    ${btnRow([{ label: 'Сменить пользователя', action: 'switch-user' }])}`;
}

// ================= настройки =================
let setTab = 'general';
export function renderSettings() {
  const me = S.me();
  const isAgent = S.hasRole(me, 'agent');
  const tabs = isAgent ? [['general', 'Общие'], ['agent', 'Агент']] : [['general', 'Общие'], ['price', 'Прайс'], ['services', 'Услуги'], ['rooms', 'Комнаты'], ['schedule', 'График']];
  if (!tabs.some(([k]) => k === setTab)) setTab = 'general';
  const st = me.settings;
  let body = '';
  if (setTab === 'general') {
    body = `<section class="plate">
      <h2 class="plate__title">Профиль</h2>
      ${field({ id: 'set-name', label: 'Имя и фамилия', value: me.name, attrs: 'data-change="set-name"' })}
      ${kv('Телефон', esc(phoneRu(me.phone)))}<p class="small">Телефон — это логин. Сменить его можно через поддержку.</p>
    </section>
    <section class="plate">
      <h2 class="plate__title">Страна</h2>
      ${select({ id: 'set-country', label: 'Страна работы', value: st.country || 'RU', options: [...Object.entries(COUNTRIES).map(([k, c]) => ({ value: k, label: c.name })), ...SOON.map((n) => ({ value: 'soon:' + n, label: n + ' — скоро' }))], attrs: 'data-change="set-country"' })}
      <p class="small">По стране в поле «Телефон» клиента стоит её код (Россия — +7) и проверяется код оператора. Сейчас собраны коды России.</p>
    </section>
    <section class="plate">
      <h2 class="plate__title">Уведомления</h2>
      <label class="toggle-row"><span><b>Присылать уведомления</b><small>Новые заказы, сообщения в чате, выплаты</small></span><input type="checkbox" class="switch" data-change="set-notify" ${st.notify.on ? 'checked' : ''}/></label>
      ${field({ id: 'set-remind', label: 'Напоминание о завтрашних выездах', type: 'time', value: st.notify.remind, attrs: 'data-change="set-remind"' })}
    </section>
    <section class="plate">
      <h2 class="plate__title">PIN-код</h2>
      <div class="grid-2">${field({ id: 'pin-a', label: 'Новый PIN', type: 'password', inputmode: 'numeric', attrs: 'maxlength="4"' })}${field({ id: 'pin-b', label: 'Ещё раз', type: 'password', inputmode: 'numeric', attrs: 'maxlength="4"' })}</div>
      ${btnRow([{ label: 'Сменить PIN', action: 'pin-change' }])}
    </section>`;
  } else if (setTab === 'price') {
    body = `<section class="plate">
      <h2 class="plate__title">Поклейка, ₽ за м²</h2>
      ${WALLPAPER_TYPES.map((t) => field({ id: `pr-${t.id}`, label: `${t.name} · система ${SYSTEM_PRICE[t.id]}`, value: String(me.price[t.id]), inputmode: 'numeric', suffix: '₽', attrs: `data-change="set-price" data-type="${t.id}"` })).join('')}
      <p class="small">${S.hasRole(me, 'dispatcher') ? 'Ваши мастера работают по этому прайсу в ваших заказах.' : 'По этим ценам агенты видят предварительную стоимость. В заказах диспетчера действуют его цены.'} В уже принятых заказах цены не меняются.</p>
    </section>`;
  } else if (setTab === 'services') {
    body = `<section class="plate">
      <h2 class="plate__title">Услуги: цена и норма выработки</h2>
      <p class="small">Норма — сколько успеваете за час. Из неё считается срок в рабочих днях по 8 часов.</p>
      ${SERVICES.filter((s) => s.id !== 'paste').map((s) => { const v = st.services[s.id]; return `<div class="well"><b>${esc(s.name)}</b><div class="grid-2">
        ${field({ id: `sv-p-${s.id}`, label: `Цена, ₽/${UNIT[s.unit]}`, value: String(v.price), inputmode: 'numeric', attrs: `data-change="set-svc" data-svc="${s.id}" data-k="price"` })}
        ${field({ id: `sv-n-${s.id}`, label: `${UNIT[s.unit]} в час`, value: num(v.norm), inputmode: 'decimal', attrs: `data-change="set-svc" data-svc="${s.id}" data-k="norm"` })}</div></div>`; }).join('')}
    </section>`;
  } else if (setTab === 'rooms') {
    body = `<section class="plate">
      <h2 class="plate__title">Список комнат</h2>
      ${st.rooms.map((r, i) => `<div class="kv"><span>${esc(r)}</span><button type="button" class="icon-btn" data-action="room-name-del" data-i="${i}" aria-label="Удалить ${esc(r)}">${ICONS.trash}</button></div>`).join('')}
      ${field({ id: 'room-new', label: 'Новая комната', placeholder: 'Например, Мансарда' })}
      ${btnRow([{ label: 'Вернуть стандартный список', action: 'room-names-reset' }, { label: 'Добавить', action: 'room-name-add', primary: true }])}
    </section>`;
  } else if (setTab === 'schedule') {
    const wd = [[1, 'Пн'], [2, 'Вт'], [3, 'Ср'], [4, 'Чт'], [5, 'Пт'], [6, 'Сб'], [0, 'Вс']];
    const busy = (me.busy || []).slice().sort();
    body = `<section class="plate">
      <h2 class="plate__title">Рабочие дни</h2>
      <div class="chips">${wd.map(([d, n]) => `<button type="button" class="chip-btn${st.workdays.includes(d) ? ' is-on' : ''}" aria-pressed="${st.workdays.includes(d)}" data-action="wd-toggle" data-d="${d}">${n}</button>`).join('')}</div>
      <div class="grid-2">${field({ id: 'h-from', label: 'С', type: 'time', value: st.hours.from, attrs: 'data-change="set-hours"' })}${field({ id: 'h-to', label: 'До', type: 'time', value: st.hours.to, attrs: 'data-change="set-hours"' })}</div>
      <p class="small">Агенты видят только свободные рабочие дни.</p>
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
  return `${topbar('Настройки', { back: 'profile' })}
    <nav class="plate topbar" style="padding:0 12px" aria-label="Разделы настроек"><div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === setTab}" class="tabs__item${k === setTab ? ' is-active' : ''}" data-action="seg" data-seg="set-tab" data-value="${k}">${t}</button>`).join('')}</div></nav>
    ${body}`;
}

changes['set-country'] = (el) => {
  if (el.value.startsWith('soon:')) { toast(`${el.value.slice(5)}: коды пока не собраны`); return; }
  S.updateSettings({ country: el.value }); toast('Страна сохранена');
};
changes['set-name'] = (el) => { if (el.value.trim().length >= 2) { S.updateProfile({ name: el.value.trim() }); toast('Имя сохранено'); } };
changes['set-notify'] = (el) => { S.updateSettings({ notify: { ...S.me().settings.notify, on: el.checked } }); toast(el.checked ? 'Уведомления включены' : 'Уведомления выключены'); };
changes['set-remind'] = (el) => { S.updateSettings({ notify: { ...S.me().settings.notify, remind: el.value } }); };
changes['set-price'] = (el) => { const v = Math.round(numOf(el.value)); if (v > 0) { S.updatePrice(el.dataset.type, v); toast('Цена сохранена'); } };
changes['set-svc'] = (el) => { const v = numOf(el.value); if (v > 0) { S.updateService(el.dataset.svc, { [el.dataset.k]: el.dataset.k === 'price' ? Math.round(v) : v }); toast('Сохранено'); } };
changes['set-hours'] = () => { S.updateSettings({ hours: { from: val('h-from'), to: val('h-to') } }); };
changes['ag-field'] = (el) => { const me = S.me(); me.agent[el.dataset.k] = el.value.trim(); S.save(); toast('Сохранено'); };
actions['pin-change'] = () => {
  const a = val('pin-a'); const b = val('pin-b');
  if (!/^\d{4}$/.test(a)) { toast('PIN — 4 цифры'); return; }
  if (a !== b) { toast('PIN-коды не совпадают'); return; }
  S.setPin(S.me().id, a); toast('PIN изменён'); rerender();
};
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
  return `${topbar('Статистика', { back: 'profile' })}
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
    return `${topbar('Бренд-зона', { back: 'profile' })}
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
  if (name === 'doc-tab') { docTab = value; rerender(); return true; }
  if (name === 'ag-plan') { S.setAgentPlan(value); rerender(); return true; }
  return false;
}
