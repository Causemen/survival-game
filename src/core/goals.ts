import { ERAS } from '../data/eras';
import type { State } from './types';

export interface GoalProgress {
  label: string;
  cur: number;
  target: number;
  done: boolean;
}

/** Прогресс по целям текущей эпохи; пусто, если эпоха ещё не открыта. */
export function goalProgress(s: State): GoalProgress[] {
  const era = ERAS[s.era];
  if (!era) return [];
  return era.goals.map((g) => {
    const cur = Math.min(g.target, g.value(s));
    return { label: g.label, cur, target: g.target, done: cur >= g.target };
  });
}

export function eraDone(s: State): boolean {
  const gs = goalProgress(s);
  return gs.length > 0 && gs.every((g) => g.done);
}
