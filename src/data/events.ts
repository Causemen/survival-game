export interface GameEvent {
  id: string;
  name: string;
  /** Что видит игрок при начале события. */
  startText: string;
  endText: string;
  /** Шанс начала за тик (1 час), когда событие не активно. */
  chance: number;
  /** Не раньше этого тика. */
  from: number;
  duration: number;
  /** Изменение температуры окружающей среды, °. */
  ambientDelta?: number;
  /** Доп. потеря здоровья за тик у замёрзших (тепло ниже порога) и не живущих в хижине. */
  sickness?: { warmthBelow: number; healthLoss: number };
}

export const EVENTS: GameEvent[] = [
  {
    id: 'blizzard', name: 'Метель', chance: 0.012, from: 48, duration: 18, ambientDelta: -22,
    startText: 'Началась метель! Всюду холоднее на 22°, дрова горят вдвое быстрее.', endText: 'Метель стихла.',
  },
  {
    id: 'sickness', name: 'Болезнь', chance: 0.008, from: 72, duration: 24,
    sickness: { warmthBelow: 50, healthLoss: 0.8 },
    startText: 'В лагере началась болезнь: страдают замёрзшие и не живущие в хижинах.', endText: 'Болезнь отступила.',
  },
];
