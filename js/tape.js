// Цифровая рулетка ADA COSMO MICRO 25 по Bluetooth LE (Web Bluetooth: Chrome на Android, страница по https).
// Служба 0000cbbb, канал 0000cbb1 шлёт показания потоком текстом «D1.234m» (метры).
// Замер считается зафиксированным, когда число не меняется STABLE_MS; следующий замер принимается,
// только когда рулетку сдвинули (число ушло от прошлого зафиксированного на REARM_MM).
// Каждый зафиксированный замер озвучивается голосом телефона.
import { rerender } from './core.js?v=420';
import { toast } from './ui.js?v=420';

const SERVICE = '0000cbbb-0000-1000-8000-00805f9b34fb';
const CHAR = '0000cbb1-0000-1000-8000-00805f9b34fb';
const PACKET = /^D([0-9]+\.[0-9]{3})m$/;
export const STABLE_MS = 1200;
export const REARM_MM = 30;

export const tape = { status: 'off', voice: true, name: '', onFix: null, supported: typeof navigator !== 'undefined' && 'bluetooth' in navigator };
let dev = null, timer = null, cur = null, lastFix = null, armed = true;

// «D2.740m» → 2740 (мм) или null
export const parsePacket = (text) => { const m = PACKET.exec(String(text || '').trim()); return m ? Math.round(parseFloat(m[1]) * 1000) : null; };

const plural = (n, a, b, c) => { const k = n % 100; if (k > 10 && k < 20) return c; const l = n % 10; return l === 1 ? a : l > 1 && l < 5 ? b : c; };
export const sayLength = (mm) => { const cm = Math.round(mm / 10), m = Math.floor(cm / 100), c = cm % 100;
  return [m ? `${m} ${plural(m, 'метр', 'метра', 'метров')}` : '', c || !m ? `${c} ${plural(c, 'сантиметр', 'сантиметра', 'сантиметров')}` : ''].filter(Boolean).join(' '); };

export function say(text) {
  if (!tape.voice || typeof speechSynthesis === 'undefined') return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ru-RU'; u.rate = 1; speechSynthesis.speak(u); } catch (e) { /* голос недоступен */ }
}

// Один пакет с рулетки (из канала или из теста)
export function feed(text) {
  const mm = parsePacket(text); if (mm == null || mm <= 0) return;
  if (!armed && lastFix != null && Math.abs(mm - lastFix) >= REARM_MM) armed = true;
  if (cur !== null && Math.abs(mm - cur) <= 1) return;   // то же число: таймер идёт дальше
  cur = mm; clearTimeout(timer);
  timer = setTimeout(() => { if (!armed) return; armed = false; lastFix = cur; if (tape.onFix) tape.onFix(cur); }, STABLE_MS);
}

export async function connect() {
  if (!tape.supported) { toast('Подключение рулетки работает в Chrome на Android'); return; }
  tape.status = 'connecting'; rerender();
  try {
    dev = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'MICRO' }], optionalServices: [SERVICE] });
    dev.addEventListener('gattserverdisconnected', () => { tape.status = 'off'; clearTimeout(timer); cur = null; toast('Рулетка отключилась'); rerender(); });
    tape.name = dev.name || 'MICRO';
    const srv = await dev.gatt.connect(), svc = await srv.getPrimaryService(SERVICE), ch = await svc.getCharacteristic(CHAR);
    ch.addEventListener('characteristicvaluechanged', (ev) => feed(new TextDecoder().decode(ev.target.value)));
    await ch.startNotifications();
    tape.status = 'on'; cur = null; lastFix = null; armed = true;
    say('Рулетка подключена');
  } catch (e) { tape.status = 'off'; if (e && e.name !== 'NotFoundError') toast('Не удалось подключить рулетку'); }
  rerender();
}
export function disconnect() { try { if (dev && dev.gatt.connected) dev.gatt.disconnect(); } catch (e) { /* уже отключена */ } tape.status = 'off'; clearTimeout(timer); cur = null; rerender(); }
// для проверки без рулетки
export const simulate = () => { tape.status = 'on'; cur = null; lastFix = null; armed = true; };
