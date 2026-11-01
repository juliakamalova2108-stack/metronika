// Подсветка полей: жёлтая кромка — изменено и не сохранено, красная с подсказкой — ошибка.
// Сохранённые поля не подсвечиваются: зелёным горит статус карточки и точка у вкладки.
import { toast } from './ui.js?v=44';

const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fcls = (changed, err) => (err ? ' is-error' : changed ? ' is-changed' : '');
export const ferr = (err) => (err ? `<span class="f-field__err" role="alert">${escH(err)}</span>` : '');

// Ввод в поле: сразу жёлтая кромка, красное гаснет.
export function liveMark(el, changed) {
  const box = el.closest('.f-input');
  if (!box) return;
  box.classList.toggle('is-changed', !!changed);
  if (box.classList.contains('is-error')) {
    box.classList.remove('is-error');
    const msg = box.parentElement.querySelector('.f-field__err');
    if (msg) msg.remove();
  }
}

// После неудачного сохранения: подсказка и прокрутка к первой ошибке.
export function showErrors() {
  toast('Проверьте поля, отмеченные красным');
  requestAnimationFrame(() => {
    const first = document.querySelector('#view .f-input.is-error');
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

// Телефон: +7 подставляется само; принимаем 9…, 8…, 7…, +7….
export function phoneDigits(v) {
  const raw = String(v || '').trim();
  let d = raw.replace(/\D/g, '');
  if (raw.startsWith('+7')) d = d.slice(1);
  else if ((d[0] === '8' || d[0] === '7') && (d.length >= 11 || d[1] === '9')) d = d.slice(1);
  return d.slice(0, 10);
}
export function phoneFormat(v) {
  const d = phoneDigits(v);
  if (!d) return '';
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)];
  return `+7 (${p[0]}${d.length < 3 ? '' : ')'}${d.length > 3 ? ' ' + p[1] : ''}${d.length > 6 ? '-' + p[2] : ''}${d.length > 8 ? '-' + p[3] : ''}`;
}
