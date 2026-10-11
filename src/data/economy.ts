/** Числа экономики (в день; в игре 1 тик = 1 час = 1/24 дня). Правятся отдельно от кода симуляции. */

export type Res =
  | 'food' | 'water' | 'wood' | 'stone' | 'scrap' | 'knowledge'
  | 'herbs' | 'medicine' | 'fertilizer' | 'bricks' | 'metal' | 'tools' | 'power';

export const PERSON_DAY = { food: 2, water: 2 };
export const START = { pop: 8, res: { food: 30, water: 24, wood: 40, stone: 10, scrap: 5 } as Partial<Record<Res, number>> };

/** Тепловая мощность реактора (ТЕ) по уровню; уровень = номер эпохи + 1. */
export const REACTOR_HEAT = [30, 45, 65, 90, 120];
export const HEAT_PER_RESIDENT = 1;
export const KNOWLEDGE_PER_PERSON = 0.2; // пассивно, в день
export const FOOD_SPOIL = 0.02; // доля сырой еды, портящейся за день
export const FOOD_SPOIL_CELLAR = 0.005;
export const TOOLS_BONUS = 0.3; // +30% к добыче, пока есть инструменты
export const TOOLS_WEAR = 0.1; // инструментов на работника в день

export interface Bld {
  name: string;
  era: number;
  cost: Partial<Record<Res, number>>;
  heat: number; // потребление тепла (ТЕ); отрицательное — даёт тепло
  slots?: number; // рабочих мест
  in?: Partial<Record<Res, number>>; // на работника в день
  out?: Partial<Record<Res, number>>; // на работника в день
  housing?: number;
  upkeep?: Partial<Record<Res, number>>; // в день, без работников
}

export const B: Record<string, Bld> = {
  // Эпоха 1 — Выживание
  hut:        { name: 'Хижина',        era: 0, cost: { wood: 15 }, heat: 0, housing: 4 },
  stove:      { name: 'Печь',          era: 0, cost: { wood: 10, stone: 5 }, heat: -8, upkeep: { wood: 3 } },
  forager:    { name: 'Собиратель',    era: 0, cost: { wood: 10 }, heat: 1, slots: 2, out: { food: 6 } },
  melter:     { name: 'Талая вода',    era: 0, cost: { wood: 10, stone: 5 }, heat: 2, slots: 2, out: { water: 12 } },
  woodcutter: { name: 'Лесоруб',       era: 0, cost: { wood: 5 }, heat: 0, slots: 2, out: { wood: 6 } },
  quarry:     { name: 'Каменоломня',   era: 0, cost: { wood: 15 }, heat: 0, slots: 2, out: { stone: 4 } },
  scavenger:  { name: 'Вылазки',       era: 0, cost: { wood: 15 }, heat: 0, slots: 2, out: { scrap: 1.5 } },
  study:      { name: 'Читальня',      era: 0, cost: { wood: 20, stone: 10 }, heat: 2, slots: 2, out: { knowledge: 3 } },
  // Эпоха 2 — Медицина
  herbs:      { name: 'Сушильня трав', era: 1, cost: { wood: 20 }, heat: 2, slots: 2, out: { herbs: 3 } },
  apothecary: { name: 'Аптека',        era: 1, cost: { wood: 20, stone: 15, scrap: 5 }, heat: 2, slots: 1, in: { herbs: 4, water: 2 }, out: { medicine: 2 } },
  infirmary:  { name: 'Лазарет',       era: 1, cost: { wood: 30, stone: 20, scrap: 10 }, heat: 3, slots: 2 },
  // Эпоха 3 — Сельское хозяйство
  greenhouse: { name: 'Теплица',       era: 2, cost: { wood: 30, stone: 20, scrap: 10 }, heat: 8, slots: 2, in: { water: 3 }, out: { food: 15 } },
  compost:    { name: 'Компостная',    era: 2, cost: { wood: 15 }, heat: 1, slots: 1, in: { food: 1 }, out: { fertilizer: 3 } },
  cellar:     { name: 'Погреб',        era: 2, cost: { wood: 20, stone: 20 }, heat: 0 },
  // Эпоха 4 — Инженерия
  brickworks: { name: 'Кирпичный цех', era: 3, cost: { wood: 20, stone: 30 }, heat: 4, slots: 2, in: { stone: 2, wood: 1 }, out: { bricks: 3 } },
  smelter:    { name: 'Плавильня',     era: 3, cost: { bricks: 20, stone: 20 }, heat: 6, slots: 2, in: { scrap: 2, wood: 2 }, out: { metal: 1.5 } },
  workshop:   { name: 'Мастерская',    era: 3, cost: { bricks: 20, metal: 5 }, heat: 2, slots: 2, in: { metal: 0.5, wood: 1 }, out: { tools: 2 } },
  pipes:      { name: 'Теплотрасса',   era: 3, cost: { bricks: 10, metal: 5 }, heat: -6 },
  // Эпоха 5 — Энергетика
  turbine:    { name: 'Паровая турбина', era: 4, cost: { metal: 20, bricks: 30 }, heat: 25, slots: 1, out: { power: 12 } },
  lamps:      { name: 'Освещение теплиц', era: 4, cost: { metal: 10, scrap: 10 }, heat: 0, upkeep: { power: 4 } },
};

/** Эпохи: знания на все технологии эпохи и обязательные здания для перехода. */
export const ERAS = [
  { name: 'Выживание',          knowledge: 18,  need: { forager: 1, melter: 1, woodcutter: 1, hut: 2, study: 1 }, popCap: 12 },
  { name: 'Медицина',           knowledge: 90,  need: { apothecary: 1, infirmary: 1 }, popCap: 18 },
  { name: 'Сельское хозяйство', knowledge: 150, need: { greenhouse: 2, compost: 1, cellar: 1 }, popCap: 26 },
  { name: 'Инженерия',          knowledge: 240, need: { brickworks: 1, smelter: 1, workshop: 1, pipes: 2 }, popCap: 36 },
  { name: 'Энергетика',         knowledge: 350, need: { turbine: 2, lamps: 2 }, popCap: 45 },
];

export const SICK_BASE = 0.005; // шанс заболеть в день
export const SICK_COLD = 0.04; // добавка при нехватке тепла
export const HEAL_CARE = 0.5; // выздоровление в день: лазарет + лекарство
export const HEAL_NONE = 0.15;
export const SICK_DEATH = 0.03; // смерть больного в день без лечения
export const ARRIVAL_EVERY = 2; // дней между новыми поселенцами при хороших условиях

