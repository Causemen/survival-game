import type { BuildingKind } from '../core/types';

export interface Tech {
  id: string;
  name: string;
  desc: string;
  /** Цена в знаниях. */
  cost: number;
  /** Индекс эпохи, с которой технология доступна. */
  era: number;
  requires?: string[];
  /** Множитель производства зданий. */
  prod?: Partial<Record<BuildingKind, number>>;
  hutCapacity?: number;
  hutWarmth?: number;
}

export const TECHS: Tech[] = [
  { id: 'boiling', name: 'Кипячение воды', desc: 'Фильтры воды дают на 30% больше.', cost: 12, era: 0, prod: { purifier: 1.3 } },
  { id: 'stone-tools', name: 'Каменные инструменты', desc: 'Лесоруб и каменоломня дают на 30% больше.', cost: 18, era: 0, prod: { woodcutter: 1.3, quarry: 1.3 } },
  { id: 'foraging', name: 'Съедобные растения', desc: 'Собиратели дают на 30% больше еды.', cost: 18, era: 0, prod: { gatherer: 1.3 } },
  { id: 'shelters', name: 'Утеплённые укрытия', desc: 'Хижина вмещает на 2 человека больше и греет на 6° сильнее.', cost: 30, era: 0, requires: ['stone-tools'], hutCapacity: 2, hutWarmth: 6 },
];
