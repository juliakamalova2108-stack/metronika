// Вход по телефону → код из SMS → PIN; регистрация; повторный вход по PIN.
// Функционал взят из секции «Вход» в Figma, оформление — из «Выездов».

import { actions, rerender, val } from './core.js?v=47';
import * as S from './store.js?v=47';
import { DEMO_CODE } from './seed.js?v=47';
import { esc, field, btnRow, seg, phoneRu, toast } from './ui.js?v=47';

const flow = { step: 'phone', mode: 'login', phone: '', error: '', reg: { name: '', role: 'master', c1: false, c2: false }, pin1: '', userId: null };
let unlocked = false;

export const isUnlocked = () => unlocked;
export function lock() { unlocked = false; }

const digits = (s) => String(s).replace(/\D/g, '');

function hero() {
  return `<div class="auth__hero">
    <div class="brand__sphere" aria-hidden="true"></div>
    <h1 class="auth__word">METRONICA</h1>
    <p class="muted">Единая среда для профессионалов</p>
  </div>`;
}

function codeInput(id, label) {
  return `<label class="field" for="${id}"><span class="field__label">${esc(label)}</span>
    <span class="field__box"><input id="${id}" class="code-one" type="password" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="• • • •" style="text-align:center;letter-spacing:.6em;font-size:22px;font-family:var(--font-num)"/></span></label>`;
}

export function renderAuth() {
  const me = S.me();
  if (me && S.pinOf(me.id) && !unlocked && flow.step === 'phone') flow.step = 'relogin';

  if (flow.step === 'relogin') {
    return `<div class="auth">${hero()}
      <form class="plate" data-form="relogin" novalidate>
        <h2 class="plate__title">С возвращением, ${esc(me.name.split(' ')[0])}</h2>
        ${codeInput('pin', 'Введите PIN-код')}
        ${flow.error ? `<p class="field__error">${esc(flow.error)}</p>` : ''}
        ${btnRow([{ label: 'Войти', action: 'relogin', primary: true }])}
        <div class="grid-2"><button type="button" class="link-btn" data-action="forgot-pin">Не помню PIN</button>
        <button type="button" class="link-btn" data-action="other-account" style="text-align:right">Другой аккаунт</button></div>
      </form></div>`;
  }

  if (flow.step === 'register') {
    const r = flow.reg;
    return `<div class="auth">
      <form class="plate" data-form="register" novalidate>
        <div class="plate__head"><h2 class="plate__title">Регистрация</h2></div>
        ${field({ id: 'reg-name', label: 'Имя и фамилия', value: r.name, placeholder: 'Как к вам обращаться' })}
        ${field({ id: 'reg-phone', label: 'Номер телефона', value: flow.phone, placeholder: '999 123-45-67', type: 'tel', inputmode: 'tel' })}
        <div class="field"><span class="field__label">Кто вы</span>
          ${seg('reg-role', [{ value: 'master', label: 'Мастер' }, { value: 'dispatcher', label: 'Диспетчер' }, { value: 'agent', label: 'Агент' }], r.role)}
          <p class="small">${r.role === 'agent' ? 'Продавец, дизайнер и другие, кто сам не клеит обои. Агент не может быть мастером.' : r.role === 'dispatcher' ? 'Раздаёте заказы своим мастерам. Можете и сами работать мастером.' : 'Клеите обои: ведёте объекты, замеры и сметы.'}</p>
        </div>
        <label class="check"><input type="checkbox" id="reg-c1" ${r.c1 ? 'checked' : ''}/> <span>Соглашаюсь с условиями пользования сервисом</span></label>
        <label class="check"><input type="checkbox" id="reg-c2" ${r.c2 ? 'checked' : ''}/> <span>Даю согласие на обработку персональных данных</span></label>
        ${flow.error ? `<p class="field__error">${esc(flow.error)}</p>` : ''}
        ${btnRow([{ label: 'Назад', action: 'auth-back' }, { label: 'Получить код', action: 'reg-submit', primary: true }])}
      </form></div>`;
  }

  if (flow.step === 'code') {
    return `<div class="auth">${hero()}
      <form class="plate" data-form="code" novalidate>
        <h2 class="plate__title">Код из SMS</h2>
        <p class="muted">Отправили на ${esc(phoneRu(flow.phone))}</p>
        ${codeInput('sms', 'Код')}
        ${flow.error ? `<p class="field__error">${esc(flow.error)}</p>` : ''}
        <p class="demo-note">Прототип не отправляет SMS. Код для входа: <b>${DEMO_CODE}</b></p>
        ${btnRow([{ label: 'Назад', action: 'auth-back' }, { label: 'Подтвердить', action: 'code-submit', primary: true }])}
        <button type="button" class="link-btn" data-action="code-resend">Отправить код ещё раз</button>
      </form></div>`;
  }

  if (flow.step === 'pin' || flow.step === 'pin2') {
    return `<div class="auth">${hero()}
      <form class="plate" data-form="pin" novalidate>
        <h2 class="plate__title">${flow.step === 'pin' ? 'Придумайте PIN-код' : 'Повторите PIN-код'}</h2>
        <p class="muted">Четыре цифры для быстрого входа на этом телефоне</p>
        ${codeInput('pin', 'PIN-код')}
        ${flow.error ? `<p class="field__error">${esc(flow.error)}</p>` : ''}
        ${btnRow([{ label: flow.step === 'pin' ? 'Дальше' : 'Готово', action: 'pin-submit', primary: true }])}
      </form></div>`;
  }

  return `<div class="auth">${hero()}
    <form class="plate" data-form="phone" novalidate>
      <h2 class="plate__title">Вход в аккаунт</h2>
      ${field({ id: 'phone', label: 'Номер телефона', value: flow.phone ? phoneRu(flow.phone).slice(3) : '', placeholder: '999 123-45-67', type: 'tel', inputmode: 'tel', error: flow.error })}
      ${btnRow([{ label: 'Получить код', action: 'phone-submit', primary: true }])}
      ${btnRow([{ label: 'Регистрация', action: 'to-register' }])}
      <div class="well">
        <p class="small">Демо-аккаунты прототипа: нажмите, чтобы подставить номер</p>
        <div class="chips">
          <button type="button" class="chip-btn" data-action="demo-phone" data-phone="9001111111">Алина<small>агент · продавец</small></button>
          <button type="button" class="chip-btn" data-action="demo-phone" data-phone="9002222222">Сергей<small>мастер</small></button>
          <button type="button" class="chip-btn" data-action="demo-phone" data-phone="9003333333">Иван<small>диспетчер и мастер</small></button>
          <button type="button" class="chip-btn" data-action="demo-phone" data-phone="9004444444">Андрей<small>мастер у Ивана</small></button>
          <button type="button" class="chip-btn" data-action="demo-phone" data-phone="9005555555">Олег<small>мастер у Ивана</small></button>
        </div>
      </div>
    </form></div>`;
}

function setStep(step) { flow.step = step; flow.error = ''; rerender(); focusFirst(); }
function focusFirst() { requestAnimationFrame(() => { const el = document.querySelector('.auth input'); if (el) el.focus(); }); }

actions['demo-phone'] = (el) => { flow.phone = el.dataset.phone; flow.error = ''; rerender(); };
actions['to-register'] = () => { flow.mode = 'register'; setStep('register'); };
actions['auth-back'] = () => { flow.mode = 'login'; setStep('phone'); };

actions['phone-submit'] = () => {
  const d = digits(val('phone')).slice(-10);
  flow.phone = d;
  if (d.length !== 10) { flow.error = 'Введите 10 цифр номера после +7'; rerender(); return; }
  const u = S.findByPhone(d);
  if (!u) { flow.error = 'Такого номера нет. Проверьте его или пройдите регистрацию'; rerender(); return; }
  flow.userId = u.id;
  flow.mode = 'login';
  setStep('code');
};

actions['reg-submit'] = () => {
  flow.reg.name = val('reg-name');
  flow.reg.c1 = document.getElementById('reg-c1').checked;
  flow.reg.c2 = document.getElementById('reg-c2').checked;
  const d = digits(val('reg-phone')).slice(-10);
  flow.phone = d;
  if (flow.reg.name.length < 2) { flow.error = 'Укажите имя'; rerender(); return; }
  if (d.length !== 10) { flow.error = 'Введите 10 цифр номера после +7'; rerender(); return; }
  if (S.findByPhone(d)) { flow.error = 'Этот номер уже зарегистрирован — войдите по нему'; rerender(); return; }
  if (!flow.reg.c1 || !flow.reg.c2) { flow.error = 'Без двух согласий регистрация невозможна'; rerender(); return; }
  setStep('code');
};

export function onSeg(name, value) {
  if (name !== 'reg-role') return false;
  flow.reg.name = val('reg-name') || flow.reg.name;
  const d = digits(val('reg-phone'));
  if (d) flow.phone = d.slice(-10);
  flow.reg.role = value;
  rerender();
  return true;
}

actions['code-resend'] = () => toast(`Новый код отправлен. В прототипе это всегда ${DEMO_CODE}`);
actions['code-submit'] = () => {
  if (val('sms') !== DEMO_CODE) { flow.error = 'Неверный код. Проверьте SMS и попробуйте ещё раз'; rerender(); focusFirst(); return; }
  if (flow.mode === 'register') {
    const u = S.register({ name: flow.reg.name, phone: flow.phone, role: flow.reg.role });
    flow.userId = u.id;
  }
  setStep('pin');
};

actions['pin-submit'] = () => {
  const p = val('pin');
  if (!/^\d{4}$/.test(p)) { flow.error = 'PIN — это 4 цифры'; rerender(); focusFirst(); return; }
  if (flow.step === 'pin') { flow.pin1 = p; setStep('pin2'); return; }
  if (p !== flow.pin1) { flow.error = 'PIN-коды не совпали. Придумайте заново'; flow.step = 'pin'; flow.pin1 = ''; rerender(); focusFirst(); return; }
  S.setPin(flow.userId, p);
  S.setSession(flow.userId);
  unlocked = true;
  flow.step = 'phone';
  flow.error = '';
  location.hash = '';
  rerender();
};

actions['relogin'] = () => {
  const me = S.me();
  if (val('pin') !== S.pinOf(me.id)) { flow.error = 'Неверный PIN'; rerender(); focusFirst(); return; }
  unlocked = true;
  flow.step = 'phone';
  flow.error = '';
  rerender();
};

actions['forgot-pin'] = () => {
  const me = S.me();
  flow.phone = me.phone;
  flow.userId = me.id;
  flow.mode = 'login';
  setStep('code');
};

export function logout() {
  S.setSession(null);
  unlocked = false;
  flow.step = 'phone';
  flow.phone = '';
  flow.error = '';
}
actions['other-account'] = () => { logout(); rerender(); };

// Enter в форме = основная кнопка.
export function submitForm(form) {
  const map = { relogin: 'relogin', register: 'reg-submit', code: 'code-submit', pin: 'pin-submit', phone: 'phone-submit' };
  const a = actions[map[form.dataset.form]];
  if (a) a();
}
