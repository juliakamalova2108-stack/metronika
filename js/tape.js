// Цифровая рулетка ADA COSMO MICRO 25 по Bluetooth LE (Web Bluetooth: Chrome на Android, страница по https).
// Служба 0000cbbb, канал 0000cbb1 шлёт показания потоком текстом «D1.234m» (метры).
// Замер считается зафиксированным, когда число не меняется STABLE_MS; следующий замер принимается,
// только когда рулетку сдвинули (число ушло от прошлого зафиксированного на REARM_MM).
// Каждый зафиксированный замер озвучивается голосом телефона.
import { rerender } from './core.js?v=544';
import { toast } from './ui.js?v=544';

const SERVICE = '0000cbbb-0000-1000-8000-00805f9b34fb';
const CHAR = '0000cbb1-0000-1000-8000-00805f9b34fb';
const PACKET = /^D([0-9]+\.[0-9]{3})m$/;
export const STABLE_MS = 1000;
export const REARM_MM = 30;
const TOL_MM = 3;

export const tape = { status: 'off', voice: true, name: '', chain: false, dbg: { n: 0, raw: '', hex: '', mm: 0 }, onFix: null, supported: typeof navigator !== 'undefined' && 'bluetooth' in navigator };
let dev = null, timer = null, cur = null, lastFix = null, armed = true;

// «D2.740m» → 2740 (мм) или null
export const parsePacket = (text) => { const m = PACKET.exec(String(text || '').trim()); return m ? Math.round(parseFloat(m[1]) * 1000) : null; };

const plural = (n, a, b, c) => { const k = n % 100; if (k > 10 && k < 20) return c; const l = n % 10; return l === 1 ? a : l > 1 && l < 5 ? b : c; };
export const sayLength = (mm) => { const cm = Math.round(mm / 10), m = Math.floor(cm / 100), c = cm % 100;
  return [m ? `${m} ${plural(m, 'метр', 'метра', 'метров')}` : '', c || !m ? `${c} ${plural(c, 'сантиметр', 'сантиметра', 'сантиметров')}` : ''].filter(Boolean).join(' '); };

// Голос: лучший из русских голосов телефона; можно выбрать другой в Настройках
const KEY = 'metronika-tape-voice';
const score = (v) => (/natural|neural|online|enhanced/i.test(v.name) ? 5 : 0) + (/google/i.test(v.name) ? 4 : 0) + (/milena|alena|katya|svetlana|irina|yuri|pavel|ekaterina|anna/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
export const voices = () => (typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter((v) => /^ru/i.test(v.lang)).sort((a, b) => score(b) - score(a)));
export const voiceName = () => { let saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch (e) { /* без памяти */ } const L = voices(); const v = L.find((x) => x.name === saved) || L[0]; return v ? v.name : ''; };
export const nextVoice = () => { const L = voices(); if (!L.length) return ''; const i = L.findIndex((x) => x.name === voiceName()); const v = L[(i + 1) % L.length]; try { localStorage.setItem(KEY, v.name); } catch (e) { /* без памяти */ } return v.name; };
if (typeof speechSynthesis !== 'undefined' && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', () => {});
// ---- Голос Метроники: записанные фразы audio/<ключ>.mp3 (если файлов нет, читает голос телефона) ----
export const CLIPS = { stena: 'Стена', rh: 'Замерьте общую высоту', len: 'Замерьте длину', hgt: 'Замерьте высоту', wid: 'Замерьте ширину', repeat: 'Повтор', dlina: 'Длина', vysota: 'Высота', shirina: 'Ширина', okno: 'Окно', dver: 'Дверь', proem: 'Проём', added: 'Добавлено', done: 'Это уже измерено. Нажмите «Перемерить»', test: 'Проверка голоса. Метроника на связи' };
const ONES = ['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
const TENS = { 20: 'двадцать', 30: 'тридцать', 40: 'сорок', 50: 'пятьдесят', 60: 'шестьдесят', 70: 'семьдесят', 80: 'восемьдесят', 90: 'девяносто' };
const HUND = { 100: 'сто', 200: 'двести', 300: 'триста', 400: 'четыреста', 500: 'пятьсот', 600: 'шестьсот', 700: 'семьсот', 800: 'восемьсот', 900: 'девятьсот' };
export const NUMCLIPS = { ...Object.fromEntries(ONES.map((w, i) => ['n' + i, w])), ...Object.fromEntries(Object.entries(TENS).map(([k, w]) => ['n' + k, w])), ...Object.fromEntries(Object.entries(HUND).map(([k, w]) => ['n' + k, w])) };
// число в сантиметрах -> ключи клипов (310 -> n300, n10)
export const numKeys = (cm) => { let n = Math.max(0, Math.min(999, Math.round(cm))); const k = []; if (n >= 100) { k.push('n' + Math.floor(n / 100) * 100); n %= 100; } if (n >= 20) { k.push('n' + Math.floor(n / 10) * 10); n %= 10; if (n) k.push('n' + n); } else if (n || !k.length) k.push('n' + n); return k; };
const textOf = (k) => CLIPS[k] || NUMCLIPS[k] || String(k);
let clipsOk = null, player = null, pending = [], busy = false;
if (typeof fetch !== 'undefined' && typeof location !== 'undefined') fetch('audio/rh.mp3', { method: 'HEAD' }).then((r) => { clipsOk = r.ok; }).catch(() => { clipsOk = false; });
function pump() {
  if (busy) return; const k = pending.shift(); if (!k) return;
  busy = true; player = player || new Audio();
  const next = () => { busy = false; pump(); };
  player.onended = next; player.onerror = next; player.src = 'audio/' + k + '.mp3'; player.play().catch(next);
}
function playKeys(keys, queue) {
  if (!queue) { pending = []; if (player) { try { player.pause(); } catch (e) { /* уже стоит */ } } busy = false; }
  pending.push(...keys); pump();
}
// say('текст') — голос телефона; say(['len', 'n300', 'n10']) — голос Метроники (или телефон, если файлов нет)
export function say(x, queue = false) {
  if (!tape.voice || !x || !x.length) return;
  if (Array.isArray(x)) {
    if (clipsOk && typeof Audio !== 'undefined') { playKeys(x, queue); return; }
    x = x.map(textOf).join(' ');
  }
  if (typeof speechSynthesis === 'undefined') return;
  try { if (!queue) speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(x); u.lang = 'ru-RU'; u.rate = 1.0; u.pitch = 1.1; const n = voiceName(); const v = n && voices().find((y) => y.name === n); if (v) u.voice = v; speechSynthesis.speak(u); } catch (e) { /* голос недоступен */ }
}

// Один пакет с рулетки (из канала или из теста). Пакеты могут прийти кусками — копим текст и ищем «D1.234m».
let buf = '', anchor = null;
export const feed = (text, hex = '') => {
  tape.dbg.n++; tape.dbg.raw = String(text).replace(/[\r\n]/g, '⏎'); tape.dbg.hex = hex;
  buf = (buf + String(text)).slice(-80);
  let m, last = null; const re = /D\s*([0-9]+(?:\.[0-9]+)?)\s*m/gi;
  while ((m = re.exec(buf))) { last = Math.round(parseFloat(m[1]) * 1000); buf = buf.slice(m.index + m[0].length); re.lastIndex = 0; }
  if (last == null || last <= 0) return;
  tape.dbg.mm = last; reading(last);
};
function reading(mm) {
  if (!armed && lastFix != null && Math.abs(mm - lastFix) >= REARM_MM) armed = true;
  cur = mm;
  if (anchor !== null && Math.abs(mm - anchor) <= TOL_MM) return;   // число стоит на месте (дрожание до 3 мм не в счёт): таймер идёт дальше
  anchor = mm; clearTimeout(timer);
  timer = setTimeout(() => { anchor = null; if (!armed) return; armed = false; lastFix = cur; if (tape.onFix) tape.onFix(cur); }, STABLE_MS);
}

// «Перемерить»: следующее значение принимаем даже если оно такое же, как прошлое
tape.reset = () => { armed = true; lastFix = null; anchor = null; clearTimeout(timer); };

export async function connect() {
  if (!tape.supported) { toast('Подключение рулетки работает в Chrome на Android'); return; }
  tape.status = 'connecting'; rerender();
  try {
    dev = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'MICRO' }], optionalServices: [SERVICE] });
    dev.addEventListener('gattserverdisconnected', () => { tape.status = 'off'; clearTimeout(timer); cur = null; toast('Рулетка отключилась'); rerender(); });
    tape.name = dev.name || 'MICRO';
    const srv = await dev.gatt.connect(), svc = await srv.getPrimaryService(SERVICE), ch = await svc.getCharacteristic(CHAR);
    ch.addEventListener('characteristicvaluechanged', (ev) => { const v = ev.target.value; feed(new TextDecoder().decode(v), Array.from(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)).map((x) => x.toString(16).padStart(2, '0')).join(' ')); });
    await ch.startNotifications();
    tape.status = 'on'; cur = null; lastFix = null; armed = true; anchor = null; buf = ''; tape.dbg = { n: 0, raw: '', hex: '', mm: 0 };
    say('Рулетка подключена');
  } catch (e) { tape.status = 'off'; if (e && e.name !== 'NotFoundError') toast('Не удалось подключить рулетку'); }
  rerender();
}
export function disconnect() { try { if (dev && dev.gatt.connected) dev.gatt.disconnect(); } catch (e) { /* уже отключена */ } tape.status = 'off'; clearTimeout(timer); cur = null; rerender(); }
// для проверки без рулетки
export const simulate = () => { tape.status = 'on'; cur = null; lastFix = null; armed = true; };
