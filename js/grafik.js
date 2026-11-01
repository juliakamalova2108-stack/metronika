// «Оформить заказ» → вкладка «График». Один в один с секцией «Выезды · 03 · График» в Figma.
// Комнаты из «Оценки» делятся на рабочие дни (смена 8 ч): выбрали комнату → нажали свободную дату →
// её дни легли подряд. Переключатель «Замеры» — то же для выезда на замер (2 часа).

import { actions, rerender } from './core.js?v=81';
import * as S from './store.js?v=81';
import { SHIFT_HOURS } from './calc.js?v=81';
import { esc, toast } from './ui.js?v=81';
import { logEvent } from './zlog.js?v=81';
import { estimateRooms, roomTotals } from './ocenka.js?v=81';

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

// Где лежат дни комнат. В дне — смена (8 ч). Комнаты раскладываются в том порядке, в котором их ставили:
// уже поставленные никогда не сдвигаются. Новая комната начинается с выбранной даты сразу после того,
// что уже стоит в этом дне, и идёт дальше по дням подряд — поэтому её ставят, только если ей хватает места (fits).
const EPS = 1e-6;
function layout(s, rooms) {
  const byDate = {};
  const keys = Object.keys(s.place || {});
  const order = keys.map((k) => rooms.find((r) => r.key === k)).filter(Boolean);
  order.forEach((r) => {
    const t = roomTotals(r);
    let left = t.hours;
    let day = s.place[r.key];
    let i = 0;
    while (left > EPS && i < 400) {
      const segs = byDate[day] || [];
      const used = segs.reduce((a, x) => a + x.hours, 0);
      const free = SHIFT_HOURS - used;
      if (free > EPS) {
        const h = Math.min(free, left);
        byDate[day] = [...segs, { room: r, hours: h, from: used, cost: Math.round((t.total * h) / t.hours) }];
        left -= h;
      }
      day = addDays(day, 1); i += 1;
    }
  });
  return byDate;
}
// Хватает ли комнате места с этой даты: остаток выбранного дня и дальше целые свободные дни подряд,
// пока не наберутся её часы. Упёрлись в день, где уже стоит другая комната, — не помещается.
function fits(lay, hours, date) {
  let left = hours; let day = date; let avail = 0;
  const first = SHIFT_HOURS - usedOn(lay[date]);
  if (first <= EPS) return { ok: false, avail: 0 };
  avail = first; left -= first; day = addDays(day, 1);
  while (left > EPS) {
    if ((lay[day] || []).length) return { ok: false, avail };
    avail += SHIFT_HOURS; left -= SHIFT_HOURS; day = addDays(day, 1);
  }
  return { ok: true, avail };
}
const hTxt = (h) => { const d = Math.floor(h / SHIFT_HOURS + EPS); const r = Math.round(h - d * SHIFT_HOURS); return [d ? `${d} дн` : '', r ? `${r} ч` : ''].filter(Boolean).join(' ') || '0 ч'; };
const usedOn = (segs) => (segs || []).reduce((a, x) => a + x.hours, 0);

// Плашка комнаты в «Без даты»: одна на комнату — название и сумма, клетки смен (неполная закрашена на долю дня), срок.
function trainChip(r, n) {
  const t = roomTotals(r);
  const cars = roomDays(r).map((x) => `<span class="g-car" style="background:${hexA(r.color, 0.22)}"><i style="background:${r.color};width:${((x.hours / SHIFT_HOURS) * 100).toFixed(1)}%"></i></span>`).join('');
  return `<button type="button" class="g-train${n ? ' is-sel' : ''}" style="--rc:${r.color};--rcA:${hexA(r.color, 0.28)};--rcG:${hexA(r.color, 0.6)}" data-action="g-pick" data-key="${r.key}" aria-pressed="${!!n}">
    ${n ? `<b class="g-train__n">${n}</b>` : ''}<span class="g-train__hd"><span>${esc(r.name)}</span><span>${fmt(t.total)} ₽</span></span>
    <span class="g-train__cars">${cars}</span><span class="g-train__ft">${shiftsTxt(t.hours)}</span></button>`;
}
const shiftsTxt = (h) => { const d = Math.floor(h / SHIFT_HOURS + 1e-6); const r = Math.round(h - d * SHIFT_HOURS); return [d ? `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}` : '', r ? `${r} ч` : ''].filter(Boolean).join(' ') || '0 ч'; };
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
      const segs = lay[date];
      const sel = segs.some((x) => s.sel === x.room.key);
      const one = segs.length === 1 && segs[0].hours >= SHIFT_HOURS - EPS;
      // Доля дня каждой комнаты — полоса своего цвета; свободный остаток дня — бледный.
      const bars = one ? '' : segs.map((x) => `<i class="g-chip__fill" style="background:${x.room.color};left:${((x.from / SHIFT_HOURS) * 100).toFixed(1)}%;width:${((x.hours / SHIFT_HOURS) * 100).toFixed(1)}%"></i>`).join('');
      const style = one ? `background:${segs[0].room.color}` : `background:${hexA(segs[segs.length - 1].room.color, 0.18)}`;
      const text = segs.length === 1 ? `<span>${esc(segs[0].room.name)}</span><span>${fmt(segs[0].cost)}</span>` : segs.map((x) => `<span>${esc(x.room.name)}</span>`).join('');
      cells.push(`<button type="button" class="g-cell g-cell--work${sel ? ' is-sel' : ''}${segs.length > 1 ? ' g-cell--multi' : ''}" style="${style}" ${act} aria-label="${dd}, ${esc(segs.map((x) => x.room.name).join(' и '))}">
        ${bars}<b>${dd}</b>${text}</button>`);
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
    todo = `<section class="g-todo"><p class="g-todo__t">Без даты</p><p class="g-todo__x">Выберите одну или несколько комнат и нажмите на дату</p>
      <div class="g-tray">${pending.map((r) => trainChip(r, (s.picks || []).indexOf(r.key) + 1)).join('')}</div></section>`;
  }
  const editing = s.dirty || s.status === 'editing';
  const status = editing ? '<span class="f-status f-status--warn g-status"><i></i>редактирование</span>' : locked ? '<span class="f-status f-status--ok g-status"><i></i>сохранено</span>' : '';
  return `<i class="f-one" hidden></i><div class="g-screen f-fill"><button type="button" class="o-row g-mode" role="switch" aria-checked="${s.mode === 'measure'}" data-action="g-mode"><span class="o-row__name">Замеры</span><span class="o-tog${s.mode === 'measure' ? ' is-on' : ''}" aria-hidden="true"><i></i></span></button>
    ${todo}
    <section class="f-plate g-plate"><p class="g-plate__t">Запланированы</p>${status}${calendar(s, rooms, lay, locked)}</section>
    <div class="f-btn-row">
      <button type="button" class="f-btn${locked ? ' f-btn--saved' : ''}" data-action="g-ok" ${!locked && !s.dirty && s.status !== 'editing' ? 'disabled' : ''}>ОК</button>
      ${s.status !== 'new' ? `<button type="button" class="f-btn${s.status === 'editing' ? ' f-btn--editing' : ''}" data-action="g-edit">${s.status === 'editing' ? 'Редактирование' : 'Редактировать'}</button>` : ''}
    </div></div>`;
}

// ---------- действия ----------
const D = () => sch(S.get().oformit[S.draftKey()]);
const save = () => { S.save(); rerender(); };
const editable = (s) => s.status !== 'saved';

actions['g-mode'] = () => { const s = D(); s.mode = s.mode === 'rooms' ? 'measure' : 'rooms'; s.sel = ''; s.picks = []; save(); };
actions['g-pick'] = (el) => {
  const s = D(); if (!editable(s)) return;
  const k = el.dataset.key;
  if (k === 'measure') { s.sel = s.sel === k ? '' : k; save(); return; }
  // Комнаты в «Без даты» отмечаются по одной или несколько; порядок отметки = порядок на календаре.
  s.picks = s.picks || []; s.sel = '';
  s.picks = s.picks.includes(k) ? s.picks.filter((x) => x !== k) : [...s.picks, k];
  save();
};
// Поставить отмеченные комнаты подряд с даты: каждая следующая — сразу за предыдущей (в остаток её дня, если есть).
// Не хватает места хотя бы одной — не ставится ни одна.
function placeChain(s, rooms, keys, date) {
  const tmp = { ...s.place }; keys.forEach((k) => delete tmp[k]);
  let start = date;
  for (const k of keys) {
    const room = rooms.find((r) => r.key === k); if (!room) continue;
    const need = roomTotals(room).hours;
    const f = fits(layout({ place: tmp }, rooms), need, start);
    if (!f.ok) return { fail: room, start, avail: f.avail, need };
    tmp[k] = start;
    const lay = layout({ place: tmp }, rooms);
    let last = start; for (let d = start, i = 0; i < 400; d = addDays(d, 1), i += 1) { if ((lay[d] || []).some((x) => x.room.key === k)) last = d; else if (d > last) break; }
    start = usedOn(lay[last]) < SHIFT_HOURS - EPS ? last : addDays(last, 1);
  }
  return { place: tmp };
}
actions['g-month'] = (el) => {
  const s = D(); const [Y, M] = s.month.split('-').map(Number);
  const d = new Date(Y, M - 1 + Number(el.dataset.d), 1); s.month = `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; save();
};
actions['g-day'] = (el) => {
  const s = D(); if (!editable(s)) return;
  const date = el.dataset.date;
  const d = S.get().oformit[S.draftKey()];
  if (s.mode === 'measure') {
    if (s.measure === date) { s.measure = ''; s.sel = ''; s.dirty = true; save(); return; } // замер снят с даты
    if (s.sel === 'measure' || s.measure) { s.measure = date; s.sel = ''; s.dirty = true; save(); }
    return;
  }
  const rooms = estimateRooms(d).filter((r) => roomTotals(r).hours > 0);
  if ((s.picks || []).length) {
    const res = placeChain(s, rooms, s.picks, date);
    if (res.fail) { toast(`«${res.fail.name}» не помещается: с ${Number(res.start.slice(8))}-го свободно ${hTxt(res.avail)}, а нужно ${hTxt(res.need)}`); return; }
    s.place = res.place; s.picks = []; s.sel = ''; s.dirty = true; save(); return;
  }
  const segs = layout(s, rooms)[date] || [];
  const mine = segs.find((x) => x.room.key === s.sel);
  // Нажали на день с комнатами без выбора — выбирается последняя комната дня (её можно перенести или снять).
  if (segs.length && !s.sel) { s.sel = segs[segs.length - 1].room.key; save(); return; }
  if (mine) { delete s.place[mine.room.key]; s.sel = ''; s.dirty = true; save(); return; } // снять с даты
  if (s.sel && s.sel !== 'measure') {
    const others = { ...s.place }; delete others[s.sel];
    const lay0 = layout({ place: others }, rooms);
    // В дне не осталось свободных часов — ставить нельзя, выбираем то, что там стоит.
    if (usedOn(lay0[date]) >= SHIFT_HOURS - EPS) { s.sel = segs.length ? segs[segs.length - 1].room.key : s.sel; save(); return; }
    const room = rooms.find((r) => r.key === s.sel);
    const need = room ? roomTotals(room).hours : 0;
    const f = fits(lay0, need, date);
    if (!f.ok) { toast(`«${room.name}» не помещается: с ${Number(date.slice(8))}-го свободно ${hTxt(f.avail)}, а нужно ${hTxt(need)}`); return; }
    delete s.place[s.sel]; // ставим заново — комната встаёт после уже стоящих в этот день
    s.place[s.sel] = date; s.sel = ''; s.dirty = true; save();
  }
};
actions['g-ok'] = () => {
  const s = D(); if (!s.dirty && s.status !== 'editing') return;
  const d = S.get().oformit[S.draftKey()];
  const rooms = estimateRooms(d).filter((r) => s.place[r.key]).map((r) => `${r.name} с ${Number(s.place[r.key].slice(8))}.${s.place[r.key].slice(5, 7)}`);
  logEvent(d, 'Изменён график', [...rooms, s.measure ? `замер ${Number(s.measure.slice(8))}.${s.measure.slice(5, 7)}` : ''].filter(Boolean).join(', '));
  s.status = 'saved'; s.dirty = false; s.sel = ''; s.picks = []; save();
  document.dispatchEvent(new CustomEvent('section-saved', { detail: 'schedule' }));
};
actions['g-edit'] = () => { const s = D(); if (s.status === 'saved') { s.status = 'editing'; save(); } };
