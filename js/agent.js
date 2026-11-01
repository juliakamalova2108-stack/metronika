// Сценарий агента: сканер обоев → расчёт → исполнитель, дата и процент → клиент → передача заказа.
// Плюс «Мои заявки» и повторная передача отклонённого или сорванного заказа.

import { actions, rerender, go, val, numVal } from './core.js?v=75';
import * as S from './store.js?v=75';
import { SYSTEM_PRICE, WALLPAPER_TYPES, DEMO_BARCODES } from './seed.js?v=75';
import { areaFromRolls, rollsFromRoom, prelimCost, commissionAmount } from './calc.js?v=75';
import { esc, rub, num, kv, status, field, select, btnRow, seg, dateRu, dateTimeRu, weekdayShort, dayNum, sheet, closeSheet, toast, ICONS } from './ui.js?v=75';
import { topbar, typeName, orderStatus, prelimBlock, clientBlock, historyBlock } from './shared.js?v=75';

const STEPS = ['Материал', 'Расчёт', 'Исполнитель', 'Клиент', 'Проверка'];

function freshDraft() {
  return {
    step: 0, barcode: '', scan: null, newMat: null,
    mode: 'rolls', rolls: 10, height: 2.7, walls: [4, 3, 4, 3], openings: [{ kind: 'window', w: 1.2, h: 1.4 }, { kind: 'door', w: 0.8, h: 2.0 }],
    partnerId: '', date: '', hour: '10', minute: '00', pct: 5,
    channel: 'shop', client: { name: '', phone: '', street: '', house: '', entrance: '', flat: '', floor: '', comment: '' },
    errors: {},
  };
}
let d = freshDraft();

// ---------- расчёт по черновику ----------
function calc() {
  const mat = d.scan && d.scan.material;
  if (!mat) return null;
  if (d.mode === 'rolls') {
    const r = areaFromRolls(mat, d.rolls || 0, d.height || 0);
    return { ...r, rolls: d.rolls, area: r.mid, ok: r.spr > 0 && d.rolls > 0 && r.max > 0 };
  }
  const openings = d.openings.map((o) => ({ w: o.w, h: o.h }));
  const r = rollsFromRoom(mat, d.walls, d.height || 0, openings);
  return { ...r, min: r.area, max: r.area, mid: r.area, ok: r.spr > 0 && r.area > 0 };
}

function stepsBar() {
  return `<div class="steps" aria-label="Шаг ${d.step + 1} из ${STEPS.length}">${STEPS.map((_, i) => `<i class="${i <= d.step ? 'is-done' : ''}"></i>`).join('')}</div>`;
}

// ---------- шаг 1: материал ----------
function stepMaterial() {
  const sc = d.scan;
  let result = '';
  if (sc && sc.kind === 'found') {
    const m = sc.material;
    result = `<section class="well">
      <div class="plate__head"><span>Штрихкод</span>${status('ok', 'считан')}</div><div class="tile"><b style="font-size:17px">${esc(m.barcode)}</b></div>
      <div class="plate__head"><span>Бренд</span>${status('ok', m.status === 'user' ? 'добавлен вами' : 'распознан')}</div><div class="tile"><b style="font-size:17px">${esc(m.brand)} «${esc(m.name)}»</b></div>
      <div class="plate__head"><span>Тип материала</span>${status('ok', 'определён')}</div><div class="tile"><b style="font-size:17px">${esc(typeName(m.type))}</b></div>
      ${kv('Рулон', `${num(m.width)} × ${num(m.length)} м`)}
      ${kv('Раппорт', m.rapport ? `${num(m.rapport)} м` : 'без подбора рисунка')}
      ${kv('Цена системы', `${SYSTEM_PRICE[m.type]} ₽/м² поклейки`)}
    </section>
    ${btnRow([{ label: 'Другие обои', action: 'scan-reset' }, { label: 'Дальше', action: 'step-next', primary: true }])}`;
  } else if (sc && sc.kind === 'new') {
    const n = d.newMat;
    result = `<section class="well">
      <div class="plate__head"><span>Штрихкод</span>${status('ok', 'считан')}</div><div class="tile"><b style="font-size:17px">${esc(sc.code)}</b></div>
      <div class="plate__head"><span>Этих обоев нет в базе</span>${status('warn', 'нет в базе')}</div>
      <p class="small">Заполните с этикетки. Размеры рулона и раппорт нужны, чтобы посчитать рулоны и площадь. После проверки производителем карточка станет подтверждённой.</p>
      ${select({ id: 'nm-brand', label: 'Бренд', value: n.brand, options: [{ value: '', label: 'Выберите бренд' }, ...['Erismann', 'Палитра', 'Rasch', 'Marburg', 'A.S. Création', 'Другой'].map((b) => ({ value: b, label: b }))] })}
      ${n.brand === 'Другой' ? field({ id: 'nm-brand-other', label: 'Название бренда', value: n.brandOther || '' }) : ''}
      ${field({ id: 'nm-name', label: 'Коллекция или артикул', value: n.name || '', placeholder: 'Например, «Мираж»' })}
      ${select({ id: 'nm-type', label: 'Тип материала', value: n.type, options: [{ value: '', label: 'Выберите тип' }, ...WALLPAPER_TYPES.map((t) => ({ value: t.id, label: t.name }))] })}
      <div class="grid-2">
        ${select({ id: 'nm-width', label: 'Ширина рулона', value: n.width, options: [{ value: '1.06', label: '1,06 м' }, { value: '0.53', label: '0,53 м' }, { value: '0.7', label: '0,70 м' }, { value: '1.4', label: '1,40 м' }] })}
        ${field({ id: 'nm-length', label: 'Длина рулона, м', value: n.length, inputmode: 'decimal' })}
      </div>
      ${field({ id: 'nm-rapport', label: 'Раппорт, м (0 — без подбора)', value: n.rapport, inputmode: 'decimal', hint: 'Раппорт — шаг повтора рисунка. Указан на этикетке значком со стрелкой и числом в сантиметрах: 64 см = 0,64 м.' })}
      ${d.errors.newMat ? `<p class="field__error">${esc(d.errors.newMat)}</p>` : ''}
    </section>
    ${btnRow([{ label: 'Отмена', action: 'scan-reset' }, { label: 'Добавить в базу', action: 'newmat-save', primary: true }])}`;
  } else if (sc && sc.kind === 'bad') {
    result = `<section class="well">
      <div class="plate__head"><span>Штрихкод</span>${status('bad', 'не считан')}</div>
      <p class="small">Нужно 8, 12, 13 или 14 цифр. Введите цифры, напечатанные под полосками штрихкода.</p>
    </section>`;
  }

  return `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Сканирование</h2>${ICONS.barcode.replace('<svg', '<svg style="width:26px;height:22px"')}</div>
    <p class="muted">Наведите камеру на штрихкод обоев</p>
    <div class="scanner" aria-hidden="true">
      <svg viewBox="0 0 340 160"><path d="M30 24h40M30 24v30M310 24h-40M310 24v30M30 136h40M30 136v-30M310 136h-40M310 136v-30" stroke="currentColor" stroke-width="3" fill="none"/>
      <path d="M90 50v60M100 50v60M106 50v60M118 50v60M126 50v60M132 50v60M146 50v60M152 50v60M164 50v60M176 50v60M182 50v60M196 50v60M206 50v60M212 50v60M224 50v60M236 50v60M242 50v60M250 50v60" stroke="currentColor" stroke-width="3"/></svg>
      <span class="scanner__line"></span>
    </div>
    ${field({ id: 'barcode', label: 'Штрихкод', value: d.barcode, placeholder: '13 цифр под полосками', inputmode: 'numeric', hint: 'Сканер читает линейные штрихкоды EAN-13, EAN-8, UPC-A и ITF-14 — обычно на обратной стороне рулона. Если не считывается, введите цифры под полосками. QR-коды не подходят.' })}
    ${btnRow([{ label: 'Сканировать', action: 'scan', primary: true }])}
    <div class="well"><p class="small">В прототипе камера не подключена: введите цифры или выберите пример.</p>
      <div class="chips">${DEMO_BARCODES.map((b) => `<button type="button" class="chip-btn" data-action="scan-demo" data-code="${b.code}">${b.code}<small>${esc(b.hint)}</small></button>`).join('')}</div>
    </div>
  </section><div id="scan-result" style="height:0;scroll-margin-top:12px"></div>${result}`;
}

// ---------- шаг 2: расчёт ----------
function stepCalc() {
  const c = calc();
  const mat = d.scan.material;
  const res = c && c.ok
    ? `<section class="well">
        <h3 class="plate__title">Результат</h3>
        ${kv('Полоса', `${num(c.stripLen)} м · ${c.spr} шт. из рулона`)}
        ${d.mode === 'room' ? kv('Периметр стен', `${num(c.perimeter)} м`) + kv('Нужно полос', String(c.stripsNeeded)) : ''}
        <div class="tiles">
          <div class="tile"><span>${d.mode === 'room' ? 'Продать рулонов' : 'Рулонов куплено'}</span><b>${c.rolls}</b></div>
          <div class="tile"><span>${d.mode === 'room' ? 'Площадь под оклейку' : 'Ожидаемая площадь'}</span><b>${d.mode === 'room' ? num(c.area) : `${num(c.min)}–${num(c.max)}`} м²</b></div>
        </div>
        <p class="small">${d.mode === 'room' ? 'Площадь стен за вычетом окон и дверей.' : 'Нижняя граница учитывает отходы на подрезку и подбор рисунка.'} Её потом сверят с замером прибора.</p>
      </section>
      ${btnRow([{ label: 'Назад', action: 'step-prev' }, { label: 'Дальше', action: 'step-next', primary: true }])}`
    : `<section class="well"><p class="field__error">${c && c.spr === 0 ? 'Полоса получается длиннее рулона — проверьте высоту потолка.' : 'Заполните значения, чтобы получить расчёт.'}</p></section>
      ${btnRow([{ label: 'Назад', action: 'step-prev' }])}`;

  const rollsForm = `<div class="grid-2">
      ${field({ id: 'c-rolls', label: 'Рулонов', value: d.rolls, inputmode: 'numeric', attrs: 'data-live="calc"' })}
      ${field({ id: 'c-height', label: 'Высота потолка', value: num(d.height), inputmode: 'decimal', suffix: 'м', attrs: 'data-live="calc"' })}
    </div>`;

  const roomForm = `${field({ id: 'c-height', label: 'Высота потолка', value: num(d.height), inputmode: 'decimal', suffix: 'м', attrs: 'data-live="calc"' })}
    <div class="field"><span class="field__label">Стены, м</span>
      <div class="grid-4">${d.walls.map((w, i) => `<span class="field__box"><input id="c-wall-${i}" inputmode="decimal" value="${esc(num(w))}" aria-label="Стена ${i + 1}" data-live="calc"/></span>`).join('')}</div>
      <div class="btn-row btn-row--2"><button type="button" class="btn" data-action="wall-add">+ Стена</button><button type="button" class="btn" data-action="wall-del" ${d.walls.length <= 1 ? 'disabled' : ''}>− Стена</button></div>
    </div>
    <div class="field"><span class="field__label">Окна и двери, м</span>
      ${d.openings.map((o, i) => `<div class="grid-4" style="align-items:center">
        <span class="small">${o.kind === 'door' ? 'Дверь' : 'Окно'}</span>
        <span class="field__box"><input id="c-ow-${i}" inputmode="decimal" value="${esc(num(o.w))}" aria-label="Ширина" data-live="calc"/></span>
        <span class="field__box"><input id="c-oh-${i}" inputmode="decimal" value="${esc(num(o.h))}" aria-label="Высота" data-live="calc"/></span>
        <button type="button" class="icon-btn" data-action="opening-del" data-i="${i}" aria-label="Убрать">${ICONS.trash}</button></div>`).join('')}
      <p class="small">Ширина × высота</p>
      <div class="btn-row btn-row--2"><button type="button" class="btn" data-action="opening-add" data-kind="window">+ Окно</button><button type="button" class="btn" data-action="opening-add" data-kind="door">+ Дверь</button></div>
    </div>`;

  return `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Расчёт</h2><span class="small">${esc(mat.brand)}, ${num(mat.width)} × ${num(mat.length)} м</span></div>
    ${seg('calc-mode', [{ value: 'rolls', label: 'По рулонам' }, { value: 'room', label: 'По размерам' }], d.mode)}
    <p class="small">${d.mode === 'rolls' ? 'Клиент уже знает, сколько рулонов берёт.' : 'Клиент принёс рисунок комнаты с размерами.'}</p>
    ${d.mode === 'rolls' ? rollsForm : roomForm}
  </section><div id="calc-result">${res}</div>`;
}

function readCalcInputs() {
  const h = numVal('c-height');
  if (!Number.isNaN(h)) d.height = h;
  if (d.mode === 'rolls') {
    const r = numVal('c-rolls');
    d.rolls = Number.isNaN(r) ? 0 : Math.max(0, Math.round(r));
  } else {
    d.walls = d.walls.map((w, i) => { const v = numVal(`c-wall-${i}`); return Number.isNaN(v) ? 0 : v; });
    d.openings = d.openings.map((o, i) => {
      const w = numVal(`c-ow-${i}`); const hh = numVal(`c-oh-${i}`);
      return { ...o, w: Number.isNaN(w) ? 0 : w, h: Number.isNaN(hh) ? 0 : hh };
    });
  }
}

// ---------- шаг 3: исполнитель ----------
function stepPartner() {
  const me = S.me();
  const c = calc();
  const mat = d.scan.material;
  const partners = S.partnersOf(me.id);
  const sys = SYSTEM_PRICE[mat.type];
  const p = d.partnerId ? S.user(d.partnerId) : null;
  const dates = p ? S.freeDates(p) : [];
  const price = p ? S.priceFor(p, mat.type) : sys;
  const cost = prelimCost(c.mid, price);
  const hours = Array.from({ length: 13 }, (_, i) => String(8 + i).padStart(2, '0'));

  return `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Кому передать</h2><span class="small">${partners.length} из ${S.partnerLimit(me)} партнёров</span></div>
    <div class="well"><div class="kv"><span>Цена системы для торговых точек</span><b>${sys} ₽/м² → ${rub(prelimCost(c.mid, sys))}</b></div></div>
    ${partners.map((pt) => {
      const pp = S.priceFor(pt, mat.type);
      const firstFree = S.freeDates(pt).find((x) => !x.busy);
      return `<button type="button" class="well partner${pt.id === d.partnerId ? ' is-active' : ''}" data-action="pick-partner" data-id="${pt.id}" aria-pressed="${pt.id === d.partnerId}">
        <span class="partner__name">${esc(pt.name)}</span><span class="partner__price">${rub(prelimCost(c.mid, pp))}</span>
        <span class="small">${S.hasRole(pt, 'dispatcher') ? `Диспетчер · команда ${S.teamOf(pt.id).length + 1} чел.` : 'Мастер'} · ${S.ratingOf(pt.id).toLocaleString('ru-RU')} м²</span><span class="small">${pp} ₽/м²</span>
        <span class="small" style="grid-column:1/-1">Ближайшая свободная дата: ${firstFree ? dateRu(firstFree.iso) : 'нет в ближайшие 2 недели'}</span>
      </button>`;
    }).join('') || '<p class="empty">У вас пока нет партнёров. Добавьте мастера или диспетчера в профиле.</p>'}
  </section>
  ${p ? `<section class="plate">
    <h2 class="plate__title">Дата и время приезда</h2>
    <div class="days">${dates.map((x) => `<button type="button" class="day${x.iso === d.date ? ' is-active' : ''}" data-action="pick-date" data-iso="${x.iso}" ${x.busy ? 'disabled' : ''} aria-label="${dateRu(x.iso)}${x.busy ? ', занято' : ''}"><small>${weekdayShort(x.weekday)}</small><b>${dayNum(x.iso)}</b></button>`).join('')}</div>
    <p class="small">Зачёркнуты занятые дни исполнителя.</p>
    <div class="grid-2">
      ${select({ id: 'p-hour', label: 'Часы', value: d.hour, options: hours.map((h) => ({ value: h, label: h })) })}
      ${select({ id: 'p-minute', label: 'Минуты', value: d.minute, options: ['00', '15', '30', '45'].map((m) => ({ value: m, label: m })) })}
    </div>
  </section>
  <section class="plate">
    <h2 class="plate__title">Ваша комиссия</h2>
    ${field({ id: 'p-pct', label: 'Процент', value: d.pct, inputmode: 'decimal', suffix: '%', attrs: 'data-live="pct"', error: d.errors.pct || '' })}
    <p class="small">Рекомендовано 5%. Можно поставить больше — исполнитель решит, браться ли. После принятия процент не меняется.</p>
    <div class="tiles">
      <div class="tile"><span>Предварительная стоимость</span><b>${rub(cost)}</b></div>
      <div class="tile"><span>Комиссия ориентировочно</span><b id="pct-amount">${rub(commissionAmount(cost, d.pct || 0))}</b></div>
    </div>
    <p class="small">Итоговая комиссия — с фактического объёма этих работ после замера, но не меньше этой суммы.</p>
  </section>` : ''}
  ${d.errors.partner ? `<p class="field__error">${esc(d.errors.partner)}</p>` : ''}
  ${btnRow([{ label: 'Назад', action: 'step-prev' }, { label: 'Дальше', action: 'step-next', primary: true, disabled: !p }])}`;
}

function readPartnerInputs() {
  if (document.getElementById('p-hour')) { d.hour = val('p-hour'); d.minute = val('p-minute'); }
  if (document.getElementById('p-pct')) { const v = numVal('p-pct'); d.pct = Number.isNaN(v) ? 0 : v; }
}

// ---------- шаг 4: клиент ----------
function stepClient() {
  const c = d.client;
  const e = d.errors;
  return `<section class="plate">
    <div class="plate__head"><h2 class="plate__title">Клиент</h2>${status('bad', 'не сохранено')}</div>
    ${field({ id: 'k-name', label: 'Имя', value: c.name, placeholder: 'Александр Петров', error: e.name })}
    ${field({ id: 'k-phone', label: 'Телефон', value: c.phone, placeholder: '+7 (999) 123-45-67', type: 'tel', inputmode: 'tel', error: e.phone })}
    ${field({ id: 'k-street', label: 'Улица', value: c.street, placeholder: 'ул. Ленина', error: e.street })}
    <div class="grid-4">
      ${field({ id: 'k-house', label: 'Дом', value: c.house, error: e.house ? ' ' : '' })}
      ${field({ id: 'k-entrance', label: 'Подъезд', value: c.entrance, inputmode: 'numeric' })}
      ${field({ id: 'k-flat', label: 'Кв', value: c.flat, inputmode: 'numeric' })}
      ${field({ id: 'k-floor', label: 'Этаж', value: c.floor, inputmode: 'numeric' })}
    </div>
    ${e.house ? '<p class="field__error">Укажите номер дома</p>' : ''}
    <label class="field" for="k-comment"><span class="field__label">Комментарий</span><span class="field__box"><textarea id="k-comment" placeholder="Например, код домофона">${esc(c.comment)}</textarea></span></label>
    <div class="field"><span class="field__label">Откуда клиент</span>${seg('channel', [{ value: 'shop', label: 'Торговая точка' }, { value: 'card', label: 'Визитка (промокод)' }], d.channel)}</div>
  </section>
  ${btnRow([{ label: 'Назад', action: 'step-prev' }, { label: 'Дальше', action: 'step-next', primary: true }])}`;
}

function readClient() {
  d.client = {
    name: val('k-name'), phone: val('k-phone'), street: val('k-street'), house: val('k-house'),
    entrance: val('k-entrance'), flat: val('k-flat'), floor: val('k-floor'), comment: val('k-comment'),
  };
}

// ---------- шаг 5: проверка ----------
function stepReview() {
  const c = calc();
  const mat = d.scan.material;
  const p = S.user(d.partnerId);
  const price = S.priceFor(p, mat.type);
  const cost = prelimCost(c.mid, price);
  const dup = S.findDuplicate(d.client);
  return `<section class="plate">
    <h2 class="plate__title">Проверьте заказ</h2>
    <div class="well">
      ${kv('Обои', `${esc(mat.brand)} «${esc(mat.name)}»`)}
      ${kv('Рулонов', String(c.rolls))}
      ${kv('Площадь', d.mode === 'room' ? `${num(c.area)} м²` : `${num(c.min)}–${num(c.max)} м²`)}
      ${kv('Исполнитель', esc(p.name))}
      ${kv('Приезд', esc(dateTimeRu(`${d.date}T${d.hour}:${d.minute}`)))}
      ${kv('Цена поклейки', `${price} ₽/м²`)}
      ${kv('Предварительная стоимость', rub(cost), true)}
      ${kv('Комиссия', `${num(d.pct)}% · ${rub(commissionAmount(cost, d.pct))}`)}
    </div>
    <div class="well">
      ${kv('Клиент', esc(d.client.name))}
      ${kv('Телефон', esc(d.client.phone))}
      ${kv('Адрес', esc([d.client.street, d.client.house && 'д. ' + d.client.house, d.client.flat && 'кв. ' + d.client.flat].filter(Boolean).join(', ')))}
    </div>
    ${dup ? `<div class="well"><div class="plate__head"><b>Этот клиент уже передан</b>${status('warn', 'дубль')}</div>
      <p class="small">Тот же телефон и адрес есть в заказе № ${dup.no}. Комиссия достаётся тому, кто отправил заказ первым, поэтому по этому заказу комиссии не будет.</p></div>` : ''}
  </section>
  ${btnRow([{ label: 'Назад', action: 'step-prev' }, { label: 'Передать заказ', action: 'submit-order', primary: true }])}`;
}

export function renderNewOrder() {
  const body = [stepMaterial, stepCalc, stepPartner, stepClient, stepReview][d.step]();
  return `${topbar('Новая заявка', { right: `<span class="small">${d.step + 1} / ${STEPS.length}</span>` })}
    <section class="plate" style="gap:8px">${stepsBar()}<div class="plate__head"><b>${STEPS[d.step]}</b><button type="button" class="link-btn" data-action="draft-reset">Начать заново</button></div></section>
    ${body}`;
}

// ---------- действия ----------
const BARCODE_RE = /^(\d{8}|\d{12,14})$/;
function doScan(code) {
  d.barcode = code;
  d.errors = {};
  if (!BARCODE_RE.test(code)) { d.scan = { kind: 'bad', code }; rerender(); return; }
  const m = S.material(code);
  if (m) d.scan = { kind: 'found', code, material: m };
  else { d.scan = { kind: 'new', code }; d.newMat = { brand: '', name: '', type: '', width: '1.06', length: '10.05', rapport: '0' }; }
  rerender();
  requestAnimationFrame(() => {
    const el = document.getElementById('scan-result');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

actions['scan'] = () => {
  const code = val('barcode').replace(/\D/g, '');
  if (!code) { toast('Камера в прототипе не подключена — введите цифры или выберите пример'); return; }
  doScan(code);
};
actions['scan-demo'] = (el) => doScan(el.dataset.code);
actions['scan-reset'] = () => { d.scan = null; d.barcode = ''; d.newMat = null; rerender(); };

function readNewMat() {
  const n = d.newMat;
  n.brand = val('nm-brand');
  if (document.getElementById('nm-brand-other')) n.brandOther = val('nm-brand-other');
  n.name = val('nm-name'); n.type = val('nm-type'); n.width = val('nm-width'); n.length = val('nm-length'); n.rapport = val('nm-rapport');
}
actions['newmat-save'] = () => {
  readNewMat();
  const n = d.newMat;
  const brand = n.brand === 'Другой' ? (n.brandOther || '').trim() : n.brand;
  const width = parseFloat(String(n.width).replace(',', '.'));
  const length = parseFloat(String(n.length).replace(',', '.'));
  const rapport = parseFloat(String(n.rapport).replace(',', '.'));
  if (!brand) d.errors.newMat = 'Выберите бренд';
  else if (!n.type) d.errors.newMat = 'Выберите тип материала';
  else if (!(length > 0)) d.errors.newMat = 'Укажите длину рулона';
  else if (!(rapport >= 0) || rapport > 2) d.errors.newMat = 'Раппорт — от 0 до 2 м';
  else d.errors.newMat = '';
  if (d.errors.newMat) { rerender(); return; }
  const m = S.addMaterial({ barcode: d.scan.code, brand, name: n.name || 'без названия', type: n.type, width, length, rapport });
  d.scan = { kind: 'found', code: m.barcode, material: m };
  toast('Обои добавлены в базу материалов');
  rerender();
};

export function onSegAgent(name, value) {
  if (name === 'calc-mode') { readCalcInputs(); d.mode = value; rerender(); return true; }
  if (name === 'channel') { readClient(); d.channel = value; rerender(); return true; }
  return false;
}

export function onLive(el) {
  if (el.dataset.live === 'calc') {
    readCalcInputs();
    const box = document.getElementById('calc-result');
    if (box) {
      // Перерисовываем только результат, чтобы поле ввода не теряло фокус.
      const tmp = document.createElement('div');
      tmp.innerHTML = stepCalc();
      const fresh = tmp.querySelector('#calc-result');
      if (fresh) box.innerHTML = fresh.innerHTML;
    }
  }
  if (el.dataset.live === 'pct') {
    readPartnerInputs();
    const c = calc();
    const p = S.user(d.partnerId);
    const amount = document.getElementById('pct-amount');
    if (p && amount) amount.textContent = rub(commissionAmount(prelimCost(c.mid, S.priceFor(p, d.scan.material.type)), d.pct || 0));
  }
}

actions['wall-add'] = () => { readCalcInputs(); d.walls.push(3); rerender(); };
actions['wall-del'] = () => { readCalcInputs(); if (d.walls.length > 1) d.walls.pop(); rerender(); };
actions['opening-add'] = (el) => { readCalcInputs(); d.openings.push(el.dataset.kind === 'door' ? { kind: 'door', w: 0.8, h: 2.0 } : { kind: 'window', w: 1.2, h: 1.4 }); rerender(); };
actions['opening-del'] = (el) => { readCalcInputs(); d.openings.splice(Number(el.dataset.i), 1); rerender(); };

actions['pick-partner'] = (el) => {
  readPartnerInputs();
  d.partnerId = el.dataset.id;
  const first = S.freeDates(S.user(d.partnerId)).find((x) => !x.busy);
  d.date = first ? first.iso : '';
  d.errors = {};
  rerender();
};
actions['pick-date'] = (el) => { readPartnerInputs(); d.date = el.dataset.iso; rerender(); };

actions['step-prev'] = () => {
  if (d.step === 1) readCalcInputs();
  if (d.step === 2) readPartnerInputs();
  if (d.step === 3) readClient();
  d.errors = {};
  d.step = Math.max(0, d.step - 1);
  rerender(); window.scrollTo(0, 0);
};

actions['step-next'] = () => {
  d.errors = {};
  if (d.step === 0 && !(d.scan && d.scan.kind === 'found')) return;
  if (d.step === 1) { readCalcInputs(); const c = calc(); if (!c || !c.ok) { rerender(); return; } }
  if (d.step === 2) {
    readPartnerInputs();
    if (!d.partnerId) { d.errors.partner = 'Выберите исполнителя'; rerender(); return; }
    if (!d.date) { d.errors.partner = 'Выберите свободную дату'; rerender(); return; }
    if (!(d.pct >= 1 && d.pct <= 50)) { d.errors.pct = 'Процент — от 1 до 50'; rerender(); return; }
  }
  if (d.step === 3) {
    readClient();
    const c = d.client;
    if (c.name.length < 2) d.errors.name = 'Укажите имя клиента';
    if (c.phone.replace(/\D/g, '').length < 10) d.errors.phone = 'Нужен телефон: 10 цифр после +7';
    if (!c.street) d.errors.street = 'Укажите улицу';
    if (!c.house) d.errors.house = true;
    if (Object.keys(d.errors).length) { rerender(); return; }
  }
  d.step = Math.min(STEPS.length - 1, d.step + 1);
  rerender(); window.scrollTo(0, 0);
};

actions['draft-reset'] = () => { d = freshDraft(); rerender(); };

actions['submit-order'] = () => {
  const c = calc();
  const o = S.createAgentOrder({
    material: d.scan.material, mode: d.mode, rolls: c.rolls, height: d.height,
    walls: d.mode === 'room' ? d.walls.slice() : null, openings: d.mode === 'room' ? d.openings.slice() : null,
    areaMin: c.min, areaMax: c.max, areaMid: c.mid,
    partnerId: d.partnerId, arrival: `${d.date}T${d.hour}:${d.minute}`, pct: d.pct,
    channel: d.channel, client: { ...d.client, phone: d.client.phone.replace(/\D/g, '').slice(-10) },
  });
  const p = S.user(d.partnerId);
  d = freshDraft();
  sheet({
    title: `Заказ № ${o.no} передан`,
    body: `<p>${esc(p.name)} увидит его во входящих и примет или отклонит.${o.duplicateOf ? ' Это дубль: комиссии по нему не будет.' : ''}</p>`,
    buttons: [{ label: 'Новая заявка', action: 'sheet-close' }, { label: 'К заказу', action: 'open-agent-order', data: `data-id="${o.id}"`, primary: true }],
  });
  rerender();
};

actions['open-agent-order'] = (el) => { closeSheet(); go(`a-order-${el.dataset.id}`); };

// ---------- мои заявки ----------
export function renderAgentOrders() {
  const me = S.me();
  const list = S.get().orders.filter((o) => o.createdBy === me.id).slice().reverse();
  return `${topbar('Мои заявки')}
    <div class="list">${list.length ? list.map((o) => {
      const l = S.linksOf(o.id).filter((x) => x.fromId === me.id).slice(-1)[0];
      const est = l ? S.settlementsOfLink(l.id).find((s) => s.type === 'commission') : null;
      return `<button type="button" class="plate card-btn order-card" data-action="go" data-to="a-order-${o.id}">
        <div class="order-card__top"><span class="order-card__no">№ ${o.no} · ${esc(o.client.name)}</span>${orderStatus(o)}</div>
        ${kv('Исполнитель', l ? esc(S.user(l.toId).name) : '—')}
        ${kv('Приезд', l ? esc(dateTimeRu(l.arrival)) : '—')}
        ${kv('Комиссия', est && est.status !== 'cancelled' ? `${rub(est.amount)} · ${est.status === 'estimate' ? 'ориентировочно' : 'к выплате'}` : '—')}
      </button>`;
    }).join('') : `<section class="plate"><p class="empty">Заявок пока нет</p>${btnRow([{ label: 'Создать заявку', action: 'go', data: 'data-to="new"', primary: true }])}</section>`}</div>`;
}

actions['resend-open'] = (el) => {
  const o = S.order(el.dataset.id);
  const me = S.me();
  const tried = S.linksOf(o.id).map((l) => l.toId);
  const options = S.partnersOf(me.id).map((p) => ({ value: p.id, label: p.name + (tried.includes(p.id) ? ' (уже передавали)' : '') }));
  const first = options.find((x) => !tried.includes(x.value)) || options[0];
  if (!first) { toast('Нет партнёров для передачи'); return; }
  const dates = S.freeDates(S.user(first.value)).filter((x) => !x.busy);
  sheet({
    title: `Передать заказ № ${o.no}`,
    body: `${select({ id: 'rs-partner', label: 'Исполнитель', value: first.value, options })}
      ${select({ id: 'rs-date', label: 'Дата', value: dates[0] ? dates[0].iso : '', options: dates.map((x) => ({ value: x.iso, label: dateRu(x.iso) })) })}
      <div class="grid-2">${field({ id: 'rs-time', label: 'Время', value: '10:00', placeholder: '10:00' })}${field({ id: 'rs-pct', label: 'Процент', value: '5', inputmode: 'decimal', suffix: '%' })}</div>
      <p class="small">Свободные даты показаны для первого исполнителя в списке. Если выберете другого, проверьте его даты в новой заявке.</p>`,
    buttons: [{ label: 'Отмена', action: 'sheet-close' }, { label: 'Передать', action: 'resend-do', data: `data-id="${o.id}"`, primary: true }],
  });
};
actions['resend-do'] = (el) => {
  const pct = parseFloat(val('rs-pct').replace(',', '.'));
  const time = /^\d{2}:\d{2}$/.test(val('rs-time')) ? val('rs-time') : '10:00';
  if (!(pct >= 1 && pct <= 50)) { toast('Процент — от 1 до 50'); return; }
  if (!val('rs-date')) { toast('Нет свободной даты'); return; }
  S.resendOrder(el.dataset.id, val('rs-partner'), `${val('rs-date')}T${time}`, pct);
  closeSheet();
  toast('Заказ передан');
  rerender();
};
