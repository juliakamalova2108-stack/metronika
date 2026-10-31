// Справочники и тестовые данные прототипа. Всё вымышленное; «Сбросить демо» возвращает это состояние.

export const WALLPAPER_TYPES = [
  { id: 'flizelin', name: 'Флизелиновые' },
  { id: 'vinyl', name: 'Виниловые на флизелине' },
  { id: 'paper', name: 'Бумажные' },
  { id: 'paint', name: 'Под покраску' },
  { id: 'glass', name: 'Стеклообои' },
  { id: 'photo', name: 'Фотообои' },
];

// Рекомендованный прайс системы для торговых точек, ₽ за м² поклейки.
export const SYSTEM_PRICE = { flizelin: 350, vinyl: 380, paper: 400, paint: 300, glass: 400, photo: 600 };

// Справочник работ по стенам. Цена «Поклейки» берётся из прайса по типу обоев.
// norm — норма выработки в час (м² или пог. м), из неё считается срок в сменах.
export const SERVICES = [
  { id: 'paste', name: 'Поклейка обоев', unit: 'm2', price: null, norm: 2.4 },
  { id: 'strip', name: 'Демонтаж старых обоев', unit: 'm2', price: 150, norm: 4.5 },
  { id: 'prime', name: 'Грунтовка стен', unit: 'm2', price: 100, norm: 8 },
  { id: 'putty', name: 'Шпаклёвка стен', unit: 'm2', price: 200, norm: 3 },
  { id: 'level', name: 'Выравнивание стен', unit: 'm2', price: 300, norm: 2 },
  { id: 'cracks', name: 'Заделка трещин', unit: 'm2', price: 150, norm: 4 },
  { id: 'sand', name: 'Шлифовка стен', unit: 'm2', price: 100, norm: 6 },
  { id: 'mesh', name: 'Монтаж малярной сетки', unit: 'm2', price: 180, norm: 5 },
  { id: 'paint', name: 'Покраска стен', unit: 'm2', price: 250, norm: 6 },
  { id: 'paintwp', name: 'Окраска обоев', unit: 'm2', price: 250, norm: 6 },
  { id: 'skirting', name: 'Монтаж плинтуса', unit: 'm', price: 150, norm: 8 },
];
export const UNIT = { m2: 'м²', m: 'пог. м' };

export const ROOM_NAMES = ['Спальня', 'Гостиная', 'Кухня', 'Коридор', 'Детская', 'Прихожая', 'Кабинет', 'Гардеробная', 'Столовая', 'Санузел', 'Балкон', 'Кладовая', 'Постирочная'];

// Источники заявки — как во вкладке «Канал» макета.
export const CHANNELS = ['Авито', 'Сайт', 'Социальные сети', 'Поиск в интернете', 'Рекомендация', 'Другой интернет-ресурс', 'Визитка', 'Торговая точка', 'Смежники', 'Самостоятельно'];

export const EXPENSE_CATS = ['Покупка материала', 'Авто', 'Реклама', 'Инструмент', 'Прочее'];

export const DEMO_CODE = '1234';

export const DEMO_BARCODES = [
  { code: '4601234567890', hint: 'есть в базе' },
  { code: '4006296123456', hint: 'узкий рулон 0,53' },
  { code: '4609876543210', hint: 'нет в базе' },
];

export const DEMO_DEVICE = 'Bosch GLM 50-27 C';

const p2 = (n) => String(n).padStart(2, '0');
export function isoDay(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
const stamp = (offset, hh = 10) => new Date(`${isoDay(offset)}T${p2(hh)}:00:00`).toISOString();

function defaultSettings() {
  return {
    services: Object.fromEntries(SERVICES.filter((s) => s.price != null).map((s) => [s.id, { price: s.price, norm: s.norm }])),
    workdays: [1, 2, 3, 4, 5, 6],
    hours: { from: '09:00', to: '19:00' },
    notify: { on: true, remind: '18:00' },
    rooms: ROOM_NAMES.slice(),
  };
}
export { defaultSettings };

// Готовая стена для демо-заказов.
const wall = (id, len, height, services, openings = [], src = 'device') => ({ id, len, height, attic: false, openings, services, src });

export function makeSeed() {
  const sergeyPrice = { flizelin: 330, vinyl: 360, paper: 380, paint: 290, glass: 390, photo: 580 };
  const users = [
    {
      id: 'u-agent', phone: '9001111111', name: 'Алина Смирнова', roles: ['agent'],
      agent: { kind: 'Продавец', shop: 'Салон «Обои на Ленина»', promo: 'ALINA5', plan: 'sub' },
      settings: defaultSettings(),
    },
    {
      id: 'u-sergey', phone: '9002222222', name: 'Сергей Волков', roles: ['master'],
      price: sergeyPrice, busy: [isoDay(1), isoDay(2), isoDay(5)], ratingBase: 1758, settings: defaultSettings(),
    },
    {
      id: 'u-ivan', phone: '9003333333', name: 'Иван Петров', roles: ['dispatcher', 'master'],
      price: { flizelin: 360, vinyl: 390, paper: 410, paint: 310, glass: 410, photo: 620 },
      busy: [isoDay(3)], ratingBase: 2310, settings: defaultSettings(), plan: { seats: 3 },
    },
    {
      id: 'u-andrey', phone: '9004444444', name: 'Андрей Козлов', roles: ['master'],
      price: { flizelin: 320, vinyl: 350, paper: 370, paint: 280, glass: 380, photo: 560 },
      busy: [isoDay(2)], ratingBase: 960, settings: defaultSettings(),
    },
    {
      id: 'u-oleg', phone: '9005555555', name: 'Олег Николаев', roles: ['master'],
      price: { flizelin: 340, vinyl: 370, paper: 390, paint: 300, glass: 400, photo: 590 },
      busy: [], ratingBase: 412, settings: defaultSettings(),
    },
  ];

  // Готовые заказы Сергея, чтобы канбан, финансы и статистика не были пустыми.
  const snapS = { types: { ...sergeyPrice }, svc: defaultSettings().services };
  const orders = [
    {
      id: 'o-1031', no: 1031, createdAt: stamp(-9), createdBy: 'u-sergey', leadId: 'u-sergey', status: 'work',
      channel: { source: 'Авито', detail: '', url: '' }, materialType: 'flizelin', priceOwnerId: 'u-sergey', priceSnap: snapS,
      client: { name: 'Марина Кузнецова', phone: '9161234567', street: 'ул. Гагарина', house: '8', entrance: '1', flat: '17', floor: '3', comment: 'Домофон 17К' },
      arrival: `${isoDay(-6)}T11:00`, prelim: null,
      rooms: [
        { id: 'r1', floor: 1, name: 'Спальня', est: [{ svc: 'strip', qty: 30 }, { svc: 'prime', qty: 30 }, { svc: 'paste', qty: 30 }], start: isoDay(-1), end: isoDay(0), assignee: 'u-sergey', done: false,
          walls: [wall('w1', 4.1, 2.7, ['strip', 'prime', 'paste'], [{ type: 'window', w: 1.4, h: 1.5 }]), wall('w2', 3.2, 2.7, ['strip', 'prime', 'paste']), wall('w3', 4.1, 2.7, ['strip', 'prime', 'paste']), wall('w4', 3.2, 2.7, ['strip', 'prime', 'paste'], [{ type: 'door', w: 0.8, h: 2 }])],
          materials: [{ barcode: '4601234567890', qty: 9, note: '' }] },
        { id: 'r2', floor: 1, name: 'Коридор', est: [{ svc: 'prime', qty: 18 }, { svc: 'paste', qty: 18 }], start: isoDay(1), end: isoDay(1), assignee: 'u-sergey', done: false,
          walls: [wall('w5', 5.2, 2.7, ['prime', 'paste'], [{ type: 'door', w: 0.8, h: 2 }, { type: 'door', w: 0.8, h: 2 }]), wall('w6', 1.6, 2.7, ['prime', 'paste'])],
          materials: [] },
      ],
      visits: [
        { id: 'v1', type: 'measure', date: isoDay(-6), time: '11:00', roomIds: null, masterId: 'u-sergey', geo: { at: stamp(-6, 11), lat: 55.7512, lng: 37.6184, demo: true } },
        { id: 'v2', type: 'work', date: isoDay(-1), time: '09:00', roomIds: ['r1'], masterId: 'u-sergey', geo: { at: stamp(-1, 9), lat: 55.7512, lng: 37.6184, demo: true } },
      ],
      smeta: [], chat: [{ authorId: 'u-sergey', text: 'Клиент просит начать со спальни', at: stamp(-5) }],
      tasks: [{ id: 't1', text: 'Купить клей для обоев', assigneeId: 'u-sergey', due: isoDay(0), done: true }, { id: 't2', text: 'Забрать уровень у Ивана', assigneeId: 'u-sergey', due: isoDay(1), done: false }],
      payments: [{ id: 'pay1', amount: 10000, kind: 'Аванс', method: 'Перевод', date: isoDay(-5) }],
      expenses: [{ id: 'ex1', name: 'Клей для обоев', amount: 1200, cat: 'Покупка материала', comment: '' }],
    },
    {
      id: 'o-1027', no: 1027, createdAt: stamp(-25), createdBy: 'u-sergey', leadId: 'u-sergey', status: 'closed', closedAt: stamp(-12),
      channel: { source: 'Рекомендация', detail: '', url: '' }, materialType: 'vinyl', priceOwnerId: 'u-sergey', priceSnap: snapS,
      client: { name: 'Олег Смирнов', phone: '9031112233', street: 'пр. Мира', house: '41', entrance: '', flat: '88', floor: '9', comment: '' },
      arrival: `${isoDay(-22)}T10:00`, prelim: null,
      rooms: [{ id: 'r1', floor: 1, name: 'Гостиная', est: [{ svc: 'paste', qty: 42 }], start: isoDay(-15), end: isoDay(-14), assignee: 'u-sergey', done: true,
        walls: [wall('w1', 5.4, 2.7, ['paste'], [{ type: 'window', w: 1.8, h: 1.5 }]), wall('w2', 4.4, 2.7, ['paste']), wall('w3', 5.4, 2.7, ['paste']), wall('w4', 4.4, 2.7, ['paste'], [{ type: 'door', w: 0.9, h: 2.1 }])],
        materials: [] }],
      visits: [
        { id: 'v1', type: 'measure', date: isoDay(-22), time: '10:00', roomIds: null, masterId: 'u-sergey', geo: { at: stamp(-22), lat: 55.78, lng: 37.63, demo: true } },
        { id: 'v2', type: 'work', date: isoDay(-15), time: '09:00', roomIds: ['r1'], masterId: 'u-sergey', geo: { at: stamp(-15, 9), lat: 55.78, lng: 37.63, demo: true } },
      ],
      smeta: [], chat: [], tasks: [],
      payments: [{ id: 'pay1', amount: 5000, kind: 'Аванс', method: 'Наличные', date: isoDay(-20) }, { id: 'pay2', amount: 9516, kind: 'Оплата', method: 'Перевод', date: isoDay(-14) }],
      expenses: [{ id: 'ex1', name: 'Бензин', amount: 800, cat: 'Авто', comment: '' }],
    },
  ];

  return {
    version: 2,
    session: { userId: null, pins: {} },
    nextOrderNo: 1041,
    users,
    team: [
      { dispatcherId: 'u-ivan', masterId: 'u-andrey', status: 'active', since: isoDay(-60) },
      { dispatcherId: 'u-ivan', masterId: 'u-oleg', status: 'active', since: isoDay(-20) },
    ],
    partnerships: [
      { agentId: 'u-agent', partnerId: 'u-sergey', status: 'active' },
      { agentId: 'u-agent', partnerId: 'u-ivan', status: 'active' },
    ],
    makers: [
      { id: 'mk-erismann', name: 'Erismann', about: 'Немецкие обои на флизелиновой основе. Клей наносится на стену — полотна не размокают и не растягиваются.', tips: ['Клей — на стену, не на полотно', 'Стыковать встык без нахлёста', 'Сохнут 48 часов без сквозняков'], news: [{ title: 'Коллекция Elle Decor', text: 'Новые фактуры под штукатурку, ширина 1,06 м.' }] },
      { id: 'mk-palitra', name: 'Палитра', about: 'Российские виниловые обои на флизелине, большие форматы.', tips: ['Проверять номер партии на всех рулонах', 'Раппорт подбирать до раскроя'], news: [{ title: 'Скидка 10% в салонах-партнёрах', text: 'На коллекцию «Мираж» до конца месяца.' }] },
      { id: 'mk-rasch', name: 'Rasch', about: 'Бумажные и флизелиновые обои, узкий рулон 0,53 м.', tips: ['Бумажные обои клеить внахлёст нельзя', 'Время пропитки клеем — 5–7 минут'], news: [] },
    ],
    materials: [
      { barcode: '4601234567890', brand: 'Erismann', name: 'Elle Decor', type: 'flizelin', width: 1.06, length: 10.05, rapport: 0.64, source: 'maker', status: 'confirmed', makerId: 'mk-erismann' },
      { barcode: '4607084950012', brand: 'Палитра', name: 'Мираж', type: 'vinyl', width: 1.06, length: 10.05, rapport: 0.53, source: 'maker', status: 'confirmed', makerId: 'mk-palitra' },
      { barcode: '4006296123456', brand: 'Rasch', name: 'Tiles & More', type: 'paper', width: 0.53, length: 10.05, rapport: 0, source: 'maker', status: 'confirmed', makerId: 'mk-rasch' },
      { barcode: '4601234500017', brand: 'Erismann', name: 'Фон под покраску', type: 'paint', width: 1.06, length: 25, rapport: 0, source: 'maker', status: 'confirmed', makerId: 'mk-erismann' },
    ],
    reviews: [{ barcode: '4601234567890', authorId: 'u-sergey', text: 'Легко стыкуются. После высыхания швы не разошлись.', at: stamp(-30) }],
    orders,
    links: [],
    settlements: [],
    credits: [{ orderId: 'o-1027', masterId: 'u-sergey', m2: 46.3, at: stamp(-12) }],
    events: [
      { orderId: 'o-1031', actorId: 'u-sergey', role: 'master', action: 'Создан заказ', detail: 'Источник: Авито', at: stamp(-9) },
      { orderId: 'o-1031', actorId: 'u-sergey', role: 'master', action: 'Замер снят', detail: 'Рулетка ' + DEMO_DEVICE, at: stamp(-6, 12) },
      { orderId: 'o-1031', actorId: 'u-sergey', role: 'master', action: 'Получен аванс', detail: '10 000 ₽ · Перевод', at: stamp(-5) },
      { orderId: 'o-1027', actorId: 'u-sergey', role: 'master', action: 'Заказ закрыт', detail: 'В рейтинг зачтено 46,3 м²', at: stamp(-12) },
    ],
  };
}
