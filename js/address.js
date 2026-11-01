// Подсказки адресов. Пока ПРИМЕРНЫЕ: несколько улиц нескольких городов, чтобы показать, как это работает.
// Потом здесь будет запрос к сервису подсказок (например, DaData): ответ тот же — город, улица, дом.
// Номер дома в запросе («айская 35.1», «ленина 5а») переносится в подсказку и потом — в поле «Дом».

const DEMO = {
  'Уфа': ['ул Айская', 'ул Ленина', 'пр-кт Октября', 'ул Менделеева', 'ул Комсомольская', 'ул Российская', 'ул Кирова', 'ул Пушкина',
    'ул Гоголя', 'ул Цюрупы', 'ул Достоевского', 'ул Рихарда Зорге', 'ул Бакалинская', 'ул Заки Валиди', 'ул Мингажева',
    'ул Революционная', 'ул Чернышевского', 'ул Карла Маркса', 'ул Энтузиастов', 'ул Габдуллы Амантая', 'ул Аксакова', 'ул Лесотехникума'],
  'Казань': ['ул Баумана', 'ул Пушкина', 'пр-кт Победы', 'ул Ленина', 'ул Чистопольская', 'ул Декабристов'],
  'Москва': ['ул Тверская', 'ул Арбат', 'пр-кт Мира', 'ул Ленинская Слобода', 'Ленинский пр-кт'],
  'Стерлитамак': ['ул Ленина', 'пр-кт Октября', 'ул Худайбердина', 'ул Артёма'],
};
const HOME_CITY = 'Уфа'; // потом — город мастера из настроек

const bare = (s) => s.toLowerCase().replace(/^(ул|пр-кт|пер|б-р|ш)\s+/, '').replace(/\s+(пр-кт)$/, '');

export function suggestAddress(query) {
  const q = String(query || '').toLowerCase().replace(/ё/g, 'е').replace(/[,]/g, ' ').trim();
  if (q.length < 2) return [];
  // Дом — последнее слово, если начинается с цифры: 35, 35.1, 35/1, 5а, 12к2.
  const m = q.match(/(?:^|\s)(?:д\.?\s*)?(\d+[а-яa-z]?(?:\s*[./\-к]\s*\d+)?)$/);
  const house = m ? m[1].replace(/\s+/g, '').replace(/[.\-]/, '/') : '';
  const words = (m ? q.slice(0, m.index) : q).split(/\s+/).filter((w) => w && !/^(г|ул|д|город|улица|дом|пр|пр-кт|проспект|пер|переулок|б-р|бульвар)\.?$/.test(w));
  if (!words.length) return [];
  const out = [];
  for (const [city, streets] of Object.entries(DEMO)) {
    const cityHit = words.some((w) => city.toLowerCase().replace(/ё/g, 'е').startsWith(w));
    const rest = cityHit ? words.filter((w) => !city.toLowerCase().replace(/ё/g, 'е').startsWith(w)) : words;
    for (const st of streets) {
      const name = bare(st).replace(/ё/g, 'е');
      const ok = rest.length ? rest.every((w) => name.split(/[\s-]+/).some((p) => p.startsWith(w))) : cityHit;
      if (!ok) continue;
      out.push({ city, street: st, house, score: (cityHit ? 0 : city === HOME_CITY ? 1 : 2) });
    }
  }
  return out.sort((a, b) => a.score - b.score).slice(0, 3)
    .map(({ city, street, house }) => ({ city, street, house, address: `г ${city}, ${street}`, label: `г ${city}, ${street}${house ? ', д ' + house : ''}` }));
}
