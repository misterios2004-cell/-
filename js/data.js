// Игровые данные: нации, звания, оружие, кампания.
// Структура званий и значения здоровья/урона взяты из описаний Hogs of War (2000);
// персонажи в нашей версии — антропоморфные лисы-солдаты;
// где оригинал не указывает число, стоит наш баланс (помечено комментарием «баланс»).

export const INF = -1; // бесконечный боезапас

// Фракции. hat — тип шлема/головного убора; color — цвет формы (приглушённый).
export const NATIONS = {
  uk:  { id: 'uk',  name: 'Королевские стрелки', short: 'Стрелки',  color: 0x4d5536, css: '#8a9464', hat: 'brodie',
         names: ['Эштон', 'Грейвс', 'Холлоуэй', 'Кроуфорд', 'Бирн', 'Мэддокс', 'Рид', 'Колдуэлл'] },
  fr:  { id: 'fr',  name: 'Республиканский легион', short: 'Легион', color: 0x2f3b52, css: '#7289b0', hat: 'adrian',
         names: ['Дюваль', 'Леруа', 'Моро', 'Готье', 'Бертран', 'Фавр', 'Руссо', 'Мерсье'] },
  de:  { id: 'de',  name: 'Железная дивизия',    short: 'Дивизия',  color: 0x4a4e50, css: '#98a0a4', hat: 'stahlhelm',
         names: ['Краузе', 'Фогель', 'Штайнер', 'Келлер', 'Браун', 'Хартманн', 'Винтер', 'Рихтер'] },
  us:  { id: 'us',  name: 'Звёздный батальон',   short: 'Батальон', color: 0x55553a, css: '#a3a574', hat: 'm1',
         names: ['Коннор', 'Хейс', 'Мерфи', 'Доусон', 'Риггс', 'Кейн', 'Бакстер', 'Уолш'] },
  ru:  { id: 'ru',  name: 'Северный фронт',      short: 'Фронт',    color: 0x5a3a30, css: '#c07a62', hat: 'ushanka',
         names: ['Воронов', 'Громов', 'Лисицын', 'Сомов', 'Ветров', 'Орлов', 'Зимин', 'Рябов'] },
  jp:  { id: 'jp',  name: 'Корпус Восхода',      short: 'Восход',   color: 0x5c5236, css: '#c2ad72', hat: 'type90',
         names: ['Кано', 'Мори', 'Исида', 'Хаяси', 'Огава', 'Сато', 'Кудо', 'Ямада'] },
  ash: { id: 'ash', name: 'Орден Пепла',         short: 'Орден',    color: 0x26222a, css: '#a0808e', hat: 'visor', enemyOnly: true,
         names: ['Пепел', 'Мрак', 'Сажа', 'Зола', 'Уголь', 'Дым'] },
};
export const PLAYABLE_NATIONS = ['uk', 'fr', 'de', 'us', 'ru', 'jp'];

// Звания. line: ветка; level: 0 — рядовой, 1–3 — ступени ветки, 4 — коммандо, 5 — герой.
// cost — очки повышения за переход на это звание (оригинал: Бомбардир 2, Герой 8; остальное — баланс).
export const RANKS = {
  grunt:      { name: 'Рядовой',      line: 'base',   level: 0, hp: 50,  cost: 0, next: ['gunner', 'sapper', 'scout', 'orderly'],
                load: { knife: INF, rifle: INF, grenade: 3 } },
  gunner:     { name: 'Стрелок',      line: 'heavy',  level: 1, hp: 75,  cost: 1, next: ['bombardier'],
                load: { knuckles: INF, pistol: INF, bazooka: 3 } },
  bombardier: { name: 'Бомбардир',    line: 'heavy',  level: 2, hp: 90,  cost: 2, next: ['pyrotech'],
                load: { knuckles: INF, pistol: INF, mortar: 3, bazooka: 3 } },
  pyrotech:   { name: 'Пиротехник',   line: 'heavy',  level: 3, hp: 120, cost: 4, next: ['commando'],
                load: { knuckles: INF, pistol: INF, flamethrower: 3, mortar: 3, bazooka: 3, airburst: 1 } },
  sapper:     { name: 'Сапёр',        line: 'eng',    level: 1, hp: 80,  cost: 1, next: ['engineer'],
                load: { knuckles: INF, shotgun: INF, mine: 3, tnt: 1 } },
  engineer:   { name: 'Инженер',      line: 'eng',    level: 2, hp: 100, cost: 2, next: ['saboteur'],
                load: { knuckles: INF, shotgun: INF, shrapnel: 3, mine: 3, tnt: 2, suicide: 1 } },
  saboteur:   { name: 'Диверсант',    line: 'eng',    level: 3, hp: 120, cost: 4, next: ['commando'],
                load: { knuckles: INF, supershotgun: INF, shrapnel: 3, mine: 3, tnt: 3, suicide: 1 } },
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
  base: { name: 'Базовая подготовка', color: '#8e8a80' },
  heavy: { name: 'Тяжёлое вооружение', color: '#b8703a' },
  eng: { name: 'Инженерные войска', color: '#a8903e' },
  spy: { name: 'Разведка', color: '#6e8e62' },
  medic: { name: 'Медслужба', color: '#b0564a' },
  officer: { name: 'Офицеры', color: '#c9a456' },
};

// Оружие и снаряжение.
// kind определяет механику; dmg — максимальный урон; r — радиус взрыва (м).
// Значения урона винтовки, пистолета, дробовиков, снайперки, огнемёта, очереди, пулемёта, базуки,
// осколочной и кассетной гранат, шрапнельного залпа — по описаниям оригинала; остальное — баланс.
export const WEAPONS = {
  // ближний бой
  knife:   { name: 'Нож',            cat: 'melee', kind: 'melee', dmg: 15, range: 2.0, push: 3, desc: 'Удар в упор.' },
  knuckles: { name: 'Кастет',        cat: 'melee', kind: 'melee', dmg: 12, range: 2.0, push: 9, desc: 'Тяжёлый удар: отбрасывает врага. Можно столкнуть в воду или с обрыва.' },
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
  mine:    { name: 'Мина',           cat: 'explosive', kind: 'place', dmg: 45, r: 4, desc: 'Ставится под ноги. Срабатывает, когда рядом окажется боец.' },
  tnt:     { name: 'Динамит',        cat: 'explosive', kind: 'place', dmg: 75, r: 6.5, fuse: 5, desc: 'Ставится под ноги. 5 секунд, чтобы убежать.' },
  suicide: { name: 'Самоподрыв',     cat: 'explosive', kind: 'suicide', dmg: 100, r: 7.5, desc: 'Последний аргумент. Боец погибает.' },
  airstrike:{ name: 'Авиаудар',      cat: 'special', kind: 'airstrike', dmg: 30, r: 4, bombs: 5, desc: 'Бомбардировщик сбрасывает пять бомб по отмеченной точке.' },
  shockwave:{ name: 'Ударная волна', cat: 'special', kind: 'shockwave', dmg: 25, r: 11, desc: 'Сбивает всех вокруг с ног.' },
  // поддержка
  healhands:{ name: 'Лечащие руки',  cat: 'support', kind: 'healtouch', heal: 20, range: 2.6, free: true, desc: 'Лечит соседа на 20 и снимает отравление. Не заканчивает ход.' },
  meddart: { name: 'Лечебный дротик', cat: 'support', kind: 'healdart', heal: 25, range: 60, desc: 'Выстрел по союзнику лечит на 25 и снимает отравление.' },
  selfheal:{ name: 'Самолечение',    cat: 'support', kind: 'selfheal', heal: 50, free: true, desc: '+50 здоровья себе. Не заканчивает ход.' },
  medkit:  { name: 'Аптечка',        cat: 'support', kind: 'selfheal', heal: 40, free: true, desc: '+40 здоровья себе. Не заканчивает ход.' },
  jetpack: { name: 'Реактивный ранец', cat: 'special', kind: 'jetpack', fuel: 5, free: true, desc: 'Полёт на 5 секунд: держите «Прыжок», чтобы набирать высоту.' },
  hide:    { name: 'Маскировка',     cat: 'special', kind: 'hide', desc: 'Боец уходит в укрытие: враги его не видят, урон по нему вдвое меньше до его следующего хода.' },
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
  farm:   { name: 'Поля',      sky: [0x2e4a6e, 0xd6a878], fog: [110, 300], hemi: [0xb0bcc8, 0x3a3024, 0.9], sun: [0xffd6a0, 1.4], water: 0x243a40, poison: false, exposure: 1.05,
            grass: [0.22, 0.27, 0.13], dry: [0.33, 0.3, 0.18], dirt: [0.26, 0.2, 0.14], rock: [0.34, 0.33, 0.31], sand: [0.46, 0.41, 0.31], trees: ['oak', 'pine'], weather: 'dust' },
  swamp:  { name: 'Топи',      sky: [0x1c2a2a, 0x6e7e56], fog: [45, 170], hemi: [0x8a9a7e, 0x22201a, 0.95], sun: [0xd8d4a0, 0.85], water: 0x2c3a1c, poison: true, exposure: 1.0,
            grass: [0.18, 0.21, 0.11], dry: [0.24, 0.23, 0.14], dirt: [0.19, 0.16, 0.11], rock: [0.27, 0.27, 0.24], sand: [0.27, 0.25, 0.18], trees: ['dead', 'willow'], weather: 'spores' },
  snow:   { name: 'Перевал',   sky: [0x2c4468, 0xa4b8cc], fog: [80, 240], hemi: [0xb8c8e0, 0x3c3e48, 0.95], sun: [0xfff0dc, 1.0], water: 0x2a3e4a, poison: false, exposure: 1.0,
            grass: [0.7, 0.73, 0.76], dry: [0.6, 0.63, 0.67], dirt: [0.28, 0.26, 0.24], rock: [0.36, 0.37, 0.4], sand: [0.48, 0.5, 0.52], trees: ['snowpine'], weather: 'snow' },
  desert: { name: 'Пустыня',   sky: [0x2c5484, 0xe4b47c], fog: [130, 340], hemi: [0xd8c8a8, 0x4a3822, 0.9], sun: [0xffd8a0, 1.4], water: 0x28484c, poison: false, exposure: 1.0,
            grass: [0.56, 0.45, 0.28], dry: [0.5, 0.4, 0.24], dirt: [0.42, 0.3, 0.18], rock: [0.4, 0.31, 0.22], sand: [0.62, 0.52, 0.35], trees: ['palm', 'cactus'], weather: 'dust' },
  ash:    { name: 'Пепелище',  sky: [0x120c14, 0x8a3a26], fog: [60, 210], hemi: [0x8a7a80, 0x201818, 0.85], sun: [0xff9a5a, 1.05], water: 0x2e3a18, poison: true, exposure: 1.05,
            grass: [0.2, 0.2, 0.15], dry: [0.26, 0.22, 0.18], dirt: [0.2, 0.16, 0.13], rock: [0.24, 0.22, 0.23], sand: [0.33, 0.29, 0.25], trees: ['dead', 'pine'], weather: 'embers' },
};

// Кампания: 4 региона по 3 операции и финал.
// enemies: список званий врагов; squad: сколько бойцов берёт игрок.
// structures: доты (pillbox), танки (tank), гаубицы (artillery), дома, мешки с песком, мосты.
export const REGIONS = [
  { id: 'r1', name: 'Пограничные поля', theme: 'farm' },
  { id: 'r2', name: 'Гнилые топи', theme: 'swamp' },
  { id: 'r3', name: 'Северный перевал', theme: 'snow' },
  { id: 'r4', name: 'Выжженная пустыня', theme: 'desert' },
  { id: 'r5', name: 'Остров Пепла', theme: 'ash' },
];
export const MISSIONS = [
  { id: 1, region: 'r1', name: 'Первая кровь', enemy: 'de', squad: 3, turnTime: 60, terrain: 'hills', seed: 11,
    enemies: ['grunt', 'grunt', 'grunt'], ai: 2.2, objective: { type: 'elim' },
    brief: 'Железная дивизия заняла холмы у фермы. Ваши рядовые получили винтовки, ножи и по три гранаты. Выбейте противника.',
    tips: ['Зажмите «Огонь», чтобы набрать силу броска гранаты.', 'На бегу стрелять нельзя: остановитесь и прицельтесь.'],
    props: { houses: 2, sandbags: 3, fences: 5, crates: 2, barrels: 3 } },
  { id: 2, region: 'r1', name: 'Окопная правда', enemy: 'fr', squad: 4, turnTime: 45, terrain: 'trenches', seed: 22,
    enemies: ['grunt', 'grunt', 'gunner', 'grunt'], ai: 1.9, objective: { type: 'elim' },
    brief: 'Две линии окопов и ничейная полоса между ними. Базука бьёт в бруствер, гранату можно закинуть прямо в окоп.',
    props: { houses: 1, sandbags: 6, fences: 3, crates: 3, barrels: 4, wire: 6 } },
  { id: 3, region: 'r1', name: 'Дзот у мельницы', enemy: 'de', squad: 4, turnTime: 45, terrain: 'plateau', seed: 33,
    enemies: ['gunner', 'grunt', 'grunt', 'sapper'], ai: 1.7, objective: { type: 'elim' },
    structures: [{ type: 'pillbox', side: 1, crew: 0 }],
    brief: 'Дивизия укрепила высоту дотом. Пока стрелок сидит внутри, пули ему не страшны: разбейте дот тяжёлым оружием или выманите противника.',
    props: { houses: 2, sandbags: 4, fences: 4, crates: 3, barrels: 3, mill: 1 } },
  { id: 4, region: 'r2', name: 'Трясина', enemy: 'us', squad: 4, turnTime: 45, terrain: 'islands', seed: 44,
    enemies: ['grunt', 'scout', 'gunner', 'sapper'], ai: 1.6, objective: { type: 'elim' }, medals: 1,
    brief: 'Кочки посреди ядовитой трясины. Зелёная вода отравляет: отравленный боец теряет здоровье каждый ход, пока её не вылечат. Ищите мосты.',
    props: { houses: 1, sandbags: 2, bridges: 3, crates: 4, barrels: 2 } },
  { id: 5, region: 'r2', name: 'Эвакуация', enemy: 'us', squad: 4, turnTime: 45, terrain: 'river', seed: 55,
    enemies: ['scout', 'grunt', 'gunner', 'grunt', 'orderly'], ai: 1.5, objective: { type: 'reach' }, medals: 1,
    brief: 'Наш разведчик удерживается в плену за рекой. Доведите любого бойца до флага у лагеря противника и закончите там ход.',
    props: { houses: 2, sandbags: 3, bridges: 2, crates: 3, barrels: 3 } },
  { id: 6, region: 'r2', name: 'Болотный танк', enemy: 'us', squad: 5, turnTime: 45, terrain: 'hills', seed: 66,
    enemies: ['gunner', 'bombardier', 'sapper', 'grunt', 'medic'], ai: 1.4, objective: { type: 'elim' }, medals: 1,
    structures: [{ type: 'tank', side: 1, crew: 0 }, { type: 'artillery', side: 0 }],
    brief: 'У противника танк. Внутри экипаж защищён, пока машина цела. У нас на холме стоит гаубица: подойдите к ней и нажмите «Техника».',
    props: { houses: 1, sandbags: 4, crates: 4, barrels: 4 } },
  { id: 7, region: 'r3', name: 'Ледяные пушки', enemy: 'ru', squad: 5, turnTime: 45, terrain: 'valley', seed: 77,
    enemies: ['bombardier', 'gunner', 'scout', 'engineer', 'medic'], ai: 1.3, objective: { type: 'elim' }, medals: 2,
    structures: [{ type: 'artillery', side: 1, crew: 0 }, { type: 'artillery', side: 0 }],
    brief: 'Северный фронт держит гаубицу на противоположном склоне. Займите свою и начните артиллерийскую дуэль.',
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
    brief: 'Дюны изрыты минами. Мина срабатывает, когда рядом боец, и взрывается через секунду. Чаще прилетают дирижабли с ящиками.',
    props: { houses: 2, sandbags: 4, crates: 6, barrels: 4 } },
  { id: 11, region: 'r4', name: 'Танковое сражение', enemy: 'jp', squad: 5, turnTime: 45, terrain: 'hills', seed: 121,
    enemies: ['gunner', 'bombardier', 'saboteur', 'sniper', 'medic'], ai: 0.9, objective: { type: 'elim' }, medals: 2,
    structures: [{ type: 'tank', side: 1, crew: 0 }, { type: 'tank', side: 0 }],
    brief: 'В пустыне стоят два танка. Наш свободен: займите его и дайте бой.',
    props: { houses: 2, sandbags: 5, crates: 4, barrels: 5 } },
  { id: 12, region: 'r4', name: 'Выжить до заката', enemy: 'jp', squad: 5, turnTime: 45, terrain: 'plateau', seed: 132,
    enemies: ['commando', 'pyrotech', 'saboteur', 'spy', 'surgeon', 'gunner'], ai: 0.9, objective: { type: 'survive', rounds: 8 }, medals: 2,
    structures: [{ type: 'pillbox', side: 0 }],
    brief: 'Нас окружили отборные части. Продержитесь 8 раундов: хотя бы один боец должен остаться в живых.',
    props: { houses: 3, sandbags: 8, crates: 5, barrels: 4, wire: 4 } },
  { id: 13, region: 'r5', name: 'Цитадель Ордена Пепла', enemy: 'ash', squad: 5, turnTime: 45, terrain: 'island', seed: 143,
    enemies: ['legend', 'legend', 'legend'], reinforce: { round: 3, ranks: ['legend', 'legend'] }, ai: 0.7, objective: { type: 'elim' }, medals: 2,
    structures: [{ type: 'pillbox', side: 1, crew: 'gunner', hp: 200 }],
    brief: 'Финал. Орден Пепла — пять Легенд по 200 здоровья: три встречают вас, ещё две высадятся на парашютах в третьем раунде. Дот охраняет стрелок. Зелёная вода ядовита.',
    props: { houses: 2, sandbags: 6, crates: 6, barrels: 5 } },
];
// Бонус за завершение региона.
export const REGION_BONUS = 2;

export const QUIPS = {
  hit: ['Есть попадание.', 'Цель поражена.', 'Точно в цель.', 'Прямое попадание.'],
  miss: ['Мимо.', 'Промах.', 'Перелёт.', 'Недолёт.'],
  kill: ['%s — безвозвратная потеря.', '%s выбыл.', '%s больше не встанет.', 'Минус один: %s.'],
  self: ['Ранен собственным огнём.', 'Непрофессионально.', 'Сам подставился.'],
  splash: ['Боец в воде.', 'Упал в воду.', 'Всплеск.'],
  poison: ['%s отравлен.'],
  crate: ['%s: трофей — %s'],
  medal: ['%s нашёл наградной знак. +1 очко повышения'],
};
