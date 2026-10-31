// Экраны и блоки, общие для всех ролей: шапка, начисления, профиль, история, сводка расчёта.

import { actions, rerender, go } from './core.js?v=4';
import * as S from './store.js?v=4';
import { WALLPAPER_TYPES } from './seed.js?v=4';
import { esc, rub, m2, num, kv, status, btnRow, dateTimeRu, phoneRu, ICONS, sheet, closeSheet, toast } from './ui.js?v=4';

export function topbar(title, { back = '', right = '' } = {}) {
  return `<header class="plate topbar">
    ${back ? `<button type="button" class="icon-btn" data-action="go" data-to="${esc(back)}" aria-label="Назад">${ICONS.back}</button>` : ''}
    <h1 class="topbar__title">${esc(title)}</h1>${right}
  </header>`;
}

export const typeName = (id) => (WALLPAPER_TYPES.find((t) => t.id === id) || { name: id }).name;

export const ORDER_STATUS = {
  offered: ['idle', 'Предложен'],
  measure: ['ok', 'Замер'],
  approval: ['warn', 'Согласование'],
  queue: ['ok', 'Очередь'],
  work: ['ok', 'В работе'],
  done: ['ok', 'Выполнен'],
  closed: ['idle', 'Закрыт'],
  declined: ['bad', 'Отклонён'],
  failed: ['bad', 'Сорван'],
  cancelled: ['idle', 'Отменён'],
};
export function orderStatus(o) {
  if (o.duplicateOf) return status('warn', 'Дубль');
  const [k, t] = ORDER_STATUS[o.status] || ['idle', o.status];
  return status(k, t);
}

const SETTLE = {
  estimate: ['idle', 'Ориентировочно'],
  due: ['warn', 'К выплате'],
  paid: ['warn', 'Выплачено, ждёт подтверждения'],
  received: ['ok', 'Получено'],
  cancelled: ['idle', 'Отменено'],
};

// Блок предварительного расчёта.
export function prelimBlock(o, viewer) {
  const p = o.prelim;
  const mat = S.material(p.barcode);
  const owner = p.priceOwner === 'system' ? 'рекомендованный прайс системы' : `прайс: ${S.displayName(viewer, p.priceOwner, o.id) === 'Вы' ? 'ваш' : S.displayName(viewer, p.priceOwner, o.id)}`;
  return `<section class="well">
    <div class="plate__head"><h3 class="plate__title">Предварительный расчёт</h3><span class="small">${p.mode === 'room' ? 'по размерам' : 'по рулонам'}</span></div>
    ${mat ? kv('Обои', `${esc(mat.brand)} «${esc(mat.name)}»`) : ''}
    ${mat ? kv('Тип и рулон', `${esc(typeName(mat.type))}, ${num(mat.width)} × ${num(mat.length)} м`) : ''}
    ${kv('Рулонов', String(p.rolls))}
    ${kv('Высота потолка', num(p.height) + ' м')}
    ${kv('Ожидаемая площадь', p.areaMin === p.areaMax ? m2(p.areaMid) : `${num(p.areaMin)}–${num(p.areaMax)} м²`)}
    ${kv('Цена поклейки', `${p.pricePerM2} ₽/м² · ${esc(owner)}`)}
    ${kv('Предварительная стоимость', rub(p.base), true)}
  </section>`;
}

export function clientBlock(o) {
  const c = o.client;
  const addr = [c.street, c.house && `д. ${c.house}`, c.entrance && `под. ${c.entrance}`, c.flat && `кв. ${c.flat}`, c.floor && `эт. ${c.floor}`].filter(Boolean).join(', ');
  return `<section class="well">
    <h3 class="plate__title">Клиент</h3>
    ${kv('Имя', esc(c.name))}
    ${kv('Телефон', esc(phoneRu(c.phone)))}
    ${kv('Адрес', esc(addr))}
    ${c.comment ? kv('Комментарий', esc(c.comment)) : ''}
    ${kv('Канал', esc([o.channel.source, o.channel.detail].filter(Boolean).join(' · ')))}
  </section>`;
}

export function historyBlock(o, viewer) {
  let ev = S.eventsOf(o.id);
  // Исполнитель видит историю только со своего звена: кому заказ предлагали раньше и под какой процент, ему знать не нужно.
  if (viewer.id !== o.createdBy) {
    const mine = S.linksOf(o.id).filter((l) => l.toId === viewer.id || l.fromId === viewer.id);
    const since = mine.length ? mine.map((l) => l.createdAt).sort()[0] : '';
    ev = ev.filter((e) => e.action === 'Создан заказ' || e.at >= since)
      .map((e) => (e.action === 'Создан заказ' ? { ...e, detail: `№ ${o.no}` } : e));
  }
  return `<section class="well">
    <h3 class="plate__title">История заказа</h3>
    ${ev.length ? ev.map((e) => `<div class="kv" style="flex-direction:column;align-items:flex-start;gap:2px">
      <span class="small">${esc(S.displayName(viewer, e.actorId, o.id))} · ${esc(S.ROLE_NAMES[e.role] || '')} · ${esc(dateTimeRu(localStamp(e.at)))}</span>
      <b style="text-align:left">${esc(e.action)}</b>
      ${e.detail ? `<span class="small">${esc(maskDetail(e.detail, viewer, o))}</span>` : ''}
    </div>`).join('') : '<p class="empty">Событий пока нет</p>'}
  </section>`;
}

// Мастер, получивший заказ через диспетчера, не должен видеть имя агента даже в журнале.
function maskDetail(text, viewer, o) {
  let t = text;
  S.get().users.forEach((u) => {
    const shown = S.displayName(viewer, u.id, o.id);
    if (shown === 'Контролёр') t = t.split(u.name).join('Контролёр');
  });
  return t;
}

function localStamp(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------- начисления ----------
export function renderSettlements() {
  const me = S.me();
  const st = S.get();
  const mine = st.settlements.filter((s) => (s.payeeId === me.id || s.payerId === me.id) && s.status !== 'cancelled');
  const incoming = mine.filter((s) => s.payeeId === me.id);
  const outgoing = mine.filter((s) => s.payerId === me.id);
  const sum = (arr, statuses) => arr.filter((s) => statuses.includes(s.status)).reduce((a, s) => a + s.amount, 0);

  const row = (s, side) => {
    const o = S.order(s.orderId);
    const other = side === 'in' ? s.payerId : s.payeeId;
    const [k, t] = SETTLE[s.status] || ['idle', s.status];
    const btn = side === 'out' && s.status === 'due'
      ? btnRow([{ label: 'Отметить выплату', action: 'settle-paid', data: `data-id="${s.id}"` }])
      : side === 'in' && s.status === 'paid'
        ? btnRow([{ label: 'Подтвердить получение', action: 'settle-received', data: `data-id="${s.id}"`, primary: true }])
        : '';
    return `<article class="well">
      <div class="order-card__top"><b>${s.type === 'penalty' ? 'Неустойка' : 'Комиссия'} · заказ № ${o ? o.no : '—'}</b>${status(k, t)}</div>
      ${kv(side === 'in' ? 'Платит' : 'Кому', esc(S.displayName(me, other, s.orderId)))}
      ${s.type === 'commission' ? kv('База и процент', `${rub(s.base)} × ${s.pct}%`) : kv('Правило', esc(s.rule || ''))}
      ${kv('Сумма', rub(s.amount), true)}
      ${btn}
    </article>`;
  };

  return `${topbar('Начисления')}
    <section class="plate">
      <p class="muted">Деньги между участниками идут напрямую. Здесь только учёт: кто кому сколько и в каком статусе.</p>
      <div class="tiles">
        <div class="tile"><span>Мне ориентировочно</span><b>${rub(sum(incoming, ['estimate']))}</b></div>
        <div class="tile"><span>Мне к получению</span><b>${rub(sum(incoming, ['due', 'paid']))}</b></div>
        <div class="tile"><span>Я должен ориентировочно</span><b>${rub(sum(outgoing, ['estimate']))}</b></div>
        <div class="tile"><span>Я должен сейчас</span><b>${rub(sum(outgoing, ['due']))}</b></div>
      </div>
    </section>
    <section class="plate">
      <h2 class="plate__title">Мне должны</h2>
      <div class="list">${incoming.length ? incoming.slice().reverse().map((s) => row(s, 'in')).join('') : '<p class="empty">Пока ничего</p>'}</div>
    </section>
    <section class="plate">
      <h2 class="plate__title">Я должен</h2>
      <div class="list">${outgoing.length ? outgoing.slice().reverse().map((s) => row(s, 'out')).join('') : '<p class="empty">Пока ничего</p>'}</div>
    </section>`;
}

actions['settle-paid'] = (el) => { S.markPaid(el.dataset.id); toast('Отмечено. Ждём подтверждения получателя'); rerender(); };
actions['settle-received'] = (el) => { S.markReceived(el.dataset.id); toast('Получение подтверждено'); rerender(); };

actions['go'] = (el) => go(el.dataset.to);
actions['sheet-close'] = () => closeSheet();
actions['hint'] = (el) => sheet({ title: 'Подсказка', body: `<p>${esc(el.dataset.hint)}</p>`, buttons: [{ label: 'Понятно', action: 'sheet-close', primary: true }] });

// Копирование текста: в артефакте нельзя скачивать файлы, поэтому документы для клиента отдаём текстом.
actions['copy'] = (el) => {
  const src = document.getElementById(el.dataset.src);
  if (!src) return;
  const text = src.value != null ? src.value : src.textContent;
  const fallback = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast('Текст скопирован');
    } catch (e) { toast('Не удалось скопировать — выделите текст вручную'); }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast('Текст скопирован'), fallback);
    else fallback();
  } catch (e) { fallback(); }
};
