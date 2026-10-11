import type { BuildingDef, BuildingKind, Resources } from '../core/types';
import { B, PERSON_DAY, START } from './economy';

/** Часов в игровом дне: числа экономики заданы в день, тик симуляции — час. */
export const HOURS_PER_DAY = 24;

// Здания игры -> строки модели экономики (src/data/economy.ts).
const MODEL_ID: Partial<Record<BuildingKind, string>> = {
  hut: 'hut', gatherer: 'forager', woodcutter: 'woodcutter', quarry: 'quarry', purifier: 'melter',
};

const modelCost = (kind: BuildingKind): BuildingDef['cost'] => {
  const c = B[MODEL_ID[kind]!]!.cost;
  return { wood: c.wood, stone: c.stone };
};

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  hut: { cost: modelCost('hut'), worker: false },
  campfire: { cost: { wood: 10 }, worker: false },
  gatherer: { cost: modelCost('gatherer'), worker: true },
  woodcutter: { cost: modelCost('woodcutter'), worker: true },
  quarry: { cost: modelCost('quarry'), worker: true },
  purifier: { cost: modelCost('purifier'), worker: true },
};

/** Что производит здание за тик (1 час) при наличии работника: дневная выработка модели / 24. */
const hourly = (kind: BuildingKind): Partial<Resources> => {
  const out = B[MODEL_ID[kind]!]!.out ?? {};
  return Object.fromEntries(Object.entries(out).map(([r, v]) => [r, (v ?? 0) / HOURS_PER_DAY]));
};

export const PRODUCTION: Partial<Record<BuildingKind, Partial<Resources>>> = {
  gatherer: hourly('gatherer'),
  woodcutter: hourly('woodcutter'),
  quarry: hourly('quarry'),
  purifier: hourly('purifier'),
};

export const HUT_CAPACITY = 4;

/** Стартовые запасы колонии (модель экономики). */
export const START_RES: Resources = {
  wood: START.res.wood ?? 0, stone: START.res.stone ?? 0,
  food: START.res.food ?? 0, water: START.res.water ?? 0, knowledge: 0,
};

/** Падение сытости/жажды за час и сколько восстанавливает 1 единица еды/воды: человек ест и пьёт PERSON_DAY за сутки. */
export const HUNGER_DROP = 0.4;
export const THIRST_DROP = 0.6;
export const FOOD_RESTORE = (HUNGER_DROP * HOURS_PER_DAY) / PERSON_DAY.food;
export const WATER_RESTORE = (THIRST_DROP * HOURS_PER_DAY) / PERSON_DAY.water;
