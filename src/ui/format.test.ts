import { describe, expect, it } from 'vitest';
import { costText, missingText, RateTracker, rateText } from './format';

const res = { wood: 12, stone: 3, food: 0, water: 0, knowledge: 0 };

describe('форматирование интерфейса', () => {
  it('пишет цену словами', () => {
    expect(costText({ wood: 15, stone: 10 })).toBe('15 дерева + 10 камня');
    expect(costText({ wood: 20 })).toBe('20 дерева');
  });

  it('показывает, чего не хватает', () => {
    expect(missingText(res, { wood: 15, stone: 10 })).toBe('ещё 3 дерева + 7 камня');
    expect(missingText(res, { wood: 10 })).toBe('');
  });

  it('форматирует скорость со знаком', () => {
    expect(rateText(12.4)).toBe('+12');
    expect(rateText(-3)).toBe('−3');
    expect(rateText(0.2)).toBe('0');
  });

  it('считает скорость за сутки', () => {
    const t = new RateTracker();
    t.record(res, { ...res, food: 1 });
    expect(t.perDay.food).toBe(24);
    t.reset();
    expect(t.perDay.food).toBe(0);
  });
});
