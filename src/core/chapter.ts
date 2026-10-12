import { ERAS } from '../data/eras';
import type { State } from './types';

export interface ChapterSummary {
  /** Название только что пройденной эпохи. */
  era: string;
  day: number;
  alive: number;
  lost: number;
  buildings: number;
  techs: number;
  /** Следующая глава; null, если эпох больше нет. */
  next: { name: string; playable: boolean } | null;
}

/** Итог главы для экрана «Эпоха пройдена»; считается сразу после перехода на следующую эпоху. */
export function chapterSummary(s: State): ChapterSummary {
  const alive = s.settlers.filter((p) => p.alive).length;
  const next = ERAS[s.era];
  return {
    era: ERAS[Math.max(0, s.era - 1)]?.name ?? '',
    day: ((s.tick / 24) | 0) + 1,
    alive,
    lost: s.settlers.length - alive,
    buildings: s.buildings.length,
    techs: s.techs.length,
    next: next ? { name: next.name, playable: next.playable } : null,
  };
}
