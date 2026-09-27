// Игровые данные: нации, звания, оружие, кампания.
// Структура званий и значения здоровья/урона взяты из описаний Hogs of War (2000);
// где оригинал не указывает число, стоит наш баланс (помечено комментарием «баланс»).

export const INF = -1; // бесконечный боезапас

export const NATIONS = {
  uk:   { id: 'uk',   name: 'Королевские Окорока', short: 'Окорока',  color: 0x6E7B3C, css: '#8E9C52', hat: 'brodie',
          names: ['Бекон', 'Шпик', 'Окорок', 'Рулька', 'Грудинка', 'Пятачков', 'Сэр Хрюк', 'Капрал Сосиск'] },
  fr:   { id: 'fr',   name: 'Чесночные Хрюны',     short: 'Хрюны',    color: 0x2E4A8C, css: '#5B7BC4', hat: 'adrian',
          names: ['Жан-Хрю', 'Паштет', 'Багет', 'Фуа-Гра', 'Лярд', 'Кассуле', 'Пьер Сало', 'Шарль Хрюмон'] },
  de:   { id: 'de',   name: 'Колбасный Легион',    short: 'Легион',   color: 0x6F767C, css: '#9AA2A8', hat: 'pickel',
          names: ['Вурст', 'Шницель', 'Айсбайн', 'Брецель', 'Клаус', 'Фриц Шпек', 'Отто Хрюн', 'Ганс Сарделька'] },
  us:   { id: 'us',   name: 'Ковбойская Грудинка', short: 'Ковбои',   color: 0x5E93C8, css: '#86B6E4', hat: 'cowboy',
          names: ['Техас', 'Барбекю', 'Джек Бекон', 'Хот-Дог', 'Стейк', 'Бадди', 'Реднек', 'Шериф Хрю'] },
  ru:   { id: 'ru',   name: 'Сальная Гвардия',     short: 'Гвардия',  color: 0xAE3228, css: '#D8584C', hat: 'ushanka',
          names: ['Сальцев', 'Холодцов', 'Шкварко', 'Пельменин', 'Буженин', 'Хрюмов', 'Окорочкин', 'Салов'] },
  jp:   { id: 'jp',   name: 'Самурайский Шпик',    short: 'Самураи',  color: 0xD6AA2E, css: '#EAC454', hat: 'visor',
          names: ['Тонкацу', 'Буташи', 'Хрюмото', 'Рамэн', 'Гёдза', 'Сакэ-сан', 'Мисо', 'Кацудон'] },
  lard: { id: 'lard', name: 'Орден Сала',          short: 'Орден',    color: 0x6B3A8C, css: '#9C6BC0', hat: 'horned', enemyOnly: true,
          names: ['Великий Жир', 'Магистр Шкварк', 'Сальвадор', 'Жиробас', 'Лордосал', 'Барон Смалец'] },
};
export const PLAYABLE_NATIONS = ['uk', 'fr', 'de', 'us', 'ru', 'jp'];

// Звания. line: ветка; level: 0 — рядовой, 1–3 — ступени ветки, 4 — коммандо, 5 — герой.
// cost — очки повышения за переход на это звание (оригинал: Бомбардир 2, Герой 8; остальное — баланс).
export const RANKS = {
  grunt:      { name: 'Рядовой',      line: 'base',   level: 0, hp: 50,  cost: 0, next: ['gunner', 'sapper', 'scout', 'orderly'],
                load: { knife: INF, rifle: INF, grenade: 3 } },
  gunner:     { name: 'Стрелок',      line: 'heavy',  level: 1, hp: 75,  cost: 1, next: ['bombardier'],
                load: { trotter: INF, pistol: INF, bazooka: 3 } },
  bombardier: { name: 'Бомбардир',    line: 'heavy',  level: 2, hp: 90,  cost: 2, next: ['pyrotech'],
                load: { trotter: INF, pistol: INF, mortar: 3, bazooka: 3 } },
  pyrotech:   { name: 'Пиротехник',   line: 'heavy',  level: 3, hp: 120, cost: 4, next: ['commando'],
                load: { trotter: INF, pistol: INF, flamethrower: 3, mortar: 3, bazooka: 3, airburst: 1 } },
  sapper:     { name: 'Сапёр',        line: 'eng',    level: 1, hp: 80,  cost: 1, next: ['engineer'],
                load: { trotter: INF, shotgun: INF, mine: 3, tnt: 1 } },
  engineer:   { name: 'Инженер',      line: 'eng',    level: 2, hp: 100, cost: 2, next: ['saboteur'],
                load: { trotter: INF, shotgun: INF, shrapnel: 3, mine: 3, tnt: 2, suicide: 1 } },
  saboteur:   { name: 'Диверсант',    line: 'eng',    level: 3, hp: 120, cost: 4, next: ['commando'],
                load: { trotter: INF, supershotgun: INF, shrapnel: 3, mine: 3, tnt: 3, suicide: 1 } },
  scout:      { name: 'Разведчик',    line: 'spy',    level: 1, hp: 75,  cost: 1, next: ['sniper'],
                load: { knife: INF, rifle: INF, gas: 1, pickpocket: 1, hide: 1 } },
  sniper:     { name: 'Снайпер',      line: 'spy',    level: 2, hp: 90,  cost: 2, next: ['spy'],
                load: { knife: INF, sniper: INF, gas: 1, suicide: 1, pickpocket: 2, hide: 1 } },
  spy:        { name: 'Шпион',        line: 'spy',    level: 3, hp: 120, cost: 4, next: ['commando'],
                load: { knife: INF, prod: INF, sniper: INF, gas: 1, tnt: 1, pickpocket: 3, hide: 1 } },
  orderly:    { name: 'Санитар',      line: 'medic',  level: 1, hp: 60,  cost: 1, next: ['medic'],
                load: { knife: INF, rifle: INF, grenade: 1, healhands: 3 } },
  medic:      { name: 'Медик',        line: 'medic',  level: 2, hp: 80,  cost: 2, next: ['surgeon'],
                load: { knife: INF, rifle: INF, meddart: 3, grenade: 3, medball: 3, healhands: 3 } },
  surgeon:    { name: 'Хирург',       line: 'medic',  level: 3, hp: 120, cost: 4, next: ['commando'],
                load: { knife: INF, rifle: INF, rifleburst: 3, meddart: 3, tranq: 1, grenade: 3, medball: 3, healhands: 3 } },
  commando:   { name: 'Коммандо',     line: 'officer', level: 4, hp: 130, cost: 6, next: ['hero'],
                load: { knife: INF, mg: INF, sniper: INF, meddart: 3, cluster: 1, gas: 1, bazooka: 1, airburst: 1, tnt: 1, jetpack: 1, hide: 1 } },
  hero:       { name: 'Герой',        line: 'officer', level: 5, hp: 150, cost: 8, next: [],
                load: { sword: INF, hmg: INF, sniper: INF, meddart: 1, cluster: 1, gas: 1, bazooka: 1, airburst: 1, tnt: 1, jetpack: 1, selfheal: 1, hide: 1, airstrike: 1 } },
  legend:     { name: 'Легенда',      line: 'officer', level: 6, hp: 200, cost: 99, next: [], enemyOnly: true,
                load: { sword: INF, mg: INF, sniper: INF, tranq: 1, firerain: 1, meddart: 3, cluster: 1, gas: 1, bazooka: 1, airburst: 1, tnt: 1, jetpack: 1, selfheal: 1, hide: 1, airstrike: 1, shockwave: 1 } },
};
export const LINES = {
  base: { name: 'Базовая подготовка', color: '#B5A47F' },
  heavy: { name: 'Тяжёлое вооружение', color: '#D8703A' },
  eng: { name: 'Инженерные войска', color: '#C9A33A' },
  spy: { name: 'Разведка', color: '#6FA06B' },
  medic: { name: 'Медслужба', color: '#E06A6A' },
  officer: { name: 'Офицеры', color: '#E8B84A' },
};

// Оружие и снаряжение.
// kind определяет механику; dmg — максимальный урон; r — радиус взрыва (м).
// Значения урона винтовки, пистолета, дробовиков, снайперки, огнемёта, очереди, пулемёта, базуки,
// осколочной и кассетной гранат, шрапнельного залпа — по описаниям оригинала; остальное — баланс.
export const WEAPONS = {
  // ближний бой
  knife:   { name: 'Нож',            cat: 'melee', kind: 'melee', dmg: 15, range: 2.0, push: 3, desc: 'Удар в упор.' },
  trotter: { name: 'Копыто',         cat: 'melee', kind: 'melee', dmg: 12, range: 2.0, push: 9, desc: 'Мощный пинок: отбрасывает врага. Можно столкнуть в воду или с обрыва.' },
  sword:   { name: 'Сабля',          cat: 'melee', kind: 'melee', dmg: 30, range: 2.3, push: 5, desc: 'Офицерская сабля.' },
  prod:    { name: 'Электрошокер',   cat: 'melee', kind: 'melee', dmg: 25, range: 2.2, push: 12, stun: true, desc: 'Разряд отбрасывает и оглушает: враг пропустит ход.' },
  // стрелковое
  pistol:  { name: 'Пистолет',       cat: 'gun', kind: 'hitscan', dmg: 20, range: 35, spread: 0.02, desc: 'Одиночный выстрел.' },
  rifle:   { name: 'Винтовка',       cat: 'gun', kind: 'hitscan', dmg: 20, range: 60, spread: 0.012, desc: 'Точный выстрел на средней дистанции.' },
  rifleburst: { name: 'Очередь',     cat: 'gun', kind: 'burst', dmg: 15, shots: 3, range: 55, spread: 0.025, desc: 'Три выстрела подряд, до 45 урона.' },
  sniper:  { name: 'Снайперская винтовка', cat: 'gun', kind: 'hitscan', dmg: 40, range: 140, spread: 0.002, scope: true, desc: 'Оптический прицел: переключите вид кнопкой «Прицел».' },
  tranq:   { name: 'Транквилизатор', cat: 'gun', kind: 'hitscan', dmg: 10, range: 80, spread: 0.004, sleep: true, scope: true, desc: 'Усыпляет цель: она пропустит следующий ход.' },
  mg:      { name: 'Пулемёт',        cat: 'gun', kind: 'burst', dmg: 4, shots: 5, range: 50, spread: 0.035, desc: 'Очередь из пяти пуль.' },
  hmg:     { name: 'Тяжёлый пулемёт', cat: 'gun', kind: 'burst', dmg: 5, shots: 8, range: 60, spread: 0.03, desc: 'Длинная очередь из восьми пуль.' },
  shotgun: { name: 'Дробовик',       cat: 'gun', kind: 'spread', dmg: 5, pellets: 6, range: 22, spread: 0.08, desc: 'Сноп дроби, до 30 урона вблизи.' },
  supershotgun: { name: 'Двустволка', cat: 'gun', kind: 'spread', dmg: 3.75, pellets: 8, range: 26, spread: 0.06, desc: 'Плотный сноп, 30 урона при полном попадании.' },
  flamethrower: { name: 'Огнемёт',   cat: 'heavy', kind: 'flame', dmg: 30, range: 9, desc: 'Струя огня на короткой дистанции. Поджигает цель.' },
  // тяжёлое и метательное
  bazooka: { name: 'Базука',         cat: 'heavy', kind: 'ballistic', dmg: 50, r: 4.2, speed: 44, wind: true, desc: 'Ракета взрывается при попадании. Сила выстрела — длительностью нажатия.' },
  mortar:  { name: 'Миномёт',        cat: 'heavy', kind: 'ballistic', dmg: 60, r: 6.5, speed: 40, high: true, desc: 'Навесной огонь по площади: бьёт за укрытия.' },
  airburst:{ name: 'Шрапнельный залп', cat: 'heavy', kind: 'ballistic', dmg: 40, r: 4, speed: 42, burst: 3, burstDmg: 20, desc: 'Снаряд рвётся над целью и сыплет ещё три заряда по 20.' },
  firerain:{ name: 'Огненный дождь', cat: 'heavy', kind: 'ballistic', dmg: 30, r: 4, speed: 42, burst: 5, burstDmg: 20, fire: true, desc: 'Снаряд раскрывается над целью горящим дождём.' },
  grenade: { name: 'Граната',        cat: 'explosive', kind: 'grenade', dmg: 40, r: 4.5, speed: 26, fuse: 3, desc: 'Отскакивает от земли, взрывается через 3 секунды.' },
  shrapnel:{ name: 'Осколочная граната', cat: 'explosive', kind: 'grenade', dmg: 30, r: 4, speed: 26, fuse: 3, frags: 6, fragDmg: 15, desc: 'Взрыв и разлёт осколков по 15 урона.' },
  cluster: { name: 'Кассетная граната', cat: 'explosive', kind: 'grenade', dmg: 25, r: 3.5, speed: 26, fuse: 3, cluster: 5, clusterDmg: 20, desc: 'Разлетается на пять малых бомб.' },
  gas:     { name: 'Ядовитый газ',   cat: 'explosive', kind: 'grenade', dmg: 5, r: 5.5, speed: 26, fuse: 2.5, poison: true, desc: 'Облако отравляет: отравленный теряет здоровье каждый ход, пока его не вылечат.' },
  medball: { name: 'Лечебный шар',   cat: 'support', kind: 'grenade', dmg: 0, heal: 30, r: 4.5, speed: 22, fuse: 1.5, desc: 'Лопается и лечит всех рядом на 30, снимает отравление.' },
  mine:    { name: 'Мина',           cat: 'explosive', kind: 'place', dmg: 45, r: 4, desc: 'Ставится под ноги. Срабатывает, когда рядом окажется свинья.' },
  tnt:     { name: 'Динамит',        cat: 'explosive', kind: 'place', dmg: 75, r: 6.5, fuse: 5, desc: 'Ставится под ноги. 5 секунд, чтобы убежать.' },
  suicide: { name: 'Самоподрыв',     cat: 'explosive', kind: 'suicide', dmg: 100, r: 7.5, desc: 'Последний аргумент. Свинья погибает.' },
  airstrike:{ name: 'Авиаудар',      cat: 'special', kind: 'airstrike', dmg: 30, r: 4, bombs: 5, desc: 'Бомбардировщик сбрасывает пять бомб по отмеченной точке.' },
  shockwave:{ name: 'Ударная волна', cat: 'special', kind: 'shockwave', dmg: 25, r: 11, desc: 'Сбивает всех вокруг с ног.' },
  // поддержка
  healhands:{ name: 'Лечащие руки',  cat: 'support', kind: 'healtouch', heal: 20, range: 2.6, free: true, desc: 'Лечит соседа на 20 и снимает отравление. Не заканчивает ход.' },
  meddart: { name: 'Лечебный дротик', cat: 'support', kind: 'healdart', heal: 25, range: 60, desc: 'Выстрел по союзнику лечит на 25 и снимает отравление.' },
  selfheal:{ name: 'Самолечение',    cat: 'support', kind: 'selfheal', heal: 50, free: true, desc: '+50 здоровья себе. Не заканчивает ход.' },
  medkit:  { name: 'Аптечка',        cat: 'support', kind: 'selfheal', heal: 40, free: true, desc: '+40 здоровья себе. Не заканчивает ход.' },
  jetpack: { name: 'Реактивный ранец', cat: 'special', kind: 'jetpack', fuel: 5, free: true, desc: 'Полёт на 5 секунд: держите «Прыжок», чтобы набирать высоту.' },
  hide:    { name: 'Маскировка',     cat: 'special', kind: 'hide', desc: 'Свинья прячется: враги не видят её, урон по ней вдвое меньше до её следующего хода.' },
  pickpocket:{ name: 'Карманник',    cat: 'special', kind: 'pickpocket', range: 2.6, free: true, desc: 'Украсть предмет у соседнего врага. Не заканчивает ход.' },
};
export const CATS = [
  ['melee', 'Ближний бой'], ['gun', 'Стрелковое'], ['heavy', 'Тяжёлое'],
  ['explosive', 'Взрывчатка'], ['support', 'Медицина'], ['special', 'Особое'],
];
// Оружие, которое может выпасть из ящика.
export const CRATE_POOL = ['grenade', 'grenade', 'bazooka', 'bazooka', 'mortar', 'shrapnel', 'cluster', 'gas', 'mine', 'tnt', 'airstrike',
  'medkit', 'medkit', 'meddart', 'jetpack', 'airburst', 'flamethrower', 'hide', 'rifleburst'];

// Темы оформления карт.
export const THEMES = {
  farm:   { name: 'Ферма',     sky: [0x7fa7c4, 0xd9d1b0], fog: [140, 330], hemi: [0xe4eef0, 0x6b5436, 0.85], sun: [0xfff0d0, 0.95], water: 0x3d6a78, poison: false,
            grass: [0.42, 0.56, 0.24], dry: [0.55, 0.52, 0.27], dirt: [0.47, 0.35, 0.22], rock: [0.52, 0.5, 0.45], sand: [0.78, 0.7, 0.5], trees: ['oak', 'pine'], weather: null },
  swamp:  { name: 'Болото',    sky: [0x6c7a68, 0xa7ab8c], fog: [60, 190], hemi: [0xc2c8b0, 0x3d3a24, 0.9], sun: [0xe8e0c0, 0.55], water: 0x4a6a2c, poison: true,
            grass: [0.33, 0.42, 0.2], dry: [0.4, 0.4, 0.24], dirt: [0.33, 0.27, 0.17], rock: [0.4, 0.4, 0.35], sand: [0.45, 0.42, 0.3], trees: ['dead', 'willow'], weather: 'spores' },
  snow:   { name: 'Зима',      sky: [0x8ea8c0, 0xe3e8ec], fog: [90, 260], hemi: [0xf0f4ff, 0x7a7a88, 0.95], sun: [0xfff6ea, 0.75], water: 0x4f7890, poison: false,
            grass: [0.92, 0.94, 0.97], dry: [0.84, 0.87, 0.92], dirt: [0.5, 0.45, 0.4], rock: [0.55, 0.56, 0.6], sand: [0.7, 0.72, 0.75], trees: ['snowpine'], weather: 'snow' },
  desert: { name: 'Пустыня',   sky: [0x6fa0d0, 0xf0d9a8], fog: [150, 360], hemi: [0xfff1d8, 0x8a6a3a, 0.8], sun: [0xffe6b0, 1.05], water: 0x3f8a92, poison: false,
            grass: [0.85, 0.72, 0.46], dry: [0.8, 0.66, 0.4], dirt: [0.7, 0.52, 0.32], rock: [0.62, 0.48, 0.34], sand: [0.9, 0.8, 0.56], trees: ['palm', 'cactus'], weather: 'dust' },
  lard:   { name: 'Остров Сала', sky: [0x3a2a48, 0xb07a8a], fog: [80, 240], hemi: [0xd8b8d0, 0x3a2430, 0.75], sun: [0xffc0a0, 0.8], water: 0x5c8a2a, poison: true,
            grass: [0.4, 0.48, 0.26], dry: [0.5, 0.42, 0.3], dirt: [0.4, 0.3, 0.22], rock: [0.42, 0.38, 0.4], sand: [0.6, 0.55, 0.45], trees: ['dead', 'pine'], weather: 'embers' },
};

// Кампания: 4 региона по 3 операции и финал.
// enemies: список званий врагов; squad: сколько свиней берёт игрок.
// structures: доты (pillbox), танки (tank), гаубицы (artillery), дома, мешки с песком, мосты.
export const REGIONS = [
  { id: 'r1', name: 'Свинская ферма', theme: 'farm' },
  { id: 'r2', name: 'Сальные болота', theme: 'swamp' },
  { id: 'r3', name: 'Хрюкоград', theme: 'snow' },
  { id: 'r4', name: 'Пустыня Шкварок', theme: 'desert' },
  { id: 'r5', name: 'Остров Сала', theme: 'lard' },
];
export const MISSIONS = [
  { id: 1, region: 'r1', name: 'Первая кровь', enemy: 'de', squad: 3, turnTime: 60, terrain: 'hills', seed: 11,
    enemies: ['grunt', 'grunt', 'grunt'], ai: 2.2, objective: { type: 'elim' },
    brief: 'Колбасный Легион занял холмы у фермы. Ваши рядовые получили винтовки, ножи и по три гранаты. Выбейте противника.',
    tips: ['Зажмите «Огонь», чтобы набрать силу броска гранаты.', 'Пока свинья бежит, стрелять нельзя: остановитесь и прицельтесь.'],
    props: { houses: 2, sandbags: 3, fences: 5, crates: 2, barrels: 3 } },
  { id: 2, region: 'r1', name: 'Окопная правда', enemy: 'fr', squad: 4, turnTime: 45, terrain: 'trenches', seed: 22,
    enemies: ['grunt', 'grunt', 'gunner', 'grunt'], ai: 1.9, objective: { type: 'elim' },
    brief: 'Две линии окопов и ничейная полоса между ними. Базука бьёт в бруствер, гранату можно закинуть прямо в окоп.',
    props: { houses: 1, sandbags: 6, fences: 3, crates: 3, barrels: 4, wire: 6 } },
  { id: 3, region: 'r1', name: 'Дзот у мельницы', enemy: 'de', squad: 4, turnTime: 45, terrain: 'plateau', seed: 33,
    enemies: ['gunner', 'grunt', 'grunt', 'sapper'], ai: 1.7, objective: { type: 'elim' },
    structures: [{ type: 'pillbox', side: 1, crew: 0 }],
    brief: 'Легион укрепил высоту дотом. Пока стрелок сидит внутри, пули ему не страшны: разбейте дот тяжёлым оружием или выманите противника.',
    props: { houses: 2, sandbags: 4, fences: 4, crates: 3, barrels: 3, mill: 1 } },
  { id: 4, region: 'r2', name: 'Трясина', enemy: 'us', squad: 4, turnTime: 45, terrain: 'islands', seed: 44,
    enemies: ['grunt', 'scout', 'gunner', 'sapper'], ai: 1.6, objective: { type: 'elim' }, medals: 1,
    brief: 'Кочки посреди ядовитой трясины. Зелёная вода отравляет: отравленная свинья теряет здоровье каждый ход, пока её не вылечат. Ищите мосты.',
    props: { houses: 1, sandbags: 2, bridges: 3, crates: 4, barrels: 2 } },
  { id: 5, region: 'r2', name: 'Спасти рядового Шкварку', enemy: 'us', squad: 4, turnTime: 45, terrain: 'river', seed: 55,
    enemies: ['scout', 'grunt', 'gunner', 'grunt', 'orderly'], ai: 1.5, objective: { type: 'reach' }, medals: 1,
    brief: 'Наш рядовой попал в плен за рекой. Доведите любую свинью до флага у лагеря противника и закончите там ход.',
    props: { houses: 2, sandbags: 3, bridges: 2, crates: 3, barrels: 3 } },
  { id: 6, region: 'r2', name: 'Болотный танк', enemy: 'us', squad: 5, turnTime: 45, terrain: 'hills', seed: 66,
    enemies: ['gunner', 'bombardier', 'sapper', 'grunt', 'medic'], ai: 1.4, objective: { type: 'elim' }, medals: 1,
    structures: [{ type: 'tank', side: 1, crew: 0 }, { type: 'artillery', side: 0 }],
    brief: 'У противника танк. Внутри экипаж защищён, пока машина цела. У нас на холме стоит гаубица: подойдите к ней и нажмите «Техника».',
    props: { houses: 1, sandbags: 4, crates: 4, barrels: 4 } },
  { id: 7, region: 'r3', name: 'Ледяные пушки', enemy: 'ru', squad: 5, turnTime: 45, terrain: 'valley', seed: 77,
    enemies: ['bombardier', 'gunner', 'scout', 'engineer', 'medic'], ai: 1.3, objective: { type: 'elim' }, medals: 2,
    structures: [{ type: 'artillery', side: 1, crew: 0 }, { type: 'artillery', side: 0 }],
    brief: 'Сальная Гвардия держит гаубицу на противоположном склоне. Займите свою и начните артиллерийскую дуэль.',
    props: { houses: 2, sandbags: 4, crates: 4, barrels: 3 } },
  { id: 8, region: 'r3', name: 'Снайперская дуэль', enemy: 'ru', squad: 5, turnTime: 45, terrain: 'canyon', seed: 88,
    enemies: ['sniper', 'sniper', 'scout', 'medic', 'engineer'], ai: 1.1, objective: { type: 'elim' }, medals: 2,
    brief: 'Снайперы бьют через ущелье на 40 урона. Держитесь за укрытиями, используйте маскировку и навесной огонь.',
    props: { houses: 1, sandbags: 6, crates: 4, barrels: 3, wire: 4 } },
  { id: 9, region: 'r3', name: 'Штурм крепости', enemy: 'ru', squad: 5, turnTime: 45, terrain: 'plateau', seed: 99,
    enemies: ['commando', 'gunner', 'sapper', 'sniper', 'medic', 'grunt'], boss: 0, ai: 1.0, objective: { type: 'boss' }, medals: 2,
    structures: [{ type: 'pillbox', side: 1, crew: 1 }, { type: 'pillbox', side: 1, crew: 2 }],
    brief: 'Крепость прикрыта двумя дотами. Цель — комендант (Коммандо). Когда он погибнет, гарнизон сдастся.',
    props: { houses: 3, sandbags: 8, crates: 4, barrels: 4, wire: 6 } },
  { id: 10, region: 'r4', name: 'Миражи', enemy: 'jp', squad: 5, turnTime: 45, terrain: 'dunes', seed: 110,
    enemies: ['scout', 'sapper', 'engineer', 'gunner', 'orderly'], ai: 1.0, objective: { type: 'elim' }, medals: 2, minefield: 14,
    brief: 'Дюны изрыты минами. Мина срабатывает, когда рядом свинья, и взрывается через секунду. Чаще прилетают дирижабли с ящиками.',
    props: { houses: 2, sandbags: 4, crates: 6, barrels: 4 } },
  { id: 11, region: 'r4', name: 'Танковое сражение', enemy: 'jp', squad: 5, turnTime: 45, terrain: 'hills', seed: 121,
    enemies: ['gunner', 'bombardier', 'saboteur', 'sniper', 'medic'], ai: 0.9, objective: { type: 'elim' }, medals: 2,
    structures: [{ type: 'tank', side: 1, crew: 0 }, { type: 'tank', side: 0 }],
    brief: 'В пустыне стоят два танка. Наш свободен: займите его и дайте бой.',
    props: { houses: 2, sandbags: 5, crates: 4, barrels: 5 } },
  { id: 12, region: 'r4', name: 'Выжить до заката', enemy: 'jp', squad: 5, turnTime: 45, terrain: 'plateau', seed: 132,
    enemies: ['commando', 'pyrotech', 'saboteur', 'spy', 'surgeon', 'gunner'], ai: 0.9, objective: { type: 'survive', rounds: 8 }, medals: 2,
    structures: [{ type: 'pillbox', side: 0 }],
    brief: 'Нас окружили отборные части. Продержитесь 8 раундов: хотя бы одна свинья должна остаться в живых.',
    props: { houses: 3, sandbags: 8, crates: 5, barrels: 4, wire: 4 } },
  { id: 13, region: 'r5', name: 'Логово Ордена Сала', enemy: 'lard', squad: 5, turnTime: 45, terrain: 'island', seed: 143,
    enemies: ['legend', 'legend', 'legend'], reinforce: { round: 3, ranks: ['legend', 'legend'] }, ai: 0.7, objective: { type: 'elim' }, medals: 2,
    structures: [{ type: 'pillbox', side: 1, crew: 'gunner', hp: 200 }],
    brief: 'Финал. Орден Сала — пять Легенд по 200 здоровья: три встречают вас, ещё две высадятся на парашютах в третьем раунде. Дот охраняет стрелок. Зелёная вода ядовита.',
    props: { houses: 2, sandbags: 6, crates: 6, barrels: 5 } },
];
// Бонус за завершение региона.
export const REGION_BONUS = 2;

export const QUIPS = {
  hit: ['Прямое попадание!', 'Вот это хрюк!', 'Прямо в пятачок!', 'Отличный выстрел!', 'Зажарили!'],
  miss: ['Мимо!', 'Птицы испугались.', 'Земле досталось больше всех.', 'Почти…'],
  kill: ['%s отправился на ферму в небесах.', '%s больше не хрюкнет.', '%s пал смертью храбрых.', 'Прощай, %s!'],
  self: ['Сам себе злобный хряк!', 'Ой. Больно.', 'Это было неловко.'],
  splash: ['Плюх!', 'Кто-то искупался.', 'Свинья за бортом!'],
  poison: ['%s отравлен!'],
  crate: ['%s нашёл: %s'],
  medal: ['%s нашёл медаль! +1 очко повышения'],
};
