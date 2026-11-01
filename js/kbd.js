import { afterRender } from './core.js?v=41';

// Подсказки над клавишами: поле с data-suggest="имя" получает список из suggesters[имя](текст).
// Выбор подсказки шлёт полю событие kb-pick с выбранным пунктом.
export const suggesters = Object.create(null);
let sugList = [];

// Своя клавиатура для экранов «Оформить заказ» и «Текущий заказ».
// Системная клавиатура телефона не открывается (inputmode="none"); вместо неё прямо под полем
// появляется компактная клавиатура: буквы — для текста, цифры — для телефона, дома, этажа и т. п.
// Кнопка «ОК» записывает значение и закрывает клавиатуру.

const RU = ['йцукенгшщзх', 'фывапролджэ', 'ячсмитьбю'];
const EN = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const SYM = ['1234567890', '-/:;()№"@', 'ъё?!\'+%'];
const ICON_BS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9l-5.5-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M11.5 9.5l5 5m0-5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ICON_SH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l7.5 8H15v7H9v-7H4.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

const NUM_MODES = new Set(['tel', 'numeric', 'decimal']);
let kb = null;        // элемент клавиатуры
let field = null;     // id поля, которое сейчас редактируется
let layer = 'ru';     // ru | en | sym
let shift = false;
let lastLetters = 'ru';

const isFig = () => document.body.classList.contains('fig');
const editable = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|tel|url|search|number|email|)$/.test(el.type || ''))) && el.closest('.view');

// Каждое поле получает тип клавиатуры (data-kb) и inputmode="none", чтобы системная не выскакивала.
// Поле без id получает постоянное имя из своих data-атрибутов: по нему клавиатура находит поле и после перерисовки.
function autoId(el) {
  if (el.id) return;
  const ds = el.dataset;
  const base = ['kb', ds.live || ds.change || el.tagName.toLowerCase(), ds.id ?? ds.i ?? ds.type ?? ds.key ?? ''].join('-').replace(/[^\w-]/g, '_');
  let id = base; let n = 2;
  while (document.getElementById(id)) id = `${base}-${n++}`;
  el.id = id;
}
function prepare(root = document) {
  if (!isFig()) return;
  root.querySelectorAll('.view input, .view textarea').forEach((el) => {
    if (editable(el)) autoId(el);
    if (el.dataset.kb || !editable(el)) return;
    const mode = el.getAttribute('inputmode') || '';
    const kind = NUM_MODES.has(mode) || el.type === 'tel' || el.type === 'number' ? 'num' : mode === 'url' || el.type === 'url' ? 'en' : 'ru';
    el.dataset.kb = kind;
    el.dataset.kbMode = mode || el.type;
    el.setAttribute('inputmode', 'none');
    // Поля «телефон», «ссылка», «число» некоторые телефоны всё равно открывают системной клавиатурой —
    // делаем их обычными текстовыми (тип клавиатуры уже запомнен в data-kb-mode).
    if (el.tagName === 'INPUT' && el.type !== 'text') el.type = 'text';
    el.setAttribute('autocomplete', 'off');
  });
}
afterRender.push(() => prepare());
new MutationObserver(() => prepare()).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
// На случай, если поле появилось между перерисовками: готовим его в момент касания, до фокуса.
document.addEventListener('pointerdown', (ev) => { if (isFig() && editable(ev.target)) prepare(ev.target.parentNode); }, true);

const cur = () => (field ? document.getElementById(field) : null);

function extraKey(el) {
  const m = el.dataset.kbMode;
  if (m === 'decimal') return ',';
  if (m === 'tel' && el.id !== 'z-cl-phone') return '+';
  if (el.id === 'z-cl-house') return '/';
  return '';
}

function keyHtml(k) {
  if (k === 'bs') return `<button type="button" class="kb__k kb__k--fn" data-k="bs" aria-label="Стереть">${ICON_BS}</button>`;
  if (k === 'sh') return `<button type="button" class="kb__k kb__k--fn${shift ? ' is-on' : ''}" data-k="sh" aria-label="Заглавная">${ICON_SH}</button>`;
  const ch = shift && layer !== 'sym' ? k.toUpperCase() : k;
  return `<button type="button" class="kb__k" data-k="${k}">${ch}</button>`;
}

function sugHtml(el) {
  const fn = el.dataset.suggest && suggesters[el.dataset.suggest];
  sugList = fn ? fn(el.value) : [];
  if (!fn) return '';
  if (!sugList.length) return `<div class="kb__sug"><p class="kb__sug-empty">${el.value.trim().length < 2 ? 'Начните вводить улицу — появятся подсказки' : 'Ничего не найдено — можно ввести вручную'}</p></div>`;
  return `<div class="kb__sug">${sugList.map((x, i) => `<button type="button" class="kb__sug-item" data-k="sug" data-i="${i}">${x.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</button>`).join('')}</div>`;
}

function build(el) {
  if (el.dataset.kb === 'num') {
    const x = extraKey(el);
    return `<div class="kb__num">
      ${['1', '2', '3'].map(keyHtml).join('')}${keyHtml('bs')}
      ${['4', '5', '6'].map(keyHtml).join('')}${x ? keyHtml(x) : '<span></span>'}
      ${['7', '8', '9'].map(keyHtml).join('')}<button type="button" class="kb__k kb__ok kb__ok--tall" data-k="ok">ОК</button>
      <button type="button" class="kb__k kb__zero" data-k="0">0</button>
    </div>`;
  }
  const rows = layer === 'sym' ? SYM : layer === 'en' ? EN : RU;
  const third = layer === 'sym' ? rows[2].split('').map(keyHtml).join('') + keyHtml('bs') : keyHtml('sh') + rows[2].split('').map(keyHtml).join('') + keyHtml('bs');
  return `${sugHtml(el)}<div class="kb__row">${rows[0].split('').map(keyHtml).join('')}</div>
    <div class="kb__row">${rows[1].split('').map(keyHtml).join('')}</div>
    <div class="kb__row">${third}</div>
    <div class="kb__row kb__row--bottom">
      <button type="button" class="kb__k kb__k--fn kb__w" data-k="layer">${layer === 'sym' ? (lastLetters === 'en' ? 'ABC' : 'АБВ') : '123'}</button>
      <button type="button" class="kb__k kb__k--fn" data-k="lang" aria-label="Язык">${layer === 'en' ? 'RU' : 'EN'}</button>
      ${el.dataset.kbMode === 'url' ? '<button type="button" class="kb__k kb__k--fn kb__w" data-k="paste">Вставить</button>' : '<button type="button" class="kb__k" data-k=",">,</button>'}
      <button type="button" class="kb__k kb__space" data-k=" " aria-label="Пробел"></button>
      <button type="button" class="kb__k" data-k=".">.</button>
      <button type="button" class="kb__k kb__ok kb__w" data-k="ok">ОК</button>
    </div>`;
}

function draw() {
  const el = cur();
  if (!el) return close();
  if (!kb) {
    kb = document.createElement('div');
    kb.className = 'kb';
    kb.setAttribute('role', 'group');
    kb.setAttribute('aria-label', 'Клавиатура');
    // Нажатия по клавиатуре не забирают фокус у поля.
    kb.addEventListener('pointerdown', (ev) => ev.preventDefault());
    kb.addEventListener('mousedown', (ev) => ev.preventDefault());
    kb.addEventListener('click', onKey);
    document.body.appendChild(kb);
  }
  kb.classList.toggle('kb--num', el.dataset.kb === 'num');
  kb.innerHTML = build(el);
  place();
}

// Клавиатура встаёт прямо под полем; если внизу места нет — над полем.
function place() {
  const el = cur();
  if (!kb || !el) return;
  const box = (el.closest('.f-input') || el).getBoundingClientRect();
  const plate = (el.closest('.f-plate, .o-card, section') || el).getBoundingClientRect();
  const vw = window.innerWidth; const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const num = el.dataset.kb === 'num';
  const w = Math.min(plate.width, vw - 12);
  let left = plate.left + (plate.width - w) / 2;
  left = Math.max(6, Math.min(left, vw - w - 6));
  kb.style.width = `${w}px`;
  kb.style.left = `${left}px`;
  const h = kb.offsetHeight;
  let top = box.bottom + 6;
  if (top + h > vh - 6) top = box.top - h - 6;
  if (top < 6) top = vh - h - 6;
  kb.style.top = `${top}px`;
}

function setActive(on) {
  document.querySelectorAll('.f-input.is-typing').forEach((x) => x.classList.remove('is-typing'));
  const el = cur();
  if (on && el) (el.closest('.f-input') || el).classList.add('is-typing');
}

function open(el) {
  if (field !== el.id) {
    field = el.id;
    shift = false;
    layer = el.dataset.kb === 'en' ? 'en' : 'ru';
    lastLetters = layer;
    autoShift(el);
  }
  setActive(true);
  draw();
}

function close() {
  field = null;
  setActive(false);
  if (kb) { kb.remove(); kb = null; }
}

// Имя, улица, комментарий начинаются с заглавной.
function autoShift(el) {
  if (el.dataset.kb !== 'ru' || layer !== 'ru') return;
  const before = el.value.slice(0, el.selectionStart ?? el.value.length);
  shift = before.trim() === '' || /[.!?]\s$/.test(before);
}

function type(text) {
  let el = cur();
  if (!el) return;
  const s = el.selectionStart ?? el.value.length;
  const e = el.selectionEnd ?? el.value.length;
  if (text === null) {
    if (s === e && s === 0) return;
    let from = s === e ? s - 1 : s;
    // В цифровых полях со скобками и дефисами «стереть» убирает цифру, а не знак оформления.
    if (s === e && el.dataset.kbMode === 'tel') while (from > 0 && /\D/.test(el.value[from])) from -= 1;
    el.setRangeText('', from, e, 'end');
  } else {
    el.setRangeText(text, s, e, 'end');
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  // Поле могло перерисоваться — берём его заново и возвращаем фокус.
  el = cur();
  if (el && document.activeElement !== el) { el.focus({ preventScroll: true }); }
  if (el) { setActive(true); }
}

function ok() {
  const el = cur();
  if (!el) return close();
  close();
  if (el.dataset.change) el.dispatchEvent(new Event('change', { bubbles: true }));
  const again = document.getElementById(el.id) || el;
  again.blur();
}

function onKey(ev) {
  const b = ev.target.closest('[data-k]');
  if (!b) return;
  const k = b.dataset.k;
  const el = cur();
  if (!el) return close();
  if (k === 'ok') return ok();
  if (k === 'bs') { type(null); autoShift(cur() || el); return draw(); }
  if (k === 'sug') {
    const item = sugList[Number(b.dataset.i)];
    if (!item) return;
    close();
    el.dispatchEvent(new CustomEvent('kb-pick', { bubbles: true, detail: item }));
    const again = document.getElementById(el.id);
    if (again) again.blur();
    return;
  }
  if (k === 'paste') {
    if (!navigator.clipboard || !navigator.clipboard.readText) return;
    navigator.clipboard.readText().then((t) => { if (t) { type(t.trim()); draw(); } }).catch(() => {});
    return;
  }
  if (k === 'sh') { shift = !shift; return draw(); }
  if (k === 'layer') { layer = layer === 'sym' ? lastLetters : 'sym'; shift = false; return draw(); }
  if (k === 'lang') { layer = layer === 'en' ? 'ru' : 'en'; lastLetters = layer; shift = false; return draw(); }
  const wasShift = shift;
  type(shift && layer !== 'sym' ? k.toUpperCase() : k);
  if (wasShift) shift = false;
  autoShift(cur() || el);
  draw();
}

document.addEventListener('focusin', (ev) => {
  const el = ev.target;
  if (!isFig() || !el.dataset) return;
  // Поле получило фокус раньше, чем его подготовили: готовим и переоткрываем без системной клавиатуры.
  if (!el.dataset.kb && editable(el)) { prepare(el.parentNode); if (el.dataset.kb) { el.blur(); el.focus({ preventScroll: true }); } return; }
  if (!el.dataset.kb) return;
  if (el.readOnly || el.disabled) { if (field) close(); return; }
  open(el);
});
// Уход из поля закрывает клавиатуру, если фокус не вернулся в то же поле (после перерисовки).
document.addEventListener('focusout', () => {
  setTimeout(() => {
    const a = document.activeElement;
    if (field && (!a || a.id !== field)) close();
  }, 0);
});
window.addEventListener('resize', place);
document.addEventListener('scroll', place, true);
window.addEventListener('hashchange', close);
