import { describe, it, expect } from 'vitest';
import { initialState, step } from './state';

describe('step', () => {
  it('тратит еду и увеличивает тик', () => {
    const s = step(initialState());
    expect(s.tick).toBe(1);
    expect(s.food).toBeLessThan(100);
  });
  it('реактор покрывает тепло малой колонии', () => {
    expect(step(initialState()).heat).toBeGreaterThanOrEqual(50);
  });
});
