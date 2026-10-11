import type { BuildingKind, State } from '../core/types';

export interface Goal {
  label: string;
  target: number;
  value: (s: State) => number;
}

export interface Era {
  name: string;
  /** false — эпоха пока без целей («скоро»). */
  playable: boolean;
  goals: Goal[];
}

const count = (s: State, k: BuildingKind) => s.buildings.filter((b) => b.kind === k).length;
const living = (s: State) => s.settlers.filter((p) => p.alive).length;

export const ERAS: Era[] = [
  {
    name: 'Выживание',
    playable: true,
    goals: [
      { label: 'Построить Собирателя', target: 1, value: (s) => count(s, 'gatherer') },
      { label: 'Построить Фильтр воды', target: 1, value: (s) => count(s, 'purifier') },
      { label: 'Построить Лесоруба', target: 1, value: (s) => count(s, 'woodcutter') },
      { label: 'Построить 2 хижины', target: 2, value: (s) => count(s, 'hut') },
      { label: 'Прожить 3 дня', target: 72, value: (s) => s.tick },
      { label: 'Сохранить 8 живых поселенцев', target: 8, value: (s) => (s.tick >= 72 ? living(s) : 0) },
    ],
  },
  { name: 'Медицина', playable: false, goals: [] },
  { name: 'Сельское хозяйство', playable: false, goals: [] },
  { name: 'Инженерия', playable: false, goals: [] },
  { name: 'Энергетика', playable: false, goals: [] },
];
