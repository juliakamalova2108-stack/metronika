// Маршрутизация и общий реестр действий.
// Адрес экрана хранится в #хеше (только буквы, цифры и дефисы), остальное — в памяти страницы.

export const actions = Object.create(null);
export const inputs = Object.create(null);
// Обработчики изменения полей (data-change): сохраняют значение сразу, без кнопки.
export const changes = Object.create(null);

// После каждой отрисовки (сразу, до любого фокуса) — например, своя клавиатура готовит поля.
export const afterRender = [];
let renderFn = () => {};
export function setRenderer(fn) { renderFn = () => { fn(); afterRender.forEach((f) => f()); }; }
export function rerender() { renderFn(); }

export function go(name) {
  if (location.hash.slice(1) === name) rerender();
  else location.hash = name;
  window.scrollTo(0, 0);
}

export const route = () => location.hash.slice(1);

// Значение поля по id, с обрезкой пробелов.
export const val = (id) => {
  const el = document.getElementById(id);
  return el ? String(el.value).trim() : '';
};
export const numVal = (id) => {
  const v = val(id).replace(',', '.');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
};
