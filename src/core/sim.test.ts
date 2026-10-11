import { describe, it, expect } from 'vitest';
import { build, initialState, isGameOver, step, tempAt, AMBIENT } from './sim';

const run = (s: ReturnType<typeof initialState>, n: number) => {
  for (let i = 0; i < n; i++) s = step(s);
  return s;
};

describe('температура', () => {
  it('у реактора тепло, вдали — холод', () => {
    const s = initialState();
    expect(tempAt(s, s.reactor.x, s.reactor.y)).toBeGreaterThan(20);
    expect(tempAt(s, 0, 0)).toBe(AMBIENT);
  });
  it('костёр греет соседние клетки', () => {
    const s = build(initialState(), 'campfire', 1, 1)!;
    expect(tempAt(s, 1, 2)).toBeGreaterThan(AMBIENT);
  });
});

describe('строительство', () => {
  it('списывает ресурсы', () => {
    const s = build(initialState(), 'hut', 1, 1)!;
    expect(s.res.wood).toBe(40);
  });
  it('нельзя на реактор, за карту и без ресурсов', () => {
    const s = initialState();
    expect(build(s, 'hut', s.reactor.x, s.reactor.y)).toBeNull();
    expect(build(s, 'hut', -1, 0)).toBeNull();
    expect(build({ ...s, res: { ...s.res, wood: 0 } }, 'hut', 1, 1)).toBeNull();
  });
  it('нельзя на занятую клетку', () => {
    const s = build(initialState(), 'hut', 1, 1)!;
    expect(build(s, 'hut', 1, 1)).toBeNull();
  });
});

describe('симуляция', () => {
  it('работник на здании даёт ресурс', () => {
    const s = build(initialState(), 'woodcutter', 1, 1)!;
    expect(step(s).res.wood).toBeGreaterThan(s.res.wood);
  });
  it('без еды и воды колония вымирает', () => {
    const s0 = initialState();
    const s = run({ ...s0, res: { ...s0.res, food: 0, water: 0 } }, 400);
    expect(isGameOver(s)).toBe(true);
  });
  it('с едой, водой и работой колония выживает сутки', () => {
    let s = initialState();
    s = build(s, 'gatherer', 11, 7)!;
    s = build(s, 'gatherer', 13, 7)!;
    s = build(s, 'woodcutter', 11, 9)!;
    s = build(s, 'purifier', 13, 9)!;
    s = run(s, 24);
    expect(s.settlers.filter((p) => p.alive).length).toBe(8);
  });
});

import { goalProgress } from './goals';

describe('цели и эпохи', () => {
  it('цели считают построенное', () => {
    const s = build(initialState(), 'gatherer', 1, 1)!;
    expect(goalProgress(s).find((g) => g.label.includes('Собирателя'))!.done).toBe(true);
  });
  it('прохождение эпохи усиливает реактор и открывает следующую', () => {
    let s = initialState();
    s = { ...s, res: { ...s.res, wood: 500, stone: 100, food: 500, water: 500 } };
    for (const [k, x, y] of [['gatherer', 11, 7], ['purifier', 13, 7], ['woodcutter', 11, 9], ['hut', 13, 9], ['hut', 12, 10]] as const) s = build(s, k, x, y)!;
    s = run(s, 80);
    expect(s.era).toBe(1);
    expect(s.reactor.level).toBe(2);
  });
});
