import { describe, it, expect } from 'vitest';
import { build, forecast, initialState, isGameOver, research, step, tempAt, AMBIENT, nightShift, heatFactor, heatDemand, heatCapacity, isNight } from './sim';

const run = (s: ReturnType<typeof initialState>, n: number) => {
  for (let i = 0; i < n; i++) s = step(s);
  return s;
};

describe('температура', () => {
  it('у реактора тепло, вдали — холод', () => {
    const s = { ...initialState(), tick: 12 };
    expect(tempAt(s, s.reactor.x, s.reactor.y)).toBeGreaterThan(20);
    expect(tempAt(s, 0, 0)).toBe(AMBIENT + nightShift(s));
  });
  it('костёр греет соседние клетки', () => {
    const s = build(initialState(), 'campfire', 1, 1)!;
    expect(tempAt(s, 1, 2)).toBeGreaterThan(AMBIENT);
  });
});

describe('строительство', () => {
  it('списывает ресурсы', () => {
    const s = build(initialState(), 'hut', 1, 1)!;
    expect(s.res.wood).toBe(25);
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
    expect(goalProgress(s).find((g) => g.label.includes('Собирател'))!.cur).toBe(1);
  });
  it('прохождение эпохи усиливает реактор и открывает следующую', () => {
    let s = initialState();
    s = { ...s, res: { ...s.res, wood: 900, stone: 300, food: 2000, water: 2000, knowledge: 100 } };
    for (const [k, x, y] of [['gatherer', 11, 7], ['gatherer', 13, 7], ['gatherer', 12, 6], ['purifier', 11, 9], ['purifier', 13, 9], ['woodcutter', 12, 10], ['quarry', 10, 9], ['hut', 10, 8], ['hut', 14, 8], ['hut', 12, 11]] as const) s = build(s, k, x, y)!;
    s = research(research(s, 'boiling')!, 'foraging')!;
    s = run(s, 239);
    expect(s.era).toBe(0);
    s = run(s, 2);
    expect(s.era).toBe(1);
    expect(s.reactor.level).toBe(2);
  });
});


describe('технологии', () => {
  it('изучение тратит знания и усиливает производство', () => {
    let s = build(initialState(), 'purifier', 1, 1)!;
    const before = step(s).res.water - s.res.water;
    s = { ...s, res: { ...s.res, knowledge: 50 } };
    s = research(s, 'boiling')!;
    expect(s.res.knowledge).toBe(38);
    expect(step(s).res.water - s.res.water).toBeGreaterThan(before);
  });
  it('нельзя без знаний, дважды и без требований', () => {
    const s = initialState();
    expect(research(s, 'boiling')).toBeNull();
    const rich = { ...s, res: { ...s.res, knowledge: 100 } };
    expect(research(rich, 'shelters')).toBeNull();
    expect(research(research(rich, 'boiling')!, 'boiling')).toBeNull();
  });
});

import { rand, ambientShift } from './sim';
import { EVENTS } from '../data/events';

describe('события', () => {
  it('rand детерминирован и в диапазоне', () => {
    const s = initialState();
    expect(rand(s, 1)).toBe(rand(s, 1));
    for (let i = 0; i < 100; i++) { const r = rand({ ...s, tick: i }, 2); expect(r).toBeGreaterThanOrEqual(0); expect(r).toBeLessThan(1); }
  });
  it('до порога событий нет, затем метель случается и охлаждает карту', () => {
    let s = { ...initialState(), res: { wood: 0, stone: 0, food: 1e6, water: 1e6, knowledge: 0 } };
    let sawBlizzard = false;
    for (let i = 0; i < 1500 && !sawBlizzard; i++) {
      s = step(s);
      if (s.tick < 48) expect(s.active.length).toBe(0);
      if (s.active.some((a) => a.id === 'blizzard')) {
        sawBlizzard = true;
        expect(ambientShift(s)).toBe(EVENTS.find((e) => e.id === 'blizzard')!.ambientDelta);
        expect(tempAt(s, 0, 0)).toBeLessThan(AMBIENT);
        expect(s.log.length).toBeGreaterThan(0);
      }
    }
    expect(sawBlizzard).toBe(true);
  });
  it('событие заканчивается', () => {
    let s = { ...initialState(), active: [{ id: 'blizzard', until: 5 }], tick: 4 };
    s = step(s);
    expect(s.active.length).toBe(0);
  });
});

describe('экономика: потребление и выработка в сутки', () => {
  it('8 поселенцев съедают и выпивают около 16 за сутки', () => {
    const s0 = { ...initialState(), res: { wood: 0, stone: 0, food: 1000, water: 1000, knowledge: 0 } };
    const warm = run(s0, 24 * 5); // первые сутки люди ещё сыты, меряем установившийся расход
    const s = run(warm, 24 * 5);
    expect((warm.res.food - s.res.food) / 5).toBeGreaterThan(14);
        expect((warm.res.water - s.res.water) / 5).toBeGreaterThan(14);
    expect((warm.res.water - s.res.water) / 5).toBeLessThan(18);
  });
  it('разумное начало (3 собирателя, 2 фильтра, лесоруб, 2 хижины) держит колонию 10 суток', () => {
    let s = { ...initialState(), res: { wood: 300, stone: 100, food: 30, water: 24, knowledge: 0 } };
    for (const [k, x, y] of [['gatherer', 11, 7], ['gatherer', 13, 7], ['gatherer', 12, 6], ['purifier', 11, 9], ['purifier', 13, 9], ['woodcutter', 12, 10], ['hut', 10, 8], ['hut', 14, 8]] as const) s = build(s, k, x, y)!;
    s = run(s, 24 * 10);
    expect(s.settlers.filter((p) => p.alive).length).toBe(8);
    expect(s.res.food).toBeGreaterThan(0);
    expect(s.res.water).toBeGreaterThan(0);
  });
});

describe('прогноз событий', () => {
  it('совпадает с тем, что реально произойдёт', () => {
    let s = initialState();
    s = { ...s, tick: 40 };
    const fc = forecast(s, 60);
    expect(fc.length).toBeGreaterThan(0);
    const first = fc[0]!;
    for (let i = 1; i < first.inHours; i++) {
      s = step(s);
      expect(s.active.some((a) => a.id === first.id)).toBe(false);
    }
    s = step(s);
    expect(s.active.some((a) => a.id === first.id)).toBe(true);
  });
  it('не обещает уже идущее событие', () => {
    const s = { ...initialState(), tick: 100, active: [{ id: 'blizzard', until: 105 }] };
    expect(forecast(s, 3).some((f) => f.id === 'blizzard')).toBe(false);
  });
});

describe('тепловой бюджет, дрова, ночь', () => {
  it('перегрузка бюджета ослабляет обогрев, костёр повышает ёмкость', () => {
    let s = { ...initialState(), tick: 12, res: { ...initialState().res, wood: 900, stone: 900 } };
    expect(heatFactor(s)).toBe(1);
    for (let i = 0; i < 9; i++) s = build(s, 'purifier', 1 + i, 1)!;
    expect(heatDemand(s)).toBeGreaterThan(heatCapacity(s));
    const hot = heatFactor(s);
    expect(hot).toBeLessThan(1);
    expect(tempAt(s, s.reactor.x + 1, s.reactor.y)).toBeLessThan(tempAt({ ...initialState(), tick: 12 }, s.reactor.x + 1, s.reactor.y));
    const withFire = build(s, 'campfire', 20, 14)!;
    expect(heatFactor(withFire)).toBeGreaterThan(hot);
  });
  it('ночью холоднее', () => {
    const s = initialState();
    expect(isNight(2)).toBe(true);
    expect(isNight(13)).toBe(false);
    expect(tempAt({ ...s, tick: 13 }, 0, 0)).toBeGreaterThan(tempAt({ ...s, tick: 2 }, 0, 0));
  });
  it('костёр и хижины жгут дрова; без дров гаснут', () => {
    let s = build(build(initialState(), 'campfire', 1, 1)!, 'hut', 2, 2)!;
    s = { ...s, tick: 12, res: { ...s.res, wood: 10 } };
    expect(step(s).res.wood).toBeLessThan(10);
    expect(step(s).lit).toBe(true);
    const dry = step({ ...s, res: { ...s.res, wood: 0 } });
    expect(dry.lit).toBe(false);
    expect(tempAt(dry, 1, 2)).toBeLessThan(tempAt(s, 1, 2));
  });
});

import { resolveDilemma } from './sim';
describe('выборы с ценой', () => {
  it('выбор появляется к своему сроку', () => {
    let s = { ...initialState(), res: { ...initialState().res, food: 1e6, water: 1e6 } };
    s = run(s, 59);
    expect(s.dilemma).toBeNull();
    s = run(s, 2);
    expect(s.dilemma).not.toBeNull();
  });
  it('решение применяет цену и назначает следующий выбор', () => {
    const s0 = { ...initialState(), dilemma: 'cough', tick: 70 };
    const s = resolveDilemma(s0, 0)!;
    expect(s.dilemma).toBeNull();
    expect(s.dilemmaAt).toBeGreaterThan(70);
    expect(s.res.water).toBe(s0.res.water - 10);
    const hurt = resolveDilemma(s0, 1)!;
    expect(hurt.settlers[0]!.health).toBe(88);
  });
  it('нельзя выбрать вариант без ресурсов', () => {
    const s0 = { ...initialState(), dilemma: 'traders', tick: 70, res: { ...initialState().res, wood: 0 } };
    expect(resolveDilemma(s0, 0)).toBeNull();
    expect(resolveDilemma(s0, 1)).not.toBeNull();
  });
  it('риск: бывает и выигрыш, и проигрыш', () => {
    const outs = new Set<string>();
    for (let t = 0; t < 40; t++) {
      const r = resolveDilemma({ ...initialState(), dilemma: 'ruins', tick: 100 + t }, 0)!;
      outs.add(r.res.food > initialState().res.food ? 'win' : 'lose');
    }
    expect(outs.size).toBe(2);
  });
  it('еда портится', () => {
    const s0 = { ...initialState(), res: { ...initialState().res, food: 1000 } };
    expect(step(s0).res.food).toBeLessThan(1000);
  });
});
