export interface State {
  tick: number;
  food: number;
  heat: number;
  water: number;
  people: number;
  reactorLevel: number;
}

export const initialState = (): State => ({
  tick: 0, food: 100, heat: 50, water: 80, people: 10, reactorLevel: 1,
});

/** Один игровой тик (1 час). Чистая функция — детерминированная симуляция, легко тестировать. */
export function step(s: State): State {
  const heatOut = 6 * s.reactorLevel;
  const heatNeed = s.people * 0.5;
  const heat = Math.max(0, s.heat + heatOut - heatNeed);
  return {
    ...s,
    tick: s.tick + 1,
    food: Math.max(0, s.food - s.people * 0.3),
    water: Math.max(0, s.water - s.people * 0.2),
    heat,
  };
}
