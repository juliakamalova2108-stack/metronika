// Бренд-зона (Новости · Витрина · Конкурсы), Доска почёта, Креаторы.
// Экраны в стиле статистики: тёмные блоки h-block, переключатели sd-chip, нижняя навигация f-nav.
import { actions, rerender } from './core.js?v=348';
import * as S from './store.js?v=348';
import { esc, toast } from './ui.js?v=348';

const ICON_MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="10" width="18" height="2" rx="1" fill="#A3AEBE"/><rect x="3" y="15" width="18" height="2" rx="1" fill="#A3AEBE"/></svg>';
const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
const ini = (n) => n.split(' ').map((w) => w[0] || '').slice(0, 2).join('');
const AV = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9', '#e66767'];
const avc = (s) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const avatar = (name, size = 44) => `<span class="bz-av" style="width:${size}px;height:${size}px;background:${avc(name)}">${esc(ini(name))}</span>`;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
const page = (title, body, tabs, cur, act) => `<div class="fig-blobs" aria-hidden="true"><i></i><i></i></div>
  <div class="h-page sd bz"><header class="sd-hd"><h1>${title}</h1></header>${body}</div>
  <nav class="f-nav f-nav--tabs" aria-label="Нижнее меню">
    <button type="button" class="f-nav__tab f-nav__menu" data-action="menu-open" aria-label="Меню">${ICON_MENU}</button>
    ${tabs ? `<div class="f-topnav f-botnav"><div class="f-topnav__track" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === cur}" class="f-tab${k === cur ? ' is-active' : ''}" data-action="${act}" data-k="${k}">${t}</button>`).join('')}</div></div>` : '<span class="f-nav__space"></span>'}
  </nav>`;

// ───────── Бренд-зона ─────────
let bzTab = 'news', bzMaker = 'all';
const DAY = 864e5, today = new Date();
const dstr = (d) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const NEWS_EXTRA = [
  { mk: 'Erismann', t: 'Новая коллекция «Скандинавия»', x: 'Светлые фактуры под лён и дерево, рулон 1,06 × 10 м. В магазинах с декабря.', d: 2, tag: 'Новинка' },
  { mk: 'Палитра', t: 'Обновили клей для тяжёлых обоев', x: 'Держит винил на флизелине до 400 г/м², время открытой работы — 20 минут.', d: 5, tag: 'Материалы' },
  { mk: 'Rasch', t: 'Мастер-класс по стыковке узких рулонов', x: 'Онлайн 21 ноября: как клеить 0,53 м без видимых швов. Запись останется в витрине.', d: 8, tag: 'Обучение' },
  { mk: 'Erismann', t: 'Скидка мастерам 10% на образцы', x: 'Покажите карточку мастера в фирменном магазине — образцы для клиентов дешевле.', d: 12, tag: 'Акция' },
];
function bzNews(makers) {
  const list = [...makers.flatMap((m) => (m.news || []).map((n, i) => ({ mk: m.name, t: n.title, x: n.text, d: 3 + i * 6, tag: 'Новости' }))), ...NEWS_EXTRA]
    .filter((n) => bzMaker === 'all' || n.mk === bzMaker).sort((a, b) => a.d - b.d);
  if (!list.length) return '<p class="sd-note">У этого бренда пока нет новостей</p>';
  return list.map((n, i) => `<article class="h-block bz-news${i === 0 ? ' is-top' : ''}">
    <div class="bz-news__hd"><span class="bz-brand">${esc(n.mk)}</span><span class="bz-tag">${esc(n.tag)}</span><small>${dstr(new Date(today - n.d * DAY))}</small></div>
    <h3>${esc(n.t)}</h3><p>${esc(n.x)}</p></article>`).join('');
}
const SW = ['#d9cbb4', '#9fb8ad', '#c9a68a', '#8a9bb8', '#e6dccb', '#b7c4a1', '#a88fa8', '#cfd6db'];
// Коллекции брендов (пример): название, средняя цена рулона, артикул, тип, оттенки
const COLL = {
  'Erismann': [['Elle Decor', 2450, '10195-08', 'флизелин', 2], ['Скандинавия', 1980, '12048-14', 'флизелин', 4], ['Fashion for Walls', 3150, '12031-05', 'винил на флизелине', 1], ['Casual Chic', 1760, '60001-02', 'флизелин', 6]],
  'Палитра': [['Мираж', 1290, 'PL71250-44', 'винил на флизелине', 3], ['Home Color', 990, 'HC71830-12', 'флизелин', 5], ['Белая коллекция', 870, 'PL72105-00', 'под покраску', 7]],
  'Rasch': [['Tiles & More', 2890, '833740', 'бумага', 0], ['Barbara Home', 3640, '527711', 'флизелин', 2], ['Kalide', 2210, '416227', 'флизелин', 5]],
};
const search = (q) => `https://yandex.ru/search/?text=${encodeURIComponent(q)}`;
const LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';
let shMaker = '';
function bzShow(makers) {
  const mk = makers.find((m) => m.name === shMaker);
  if (!mk) {
    return `<div class="bz-grid">${makers.map((m, i) => { const c = COLL[m.name] || [], avg = c.length ? c.reduce((a, x) => a + x[1], 0) / c.length : 0;
      return `<button type="button" class="bz-bt" data-action="bz-open" data-k="${esc(m.name)}" style="--a:${SW[i % SW.length]};--b:${SW[(i + 3) % SW.length]}"><span class="bz-bt__logo">${esc(m.name)}</span>
        <span class="bz-bt__f"><b>${c.length} ${plural(c.length, 'коллекция', 'коллекции', 'коллекций')}</b><small>${avg ? `в среднем ${fmt(avg)} ₽ за рулон` : 'скоро'}</small></span></button>`; }).join('')}</div>`;
  }
  const c = COLL[mk.name] || [], i0 = makers.indexOf(mk);
  return `<button type="button" class="bz-back" data-action="bz-open" data-k="">‹ Все бренды</button>
    <section class="h-block bz-mk"><div class="bz-mk__logo" style="--a:${SW[i0 % SW.length]};--b:${SW[(i0 + 3) % SW.length]}">${esc(mk.name)}</div><p>${esc(mk.about || '')}</p>
      <a class="bz-btn" href="${search(mk.name + ' обои официальный сайт')}" target="_blank" rel="noopener">Сайт бренда ${LINK}</a></section>
    ${c.map(([n, price, art, type, k], j) => `<article class="h-block bz-col"><div class="bz-col__sw" style="background:linear-gradient(135deg, ${SW[(j + k) % SW.length]}, ${SW[(j + k + 3) % SW.length]})"></div>
      <div class="bz-col__t"><b>${esc(n)}</b><small>${esc(type)}</small><span class="bz-col__p">≈ ${fmt(price)} ₽ <i>за рулон</i></span></div>
      <div class="bz-col__l"><a href="${search(mk.name + ' ' + n + ' обои')}" target="_blank" rel="noopener">Коллекция ${LINK}</a><a href="${search(mk.name + ' ' + art)}" target="_blank" rel="noopener">Арт. ${esc(art)} ${LINK}</a></div></article>`).join('') || '<p class="sd-note">Коллекции бренда скоро появятся</p>'}`;
}
const CONTESTS = [
  { id: 'c1', mk: 'Erismann', t: 'Лучшая спальня ноября', x: 'Пришлите фото «до/после» спальни с обоями Erismann. Жюри — дизайнеры бренда.', prize: 'Профессиональный набор инструмента', until: 22, n: 38, col: '#3987e5' },
  { id: 'c2', mk: 'Палитра', t: 'Идеальный стык', x: 'Крупный план стыка на тёмных обоях. Побеждает самый незаметный шов.', prize: '30 000 ₽ на материалы', until: 9, n: 61, col: '#c98500' },
  { id: 'c3', mk: 'Rasch', t: 'Сложная стена', x: 'Ниши, арки, скосы под крышей — покажите, как справились с узким рулоном.', prize: 'Поездка на завод Rasch', until: 35, n: 17, col: '#199e70' },
];
const joined = new Set();
function bzContests() {
  const list = CONTESTS.filter((c) => bzMaker === 'all' || c.mk === bzMaker);
  if (!list.length) return '<p class="sd-note">У этого бренда сейчас нет конкурсов</p>';
  return list.map((c) => { const on = joined.has(c.id);
    return `<article class="h-block bz-ct"><div class="bz-ct__top" style="--c:${c.col}"><span class="bz-brand">${esc(c.mk)}</span><span class="bz-ct__left">ещё ${c.until} ${plural(c.until, 'день', 'дня', 'дней')}</span></div>
      <h3>${esc(c.t)}</h3><p>${esc(c.x)}</p>
      <div class="bz-ct__row"><div><small>Приз</small><b>${esc(c.prize)}</b></div><div><small>Участников</small><b>${c.n + (on ? 1 : 0)}</b></div></div>
      <button type="button" class="bz-btn${on ? ' is-on' : ''}" data-action="bz-join" data-id="${c.id}">${on ? 'Вы участвуете ✓' : 'Участвовать'}</button></article>`; }).join('');
}
export function renderBrandZone() {
  const makers = S.get().makers;
  const chips = bzTab === 'show' ? '' : `<div class="sd-chips">${[['all', 'Все бренды'], ...makers.map((m) => [m.name, m.name])].map(([k, t]) => `<button type="button" class="sd-chip${bzMaker === k ? ' is-on' : ''}" data-action="bz-maker" data-k="${esc(k)}">${esc(t)}</button>`).join('')}</div>`;
  const body = bzTab === 'show' ? bzShow(makers) : bzTab === 'contests' ? bzContests() : bzNews(makers);
  return page('Бренд-зона', chips + body, [['news', 'Новости'], ['show', 'Витрина'], ['contests', 'Конкурсы']], bzTab, 'bz-tab');
}
actions['bz-tab'] = (el) => { bzTab = el.dataset.k; rerender(); window.scrollTo(0, 0); };
actions['bz-open'] = (el) => { shMaker = el.dataset.k; rerender(); window.scrollTo(0, 0); };
actions['bz-maker'] = (el) => { bzMaker = el.dataset.k; rerender(); };
actions['bz-join'] = (el) => { const id = el.dataset.id; if (joined.has(id)) joined.delete(id); else { joined.add(id); toast('Вы в конкурсе — загрузите фото в галерее заказа'); } rerender(); };

// ───────── Доска почёта ─────────
let hTab = 'month';
const HONOR = [['Алексей Морозов', 'Уфа', 412, 1880], ['Ирина Белова', 'Казань', 388, 1710], ['Дмитрий Орлов', 'Самара', 351, 1695], ['Павел Соколов', 'Уфа', 302, 1420], ['Наталья Егорова', 'Пермь', 287, 1390],
  ['Руслан Хайруллин', 'Стерлитамак', 260, 1255], ['Олег Кузнецов', 'Челябинск', 244, 1180], ['Марина Лебедева', 'Уфа', 231, 1102], ['Тимур Галиев', 'Оренбург', 207, 990], ['Виктор Попов', 'Казань', 193, 941]];
export function renderHonor() {
  const me = S.me(), myM = Math.round(S.ratingOf(me.id) / (hTab === 'month' ? 12 : 1)) || (hTab === 'month' ? 176 : 1050);
  const rows = [...HONOR.map(([n, c, m, y]) => ({ n, c, v: hTab === 'month' ? m : y })), { n: me.name, c: me.settings.city || 'Уфа', v: myM, me: true }].sort((a, b) => b.v - a.v);
  const pod = rows.slice(0, 3), rest = rows.slice(3, 10), myPos = rows.findIndex((r) => r.me) + 1;
  const ord = [pod[1], pod[0], pod[2]], H = [86, 112, 70], medal = ['🥈', '🥇', '🥉'], col = ['#c9d3dc', '#f2c94c', '#d69a6a'];
  const podium = `<section class="h-block bz-pod">${ord.map((r, i) => r ? `<div class="bz-pod__c">${avatar(r.n, i === 1 ? 58 : 48)}<b>${esc(r.n.split(' ')[0])}</b><small>${esc(r.c)}</small>
      <div class="bz-pod__bar" style="height:${H[i]}px;--c:${col[i]}"><span>${medal[i]}</span><em>${fmt(r.v)} м²</em></div></div>` : '').join('')}</section>`;
  const list = `<section class="h-block bz-rank">${rest.map((r, i) => `<div class="bz-rank__r${r.me ? ' is-me' : ''}"><span class="bz-rank__n">${i + 4}</span>${avatar(r.n, 36)}<span class="bz-rank__t"><b>${esc(r.n)}${r.me ? ' · вы' : ''}</b><small>${esc(r.c)}</small></span><em>${fmt(r.v)} м²</em></div>`).join('')}</section>`;
  const mine = myPos > 10 ? `<section class="h-block bz-rank"><div class="bz-rank__r is-me"><span class="bz-rank__n">${myPos}</span>${avatar(me.name, 36)}<span class="bz-rank__t"><b>${esc(me.name)} · вы</b><small>до 10-го места ${fmt(rows[9].v - myM)} м²</small></span><em>${fmt(myM)} м²</em></div></section>` : '';
  const hint = `<p class="bz-hint">Место считается по поклеенным квадратным метрам ${hTab === 'month' ? 'за этот месяц' : 'за год'}. Тройка лидеров попадает на главную страницу всех мастеров.</p>`;
  return page('Доска почёта', podium + list + mine + hint, [['month', 'Месяц'], ['year', 'Год']], hTab, 'hn-tab');
}
actions['hn-tab'] = (el) => { hTab = el.dataset.k; rerender(); };

// ───────── Креаторы ─────────
let crPl = 'all';
const PL = { yt: ['YouTube', '#ff3b30'], tg: ['Telegram', '#2aabee'], vk: ['ВКонтакте', '#4c75a3'], dz: ['Дзен', '#9aa3a8'], rt: ['Rutube', '#14191f'] };
const CREATORS = [
  ['Обойщик Саня', 'yt', 214000, 'Разборы сложных поклеек, стыки, углы'], ['Ремонт без боли', 'tg', 86000, 'Короткие советы мастерам и клиентам'],
  ['Мастер Ильдар', 'vk', 41000, 'Поклейка в новостройках Уфы, честные цены'], ['Стены как надо', 'yt', 158000, 'Шпаклёвка, грунт, подготовка под обои'],
  ['Дизайн и обои', 'dz', 63000, 'Подбор обоев под интерьер, тренды сезона'], ['Флизелин и точка', 'tg', 27500, 'Обзоры клея и обоев от практиков'],
  ['Ремонтник Олег', 'rt', 19000, 'Влог мастера: объекты, клиенты, деньги'], ['Обои PRO', 'vk', 95000, 'Сообщество мастеров-обойщиков'],
];
const subs = new Set();
export function renderCreators() {
  const list = CREATORS.filter(([, p]) => crPl === 'all' || p === crPl).sort((a, b) => b[2] - a[2]);
  const chips = `<div class="sd-chips">${[['all', 'Все'], ...Object.entries(PL).map(([k, [t]]) => [k, t])].map(([k, t]) => `<button type="button" class="sd-chip${crPl === k ? ' is-on' : ''}" data-action="cr-pl" data-k="${k}">${t}</button>`).join('')}</div>`;
  const cards = list.map(([n, p, f, about]) => { const on = subs.has(n);
    return `<article class="h-block bz-cr">${avatar(n, 52)}<div class="bz-cr__t"><b>${esc(n)}</b><span class="bz-pl" style="--c:${PL[p][1]}">${PL[p][0]}</span><small>${esc(about)}</small><em>${f >= 1000 ? `${fmt(f / 1000)} тыс.` : fmt(f)} подписчиков</em></div>
      <button type="button" class="bz-btn bz-btn--sm${on ? ' is-on' : ''}" data-action="cr-sub" data-k="${esc(n)}">${on ? 'Вы подписаны' : 'Подписаться'}</button></article>`; }).join('');
  const join = `<section class="h-block bz-join"><b>Ведёте блог про ремонт?</b><p>Добавьтесь в креаторы — вас увидят мастера и бренды для коллабораций.</p><button type="button" class="bz-btn" data-action="cr-apply">Стать креатором</button></section>`;
  return page('Креаторы', chips + cards + join);
}
actions['cr-pl'] = (el) => { crPl = el.dataset.k; rerender(); };
actions['cr-sub'] = (el) => { const k = el.dataset.k; if (subs.has(k)) subs.delete(k); else subs.add(k); rerender(); };
actions['cr-apply'] = () => toast('Заявка отправлена — мы свяжемся с вами');
