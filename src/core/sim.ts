import { BUILDINGS, HUT_CAPACITY, PRODUCTION } from '../data/buildings';
import { TECHS } from '../data/techs';
import { eraDone } from './goals';
import type { BuildingKind, Resources, Settler, State } from './types';

export const AMBIENT = -20;
export const COMFORT = 10;

export function reactorRadius(level: number): number {
  return 4 + 2 * level;
}

export function initialState(): State {
  const w = 24;
  const h = 16;
  const reactor = { x: 12, y: 8, level: 1 };
  const settlers: Settler[] = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    x: reactor.x + (i % 3) - 1,
    y: reactor.y + 1 + ((i / 3) | 0),
    warmth: 70,
    hunger: 80,
    thirst: 80,
    health: 100,
    alive: true,
  }));
  return {
    tick: 0, w, h, reactor, buildings: [], settlers,
    res: { wood: 60, stone: 20, food: 60, water: 60, knowledge: 0 },
    nextId: 100,
    era: 0,
    techs: [],
  };
}

/** Температура клетки: холод окружающей среды + тепло реактора и костров. */
export function tempAt(s: State, x: number, y: number): number {
  const d = Math.hypot(x - s.reactor.x, y - s.reactor.y);
  const R = reactorRadius(s.reactor.level);
  let t = AMBIENT + 45 * Math.max(0, 1 - d / R);
  for (const b of s.buildings) {
    if (b.kind !== 'campfire') continue;
    t += 25 * Math.max(0, 1 - Math.hypot(x - b.x, y - b.y) / 2.5);
  }
  return t;
}

export function canAfford(res: Resources, kind: BuildingKind): boolean {
  const c = BUILDINGS[kind].cost;
  return res.wood >= (c.wood ?? 0) && res.stone >= (c.stone ?? 0);
}

export function isFree(s: State, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  if (x === s.reactor.x && y === s.reactor.y) return false;
  return !s.buildings.some((b) => b.x === x && b.y === y);
}

/** Строит здание; возвращает null, если нельзя. */
export function build(s: State, kind: BuildingKind, x: number, y: number): State | null {
  if (!isFree(s, x, y) || !canAfford(s.res, kind)) return null;
  const c = BUILDINGS[kind].cost;
  return {
    ...s,
    buildings: [...s.buildings, { id: s.nextId, kind, x, y }],
    nextId: s.nextId + 1,
    res: { ...s.res, wood: s.res.wood - (c.wood ?? 0), stone: s.res.stone - (c.stone ?? 0) },
  };
}

/** Множитель производства здания от изученных технологий. */
export function prodMult(s: State, kind: BuildingKind): number {
  return s.techs.reduce((m, id) => m * (TECHS.find((t) => t.id === id)?.prod?.[kind] ?? 1), 1);
}
const techSum = (s: State, f: 'hutCapacity' | 'hutWarmth'): number =>
  s.techs.reduce((a, id) => a + (TECHS.find((t) => t.id === id)?.[f] ?? 0), 0);

/** Изучает технологию за знания; null, если нельзя. */
export function research(s: State, id: string): State | null {
  const t = TECHS.find((x) => x.id === id);
  if (!t || s.techs.includes(id) || s.era < t.era || s.res.knowledge < t.cost) return null;
  if (t.requires?.some((r) => !s.techs.includes(r))) return null;
  return { ...s, techs: [...s.techs, id], res: { ...s.res, knowledge: s.res.knowledge - t.cost } };
}

export const alive = (s: State): Settler[] => s.settlers.filter((p) => p.alive);
export const isGameOver = (s: State): boolean => alive(s).length === 0;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Один тик = 1 игровой час. Чистая функция. */
export function step(s: State): State {
  const res = { ...s.res };
  const living = alive(s);

  // Работники закреплены за зданиями по порядку; без работника здание простаивает.
  const workplaces = s.buildings.filter((b) => BUILDINGS[b.kind].worker);
  const workerOf = new Map<number, number>();
  living.forEach((p, i) => {
    const b = workplaces[i];
    if (b) workerOf.set(p.id, b.id);
  });
  for (const b of workplaces) {
    if (![...workerOf.values()].includes(b.id)) continue;
    const prod = PRODUCTION[b.kind];
    if (!prod) continue;
    for (const k of Object.keys(prod) as (keyof Resources)[]) res[k] += (prod[k] ?? 0) * prodMult(s, b.kind);
  }
  res.knowledge += living.length * 0.1;

  const huts = s.buildings.filter((b) => b.kind === 'hut').length;
  let housed = huts * (HUT_CAPACITY + techSum(s, 'hutCapacity'));

  const settlers = s.settlers.map((p): Settler => {
    if (!p.alive) return p;
    const bId = workerOf.get(p.id);
    const wb = bId ? s.buildings.find((b) => b.id === bId) : undefined;
    const x = wb ? wb.x : s.reactor.x + ((p.id % 3) - 1);
    const y = wb ? wb.y : s.reactor.y + 1;
    let temp = tempAt(s, x, y);
    if (housed > 0) {
      housed--;
      temp += 12 + techSum(s, 'hutWarmth');
    }
    let { warmth, hunger, thirst, health } = p;
    warmth = clamp(warmth + clamp((temp - COMFORT) * 0.08, -3, 1), 0, 100);
    hunger = clamp(hunger - 0.4, 0, 100);
    thirst = clamp(thirst - 0.6, 0, 100);
    if (hunger < 50 && res.food >= 1) { res.food -= 1; hunger = clamp(hunger + 30, 0, 100); }
    if (thirst < 50 && res.water >= 1) { res.water -= 1; thirst = clamp(thirst + 30, 0, 100); }
    const suffering = warmth <= 0 || hunger <= 0 || thirst <= 0;
    health = suffering ? health - 1.5 : warmth > 30 && hunger > 30 && thirst > 30 ? Math.min(100, health + 0.2) : health;
    return { ...p, x, y, warmth, hunger, thirst, health, alive: health > 0 };
  });

  const next: State = { ...s, tick: s.tick + 1, res, settlers };
  // Эпоха пройдена: награда — реактор усиливается (больше радиус тепла) и приходят знания.
  if (eraDone(next)) {
    return { ...next, era: next.era + 1, reactor: { ...next.reactor, level: next.reactor.level + 1 }, res: { ...res, knowledge: res.knowledge + 20 } };
  }
  return next;
}
