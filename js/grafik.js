// «Оформить заказ» → вкладка «График». Один в один с секцией «Выезды · 03 · График» в Figma.
// Комнаты из «Оценки» делятся на рабочие дни (смена 8 ч): выбрали комнату → нажали свободную дату →
// её дни легли подряд. Переключатель «Замеры» — то же для выезда на замер (2 часа).

import { actions, rerender } from './core.js?v=23';
import * as S from './store.js?v=23';
import { SHIFT_HOURS } from './calc.js?v=23';
import { esc } from './ui.js?v=23';
import { logEvent } from './zlog.js?v=23';
import { estimateRooms, roomTotals } from './ocenka.js?v=23';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const CHEV = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ');
const p2 = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${p2(m + 1)}-${p2(d)}`;
function addDays(s, n) { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d.getFullYear(), d.getMonth(), d.getDate()); }

function sch(d) {
  if (!d.sched) { const t = new Date(); d.sched = { mode: 'rooms', sel: '', place: {}, measure: '', month: `${t.getFullYear()}-${p2(t.getMonth() + 1)}`, status: 'new', dirty: false }; }
  return d.sched;
}
export function scheduleState(d) { if (!d.sched) return ''; return scheduleDirty(d) ? 'warn' : d.sched.status === 'saved' ? 'ok' : ''; }
export function scheduleDirty(d) { return !!d.sched && (d.sched.dirty || d.sched.status === 'editing'); }

// Дни работы комнаты: полные смены и остаток; стоимость дня — доля от стоимости комнаты.
function roomDays(r) {
  const t = roomTotals(r);
  if (!t.hours) return [];
  const out = [];
  let left = t.hours;
  while (left > 0) { const h = Math.min(SHIFT_HOURS, left); out.push({ hours: h, cost: Math.round((t.total * h) / t.hours) }); left -= h; }
  return out;
}

// Где лежат дни комнат: дата начала → дни подряд, занятые другими комнатами даты пропускаются.
function layout(s, rooms) {
  const byDate = {};
  rooms.forEach((r) => {
    const start = s.place[r.key];
    if (!start) return;
    let day = start;
    roomDays(r).forEach((x, i) => {
      while (byDate[day]) day = addDays(day, 1);
      byDate[day] = { room: r, ...x, i };
      day = addDays(day, 1);
    });
  });
  return byDate;
}

function chip(r, x, selected, extraAttrs = '') {
  const frac = x.hours / SHIFT_HOURS;
  const style = frac >= 1 ? `background:${r.color}` : `background:${hexA(r.color, 0.18)}`;
  return `<button type="button" class="g-chip${selected ? ' is-sel' : ''}" style="${style}" ${extraAttrs}>
    ${frac < 1 ? `<i class="g-chip__fill" style="background:${r.color};width:${(frac * 100).toFixed(1)}%"></i>` : ''}
    <span>${esc(r.name)}</span><span>${fmt(x.cost)}</span></button>`;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

function measuresOn(date) {
  // Замеры этого дня в других заказах мастера + текущий.
  const me = S.me();
  return S.get().orders.filter((o) => !o.trashed && !['closed', 'cancelled', 'failed'].includes(o.status)).reduce((a, o) => a + o.visits.filter((v) => v.type === 'measure' && v.date === date && v.masterId === me.id).length, 0);
}

function calendar(s, rooms, lay, locked) {
  const [Y, M] = s.month.split('-').map(Number);
  const first = new Date(Y, M - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(Y, M, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="g-cell g-cell--void"></span>');
  for (let dd = 1; dd <= days; dd++) {
    const date = iso(Y, M - 1, dd);
    const act = locked ? '' : `data-action="g-day" data-date="${date}"`;
    if (s.mode === 'rooms' && lay[date]) {
      const x = lay[date];
      const frac = x.hours / SHIFT_HOURS;
      const style = frac >= 1 ? `background:${x.room.color}` : `background:${hexA(x.room.color, 0.18)}`;
      cells.push(`<button type="button" class="g-cell g-cell--work${s.sel === x.room.key ? ' is-sel' : ''}" style="${style}" ${act} aria-label="${dd}, ${esc(x.room.name)}">
        ${frac < 1 ? `<i class="g-chip__fill" style="background:${x.room.color};width:${(frac * 100).toFixed(1)}%"></i>` : ''}
        <b>${dd}</b><span>${esc(x.room.name)}</span><span>${fmt(x.cost)}</span></button>`);
    } else {
      const meas = s.mode === 'measure' ? measuresOn(date) + (s.measure === date ? 1 : 0) : 0;
      cells.push(`<button type="button" class="g-cell" ${act} aria-label="${dd}"><b>${dd}</b>${meas ? `<i class="g-badge">${meas}</i>` : ''}</button>`);
    }
  }
  return `<div class="g-month"><button type="button" class="f-icon-btn g-prev" data-action="g-month" data-d="-1" aria-label="Предыдущий месяц">${CHEV}</button>
      <span>${MONTHS[M - 1]} ${Y}</span><button type="button" class="f-icon-btn g-next" data-action="g-month" data-d="1" aria-label="Следующий месяц">${CHEV}</button></div>
    <div class="g-dow">${DOW.map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="g-grid" style="--weeks:${Math.ceil((lead + days) / 7)}">${cells.join('')}</div>`;
}

export function renderSchedule(d) {
  const s = sch(d);
  const rooms = estimateRooms(d).filter((r) => roomTotals(r).hours > 0);
  const lay = layout(s, rooms);
  const locked = s.status === 'saved';
  const pending = rooms.filter((r) => !s.place[r.key]);
  let todo;
  if (s.mode === 'measure') {
    todo = s.measure ? '<div class="g-tray"></div>'
      : `<div class="g-tray"><button type="button" class="g-chip g-chip--measure${s.sel === 'measure' ? ' is-sel' : ''}" data-action="g-pick" data-key="measure"><span>Замер</span><span>2 часа</span></button></div>`;
    todo = `<section class="g-todo"><p class="g-todo__t">Без даты</p><p class="g-todo__x">Выберите замер и нажмите на любую свободную дату</p>${todo}</section>`;
  } else if (!rooms.length) {
    todo = '<section class="g-todo"><p class="g-todo__t">Без даты</p><p class="g-todo__x">Сначала заполните «Оценку»: дни работ считаются по объёмам комнат</p><div class="g-tray"></div></section>';
  } else if (!pending.length) {
    todo = '<section class="g-todo g-todo--done"><p class="g-todo__t">Все комнаты запланированы</p><p class="g-todo__x" aria-hidden="true" style="visibility:hidden">Выберите комнату и нажмите на любую свободную дату</p><div class="g-tray"></div></section>';
  } else {
    todo = `<section class="g-todo"><p class="g-todo__t">Без даты</p><p class="g-todo__x">Выберите комнату и нажмите на любую свободную дату</p>
      <div class="g-tray">${pending.map((r) => roomDays(r).map((x) => chip(r, x, s.sel === r.key, `data-action="g-pick" data-key="${r.key}"`)).join('')).join('')}</div></section>`;
  }
  const editing = s.dirty || s.status === 'editing';
  const status = editing ? '<span class="f-status f-status--warn g-status"><i></i>редактирование</span>' : locked ? '<span class="f-status f-status--ok g-status"><i></i>сохранено</span>' : '';
  return `<i class="f-one" hidden></i><div class="g-screen f-fill"><button type="button" class="o-row g-mode" role="switch" aria-checked="${s.mode === 'measure'}" data-action="g-mode"><span class="o-row__name">Замеры</span><span class="o-tog${s.mode === 'measure' ? ' is-on' : ''}" aria-hidden="true"><i></i></span></button>
    ${todo}
    <section class="f-plate g-plate"><p class="g-plate__t">Запланированы</p>${status}${calendar(s, rooms, lay, locked)}</section>
    <div class="f-btn-row">
      <button type="button" class="f-btn${locked ? ' f-btn--saved' : ''}" data-action="g-ok" ${!locked && !s.dirty && s.status !== 'editing' ? 'disabled' : ''}>ОК</button>
      ${s.status !== 'new' ? `<button type="button" class="f-btn${s.status === 'editing' ? ' f-btn--editing' : ''}" data-action="g-edit">Редактировать</button>` : ''}
    </div></div>`;
}

// ---------- действия ----------
const D = () => sch(S.get().oformit[S.me().id]);
const save = () => { S.save(); rerender(); };
const editable = (s) => s.status !== 'saved';

actions['g-mode'] = () => { const s = D(); s.mode = s.mode === 'rooms' ? 'measure' : 'rooms'; s.sel = ''; save(); };
actions['g-pick'] = (el) => { const s = D(); if (!editable(s)) return; s.sel = s.sel === el.dataset.key ? '' : el.dataset.key; save(); };
actions['g-month'] = (el) => {
  const s = D(); const [Y, M] = s.month.split('-').map(Number);
  const d = new Date(Y, M - 1 + Number(el.dataset.d), 1); s.month = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; save();
};
actions['g-day'] = (el) => {
  const s = D(); if (!editable(s)) return;
  const date = el.dataset.date;
  const d = S.get().oformit[S.me().id];
  if (s.mode === 'measure') {
    if (s.measure === date) { s.measure = ''; s.sel = ''; s.dirty = true; save(); return; } // замер снят с даты
    if (s.sel === 'measure' || s.measure) { s.measure = date; s.sel = ''; s.dirty = true; save(); }
    return;
  }
  const rooms = estimateRooms(d).filter((r) => roomTotals(r).hours > 0);
  const here = layout(s, rooms)[date];
  if (here && !s.sel) { s.sel = here.room.key; save(); return; } // выбрали комнату в календаре — дальше дата переноса
  if (here && s.sel === here.room.key) { delete s.place[here.room.key]; s.sel = ''; s.dirty = true; save(); return; } // снять с даты
  if (s.sel && s.sel !== 'measure') {
    const others = { ...s.place }; delete others[s.sel];
    if (layout({ place: others }, rooms)[date]) { s.sel = here ? here.room.key : s.sel; save(); return; }
    s.place[s.sel] = date; s.sel = ''; s.dirty = true; save();
  }
};
actions['g-ok'] = () => {
  const s = D(); if (!s.dirty && s.status !== 'editing') return;
  const d = S.get().oformit[S.me().id];
  const rooms = estimateRooms(d).filter((r) => s.place[r.key]).map((r) => `${r.name} с ${Number(s.place[r.key].slice(8))}.${s.place[r.key].slice(5, 7)}`);
  logEvent(d, 'Изменён график', [...rooms, s.measure ? `замер ${Number(s.measure.slice(8))}.${s.measure.slice(5, 7)}` : ''].filter(Boolean).join(', '));
  s.status = 'saved'; s.dirty = false; s.sel = ''; save();
};
actions['g-edit'] = () => { const s = D(); if (s.status === 'saved') { s.status = 'editing'; save(); } };
