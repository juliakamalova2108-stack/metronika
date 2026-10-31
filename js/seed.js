// Тестовые данные прототипа. Всё вымышленное; меняется кнопкой «Сбросить демо».

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

export const DEMO_CODE = '1234';

function isoDay(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function makeSeed() {
  return {
    version: 1,
    session: { userId: null, pins: {} },
    nextOrderNo: 1041,
    users: [
      {
        id: 'u-agent', phone: '9001111111', name: 'Алина Смирнова', roles: ['agent'],
        agent: { kind: 'Продавец', shop: 'Салон «Обои на Ленина»', promo: 'ALINA5', plan: 'sub' },
      },
      {
        id: 'u-sergey', phone: '9002222222', name: 'Сергей Волков', roles: ['master'],
        price: { flizelin: 330, vinyl: 360, paper: 380, paint: 290, glass: 390, photo: 580 },
        busy: [isoDay(1), isoDay(2), isoDay(5)],
        rating: 1840,
      },
      {
        id: 'u-ivan', phone: '9003333333', name: 'Иван Петров', roles: ['dispatcher', 'master'],
        price: { flizelin: 360, vinyl: 390, paper: 410, paint: 310, glass: 410, photo: 620 },
        busy: [isoDay(3)],
        rating: 2310,
        team: ['u-andrey'],
      },
      {
        id: 'u-andrey', phone: '9004444444', name: 'Андрей Козлов', roles: ['master'],
        price: { flizelin: 320, vinyl: 350, paper: 370, paint: 280, glass: 380, photo: 560 },
        busy: [isoDay(2)],
        rating: 960,
      },
    ],
    // Партнёрства агента: с подпиской — до 3, мастера и диспетчеры вместе.
    partnerships: [
      { agentId: 'u-agent', partnerId: 'u-sergey', status: 'active' },
      { agentId: 'u-agent', partnerId: 'u-ivan', status: 'active' },
    ],
    materials: [
      { barcode: '4601234567890', brand: 'Erismann', name: 'Elle Decor', type: 'flizelin', width: 1.06, length: 10.05, rapport: 0.64, source: 'maker', status: 'confirmed' },
      { barcode: '4607084950012', brand: 'Палитра', name: 'Мираж', type: 'vinyl', width: 1.06, length: 10.05, rapport: 0.53, source: 'maker', status: 'confirmed' },
      { barcode: '4006296123456', brand: 'Rasch', name: 'Tiles & More', type: 'paper', width: 0.53, length: 10.05, rapport: 0, source: 'maker', status: 'confirmed' },
      { barcode: '4601234500017', brand: 'Erismann', name: 'Фон под покраску', type: 'paint', width: 1.06, length: 25, rapport: 0, source: 'maker', status: 'confirmed' },
    ],
    orders: [],
    links: [],
    settlements: [],
    events: [],
  };
}

// Подсказки для сканера: какие штрихкоды попробовать.
export const DEMO_BARCODES = [
  { code: '4601234567890', hint: 'есть в базе' },
  { code: '4006296123456', hint: 'узкий рулон 0,53' },
  { code: '4609876543210', hint: 'нет в базе' },
];
