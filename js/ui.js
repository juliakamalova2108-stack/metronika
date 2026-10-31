// Общие элементы интерфейса в стиле секции «Выезды».

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const rub = (n) => (Math.round(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
export const m2 = (n) => String(n).replace('.', ',') + ' м²';
export const num = (n) => String(n).replace('.', ',');

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export function dateRu(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
export function dateTimeRu(iso) {
  if (!iso) return '—';
  return `${dateRu(iso)}, ${iso.slice(11, 16)}`;
}
export const weekdayShort = (i) => WD[i];
export const dayNum = (iso) => Number(iso.slice(8, 10));

export function phoneRu(digits) {
  const d = String(digits || '').replace(/\D/g, '').slice(-10);
  if (d.length < 10) return '+7 ' + d;
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

export const ICONS = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7.5" width="17" height="12" rx="2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M3.5 12.5h17" stroke="currentColor" stroke-width="1.7" fill="none"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7h11M9 12h11M9 17h11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="5" cy="7" r="1.2" fill="currentColor"/><circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="5" cy="17" r="1.2" fill="currentColor"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6.5" width="17" height="13" rx="2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M15.5 13h5M6 6.5l9-3 1.2 3" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13l2.5-7.5h11L20 13v5.5H4z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M4 13h4.5l1 2h5l1-2H20" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
  barcode: '<svg viewBox="0 0 24 20" aria-hidden="true"><path d="M2 5V2h3M19 2h3v3M22 15v3h-3M5 18H2v-3" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M7 5v10M9.5 5v10M11.5 5v10M14.5 5v10M17 5v10" stroke="currentColor" stroke-width="1.4"/></svg>',
  calc: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="8" y="6" width="8" height="3.5" rx=".6" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/></svg>',
};

export const status = (kind, text) => `<span class="status status--${kind}"><i></i>${esc(text)}</span>`;

export function field({ id, label, value = '', placeholder = '', type = 'text', inputmode = '', hint = '', error = '', suffix = '', attrs = '' }) {
  return `<label class="field${error ? ' is-error' : ''}" for="${id}">
    <span class="field__label">${esc(label)}${hint ? ` <button type="button" class="hint" data-action="hint" data-hint="${esc(hint)}" aria-label="Подсказка">?</button>` : ''}</span>
    <span class="field__box">
      <input id="${id}" name="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${inputmode ? `inputmode="${inputmode}"` : ''} ${attrs} />
      ${suffix ? `<span class="field__suffix">${esc(suffix)}</span>` : ''}
    </span>
    ${error ? `<span class="field__error">${esc(error)}</span>` : ''}
  </label>`;
}

export function select({ id, label, value, options, attrs = '' }) {
  return `<label class="field" for="${id}">
    <span class="field__label">${esc(label)}</span>
    <span class="field__box field__box--select">
      <select id="${id}" name="${id}" ${attrs}>${options.map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
      <span class="field__chev">${ICONS.chevron}</span>
    </span>
  </label>`;
}

export function btnRow(buttons) {
  return `<div class="btn-row btn-row--${buttons.length}">${buttons.map((b) => `<button type="button" class="btn${b.primary ? ' btn--primary' : ''}" data-action="${b.action}" ${b.data || ''} ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`).join('')}</div>`;
}

export function seg(name, items, active) {
  return `<div class="seg" role="tablist">${items.map((it) => `<button type="button" role="tab" aria-selected="${it.value === active}" class="seg__item${it.value === active ? ' is-active' : ''}" data-action="seg" data-seg="${name}" data-value="${it.value}">${esc(it.label)}</button>`).join('')}</div>`;
}

export function kv(label, value, strong = false) {
  return `<div class="kv"><span>${esc(label)}</span><b class="${strong ? 'kv__strong' : ''}">${value}</b></div>`;
}

let toastTimer;
export function toast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

// Модальное окно внутри страницы (alert и confirm в артефакте не работают).
export function sheet({ title, body, buttons }) {
  const root = document.getElementById('sheet');
  root.innerHTML = `<div class="sheet__scrim" data-action="sheet-close"></div>
    <div class="sheet__panel plate" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <h2 id="sheet-title" class="sheet__title">${esc(title)}</h2>
      <div class="sheet__body">${body}</div>
      ${btnRow(buttons)}
    </div>`;
  root.classList.add('is-on');
  const first = root.querySelector('button.btn');
  if (first) first.focus();
}
export function closeSheet() {
  const root = document.getElementById('sheet');
  root.classList.remove('is-on');
  root.innerHTML = '';
}
