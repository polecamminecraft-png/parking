'use strict';

/* ============================================================
   KONFIGURACJA – rozmiary siatki, typy kafelków, dane wież
   ============================================================ */

const COLS = 16;
const ROWS = 12;
const TILE = 48;               // rozmiar kafelka w px
const CANVAS_W = COLS * TILE;  // 768
const CANVAS_H = ROWS * TILE;  // 576

// Typy kafelków
const T = {
  EMPTY: 0,     // miejsce na wieżyczkę (parking)
  PATH: 1,      // droga dla pojazdów
  START: 2,     // wjazd
  END: 3,       // szlaban / cel
  OBSTACLE: 4   // przeszkoda (nie do zabudowy)
};

const START_MONEY = 300;
const START_LIVES = 20;
const TOTAL_WAVES = 15;      // fale "podstawowe" – po nich tryb nieskończony
const MAX_LEVEL = 4;         // poziomy wieżyczki (4 = specjalizacja 3. poziom)
const SAVE_KEY = 'parkingDefender.map';

/* ---------------- WIEŻYCZKI (7 typów) ---------------- */
const TOWER_TYPES = {
  guard: {
    id: 'guard',
    name: 'Strażnik Miejski',
    emoji: '👮',
    cost: 60,
    range: 105,
    cooldown: 1.2,
    damage: 10,
    projectile: 'permit',
    color: '#f59e0b',
    slow: { amount: 0.35, duration: 1.5 },
    desc: 'Mandaty – spowalnia pojazdy o 35%.',
    spec: {
      A: { name: 'Mandaty na potęgę', desc: 'Silniejsze (+15%) i dłuższe spowolnienie.', slowAdd: 0.15, slowDurAdd: 0.8 },
      B: { name: 'Strefa płatnego parkingu', desc: '+40% nagrody za pojazdy zniszczone w zasięgu.', killBountyMul: 1.4 }
    }
  },
  police: {
    id: 'police',
    name: 'Policjant',
    emoji: '🚓',
    cost: 120,
    range: 155,
    cooldown: 0.55,
    damage: 26,
    projectile: 'bullet',
    color: '#3b82f6',
    desc: 'Szybkie strzały, duży dmg w pojedynczy cel.',
    spec: {
      A: { name: 'Pistolet maszynowy', desc: 'Szybkostrzelność +40% (cooldown ×0.6).', cooldownMul: 0.6 },
      B: { name: 'Amunicja przeciwpancerna', desc: 'Obrażenia +70%.', damageMul: 1.7 }
    }
  },
  fire: {
    id: 'fire',
    name: 'Strażak',
    emoji: '🚒',
    cost: 200,
    range: 125,
    cooldown: 1.6,
    damage: 22,
    projectile: 'water',
    cone: { half: 0.45 },
    color: '#ef4444',
    desc: 'Stożek wody – obrażenia AOE na całą grupę.',
    spec: {
      A: { name: 'Potężny strumień', desc: 'Szerszy stożek i większe obrażenia.', coneHalfAdd: 0.18, damageMul: 1.35 },
      B: { name: 'Piana gaśnicza', desc: 'Obrażenia w czasie – pojazdy płoną pianą.', burnDps: 14, burnDur: 2.5 }
    }
  },
  saper: {
    id: 'saper',
    name: 'Saper',
    emoji: '💣',
    cost: 160,
    range: 135,
    cooldown: 2.0,
    damage: 32,
    splash: { radius: 66 },
    projectile: 'bomb',
    color: '#22c55e',
    desc: 'Rzuca bombę – eksplozja zadaje obrażenia w obszarze.',
    spec: {
      A: { name: 'Większy wybuch', desc: 'Promień eksplozji +40%.', radiusMul: 1.4 },
      B: { name: 'Ładunek bramowy', desc: 'Eksplozja spowalnia pojazdy o 40% na 2 s.', slowPct: 0.4, slowDur: 2 }
    }
  },
  snajper: {
    id: 'snajper',
    name: 'Snajper',
    emoji: '🎯',
    cost: 240,
    range: 235,
    cooldown: 2.4,
    damage: 90,
    projectile: 'bullet',
    bulletSpeed: 980,
    color: '#8b5cf6',
    desc: 'Ogromny zasięg i potężny pojedynczy strzał.',
    spec: {
      A: { name: 'Celownik optyczny', desc: 'Zasięg +60 px.', rangeAdd: 60 },
      B: { name: 'Amunicja .50', desc: 'Obrażenia +60%, strzał wolniejszy.', damageMul: 1.6, cooldownMul: 1.25 }
    }
  },
  dzwig: {
    id: 'dzwig',
    name: 'Dźwig',
    emoji: '🏗️',
    cost: 210,
    range: 150,
    cooldown: 3.4,
    damage: 8,
    pull: 50,
    projectile: 'none',
    color: '#f97316',
    desc: 'Wciąga pojazdy z powrotem w bezpieczną strefę.',
    spec: {
      A: { name: 'Mocne dźwignie', desc: 'Cofa pojazdy o 90 px zamiast 50.', pull: 90 },
      B: { name: 'Podwójny hak', desc: 'Cofa 2 najbardziej wysunięte pojazdy.', twin: true }
    }
  },
  radar: {
    id: 'radar',
    name: 'Kontroler Ruchu',
    emoji: '🛰️',
    cost: 150,
    range: 130,
    cooldown: 0.3,
    damage: 0,
    vuln: 0.4,
    slow: 0.12,
    projectile: 'none',
    color: '#06b6d4',
    desc: 'Aura: pojazdy w strefie przyjmują +40% obrażeń.',
    spec: {
      A: { name: 'Wzmocniona podatność', desc: '+60% obrażeń w strefie (zamiast +40%).', vuln: 0.6 },
      B: { name: 'Pasywne zagłuszanie', desc: 'Dodatkowe spowolnienie 25% w strefie.', weakSlow: 0.25 }
    }
  }
};

const TOWER_ORDER = ['guard', 'police', 'fire', 'saper', 'snajper', 'dzwig', 'radar'];

/* ---------------- PRZECIWNICY (POJAZDY) ---------------- */
const ENEMY_TYPES = {
  hulajnoga: {
    id: 'hulajnoga', name: 'Hulajnoga', emoji: '🛴',
    hp: 40, speed: 135, bounty: 8, unlock: 1,
    size: 20, lifeDamage: 1, slowResist: 0, boss: false, straight: false
  },
  rower: {
    id: 'rower', name: 'Rower', emoji: '🚲',
    hp: 60, speed: 95, bounty: 10, unlock: 2,
    size: 22, lifeDamage: 1, slowResist: 0, boss: false, straight: false
  },
  skuter: {
    id: 'skuter', name: 'Skuter', emoji: '🛵',
    hp: 95, speed: 118, bounty: 12, unlock: 3,
    size: 24, lifeDamage: 1, slowResist: 0, boss: false, straight: false
  },
  motor: {
    id: 'motor', name: 'Motor', emoji: '🏍️',
    hp: 120, speed: 155, bounty: 14, unlock: 4,
    size: 24, lifeDamage: 1, slowResist: 0.1, boss: false, straight: false
  },
  auto: {
    id: 'auto', name: 'Samochód osobowy', emoji: '🚗',
    hp: 190, speed: 85, bounty: 20, unlock: 5,
    size: 27, lifeDamage: 1, slowResist: 0.15, boss: false, straight: false
  },
  bus: {
    id: 'bus', name: 'Bus / Dostawczak', emoji: '🚐',
    hp: 360, speed: 62, bounty: 30, unlock: 6,
    size: 31, lifeDamage: 2, slowResist: 0.25, boss: false, straight: false
  },
  ciezarowka: {
    id: 'ciezarowka', name: 'Ciężarówka', emoji: '🚚',
    hp: 700, speed: 46, bounty: 45, unlock: 7,
    size: 34, lifeDamage: 3, slowResist: 0.35, boss: false, straight: false
  },
  czolg: {
    id: 'czolg', name: 'Czołg', emoji: '🪖',
    hp: 1100, speed: 32, bounty: 120, unlock: 8,
    size: 38, lifeDamage: 5, slowResist: 0.8, boss: true, straight: false
  },
  pociag: {
    id: 'pociag', name: 'Pociąg / Tramwaj', emoji: '🚊',
    hp: 2100, speed: 58, bounty: 150, unlock: 9,
    size: 40, lifeDamage: 5, slowResist: 0.5, boss: true, straight: false
  },
  dron: {
    id: 'dron', name: 'Samolot / Dron', emoji: '✈️',
    hp: 1450, speed: 125, bounty: 130, unlock: 10,
    size: 34, lifeDamage: 4, slowResist: 0.6, boss: true, straight: true
  }
};

const ENEMY_ORDER = [
  'hulajnoga', 'rower', 'skuter', 'motor', 'auto',
  'bus', 'ciezarowka', 'czolg', 'pociag', 'dron'
];

/* ============================================================
   MAPA DOMYŚLNA – trudna serpentyna przez całą planszę
   + 27 przeszkód tworzących wąskie gardła
   ============================================================ */
const DEFAULT_MAP = (() => {
  const cells = Array.from({ length: ROWS }, () => Array(COLS).fill(T.EMPTY));

  // serpentyna: A(row2) -> B(col6) -> C(row9) -> D(col9) -> E(row3)
  //           -> F(col13) -> G(row8) -> H(col15) -> END (15,0)
  for (let c = 0; c <= 6; c++) cells[2][c] = T.PATH;
  for (let r = 2; r <= 9; r++) cells[r][6] = T.PATH;
  for (let c = 6; c <= 9; c++) cells[9][c] = T.PATH;
  for (let r = 9; r >= 3; r--) cells[r][9] = T.PATH;
  for (let c = 9; c <= 13; c++) cells[3][c] = T.PATH;
  for (let r = 3; r <= 8; r++) cells[r][13] = T.PATH;
  for (let c = 13; c <= 15; c++) cells[8][c] = T.PATH;
  for (let r = 8; r >= 0; r--) cells[r][15] = T.PATH;

  cells[2][0] = T.START;   // wjazd (lewy górny róg)
  cells[0][15] = T.END;    // szlaban (prawy górny róg)

  // przeszkody – wąskie gardła i kępy uniemożliwiające budowę
  const obstacles = [
    // korytarz wejściowy (nad i pod pierwszą prostą)
    [1, 3], [2, 3], [3, 3], [3, 1], [3, 0], [0, 4], [1, 4], [5, 1], [6, 1], [7, 1],
    // wokół kolumny 6
    [5, 4], [5, 5], [7, 4], [7, 5], [7, 6], [4, 7], [4, 8], [8, 7],
    // środkowe kępy
    [10, 5], [10, 6], [11, 5], [8, 4], [12, 6], [8, 6],
    // przy kolumnie 13
    [14, 5], [14, 6], [12, 5],
    // górny róg przy kolumnie 15
    [14, 3], [13, 2], [14, 2], [12, 1], [11, 1], [13, 0], [14, 0], [11, 0]
  ];
  obstacles.forEach(([c, r]) => {
    if (cells[r][c] === T.EMPTY) cells[r][c] = T.OBSTACLE;
  });

  return { name: 'Mapa domyślna', cols: COLS, rows: ROWS, cells };
})();