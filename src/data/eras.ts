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
    // Темп по модели экономики (economy/ECONOMY.md): первая эпоха около 10 игровых дней.
    goals: [
      { label: 'Построить 3 Собирателя', target: 3, value: (s) => count(s, 'gatherer') },
      { label: 'Построить 2 Фильтра воды', target: 2, value: (s) => count(s, 'purifier') },
      { label: 'Построить Лесоруба', target: 1, value: (s) => count(s, 'woodcutter') },
      { label: 'Построить Каменоломню', target: 1, value: (s) => count(s, 'quarry') },
      { label: 'Построить 3 хижины', target: 3, value: (s) => count(s, 'hut') },
      { label: 'Изучить 2 технологии', target: 2, value: (s) => s.techs.length },
      { label: 'Прожить 10 дней', target: 240, value: (s) => s.tick },
      { label: 'Сохранить 8 живых поселенцев', target: 8, value: (s) => (s.tick >= 240 ? living(s) : 0) },
    ],
  },
  { name: 'Медицина', playable: false, goals: [] },
  { name: 'Сельское хозяйство', playable: false, goals: [] },
  { name: 'Инженерия', playable: false, goals: [] },
  { name: 'Энергетика', playable: false, goals: [] },
];
