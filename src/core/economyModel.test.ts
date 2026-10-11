import { describe, expect, it } from 'vitest';
import { run } from './economyModel';
import { ERAS } from '../data/economy';

const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const runs = SEEDS.map((seed) => run(seed));

describe('баланс экономики (бот-игрок, дневная модель)', () => {
  it('все пять эпох проходятся за 60–100 игровых дней (около часа)', () => {
    for (const s of runs) {
      expect(s.era).toBe(ERAS.length);
      const end = s.eraDay[ERAS.length]!;
      expect(end).toBeGreaterThanOrEqual(60);
      expect(end).toBeLessThanOrEqual(100);
    }
  });
  it('при разумной игре гибнет не больше 3 человек', () => {
    for (const s of runs) expect(s.dead).toBeLessThanOrEqual(3);
  });
  it('голода и жажды почти нет', () => {
    for (const s of runs) expect(s.starveDays).toBeLessThanOrEqual(3);
  });
  it('без построек колония гибнет за неделю (еда и вода — не бесплатные)', () => {
    const s = run(1, 7, true);
    expect(s.pop).toBeLessThan(8);
  });
});
