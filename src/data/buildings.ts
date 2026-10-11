import type { BuildingDef, BuildingKind, Resources } from '../core/types';

export const BUILDINGS: Record<BuildingKind, BuildingDef> = {
  hut: { cost: { wood: 20 }, worker: false },
  campfire: { cost: { wood: 10 }, worker: false },
  gatherer: { cost: { wood: 15 }, worker: true },
  woodcutter: { cost: { wood: 10 }, worker: true },
  quarry: { cost: { wood: 20 }, worker: true },
  purifier: { cost: { wood: 15, stone: 10 }, worker: true },
};

/** Что производит здание за тик (1 час) при наличии работника. */
export const PRODUCTION: Partial<Record<BuildingKind, Partial<Resources>>> = {
  gatherer: { food: 1.4 },
  woodcutter: { wood: 1.2 },
  quarry: { stone: 0.8 },
  purifier: { water: 2.5 },
};

export const HUT_CAPACITY = 4;
