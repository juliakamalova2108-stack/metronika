// Бренд-зона (Новости · Витрина · Конкурсы), Доска почёта, Креаторы.
// Экраны в стиле статистики: тёмные блоки h-block, переключатели sd-chip, нижняя навигация f-nav.
import { actions, rerender } from './core.js?v=355';
import * as S from './store.js?v=355';
import { esc, toast } from './ui.js?v=355';

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
    ${tabs ? `<div class="f-topnav f-botnav${tabs.reduce((a, t) => a + t[1].length, 0) > 26 ? ' f-botnav--many' : ''}"><div class="f-topnav__track" role="tablist">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === cur}" class="f-tab${k === cur ? ' is-active' : ''}" data-action="${act}" data-k="${k}">${t}</button>`).join('')}</div></div>` : '<span class="f-nav__space"></span>'}
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
let shMaker = '', shColl = '', shItem = -1, shPh = 0;
// «Фото» обоев рисуем узорами (в прототипе нет настоящих снимков)
const PAL = [['#efe6d6', '#c9b38f'], ['#dfe8e2', '#7fa392'], ['#e9dccf', '#b07d5a'], ['#dfe3ec', '#6d7fa6'], ['#f1ece4', '#9c948a'], ['#e5ead8', '#8a9a5b'], ['#ecdfe6', '#9b6f8a'], ['#2e3a3f', '#c9a96b'], ['#e8e3da', '#3f4a52']];
const PAT = ['Полоса', 'Дамаск', 'Геометрия', 'Горох', 'Ёлочка', 'Штукатурка', 'Листья', 'Клетка'];
const pat = (k, [bg, fg]) => [
  `repeating-linear-gradient(90deg, ${bg} 0 18px, ${fg} 18px 22px, ${bg} 22px 34px, ${fg}55 34px 36px)`,
  `radial-gradient(circle at 50% 50%, ${fg} 0 6px, transparent 7px) 0 0/34px 44px, radial-gradient(ellipse at 50% 0, ${fg}88 0 9px, transparent 10px) 17px 22px/34px 44px, ${bg}`,
  `linear-gradient(135deg, ${fg} 25%, transparent 25%) -14px 0/28px 28px, linear-gradient(225deg, ${fg} 25%, transparent 25%) -14px 0/28px 28px, linear-gradient(315deg, ${fg}99 25%, transparent 25%) 0 0/28px 28px, ${bg}`,
  `radial-gradient(${fg} 3.5px, transparent 4px) 0 0/22px 22px, radial-gradient(${fg}77 3px, transparent 3.5px) 11px 11px/22px 22px, ${bg}`,
  `linear-gradient(45deg, ${fg}aa 25%, transparent 25%, transparent 75%, ${fg}aa 75%) 0 0/16px 32px, linear-gradient(-45deg, ${fg}66 25%, transparent 25%, transparent 75%, ${fg}66 75%) 0 16px/16px 32px, ${bg}`,
  `radial-gradient(circle at 20% 30%, ${fg}44, transparent 40%), radial-gradient(circle at 75% 70%, ${fg}55, transparent 45%), radial-gradient(circle at 60% 20%, ${bg}, transparent 50%), ${bg}`,
  `radial-gradient(ellipse 9px 16px at 30% 40%, ${fg} 98%, transparent) 0 0/40px 46px, radial-gradient(ellipse 9px 16px at 70% 80%, ${fg}99 98%, transparent) 0 0/40px 46px, ${bg}`,
  `linear-gradient(${fg}66 2px, transparent 2px) 0 0/26px 26px, linear-gradient(90deg, ${fg}66 2px, transparent 2px) 0 0/26px 26px, ${bg}`,
][k % 8];
const itemsOf = (mkName, ci) => { const [cn, price, art, type, sh] = COLL[mkName][ci];
  return Array.from({ length: 6 }, (_, j) => { const k = (ci * 3 + j * 5 + sh) % 8, pl = PAL[(ci * 2 + j + sh) % PAL.length];
    return { name: `${cn} · ${PAT[k]}`, art: `${art}-${String(j + 1).padStart(2, '0')}`, price: Math.round((price * (0.82 + ((j * 37 + ci * 13) % 40) / 100)) / 10) * 10, k, pl, type,
      rate: (4.3 + ((j * 7 + ci) % 7) / 10).toFixed(1).replace('.', ','), rv: 3 + ((j * 11 + ci * 5) % 40), w: mkName === 'Rasch' ? '0,53' : '1,06', l: '10,05', rap: [0, 0.32, 0.53, 0.64][(j + ci) % 4], g: 140 + ((j * 23) % 120) }; }); };
const ph = (it, n, cls = '') => `<div class="bz-ph ${cls}" style="background:${pat(it.k, it.pl)}">${n === 1 ? '<i class="bz-ph__room"></i>' : ''}${n === 2 ? '<i class="bz-ph__roll"></i>' : ''}</div>`;
function bzShow(makers) {
  const mk = makers.find((m) => m.name === shMaker);
  if (!mk) {
    return `<div class="bz-grid">${makers.map((m, i) => { const c = COLL[m.name] || [], avg = c.length ? c.reduce((a, x) => a + x[1], 0) / c.length : 0;
      return `<button type="button" class="bz-bt" data-action="bz-open" data-k="${esc(m.name)}" style="--a:${SW[i % SW.length]};--b:${SW[(i + 3) % SW.length]}"><span class="bz-bt__logo">${esc(m.name)}</span>
        <span class="bz-bt__f"><b>${c.length} ${plural(c.length, 'коллекция', 'коллекции', 'коллекций')}</b><small>${avg ? `в среднем ${fmt(avg)} ₽ за рулон` : 'скоро'}</small></span></button>`; }).join('')}</div>`;
  }
  const c = COLL[mk.name] || [], i0 = makers.indexOf(mk), ci = c.findIndex((x) => x[0] === shColl);
  if (ci < 0) {
    return `<button type="button" class="bz-back" data-action="bz-open" data-k="">‹ Все бренды</button>
    <section class="h-block bz-mk"><div class="bz-mk__logo" style="--a:${SW[i0 % SW.length]};--b:${SW[(i0 + 3) % SW.length]}">${esc(mk.name)}</div><p>${esc(mk.about || '')}</p>
      <a class="bz-btn" href="${search(mk.name + ' обои официальный сайт')}" target="_blank" rel="noopener">Сайт бренда ${LINK}</a></section>
    <div class="bz-grid">${c.map(([n, price, , type], j) => { const its = itemsOf(mk.name, j);
      return `<button type="button" class="bz-cl" data-action="bz-coll" data-k="${esc(n)}"><span class="bz-cl__ph">${its.slice(0, 4).map((it) => `<i style="background:${pat(it.k, it.pl)}"></i>`).join('')}</span>
        <span class="bz-cl__t"><b>${esc(n)}</b><small>${esc(type)} · ${its.length} обоев</small><em>≈ ${fmt(price)} ₽ за рулон</em></span></button>`; }).join('')}</div>`;
  }
  const its = itemsOf(mk.name, ci), it = its[shItem];
  if (!it) {
    return `<button type="button" class="bz-back" data-action="bz-coll" data-k="">‹ ${esc(mk.name)}</button>
    <header class="bz-ch"><b>${esc(shColl)}</b><small>${esc(c[ci][3])} · средняя цена ≈ ${fmt(c[ci][1])} ₽ за рулон</small></header>
    <div class="bz-grid">${its.map((x, j) => `<button type="button" class="bz-pc" data-action="bz-item" data-k="${j}">${ph(x, 0)}
      <span class="bz-pc__b"><b class="bz-pc__p">${fmt(x.price)} ₽</b><span class="bz-pc__n">${esc(x.name)}</span><small>★ ${x.rate} · ${x.rv} ${plural(x.rv, 'отзыв', 'отзыва', 'отзывов')}</small><small>Арт. ${esc(x.art)}</small></span></button>`).join('')}</div>`;
  }
  const spec = [['Артикул', it.art], ['Бренд', mk.name], ['Коллекция', shColl], ['Материал', it.type], ['Размер рулона', `${it.w} × ${it.l} м`], ['Раппорт', it.rap ? `${String(it.rap).replace('.', ',')} м` : 'без подбора'], ['Плотность', `${it.g} г/м²`]];
  return `<button type="button" class="bz-back" data-action="bz-item" data-k="-1">‹ ${esc(shColl)}</button>
    <section class="bz-gal">${ph(it, shPh, 'bz-ph--big')}<div class="bz-gal__dots">${[0, 1, 2].map((n) => `<button type="button" class="${n === shPh ? 'is-on' : ''}" data-action="bz-ph" data-k="${n}" aria-label="Фото ${n + 1}"></button>`).join('')}</div>
      <div class="bz-gal__th">${[0, 1, 2].map((n) => `<button type="button" class="${n === shPh ? 'is-on' : ''}" data-action="bz-ph" data-k="${n}">${ph(it, n)}</button>`).join('')}</div></section>
    <section class="h-block bz-pd"><div class="bz-pd__pr"><b>${fmt(it.price)} ₽</b><small>за рулон</small></div><h2>${esc(it.name)}</h2>
      <div class="bz-pd__rt"><span>★ ${it.rate}</span><small>${it.rv} ${plural(it.rv, 'отзыв', 'отзыва', 'отзывов')} мастеров</small></div>
      <div class="bz-pd__bt"><a class="bz-btn" href="${search(mk.name + ' ' + it.art)}" target="_blank" rel="noopener">Купить на сайте ${LINK}</a></div></section>
    <section class="h-block bz-sp"><p class="bz-sp__h">Характеристики</p>${spec.map(([k, v]) => `<div class="bz-sp__r"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</section>`;
}
const CONTESTS = [
  { id: 'c1', mk: 'Erismann', t: 'Лучшая спальня ноября', x: 'Пришлите фото «до/после» спальни с обоями Erismann. Жюри — дизайнеры бренда.', prize: 'Профессиональный набор инструмента', until: 22, n: 38, col: '#3987e5' },
  { id: 'c2', mk: 'Палитра', t: 'Идеальный стык', x: 'Крупный план стыка на тёмных обоях. Побеждает самый незаметный шов.', prize: '30 000 ₽ на материалы', until: 9, n: 61, col: '#c98500' },
  { id: 'c3', mk: 'Rasch', t: 'Сложная стена', x: 'Ниши, арки, скосы под крышей — покажите, как справились с узким рулоном.', prize: 'Поездка на завод Rasch', until: 35, n: 17, col: '#199e70' },
];
const joined = new Set();
function bzContests() {
  const list = CONTESTS;
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
  if (bzTab === 'contests') bzTab = 'news';
  const body = bzTab === 'show' ? bzShow(makers) : bzNews(makers);
  return page('Бренд-зона', chips + body, [['news', 'Новости'], ['show', 'Витрина']], bzTab, 'bz-tab');
}
actions['bz-tab'] = (el) => { bzTab = el.dataset.k; rerender(); window.scrollTo(0, 0); };
actions['bz-open'] = (el) => { shMaker = el.dataset.k; shColl = ''; shItem = -1; rerender(); window.scrollTo(0, 0); };
actions['bz-coll'] = (el) => { shColl = el.dataset.k; shItem = -1; rerender(); window.scrollTo(0, 0); };
actions['bz-item'] = (el) => { shItem = +el.dataset.k; shPh = 0; rerender(); window.scrollTo(0, 0); };
actions['bz-ph'] = (el) => { shPh = +el.dataset.k; rerender(); };
actions['bz-maker'] = (el) => { bzMaker = el.dataset.k; rerender(); };
actions['bz-join'] = (el) => { const id = el.dataset.id; if (joined.has(id)) joined.delete(id); else { joined.add(id); toast('Вы в конкурсе — загрузите фото в галерее заказа'); } rerender(); };

// ───────── Доска почёта ─────────
let hTab = 'month';
const HONOR = [['Алексей Морозов', 'Уфа', 412, 1880], ['Ирина Белова', 'Казань', 388, 1710], ['Дмитрий Орлов', 'Самара', 351, 1695], ['Павел Соколов', 'Уфа', 302, 1420], ['Наталья Егорова', 'Пермь', 287, 1390],
  ['Руслан Хайруллин', 'Стерлитамак', 260, 1255], ['Олег Кузнецов', 'Челябинск', 244, 1180], ['Марина Лебедева', 'Уфа', 231, 1102], ['Тимур Галиев', 'Оренбург', 207, 990], ['Виктор Попов', 'Казань', 193, 941]];
function honorRating() {
  const me = S.me(), myM = Math.round(S.ratingOf(me.id) / (hTab === 'month' ? 12 : 1)) || (hTab === 'month' ? 176 : 1050);
  const rows = [...HONOR.map(([n, c, m, y]) => ({ n, c, v: hTab === 'month' ? m : y })), { n: me.name, c: me.settings.city || 'Уфа', v: myM, me: true }].sort((a, b) => b.v - a.v);
  const pod = rows.slice(0, 3), rest = rows.slice(3, 10), myPos = rows.findIndex((r) => r.me) + 1;
  const ord = [pod[1], pod[0], pod[2]], H = [86, 112, 70], medal = ['🥈', '🥇', '🥉'], col = ['#c9d3dc', '#f2c94c', '#d69a6a'];
  const podium = `<section class="h-block bz-pod">${ord.map((r, i) => r ? `<div class="bz-pod__c">${avatar(r.n, i === 1 ? 58 : 48)}<b>${esc(r.n.split(' ')[0])}</b><small>${esc(r.c)}</small>
      <div class="bz-pod__bar" style="height:${H[i]}px;--c:${col[i]}"><span>${medal[i]}</span><em>${fmt(r.v)} м²</em></div></div>` : '').join('')}</section>`;
  const list = `<section class="h-block bz-rank">${rest.map((r, i) => `<div class="bz-rank__r${r.me ? ' is-me' : ''}"><span class="bz-rank__n">${i + 4}</span>${avatar(r.n, 36)}<span class="bz-rank__t"><b>${esc(r.n)}${r.me ? ' · вы' : ''}</b><small>${esc(r.c)}</small></span><em>${fmt(r.v)} м²</em></div>`).join('')}</section>`;
  const mine = myPos > 10 ? `<section class="h-block bz-rank"><div class="bz-rank__r is-me"><span class="bz-rank__n">${myPos}</span>${avatar(me.name, 36)}<span class="bz-rank__t"><b>${esc(me.name)} · вы</b><small>до 10-го места ${fmt(rows[9].v - myM)} м²</small></span><em>${fmt(myM)} м²</em></div></section>` : '';
  const hint = `<p class="bz-hint">Место считается по поклеенным квадратным метрам ${hTab === 'month' ? 'за этот месяц' : 'за год'}. Тройка лидеров попадает на главную страницу всех мастеров.</p>`;
  return podium + list + mine + hint;
}
// Соревнования: номинации, лидеры, ваше место
const NOM = [
  ['🧾', 'Больше всего заказов', 'Кто закрыл больше заказов', 'заказов', [31, 28, 26], 14, 'Сертификат 10 000 ₽ на инструмент'],
  ['📐', 'Король квадратных метров', 'Больше всего поклеенных м²', 'м²', [412, 388, 351], 176, 'Лазерный уровень'],
  ['🧻', 'Рулонный рекорд', 'Больше всего рулонов за период', 'рулонов', [236, 214, 198], 97, 'Набор шпателей Pro'],
  ['🎨', 'Мастер раппорта', 'Больше рулонов с подбором рисунка', 'рулонов', [94, 81, 77], 38, 'Обучение у бренда'],
  ['⚡', 'Самый быстрый', 'Лучшая скорость поклейки', 'м²/ч', [11.8, 11.2, 10.9], 9.6, 'Беспроводной миксер'],
  ['⭐', 'Любимец клиентов', 'Самая высокая оценка клиентов', 'из 5', [5, 4.98, 4.97], 4.9, 'Значок на профиле на месяц'],
  ['✨', 'Без единой переделки', 'Заказов подряд без жалоб', 'заказов', [42, 37, 33], 19, 'Бонус 5 000 ₽'],
  ['✂️', 'Экономный', 'Меньше всего обрезков и отходов', '% отхода', [4.1, 4.6, 5.0], 6.8, 'Нож и лезвия Olfa', true],
  ['🌱', 'Новичок месяца', 'Лучший результат среди тех, кто с нами меньше 3 месяцев', 'м²', [214, 190, 171], null, 'Продвижение в поиске мастеров'],
];
const SPONS = ['Erismann', 'Палитра', 'Rasch', 'Quelyd', 'Knauf', 'Erismann', 'Metylan', 'Olfa', 'Палитра'];
function honorContests() {
  const me = S.me(), ppl = HONOR.map((h) => h[0]);
  const v = (x) => (Number.isInteger(x) ? fmt(x) : String(x).replace('.', ','));
  return `<section class="h-block bz-org"><b>Соревнования Метроники</b><p>Проводит Метроника при спонсорстве брендов — призы от спонсоров. Итоги ${hTab === 'month' ? 'месяца — 30 ноября' : 'года — 31 декабря'}, участвуют все мастера автоматически.</p></section>` + NOM.map(([ic, t, d, unit, top, my, prize, low], i) => {
    const k = hTab === 'year' ? (low ? 1 : 11) : 1, sc = (x) => (low ? x : Number.isInteger(x) ? Math.round(x * k) : +(x).toFixed(2));
    const leaders = top.map((x, j) => [ppl[(i * 2 + j * 3) % ppl.length], sc(x)]);
    const myPlace = my == null ? null : 4 + ((i * 5) % 9), lead = leaders[0][1];
    const pct = my == null ? 0 : Math.max(6, Math.min(100, low ? (lead / my) * 100 : (sc(my) / lead) * 100));
    return `<article class="h-block bz-nom"><div class="bz-nom__hd"><span class="bz-nom__ic">${ic}</span><span><b>${t}</b><small>${d}</small></span></div>
      <ol class="bz-nom__top">${leaders.map(([n, x], j) => `<li><span class="bz-nom__m">${['🥇', '🥈', '🥉'][j]}</span>${avatar(n, 28)}<span class="bz-nom__n">${esc(n)}</span><b>${v(x)} <i>${unit}</i></b></li>`).join('')}</ol>
      ${my == null ? '<p class="bz-nom__me is-off">Вы с нами больше 3 месяцев — эта номинация для новичков</p>' : `<div class="bz-nom__me"><span>Вы — <b>${myPlace} место</b> · ${v(sc(my))} ${unit}</span><div class="bz-nom__bar"><i style="width:${pct}%"></i></div></div>`}
      <div class="bz-nom__ft"><span class="bz-nom__pr">🎁 ${esc(prize)}</span><span class="bz-nom__sp">Спонсор <b>${esc(SPONS[i])}</b></span></div></article>`; }).join('');
}
// Доска почёта: люди, которые внесли вклад в отрасль
const FAME = [
  ['Николай Гришин', 'Мастер-обойщик, наставник', 'Москва', 31, 'Обучил больше 300 мастеров. Автор методики раскроя с подбором раппорта без потерь, которой сегодня пользуются тысячи обойщиков.', ['Наставник', 'Автор методики', '300+ учеников'], [['ок. 210 тыс.', 'м² за карьеру'], ['312', 'учеников'], ['4 800', 'объектов']]],
  ['Елена Сафина', 'Технолог отделочных материалов', 'Казань', 24, 'Разработала стандарт подготовки стен под флизелин, который приняли производители. Ведёт бесплатные разборы ошибок поклейки.', ['Стандарт отрасли', 'Эксперт брендов'], [['18', 'стандартов и инструкций'], ['1 200+', 'разборов'], ['9', 'брендов-партнёров']]],
  ['Ринат Ахметов', 'Основатель гильдии обойщиков', 'Уфа', 19, 'Собрал первое профессиональное сообщество обойщиков в регионе, добился честных расценок и страхования работ для мастеров.', ['Основатель гильдии', 'Защита мастеров'], [['2 400', 'мастеров в гильдии'], ['14', 'городов'], ['ок. 95 тыс.', 'м² лично']]],
  ['Анна Ковалёва', 'Дизайнер, исследователь цвета', 'Санкт-Петербург', 16, 'Создала открытую палитру сочетаний обоев и красок для маленьких квартир. Её подборками пользуются мастера при работе с клиентами.', ['Открытая палитра', 'Лектор'], [['540', 'подборок'], ['80+', 'лекций'], ['3', 'книги']]],
  ['Сергей Лаптев', 'Изобретатель инструмента', 'Екатеринбург', 27, 'Придумал прижимной валик для стыков на тяжёлых обоях — сейчас он есть почти в каждом наборе обойщика.', ['Изобретатель', 'Патент'], [['4', 'патента'], ['ок. 120 тыс.', 'м² за карьеру'], ['60', 'учеников']]],
];
let hView = 'fame';
function honorFame() {
  return `<p class="bz-hint" style="margin-top:0">Люди, которые сделали нашу профессию лучше: учили мастеров, придумывали инструменты и методики, объединяли сообщество.</p>` + FAME.map(([n, role, city, yrs, txt, tags, st], i) => `<article class="h-block bz-fame">
    <div class="bz-fame__hd"><span class="bz-fame__ring">${avatar(n, 72)}</span><div><b>${esc(n)}</b><small>${esc(role)}</small><em>${esc(city)} · ${yrs} ${plural(yrs, 'год', 'года', 'лет')} в профессии</em></div></div>
    <p class="bz-fame__t">${esc(txt)}</p>
    <div class="bz-fame__tags">${tags.map((t) => `<span>🏅 ${esc(t)}</span>`).join('')}</div>
    <div class="bz-fame__st">${st.map(([v, l]) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>
    <div class="bz-fame__ft">На доске почёта с ${2019 + (i % 6)} года</div></article>`).join('') +
    `<section class="h-block bz-join"><b>Знаете такого человека?</b><p>Предложите мастера, технолога или наставника — сообщество проголосует.</p><button type="button" class="bz-btn" data-action="hn-nominate">Предложить кандидата</button></section>`;
}
export function renderHonor() { return page('Доска почёта', honorFame()); }

// ───────── События: Соревнования · Конкурсы · Мероприятия ─────────
let evTab = 'comp';
const EVENTS = [
  ['Вебинар', 'Флизелин без пузырей', 'Erismann', 14, '19:00', 'Онлайн', 'Технолог бренда разберёт подготовку стен и типичные ошибки на флизелине.', 412],
  ['Мастер-класс', 'Стыки на тёмных обоях', 'Палитра', 21, '11:00', 'Уфа, ТЦ «Мега», шоурум', 'Практика на стенде: подрезка, прикатка, работа с раппортом. Мест — 20.', 17],
  ['Выставка', 'Ремонт и отделка 2026', 'Метроника', 28, '10:00', 'Казань, Expo', 'Стенд Метроники, встречи с брендами, розыгрыш инструмента среди мастеров.', 260],
  ['Встреча', 'Клуб обойщиков Уфы', 'Метроника', 33, '18:30', 'Уфа, коворкинг «Точка»', 'Разговор про цены, клиентов и сложные объекты. Чай и полезные знакомства.', 34],
  ['Обучение', 'Курс «Обойщик с нуля»', 'Rasch', 40, '10:00', 'Онлайн, 4 недели', 'Для новичков и помощников: от замера до сдачи объекта. Сертификат бренда.', 96],
];
const signed = new Set();
function evMeets() {
  return EVENTS.map(([kind, t, org, d, time, place, x, n], i) => { const dt = new Date(today.getTime() + d * DAY), on = signed.has(i);
    return `<article class="h-block bz-ev"><div class="bz-ev__d"><b>${dt.getDate()}</b><small>${dt.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '')}</small></div>
      <div class="bz-ev__b"><span class="bz-tag">${esc(kind)}</span><h3>${esc(t)}</h3><p>${esc(x)}</p>
      <div class="bz-ev__m"><span>🕒 ${time}</span><span>📍 ${esc(place)}</span><span>Организатор <b>${esc(org)}</b></span></div>
      <div class="bz-ev__f"><small>${n + (on ? 1 : 0)} ${plural(n + (on ? 1 : 0), 'идёт', 'идут', 'идут')}</small><button type="button" class="bz-btn bz-btn--sm${on ? ' is-on' : ''}" data-action="ev-sign" data-k="${i}">${on ? 'Вы записаны ✓' : 'Записаться'}</button></div></div></article>`; }).join('');
}
export function renderEvents() {
  const per = evTab === 'comp' ? `<div class="sd-chips">${[['month', 'Этот месяц'], ['year', 'Этот год']].map(([k, t]) => `<button type="button" class="sd-chip${hTab === k ? ' is-on' : ''}" data-action="hn-tab" data-k="${k}">${t}</button>`).join('')}</div>` : '';
  const body = evTab === 'comp' ? honorContests() : evTab === 'contests' ? `<p class="bz-hint" style="margin-top:0">Конкурсы от брендов: присылайте фото своих работ и выигрывайте призы.</p>${bzContests()}` : evMeets();
  return page('События', per + body, [['comp', 'Соревнования'], ['contests', 'Конкурсы'], ['meet', 'Мероприятия']], evTab, 'ev-tab');
}
actions['ev-tab'] = (el) => { evTab = el.dataset.k; rerender(); window.scrollTo(0, 0); };
actions['ev-sign'] = (el) => { const i = +el.dataset.k; if (signed.has(i)) signed.delete(i); else { signed.add(i); toast('Вы записаны — напомним за день'); } rerender(); };
actions['hn-nominate'] = () => toast('Спасибо! Кандидатура уйдёт на голосование');
actions['hn-view'] = (el) => { hView = el.dataset.k; rerender(); window.scrollTo(0, 0); };
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
