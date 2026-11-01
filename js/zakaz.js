// «Текущий заказ» мастера: остальные разделы секции «Выезды» в Figma —
// 01 Клиент, 04 Материал, 05 Смета, Чат, 07 Задачи, 08 Финансы, 09 История заказа.
// Данные общие с «Оформить заказ»: комнаты и услуги — из «Оценки», даты — из «Графика».

import { actions, changes, rerender } from './core.js?v=45';
import * as S from './store.js?v=45';
import { WALLPAPER_TYPES } from './seed.js?v=45';
import { esc, toast } from './ui.js?v=45';
import { fcls, ferr, liveMark, showErrors, phoneDigits, phoneFormat } from './fld.js?v=45';
import { registerSection, selectField, pickers, toggles, logEvent, oformitDraft } from './oformit.js?v=45';
import { country } from './phonecodes.js?v=45';
import { suggestAddress } from './address.js?v=45';
import { suggesters } from './kbd.js?v=45';
import { estimateRooms, roomTotals, svcInfo, SVC_LIST } from './ocenka.js?v=45';

const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
const fmt2 = (n) => (Math.round(n * 100) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,(?=\d{3})/g, ' ');
const numTxt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const n2 = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
const parse = (v) => { const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
const D = () => oformitDraft();
const save = () => { S.save(); rerender(); };
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const dateWords = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS_GEN[Number(iso.slice(5, 7)) - 1]}`;
const todayISO = () => S.todayISO();

// Срок по смете с минутами: «1 смена 2 ч 50 мин».
function hm(qty, norm) {
  if (!qty || !norm) return '';
  let m = Math.round((qty / norm) * 60);
  const sh = Math.floor(m / 480); m -= sh * 480;
  const h = Math.floor(m / 60); m -= h * 60;
  const sw = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'смена' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'смены' : 'смен');
  return [sh ? `${sh} ${sw(sh)}` : '', h ? `${h} ч` : '', m ? `${m} мин` : ''].filter(Boolean).join(' ') || '0 мин';
}
const status = (kind, text, cls = '') => `<span class="f-status f-status--${kind}${cls ? ' ' + cls : ''}"><i></i>${esc(text)}</span>`;
const btn = (label, action, { cls = '', data = '', disabled = false } = {}) => `<button type="button" class="f-btn${cls ? ' ' + cls : ''}" data-action="${action}" ${data} ${disabled ? 'disabled' : ''}>${label}</button>`;
const row = (...b) => `<div class="f-btn-row">${b.join('')}</div>`;
const input = (id, label, value, { ph = '', live = '', mode = '', ro = false, type = 'text', changed = false, err = '' } = {}) => `<label class="f-field" for="${id}"><span class="f-field__label">${esc(label)}</span>
  <span class="f-input${fcls(changed, err)}"><input id="${id}" type="${type}" ${mode ? `inputmode="${mode}"` : ''} placeholder="${esc(ph)}" value="${esc(value)}" ${ro ? 'readonly' : ''} ${live ? `data-live="${live}"` : ''}/></span>${ferr(err)}</label>`;
const area = (id, label, value, { ph = '', live = '', ro = false, changed = false, err = '' } = {}) => `<label class="f-field" for="${id}">${label ? `<span class="f-field__label">${esc(label)}</span>` : ''}
  <span class="f-input z-area${fcls(changed, err)}"><textarea id="${id}" placeholder="${esc(ph)}" ${ro ? 'readonly' : ''} ${live ? `data-live="${live}"` : ''}>${esc(value)}</textarea></span>${ferr(err)}</label>`;
const seg = (key, items, cur) => `<div class="z-seg" role="tablist">${items.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === cur}" class="f-btn${k === cur ? ' f-btn--lit' : ''}" data-action="z-seg" data-key="${key}" data-v="${k}">${t}</button>`).join('')}</div>`;
const dock = (html) => `<div class="z-dock">${html}</div>`;
const dialog = (title, text, buttons) => `<div class="o-overlay"></div><div class="f-plate o-dialog" role="alertdialog"><p class="o-dialog__t">${esc(title)}</p>${text ? `<p class="o-dialog__x">${text}</p>` : ''}${buttons}</div>`;
const segState = Object.create(null);
actions['z-seg'] = (el) => { segState[el.dataset.key] = el.dataset.v; D().ui = { ...(D().ui || {}), form: '' }; save(); };

// ---------- карусель комнат (как в «Оценке») ----------
function carousel(items, cur, ear, action) {
  const i = Math.max(0, items.findIndex((x) => x.key === cur));
  const it = items[i]; const prev = items[i - 1]; const next = items[i + 1];
  return `<div class="o-head${ear ? ' o-head--tabs' : ''}">
    ${items[i - 2] ? '<span class="o-back o-back--deep o-back--l" aria-hidden="true"></span>' : ''}
    ${items[i + 2] ? '<span class="o-back o-back--deep o-back--r" aria-hidden="true"></span>' : ''}
    ${prev ? `<button type="button" class="o-back o-back--l" data-action="${action}" data-key="${prev.key}"><span>${prev.label}</span></button>` : ''}
    ${next ? `<button type="button" class="o-back o-back--r" data-action="${action}" data-key="${next.key}"><span>${next.label}</span></button>` : ''}
    ${ear || ''}
    <div class="o-cur"><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</div></div>`;
}
const roomItems = (rooms) => rooms.map((r) => ({ key: r.key, title: r.name, sub: `${r.floor} этаж`, label: esc(r.name) }));
const noRooms = (what) => `<section class="f-plate"><p class="z-muted">${what}: сначала добавьте комнаты во вкладке «Оценка».</p></section>`;

// ======================= 01 · Клиент =======================
function cl(d) { if (!d.cl) d.cl = { name: '', phone: '', street: '', house: '', entrance: '', flat: '', floor: '', hour: '', min: '', comment: '', saved: false, editing: true, dirty: false }; return d.cl; }
const HOURS = Array.from({ length: 15 }, (_, i) => String(7 + i).padStart(2, '0'));
const MINS = ['00', '15', '30', '45'];
const CL_FIELDS = ['name', 'phone', 'street', 'house', 'entrance', 'flat', 'floor', 'hour', 'min', 'comment'];
const clSnap = (c) => c.snap || {};
const clCh = (c, k) => c.editing && String(c[k] || '') !== String(clSnap(c)[k] || '');
// Телефон: «+7» стоит в поле всегда (код страны из настроек), набираются 10 цифр.
// После трёх цифр справа в поле видно оператора; несуществующий код подсвечивается красным.
const myCountry = () => country((S.me() && S.me().settings && S.me().settings.country) || 'RU');
const localFmt = (d) => (!d ? '' : `(${d.slice(0, 3)}${d.length >= 3 ? ')' : ''}${d.length > 3 ? ' ' + d.slice(3, 6) : ''}${d.length > 6 ? '-' + d.slice(6, 8) : ''}${d.length > 8 ? '-' + d.slice(8, 10) : ''}`);
function codeInfo(dd) {
  if (dd.length < 3) return { text: '', bad: false };
  const code = dd.slice(0, 3);
  const hit = myCountry().codes.find(([k]) => k === code);
  if (hit) return { text: hit[1] === 'разные операторы' ? 'мобильный' : hit[1], bad: false };
  if ('348'.includes(code[0])) return { text: 'городской', bad: false };
  if (code[0] === '7') return { text: 'Казахстан', bad: false };
  return { text: 'нет такого кода', bad: true };
}
function phoneField(c, ro, e) {
  const dd = phoneDigits(c.phone);
  const inf = codeInfo(dd);
  const err = e.phone || (inf.bad ? ' ' : '');
  return `<div class="f-field"><span class="f-field__label">Телефон</span>
    <span class="f-input z-phone${fcls(clCh(c, 'phone'), err)}"><b class="z-cc">+${myCountry().cc}</b><input id="z-cl-phone" type="tel" inputmode="tel" placeholder="(___) ___-__-__" value="${esc(localFmt(dd))}" ${ro ? 'readonly' : ''} data-live="z-cl:phone10"/><span class="z-op${inf.bad ? ' is-bad' : ''}" id="z-cl-op">${esc(inf.text)}</span></span>${ferr(e.phone)}</div>`;
}
function renderClient(d) {
  const c = cl(d);
  const ro = !c.editing;
  const e = c.err || {};
  const edit = c.dirty || (c.saved && c.editing);
  const st = edit ? status('warn', 'редактирование') : c.saved ? status('ok', 'сохранено') : '';
  const o = (k, extra = {}) => ({ live: `z-cl:${k}`, ro, changed: clCh(c, k), err: e[k], ...extra });
  return `<i class="f-one" hidden></i><section class="f-plate z-client f-fill" aria-label="Клиент"><p class="z-title">Клиент</p>${st}
    ${input('z-cl-name', 'Имя', c.name, o('name', { ph: 'Имя клиента' }))}
    ${phoneField(c, ro, e)}
    ${input('z-cl-street', 'Адрес', c.street, o('street', { ph: 'Улица, можно сразу с домом' })).replace('<input ', '<input data-suggest="addr" ')}
    <div class="z-grid4">${input('z-cl-house', 'Дом', c.house, o('house', { mode: 'numeric' }))}${input('z-cl-entrance', 'Подъезд', c.entrance, o('entrance', { mode: 'numeric' }))}${input('z-cl-flat', 'Кв', c.flat, o('flat', { mode: 'numeric' }))}${input('z-cl-floor', 'Этаж', c.floor, o('floor', { mode: 'numeric' }))}</div>
    <div class="f-field"><span class="f-field__label">Время приезда</span>
      <div class="z-time">${selectField('cl-h', 'Часы', c.hour || '—', HOURS.map((h) => ({ value: h, label: h })), ro, { changed: clCh(c, 'hour') })}<b>:</b>${selectField('cl-m', 'Минуты', c.min || '—', MINS.map((m) => ({ value: m, label: m })), ro, { changed: clCh(c, 'min') })}</div></div>
    ${area('z-cl-comment', 'Комментарий', c.comment, o('comment'))}
    ${row(btn(ro ? 'Сохранено' : 'Сохранить', 'z-cl-save', { cls: ro ? 'f-btn--saved' : '' }), btn(edit ? 'Редактирование' : 'Редактировать', 'z-cl-edit', { cls: edit ? 'f-btn--editing' : '' }))}
  </section>`;
}
pickers['cl-h'] = (v, d) => { const c = cl(d); c.hour = v; c.dirty = true; };
pickers['cl-m'] = (v, d) => { const c = cl(d); c.min = v; c.dirty = true; };
toggles['cl-h'] = toggles['cl-m'] = (d) => { cl(d).dirty = true; };
actions['z-cl-save'] = () => {
  const d = D(); const c = cl(d);
  if (!c.editing) return;
  if (c.phone) c.phone = phoneFormat(c.phone);
  const e = {};
  if (c.name.trim().length < 2) e.name = 'Введите имя';
  const dd = phoneDigits(c.phone);
  if (dd.length < 10) e.phone = dd ? 'Не хватает цифр: нужно 10 после +7' : 'Введите телефон';
  else if (codeInfo(dd).bad) e.phone = `Кода ${dd.slice(0, 3)} нет — проверьте номер`;
  if (!c.street.trim()) e.street = 'Введите адрес';
  if (!c.house.trim()) e.house = 'Дом';
  c.err = e;
  if (Object.keys(e).length) { save(); showErrors(); return; }
  c.snap = Object.fromEntries(CL_FIELDS.map((k) => [k, c[k]]));
  c.saved = true; c.editing = false; c.dirty = false;
  logEvent(d, 'Сохранены данные клиента', 'Контакты и адрес заказа');
  save();
};
actions['z-cl-edit'] = () => { const c = cl(D()); if (!c.saved) return; c.editing = true; save(); };

// ======================= 04 · Материал =======================
const SCAN_ICON = '<span class="z-scan-ico" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></span>';
const MAT_TYPES = WALLPAPER_TYPES.map((t) => t.name);
function mat(d) { if (!d.mat) d.mat = { view: '', rooms: {}, scans: 0 }; return d.mat; }
function matRoom(m, key) { if (!m.rooms[key]) m.rooms[key] = { items: [], panel: '', tab: 'added', res: null, note: '' }; return m.rooms[key]; }
const typeLabel = (x) => (x ? `${(WALLPAPER_TYPES.find((t) => t.id === x.type) || { name: x.type }).name.replace('Флизелиновые', 'Обои флиз.').replace('Виниловые на флизелине', 'Обои винил.').replace('Бумажные', 'Обои бумаж.')} ${Math.round(x.width * 100)} см` : '');
const MAT_SAMPLE = '<span class="z-roll" aria-hidden="true"></span>';

function scanResult(r) {
  const x = r.res;
  const stat = (ok, okText, badText) => status(ok ? 'ok' : 'bad', ok ? okText : badText, 'z-st');
  const sel = (k, label, value, options) => selectField(k, label, value, options.map((o) => ({ value: o, label: o })), false);
  const brands = [...new Set(S.get().materials.map((m) => m.brand))];
  if (x.kind === 'found') {
    return `<div class="z-mfield"><p class="z-mhead">Штрихкод <button type="button" class="z-q" data-action="z-howto" aria-label="Как ввести штрихкод">?</button></p>${stat(true, 'считан')}<span class="f-input"><span class="f-input__value">${esc(x.code)}</span></span></div>
      <div class="z-mfield"><p class="z-mhead">Бренд</p>${stat(true, 'распознан')}<span class="f-input"><span class="f-input__value">${esc(x.brand)}</span></span></div>
      <div class="z-mfield"><p class="z-mhead">Тип материала</p>${stat(true, 'определен')}<span class="f-input"><span class="f-input__value">${esc(x.type)}</span></span></div>
      ${row(btn('Добавить в комнату', 'z-mat-add'))}`;
  }
  if (x.kind === 'new') {
    return `<div class="z-mfield"><p class="z-mhead">Штрихкод <button type="button" class="z-q" data-action="z-howto" aria-label="Как ввести штрихкод">?</button></p>${stat(true, 'считан')}<span class="f-input"><span class="f-input__value">${esc(x.code)}</span></span></div>
      <div class="z-mfield z-mfield--sel"><p class="z-mhead">Бренд</p>${stat(true, 'выбран')}${sel('m-brand', '', x.brand, brands)}</div>
      <div class="z-mfield z-mfield--sel"><p class="z-mhead">Тип материала</p>${stat(true, 'выбран')}${sel('m-type', '', x.type, MAT_TYPES.map((t) => typeLabel({ type: WALLPAPER_TYPES.find((w) => w.name === t).id, width: 1.06 })))}</div>
      ${row(btn('Добавить в комнату', 'z-mat-add'))}`;
  }
  return `<div class="z-mfield"><p class="z-mhead">Штрихкод <button type="button" class="z-q" data-action="z-howto" aria-label="Как ввести штрихкод">?</button></p>${stat(!!x.code, 'введён', 'не считан')}<span class="f-input"><input id="z-m-code" inputmode="numeric" placeholder="Введите штрихкод вручную" value="${esc(x.code || '')}" data-live="z-m:code"/></span></div>
    <div class="z-mfield"><p class="z-mhead">Бренд</p>${stat(!!x.brand, 'введён', 'не распознан')}<span class="f-input"><input id="z-m-brand" placeholder="Введите бренд вручную" value="${esc(x.brand || '')}" data-live="z-m:brand"/></span></div>
    <div class="z-mfield"><p class="z-mhead">Тип материала</p>${stat(!!x.type, 'введён', 'не определен')}<span class="f-input"><input id="z-m-type" placeholder="Введите тип вручную" value="${esc(x.type || '')}" data-live="z-m:type"/></span></div>
    ${row(btn('Повторить', 'z-scan-do'), btn('Закрыть', 'z-scan-close'))}
    ${row(btn('Добавить в комнату', 'z-mat-add', { disabled: !(x.code && x.brand && x.type) }))}`;
}

function renderMaterial(d) {
  const rooms = estimateRooms(d);
  if (!rooms.length) return noRooms('Материал');
  const m = mat(d);
  if (!rooms.some((r) => r.key === m.view)) m.view = rooms[0].key;
  const room = rooms.find((r) => r.key === m.view);
  const r = matRoom(m, room.key);
  const ear = `<button type="button" class="o-ear o-ear--plus is-solo" data-action="z-scan-open" aria-label="Сканировать штрихкод">${SCAN_ICON}</button>`;
  let body = '';
  if (r.panel === 'scan') {
    body = `<section class="f-plate z-scan"><p class="z-title">Сканирование</p><p class="z-muted">Наведите камеру на штрихкод материала</p>
      <div class="z-scan__frame"><i class="z-scan__c"></i><i class="z-scan__c"></i><i class="z-scan__c"></i><i class="z-scan__c"></i><span class="z-scan__bars"></span><i class="z-scan__line"></i></div>
      ${row(btn('Закрыть', 'z-scan-close'), btn('Сканировать', 'z-scan-do'))}</section>`;
  } else if (r.panel === 'result') {
    body = `<section class="f-plate z-mres">${scanResult(r)}</section>`;
  } else if (r.items.length) {
    const tab = r.tab;
    body = `${seg('mat-' + room.key, [['added', 'Добавленные'], ['mine', 'Мой опыт']], segState['mat-' + room.key] || 'added')}
      <section class="f-plate z-mlist">${r.items.map((it, idx) => {
        const reviews = S.reviewsOf(it.code).filter((x) => x.authorId !== S.me().id);
        const mineTab = (segState['mat-' + room.key] || 'added') === 'mine';
        const rv = reviews[(it.rv || 0) % Math.max(1, reviews.length)];
        return `<div class="o-card z-mcard">${MAT_SAMPLE}<div class="z-mcard__t"><b>${esc(it.type)}</b><small>Бренд <span>${esc(it.brand)}</span></small></div>
            <button type="button" class="f-icon-btn" data-action="z-mat-del" data-i="${idx}" aria-label="Удалить материал"><svg viewBox="0 0 16 16" fill="none"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="#EDF0E7" stroke-width="1.4" stroke-linejoin="round"/></svg></button></div>
          ${mineTab ? `<div class="o-card z-exp"><p class="z-sub">Мой опыт работы с материалом</p>
              <button type="button" class="z-photo" data-action="z-photo" aria-label="Добавить фото">+</button>
              ${area('z-m-note-' + idx, '', it.note || '', { ph: 'Напишите комментарий о материале', live: `z-mnote:${idx}` })}</div>
              ${row(btn('Поделиться опытом', 'z-mat-share', { data: `data-i="${idx}"` }))}`
            : `<div class="o-card z-exp"><p class="z-sub">Опыт работы мастера с материалом</p>
              ${rv ? `<div class="z-exp__who"><span class="z-ava">${esc(S.user(rv.authorId).name[0])}</span><b>${esc(S.user(rv.authorId).name.split(' ')[0])}</b>
                ${reviews.length > 1 ? `<span class="z-exp__nav"><button type="button" class="f-icon-btn g-prev" data-action="z-rv" data-i="${idx}" data-d="-1" aria-label="Предыдущий отзыв"><svg viewBox="0 0 16 16" fill="none"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round"/></svg></button><button type="button" class="f-icon-btn g-next" data-action="z-rv" data-i="${idx}" data-d="1" aria-label="Следующий отзыв"><svg viewBox="0 0 16 16" fill="none"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round"/></svg></button></span>` : ''}</div>
                ${MAT_SAMPLE}<span class="f-input z-area"><span class="z-exp__text">${esc(rv.text)}</span></span>`
                : '<p class="z-muted">Мастера пока не делились опытом с этим материалом.</p>'}</div>`}`;
      }).join('')}</section>`;
    void tab;
  }
  const dlg = r.added ? dialog('Материал добавлен', `${esc(r.added.type)}<br>Бренд: ${esc(r.added.brand)}<br>добавлены в комнату «${esc(room.name)}».`, row(btn('OK', 'z-mat-ok')))
    : m.howto ? dialog('Как ввести штрихкод', 'Штрихкод — 8 или 13 цифр под полосками на этикетке рулона (EAN-13, EAN-8, UPC-A, ITF-14). Если камера не считала код, введите цифры вручную — бренд и тип материала можно выбрать или вписать.', row(btn('Понятно', 'z-howto-close')))
      : '';
  return `${carousel(roomItems(rooms), m.view, ear, 'z-mat-view')}${body}${dlg}`;
}
actions['z-mat-view'] = (el) => { mat(D()).view = el.dataset.key; save(); };
actions['z-scan-open'] = () => { const m = mat(D()); const r = matRoom(m, m.view); r.panel = r.panel === 'scan' ? '' : 'scan'; save(); };
actions['z-scan-close'] = () => { const m = mat(D()); matRoom(m, m.view).panel = ''; save(); };
// Один сканер — три результата (кадр «02»): найден в базе → новый штрихкод → не считан, по кругу.
actions['z-scan-do'] = () => {
  const m = mat(D()); const r = matRoom(m, m.view);
  const k = m.scans % 3; m.scans += 1;
  if (k === 0) { const x = S.material('4601234567890'); r.res = { kind: 'found', code: x.barcode, brand: x.brand, type: typeLabel(x), mtype: x.type }; }
  else if (k === 1) r.res = { kind: 'new', code: '4609876543210', brand: 'Erismann', type: 'Обои флиз. 106 см' };
  else r.res = { kind: 'manual', code: '', brand: '', type: '' };
  r.panel = 'result'; save();
};
pickers['m-brand'] = (v, d) => { const m = mat(d); matRoom(m, m.view).res.brand = v; };
pickers['m-type'] = (v, d) => { const m = mat(d); matRoom(m, m.view).res.type = v; };
actions['z-mat-add'] = () => {
  const d = D(); const m = mat(d); const r = matRoom(m, m.view);
  const x = r.res; if (!x || !(x.code && x.brand && x.type)) return;
  r.items.push({ code: x.code, brand: x.brand, type: x.type, note: '', rv: 0 });
  r.added = { brand: x.brand, type: x.type }; r.panel = ''; r.res = null;
  const room = estimateRooms(d).find((z) => z.key === m.view);
  logEvent(d, 'Добавлен материал', `${room ? room.name : ''}: ${x.type}, ${x.brand}`);
  save();
};
actions['z-mat-ok'] = () => { const m = mat(D()); matRoom(m, m.view).added = null; save(); };
actions['z-mat-del'] = (el) => { const m = mat(D()); matRoom(m, m.view).items.splice(Number(el.dataset.i), 1); save(); };
actions['z-rv'] = (el) => { const m = mat(D()); const it = matRoom(m, m.view).items[Number(el.dataset.i)]; it.rv = (it.rv || 0) + Number(el.dataset.d) + 100; save(); };
actions['z-photo'] = () => toast('Фото материала снимается встроенной камерой — в прототипе недоступно');
actions['z-mat-share'] = (el) => {
  const d = D(); const m = mat(d); const it = matRoom(m, m.view).items[Number(el.dataset.i)];
  if ((it.note || '').trim().length < 3) { toast('Напишите хотя бы пару слов'); return; }
  S.addReview(it.code, it.note.trim()); logEvent(d, 'Опыт с материалом', `${it.type}: ${it.note.trim()}`);
  it.note = ''; toast('Спасибо — опыт увидят другие мастера'); save();
};
actions['z-howto'] = () => { mat(D()).howto = true; save(); };
actions['z-howto-close'] = () => { mat(D()).howto = false; save(); };

// ======================= 05 · Смета =======================
const OPEN_TYPES = ['Окно', 'Дверь', 'Проём', 'Ниша'];
function sm(d) { if (!d.sm) d.sm = { view: '', rooms: {} }; return d.sm; }
function smRoom(s, key) { if (!s.rooms[key]) s.rooms[key] = { sameH: true, h: 2.7, sameSvc: false, walls: [], dlg: null }; return s.rooms[key]; }
const wallArea = (w, R) => Math.max(0, Math.round(((w.len || 0) * (R.sameH ? R.h : w.h || 0) - w.opens.reduce((a, o) => a + o.area, 0)) * 100) / 100);
function wallLines(w, R) { const a = wallArea(w, R); return w.svcs.map((id) => { const s = svcInfo(id); return { ...s, qty: a, sum: Math.round(a * s.price), time: hm(a, s.norm) }; }); }
export function smetaTotals(d) {
  const s = sm(d);
  const rooms = estimateRooms(d).map((r) => {
    const R = smRoom(s, r.key); const by = new Map();
    R.walls.forEach((w) => wallLines(w, R).forEach((l) => { const x = by.get(l.id) || { ...l, qty: 0, sum: 0 }; x.qty += l.qty; x.sum += l.sum; by.set(l.id, x); }));
    const lines = [...by.values()].map((l) => ({ ...l, time: hm(l.qty, l.norm) }));
    return { room: r, lines, total: lines.reduce((a, l) => a + l.sum, 0) };
  });
  const by = new Map();
  rooms.forEach((x) => x.lines.forEach((l) => { const y = by.get(l.id) || { ...l, qty: 0, sum: 0 }; y.qty += l.qty; y.sum += l.sum; by.set(l.id, y); }));
  const lines = [...by.values()].map((l) => ({ ...l, time: hm(l.qty, l.norm) }));
  const minutes = lines.reduce((a, l) => a + (l.qty / l.norm) * 60, 0);
  return { rooms, lines, total: lines.reduce((a, l) => a + l.sum, 0), minutes };
}
const lineCard = (l) => `<div class="o-card"><div class="o-card__head"><span>${esc(l.name)}</span><small>${l.time}</small></div>
  <div class="o-card__row"><span class="o-qty is-locked z-qty"><span>${n2(l.qty)}</span><span>м²</span></span><span class="o-x">×</span><span class="o-price">${fmt(l.price)} ₽/м²</span><b class="o-sum">= ${fmt(l.sum)} ₽</b></div></div>`;

function renderSmeta(d) {
  const rooms = estimateRooms(d);
  if (!rooms.length) return noRooms('Смета');
  const s = sm(d);
  const items = [...roomItems(rooms), { key: 'total', title: 'Смета заказа', sub: `${rooms.length} ${rooms.length === 1 ? 'комната' : rooms.length < 5 ? 'комнаты' : 'комнат'}`, label: 'Смета<br>заказа' }];
  if (!items.some((x) => x.key === s.view)) s.view = rooms[0].key;
  if (s.view === 'total') {
    const t = smetaTotals(d);
    const mins = Math.round(t.minutes);
    return `${carousel(items, 'total', '', 'z-sm-view')}
      ${t.rooms.map((x) => `<section class="f-plate o-room o-room--sum"><div class="o-room__head"><span>${esc(x.room.name)} · ${x.room.floor} этаж</span><span>${fmt(x.total)} ₽</span></div>${x.lines.map(lineCard).join('') || '<p class="z-muted">Стен со услугами пока нет</p>'}</section>`).join('')}
      <section class="f-plate o-room o-room--sum"><div class="o-room__head"><span>Итого по видам работ</span></div>${t.lines.map(lineCard).join('')}
        <div class="o-card o-total"><div class="o-card__head"><span>Общий итог</span></div><div class="o-tiles"><div class="o-tile"><small>Стоимость</small><b>${fmt(t.total)} ₽</b></div><div class="o-tile"><small>Срок</small><b>${hm(mins, 60)}</b></div></div></div></section>
      ${row(btn('Скачать PDF', 'o-pdf'))}`;
  }
  const room = rooms.find((r) => r.key === s.view);
  const R = smRoom(s, room.key);
  const tog = (on, action, label, value, inputHtml) => `<div class="z-set"><span class="z-set__l">${label}</span><span class="z-set__r"><button type="button" class="z-tog-btn" role="switch" aria-checked="${on}" data-action="${action}" aria-label="${label}"><span class="o-tog${on ? ' is-on' : ''}"><i></i></span></button>${inputHtml || `<span class="f-input z-mini${on ? '' : ' is-off'}"><span class="f-input__value">${value}</span></span>`}</span></div>`;
  const walls = R.walls.map((w, i) => {
    const a = wallArea(w, R);
    const lines = wallLines(w, R);
    return `<section class="f-plate z-wall"><p class="z-title">Стена ${i + 1}</p>
      <button type="button" class="z-x" data-action="z-wall-del" data-i="${i}" aria-label="Удалить стену ${i + 1}">×</button>
      <div class="o-card z-dims">
        <div class="z-dims__row">
          <label class="f-field"><span class="f-field__label">Длина L, м</span><span class="f-input"><input inputmode="decimal" value="${w.len ? n2(w.len) : ''}" placeholder="0,00" data-change="z-wall:len" data-i="${i}"/></span></label>
          <label class="f-field"><span class="f-field__label">Высота H, м</span><span class="f-input"><input inputmode="decimal" value="${n2(R.sameH ? R.h : w.h || 0)}" ${R.sameH ? 'readonly' : ''} data-change="z-wall:h" data-i="${i}"/></span></label>
          <div class="f-field"><span class="f-field__label">Площадь S, м² · расчёт</span><span class="f-input z-calcd"><span class="f-input__value">${n2(a)}</span></span></div>
        </div>
        ${w.opens.length ? `<div class="z-chips">${w.opens.map((o, k) => `<span class="z-chip">${esc(o.type)} · ${numTxt(o.area)} м² <button type="button" data-action="z-open-del" data-i="${i}" data-k="${k}" aria-label="Убрать">×</button></span>`).join('')}</div>` : ''}
      </div>
      ${row(btn('Окна и проёмы', 'z-open-add', { data: `data-i="${i}"` }), btn('Добавить услуги', 'z-wsvc-open', { data: `data-i="${i}"` }))}
      ${w.pick ? `<div class="o-list o-list--svc z-wsvc">${SVC_LIST.map((x) => { const on = w.pick.includes(x.id); const s0 = svcInfo(x.id); return `<button type="button" class="o-row o-row--svc" role="switch" aria-checked="${on}" data-action="z-wsvc-toggle" data-i="${i}" data-id="${x.id}"><span class="o-row__text"><span>${esc(s0.name)}</span><small>от ${fmt(s0.price)} ₽/м²</small></span><span class="o-tog${on ? ' is-on' : ''}"><i></i></span></button>`; }).join('')}</div>
        ${row(btn('Готово', 'z-wsvc-done', { data: `data-i="${i}"` }))}` : ''}
      ${lines.map(lineCard).join('')}
    </section>`;
  }).join('');
  const dlg = R.dlg ? `<div class="o-overlay"></div><div class="f-plate o-dialog z-odlg" role="dialog"><p class="o-dialog__t">Окна и проёмы</p>
      <div class="o-card">${selectField('z-otype', 'Тип', R.dlg.type, OPEN_TYPES.map((x) => ({ value: x, label: x })), false)}
      ${input('z-oarea', 'Площадь, м²', R.dlg.area, { mode: 'decimal', live: 'z-oarea' })}</div>
      ${row(btn('Назад', 'z-open-cancel'), btn('Добавить', 'z-open-save'))}</div>` : '';
  return `${carousel(items, s.view, '', 'z-sm-view')}
    <section class="o-card z-sets">${tog(R.sameH, 'z-sameh', 'Одинаковая высота', '', `<span class="f-input z-mini${R.sameH ? '' : ' is-off'}"><input inputmode="decimal" value="${R.sameH ? n2(R.h) + ' м' : '—'}" ${R.sameH ? '' : 'readonly'} data-change="z-roomh" aria-label="Высота стен"/></span>`)}
      <i class="z-sets__div"></i>${tog(R.sameSvc, 'z-samesvc', 'Одинаковые услуги', R.sameSvc && R.walls[0] ? `${R.walls[0].svcs.length} усл.` : '—')}</section>
    ${walls}
    ${row(btn('+ Добавить стену', 'z-wall-add'))}${dlg}`;
}
const SR = () => { const s = sm(D()); return smRoom(s, s.view); };
actions['z-sm-view'] = (el) => { sm(D()).view = el.dataset.key; save(); window.scrollTo(0, 0); };
actions['z-sameh'] = () => { const R = SR(); R.sameH = !R.sameH; if (!R.sameH) R.walls.forEach((w) => { w.h = w.h || R.h; }); save(); };
actions['z-samesvc'] = () => { const R = SR(); R.sameSvc = !R.sameSvc; save(); };
changes['z-roomh'] = (el) => { const v = parse(el.value); if (v > 0) SR().h = v; S.save(); };
actions['z-wall-add'] = () => {
  const d = D(); const s = sm(d); const R = smRoom(s, s.view);
  const prev = R.walls[R.walls.length - 1];
  const room = estimateRooms(d).find((r) => r.key === s.view);
  // Первая стена — услуги комнаты из «Оценки»; дальше — как у прошлой, если включено «Одинаковые услуги».
  const svcs = R.sameSvc && prev ? prev.svcs.slice() : !prev && room ? room.svcs.map((x) => x.id) : [];
  R.walls.push({ len: 0, h: R.h, opens: [], svcs });
  save();
};
actions['z-wall-del'] = (el) => { SR().walls.splice(Number(el.dataset.i), 1); save(); };
changes['z-wall:len'] = (el) => { SR().walls[Number(el.dataset.i)].len = parse(el.value); S.save(); };
changes['z-wall:h'] = (el) => { SR().walls[Number(el.dataset.i)].h = parse(el.value); S.save(); };
actions['z-open-add'] = (el) => { SR().dlg = { wall: Number(el.dataset.i), type: 'Окно', area: '' }; save(); };
pickers['z-otype'] = (v) => { SR().dlg.type = v; };
actions['z-open-cancel'] = () => { SR().dlg = null; save(); };
actions['z-open-save'] = () => {
  const R = SR(); const a = parse(R.dlg.area);
  if (!(a > 0)) { toast('Введите площадь проёма'); return; }
  R.walls[R.dlg.wall].opens.push({ type: R.dlg.type, area: a }); R.dlg = null; save();
};
actions['z-open-del'] = (el) => { SR().walls[Number(el.dataset.i)].opens.splice(Number(el.dataset.k), 1); save(); };
actions['z-wsvc-open'] = (el) => { const w = SR().walls[Number(el.dataset.i)]; w.pick = w.pick ? null : w.svcs.slice(); save(); };
actions['z-wsvc-toggle'] = (el) => { const w = SR().walls[Number(el.dataset.i)]; const id = el.dataset.id; w.pick = w.pick.includes(id) ? w.pick.filter((x) => x !== id) : [...w.pick, id]; save(); };
actions['z-wsvc-done'] = (el) => {
  const d = D(); const R = SR(); const w = R.walls[Number(el.dataset.i)];
  w.svcs = SVC_LIST.map((x) => x.id).filter((id) => w.pick.includes(id)); w.pick = null;
  logEvent(d, 'Обновлена смета', `Стоимость работ: ${fmt(smetaTotals(d).total)} ₽`);
  save();
};

// ======================= Чат =======================
function renderChat(d) {
  d.chat = d.chat || [];
  return `<section class="f-plate"><p class="z-title">Чат заказа</p><p class="z-muted">Только участники заказа. Клиента здесь нет.</p>
    <div class="z-chat">${d.chat.length ? d.chat.map((m) => `<div class="z-msg${m.who === S.me().id ? ' z-msg--me' : ''}"><small>${m.who === S.me().id ? 'Вы' : esc((S.user(m.who) || {}).name || '')} · ${new Date(m.at).toTimeString().slice(0, 5)}</small><p>${esc(m.text)}</p></div>`).join('') : '<p class="z-muted">Сообщений пока нет</p>'}</div>
    ${area('z-chat-text', '', '', { ph: 'Сообщение участникам' })}
    ${row(btn('Отправить', 'z-chat-send'))}</section>`;
}
actions['z-chat-send'] = () => { const el = document.getElementById('z-chat-text'); const t = el ? el.value.trim() : ''; if (!t) return; const d = D(); d.chat.push({ who: S.me().id, text: t, at: new Date().toISOString() }); save(); };

// ======================= 07 · Задачи =======================
function renderTasks(d) {
  d.tasks = d.tasks || [];
  const ui = d.ui || {};
  if (ui.form === 'task') {
    const f = ui.task;
    const people = [S.me(), ...((d.channel && d.channel.partner !== 'self' && S.user(d.channel.partner)) ? [S.user(d.channel.partner)] : [])];
    return `<section class="f-plate"><p class="z-title">Новая задача</p>
      ${input('z-t-text', 'Что нужно сделать', f.text, { ph: 'Купить клей для обоев', live: 'z-t:text', changed: !!f.text, err: (ui.err || {}).text })}
      ${selectField('z-t-who', 'Ответственный', (S.user(f.who) || S.me()).name.split(' ')[0], people.map((u) => ({ value: u.id, label: u.name.split(' ')[0] })), false)}
      <label class="f-field" for="z-t-due"><span class="f-field__label">Срок</span><span class="f-input"><input id="z-t-due" type="date" value="${f.due}" data-live="z-t:due"/></span></label>
    </section>
    ${dock(row(btn('Отмена', 'z-form-close'), btn('Создать', 'z-task-add')))}`;
  }
  const tab = segState.tasks || 'open';
  const list = d.tasks.filter((t) => (tab === 'open' ? !t.done : t.done));
  return `${seg('tasks', [['open', 'Текущие'], ['done', 'Выполненные']], tab)}
    <section class="f-plate z-tall">${list.length ? list.map((t) => `<div class="o-card z-task"><b>${esc(t.text)}</b>
        <small>Ответственный</small><span>${esc((S.user(t.who) || S.me()).name.split(' ')[0])}</span><small>Срок</small><span>${t.due ? dateWords(t.due) : 'без срока'}</span>
        ${row(btn(t.done ? 'Вернуть в работу' : 'Выполнено', 'z-task-toggle', { data: `data-id="${t.id}"` }))}</div>`).join('')
      : tab === 'open' ? '<p class="z-sub">Задач пока нет</p><p class="z-text">Добавьте поручение: например, купить клей или забрать материалы.</p>' : '<p class="z-sub">Выполненных задач пока нет</p>'}</section>
    ${dock(row(btn('+ Добавить задачу', 'z-task-new')))}`;
}
actions['z-task-new'] = () => { const d = D(); d.ui = { form: 'task', task: { text: '', who: S.me().id, due: todayISO() } }; save(); };
pickers['z-t-who'] = (v, d) => { d.ui.task.who = v; };
actions['z-form-close'] = () => { D().ui = {}; save(); };
actions['z-task-add'] = () => {
  const d = D(); const f = d.ui.task;
  if (f.text.trim().length < 2) { d.ui.err = { text: 'Опишите задачу' }; save(); showErrors(); return; }
  d.tasks.push({ id: 't' + Date.now(), text: f.text.trim(), who: f.who, due: f.due, done: false });
  logEvent(d, 'Добавлена задача', f.text.trim()); d.ui = {}; segState.tasks = 'open'; save();
};
actions['z-task-toggle'] = (el) => { const d = D(); const t = d.tasks.find((x) => x.id === el.dataset.id); t.done = !t.done; if (t.done) logEvent(d, 'Задача выполнена', t.text); save(); };

// ======================= 08 · Финансы =======================
function money(d) {
  const st = smetaTotals(d);
  const useSmeta = st.total > 0;
  const est = estimateRooms(d);
  const by = new Map();
  if (useSmeta) st.lines.forEach((l) => by.set(l.name, l.sum));
  else est.forEach((r) => roomTotals(r).lines.forEach((l) => by.set(l.name, (by.get(l.name) || 0) + l.sum)));
  const income = [...by.values()].reduce((a, b) => a + b, 0);
  const pasteIds = new Set(['paste-flizelin', 'paste-paper', 'paste-glass', 'paste-photo']);
  const pasteBase = useSmeta ? st.lines.filter((l) => pasteIds.has(l.id)).reduce((a, l) => a + l.sum, 0)
    : est.reduce((a, r) => a + roomTotals(r).lines.filter((l) => pasteIds.has(l.id)).reduce((x, l) => x + l.sum, 0), 0);
  const ch = d.channel || { partner: 'self', pct: 0 };
  const agent = ch.partner !== 'self' ? Math.round(pasteBase * (ch.pct || 0)) / 100 : 0;
  d.fin = d.fin || { pays: [], exps: [] };
  const own = d.fin.exps.reduce((a, e) => a + e.amount, 0);
  const paid = d.fin.pays.reduce((a, p) => a + p.amount, 0);
  const adv = d.fin.pays.filter((p) => p.kind === 'Аванс').reduce((a, p) => a + p.amount, 0);
  return { by, income, pasteBase, agent, own, paid, adv, ch };
}
const kv = (l, v, cls = '') => `<div class="z-kv${cls ? ' ' + cls : ''}"><span>${l}</span><b>${v}</b></div>`;
function renderFinance(d) {
  const f = money(d);
  const ui = d.ui || {};
  const tab = segState.fin || 'income';
  const head = seg('fin', [['income', 'Доходы'], ['expense', 'Расходы'], ['total', 'Итог']], tab);
  if (ui.form === 'pay') {
    const p = ui.pay;
    return `${head}<section class="f-plate"><p class="z-title">Добавить оплату</p>${status('warn', 'редактирование')}
      <div class="z-kind">${['Аванс', 'Оплата'].map((k) => `<button type="button" class="${p.kind === k ? 'is-on' : ''}" data-action="z-pay-kind" data-v="${k}">${k}</button>`).join('')}</div>
      ${input('z-p-sum', 'Сумма', p.sum, { ph: '0 ₽', mode: 'numeric', live: 'z-p:sum', changed: !!p.sum, err: (ui.err || {}).sum })}
      <label class="f-field" for="z-p-date"><span class="f-field__label">Дата</span><span class="f-input"><input id="z-p-date" type="date" value="${p.date}" data-live="z-p:date"/></span></label>
      ${selectField('z-p-method', 'Способ оплаты', p.method, ['Перевод', 'Наличные', 'Карта'].map((x) => ({ value: x, label: x })), false)}
      ${row(btn('Прикрепить подтверждение', 'z-attach'))}</section>
      ${dock(row(btn('Отмена', 'z-form-close'), btn('Сохранить', 'z-pay-save')))}`;
  }
  if (ui.form === 'exp') {
    const e = ui.exp;
    return `${head}<section class="f-plate"><p class="z-title">Новый расход</p>${status('warn', 'редактирование')}
      ${input('z-e-name', 'Название расхода', e.name, { ph: 'Клей для обоев', live: 'z-e:name', changed: !!e.name, err: (ui.err || {}).name })}
      ${input('z-e-sum', 'Сумма', e.sum, { ph: '0 ₽', mode: 'numeric', live: 'z-e:sum', changed: !!e.sum, err: (ui.err || {}).sum })}
      ${input('z-e-com', 'Комментарий', e.comment, { ph: 'Покупка материала', live: 'z-e:comment', changed: !!e.comment })}
      ${row(btn('Прикрепить чек', 'z-attach'))}</section>
      ${dock(row(btn('Отмена', 'z-form-close'), btn('Сохранить', 'z-exp-save')))}`;
  }
  const expTotal = f.agent + f.own;
  if (tab === 'income') {
    return `${head}<section class="f-plate z-fin">${kv('Доход по смете', `${fmt(f.income)} ₽`, 'z-kv--big')}<p class="z-muted">Автоматически из сметы заказа</p></section>
      <section class="f-plate z-fin"><p class="z-title">Оплаты клиента</p>
        <div class="z-tiles3"><div class="o-card"><small>Аванс</small><b>${fmt(f.adv)} ₽</b></div><div class="o-card"><small>Получено</small><b>${fmt(f.paid)} ₽</b></div><div class="o-card"><small>Осталось</small><b>${fmt(Math.max(0, f.income - f.paid))} ₽</b></div></div>
        ${d.fin.pays.length ? d.fin.pays.map((p) => kv(`${p.kind} · ${p.method} · ${dateWords(p.date)}`, `${fmt(p.amount)} ₽`)).join('') : '<p class="z-text">Оплат пока нет</p>'}</section>
      <section class="f-plate z-fin"><p class="z-title">По смете заказа</p>${[...f.by.entries()].map(([n, v]) => kv(esc(n), `${fmt(v)} ₽`)).join('') || '<p class="z-muted">Смета пока пустая</p>'}</section>
      ${dock(row(btn('+ Оплата', 'z-pay-new')))}`;
  }
  if (tab === 'expense') {
    return `${head}<section class="f-plate z-fin"><p class="z-title">Расходы заказа</p>
        <div class="o-card z-exp-row"><span><b>Агентские</b><small>${f.ch.partner !== 'self' ? `${String(f.ch.pct).replace('.', ',')}% от ${fmt(f.pasteBase)} ₽` : 'Заказ без партнёра'}</small></span><b>${fmt2(f.agent)} ₽</b></div>
        <div class="o-card z-exp-row"><span><b>Авто</b><small>Пробег: 0 км</small></span><b>0 ₽</b></div>
        <div class="o-card z-exp-row"><span><b>Реклама</b><small>Из источника заказа</small></span><b>0 ₽</b></div>
        ${d.fin.exps.map((e) => `<div class="o-card z-exp-row"><span><b>${esc(e.name)}</b><small>${esc(e.comment || 'Покупки и прочее')}</small></span><b>${fmt2(e.amount)} ₽</b></div>`).join('')}</section>
      <div class="z-sum">${kv('Всего расходов', `${fmt2(expTotal)} ₽`)}</div>
      ${dock(row(btn('+ Добавить расход', 'z-exp-new')))}`;
  }
  return `${head}<section class="f-plate z-fin">${kv('Доходы', `${fmt(f.income)} ₽`, 'z-kv--big')}<p class="z-muted">Автоматически из сметы заказа</p></section>
    <section class="f-plate z-fin">${kv('Расходы', `${fmt2(expTotal)} ₽`, 'z-kv--big')}${kv('Агентские', `${fmt2(f.agent)} ₽`, 'z-kv--sm')}${kv('Авто', '0 ₽', 'z-kv--sm')}${kv('Реклама', '0 ₽', 'z-kv--sm')}${kv('Покупки и прочее', `${fmt2(f.own)} ₽`, 'z-kv--sm')}</section>
    <section class="f-plate z-fin z-net"><p class="z-title">Чистый заработок</p><b>${fmt2(f.income - expTotal)} ₽</b><p class="z-muted">Стоимость работ минус все расходы</p></section>
    ${dock(row(btn('Открыть расходы', 'z-seg', { data: 'data-key="fin" data-v="expense"' })))}`;
}
actions['z-pay-new'] = () => { D().ui = { form: 'pay', pay: { kind: 'Аванс', sum: '', date: todayISO(), method: 'Перевод' } }; save(); };
actions['z-pay-kind'] = (el) => { D().ui.pay.kind = el.dataset.v; save(); };
pickers['z-p-method'] = (v, d) => { d.ui.pay.method = v; };
actions['z-pay-save'] = () => {
  const d = D(); const p = d.ui.pay; const a = Math.round(parse(p.sum));
  if (!(a > 0)) { d.ui.err = { sum: 'Введите сумму' }; save(); showErrors(); return; }
  d.fin.pays.push({ kind: p.kind, amount: a, date: p.date || todayISO(), method: p.method });
  logEvent(d, p.kind === 'Аванс' ? 'Получен аванс' : 'Получена оплата', `${fmt(a)} ₽ · ${p.method}`); d.ui = {}; save();
};
actions['z-exp-new'] = () => { D().ui = { form: 'exp', exp: { name: '', sum: '', comment: '' } }; save(); };
actions['z-exp-save'] = () => {
  const d = D(); const e = d.ui.exp; const a = Math.round(parse(e.sum) * 100) / 100;
  if (!e.name.trim() || !(a > 0)) { d.ui.err = { ...(!e.name.trim() ? { name: 'Введите название' } : {}), ...(!(a > 0) ? { sum: 'Введите сумму' } : {}) }; save(); showErrors(); return; }
  d.fin.exps.push({ name: e.name.trim(), amount: a, comment: e.comment.trim() });
  logEvent(d, 'Добавлен расход', `${e.name.trim()} · ${fmt(a)} ₽`); d.ui = {}; save();
};
actions['z-attach'] = () => toast('Фото чека или подтверждения снимается камерой — в прототипе недоступно');

// ======================= 09 · История заказа =======================
function renderHistory(d) {
  const log = (d.log || []).slice().reverse();
  let lastDay = '';
  return `<section class="o-card z-hhead"><span>История заказа</span></section>
    ${log.length ? log.map((e) => {
      const dt = new Date(e.at);
      const day = `${dt.getDate()} ${MONTHS_GEN[dt.getMonth()]} ${dt.getFullYear()}`;
      const hd = day !== lastDay ? `<p class="z-day">${day}</p>` : '';
      lastDay = day;
      const u = S.user(e.who);
      const role = u && u.roles.includes('agent') ? 'Агент' : u && u.roles.includes('dispatcher') ? 'Диспетчер' : 'Мастер';
      return `${hd}<section class="f-plate z-ev"><small>${e.who === S.me().id ? 'Вы' : esc(u ? u.name.split(' ')[0] : '')} · ${role} · ${dt.toTimeString().slice(0, 5)}</small><b>${esc(e.action)}</b>${e.detail ? `<span>${esc(e.detail)}</span>` : ''}</section>`;
    }).join('') : '<section class="f-plate"><p class="z-muted">Событий пока нет. Они появятся, когда вы сохраните канал, клиента, оценку, график, смету, задачи или оплаты.</p></section>'}`;
}

// ---------- ввод без перерисовки ----------
export function onLiveZakaz(el) {
  const [k, f] = (el.dataset.live || '').split(':');
  const d = D();
  if (k === 'z-cl' && f === 'phone10') {
    const c = cl(d);
    const dd = phoneDigits(el.value);
    c.phone = dd ? phoneFormat(dd) : '';
    if (c.err) delete c.err.phone;
    el.value = localFmt(dd);
    const inf = codeInfo(dd);
    const op = document.getElementById('z-cl-op');
    if (op) { op.textContent = inf.text; op.classList.toggle('is-bad', inf.bad); }
    if (!c.dirty) { c.dirty = true; S.save(); refocus(el); } else { S.save(); liveMark(el, clCh(c, 'phone')); }
    const box2 = (document.getElementById('z-cl-phone') || el).closest('.f-input');
    if (box2) box2.classList.toggle('is-error', inf.bad);
    return true;
  }
  if (k === 'z-cl') {
    const c = cl(d); c[f] = el.value;
    if (c.err) delete c.err[f];
    if (!c.dirty) { c.dirty = true; S.save(); refocus(el); } else { S.save(); liveMark(el, clCh(c, f)); }
    return true;
  }
  if (k === 'z-m') { const m = mat(d); const r = matRoom(m, m.view); r.res[f] = el.value.trim(); S.save(); return true; }
  if (k === 'z-mnote') { const m = mat(d); matRoom(m, m.view).items[Number(f)].note = el.value; S.save(); return true; }
  if (k === 'z-oarea') { SR().dlg.area = el.value; return true; }
  if (k === 'z-t' || k === 'z-p' || k === 'z-e') {
    d.ui[{ 'z-t': 'task', 'z-p': 'pay', 'z-e': 'exp' }[k]][f] = el.value;
    if (d.ui.err) delete d.ui.err[f];
    liveMark(el, !!el.value);
    return true;
  }
  return false;
}
function refocus(el) {
  const id = el.id; const pos = el.selectionStart;
  rerender();
  const again = document.getElementById(id);
  if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* поле */ } }
}

registerSection('client', renderClient, (d) => (!d.cl ? '' : d.cl.dirty || (d.cl.saved && d.cl.editing) ? 'warn' : d.cl.saved ? 'ok' : ''));
registerSection('material', renderMaterial);
registerSection('smeta', renderSmeta);
registerSection('chat', renderChat);
registerSection('tasks', renderTasks);
registerSection('finance', renderFinance);
registerSection('history', renderHistory);



// Адрес: подсказки на клавиатуре. Выбрали «г Уфа, ул Айская, д 35/1» — в «Адрес» пишется город и улица,
// а номер дома сразу встаёт в поле «Дом». Если в подсказке дома нет, «Дом» вписывается вручную.
suggesters.addr = (text) => suggestAddress(text);
document.addEventListener('kb-pick', (ev) => {
  if (ev.target.id !== 'z-cl-street') return;
  const c = cl(D()); const x = ev.detail;
  c.street = x.address;
  if (x.house) c.house = x.house;
  c.dirty = true;
  if (c.err) { delete c.err.street; if (x.house) delete c.err.house; }
  save();
});
