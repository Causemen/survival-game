export type BuildingKind = 'hut' | 'campfire' | 'gatherer' | 'woodcutter' | 'quarry' | 'purifier';

export interface Cost {
  wood?: number;
  stone?: number;
}

export interface BuildingDef {
  cost: Cost;
  /** Нужен ли работник для производства. */
  worker: boolean;
}

export interface Building {
  id: number;
  kind: BuildingKind;
  x: number;
  y: number;
}

export interface Settler {
  id: number;
  x: number;
  y: number;
  warmth: number;
  hunger: number;
  thirst: number;
  health: number;
  alive: boolean;
}

export interface Resources {
  wood: number;
  stone: number;
  food: number;
  water: number;
  knowledge: number;
}

export interface State {
  tick: number;
  w: number;
  h: number;
  reactor: { x: number; y: number; level: number };
  buildings: Building[];
  settlers: Settler[];
  res: Resources;
  nextId: number;
  era: number;
  techs: string[];
  seed: number;
  /** Горят ли костры и топятся ли хижины: false, если дрова кончились. */
  lit: boolean;
  /** Ожидающий решения выбор игрока (id из DILEMMAS) или null. */
  dilemma: string | null;
  /** Не раньше этого тика появится следующий выбор. */
  dilemmaAt: number;
  active: { id: string; until: number }[];
  log: { tick: number; text: string }[];
}
