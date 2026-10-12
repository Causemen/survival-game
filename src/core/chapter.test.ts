import { describe, expect, it } from 'vitest';
import { chapterSummary } from './chapter';
import { initialState } from './sim';

describe('итог главы', () => {
  it('считает дни, живых и потери', () => {
    const s = initialState();
    s.era = 1;
    s.tick = 250;
    s.settlers[0]!.alive = false;
    const c = chapterSummary(s);
    expect(c.era).toBe('Выживание');
    expect(c.day).toBe(11);
    expect(c.alive).toBe(7);
    expect(c.lost).toBe(1);
    expect(c.next).toEqual({ name: 'Медицина', playable: false });
  });
  it('после последней эпохи следующей главы нет', () => {
    const s = { ...initialState(), era: 5 };
    expect(chapterSummary(s).next).toBeNull();
  });
});
