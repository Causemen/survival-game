import { BLIZZARD_FUEL_MULT, BUILDINGS, FOOD_RESTORE, FUEL_PER_HOUR, HEAT_PER_RESIDENT, HEAT_USE, HUNGER_DROP, HUT_CAPACITY, MIN_HEAT_FACTOR, NIGHT_DELTA, NIGHT_FUEL_MULT, PRODUCTION, reactorHeat, START_RES, THIRST_DROP, WATER_RESTORE } from '../data/buildings';
import { EVENTS } from '../data/events';
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
    res: { ...START_RES },
    nextId: 100,
    era: 0,
    techs: [],
    seed: 1,
    lit: true,
    active: [],
    log: [],
  };
}

const activeEvents = (s: State) => s.active.flatMap((a) => EVENTS.filter((e) => e.id === a.id));
export const ambientShift = (s: State): number => activeEvents(s).reduce((a, e) => a + (e.ambientDelta ?? 0), 0);

/** Детерминированный «случайный» ответ [0,1) для (тик, соль): симуляция воспроизводима. */
export function rand(s: State, salt: number): number {
  let x = (s.seed + s.tick * 7919 + salt * 104729) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export const isNight = (tick: number): boolean => tick % 24 >= 20 || tick % 24 < 6;
export const nightShift = (s: State): number => (isNight(s.tick) ? NIGHT_DELTA : 0);

/** Сколько ТЕ реактора забирают жители и здания. */
export function heatDemand(s: State): number {
  const use = s.buildings.reduce((a, b) => a + Math.max(0, HEAT_USE[b.kind]), 0);
  return alive(s).length * HEAT_PER_RESIDENT + use;
}

/** Тепловая ёмкость: реактор плюс горящие костры. */
export function heatCapacity(s: State): number {
  const fires = s.lit ? s.buildings.filter((b) => b.kind === 'campfire').length : 0;
  return reactorHeat(s.reactor.level) - HEAT_USE.campfire * fires;
}

/** Доля полного обогрева от реактора: 1, пока бюджет сходится, ниже — при перегрузке. */
export function heatFactor(s: State): number {
  const d = heatDemand(s);
  return d <= 0 ? 1 : Math.max(MIN_HEAT_FACTOR, Math.min(1, heatCapacity(s) / d));
}

/** Дров в час на костры и хижины с учётом ночи и метели. */
export function fuelNeed(s: State): number {
  const base = s.buildings.reduce((a, b) => a + (b.kind === 'campfire' ? FUEL_PER_HOUR.campfire : b.kind === 'hut' ? FUEL_PER_HOUR.hut : 0), 0);
  const blizzard = s.active.some((a) => a.id === 'blizzard');
  return base * (isNight(s.tick) ? NIGHT_FUEL_MULT : 1) * (blizzard ? BLIZZARD_FUEL_MULT : 1);
}

/** Температура клетки: холод среды (ночью холоднее) + тепло реактора (с учётом бюджета) и костров. */
export function tempAt(s: State, x: number, y: number): number {
  const d = Math.hypot(x - s.reactor.x, y - s.reactor.y);
  const R = reactorRadius(s.reactor.level);
  let t = AMBIENT + ambientShift(s) + nightShift(s) + 45 * heatFactor(s) * Math.max(0, 1 - d / R);
  for (const b of s.buildings) {
    if (b.kind !== 'campfire' || !s.lit) continue;
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

/** Завершает истёкшие события и с заданным шансом запускает новые. */
function updateEvents(s: State): State {
  let { active, log } = s;
  for (const a of active.filter((x) => x.until <= s.tick)) {
    log = [...log, { tick: s.tick, text: EVENTS.find((e) => e.id === a.id)?.endText ?? '' }];
  }
  active = active.filter((a) => a.until > s.tick);
  EVENTS.forEach((e, i) => {
    if (s.tick < e.from || active.some((a) => a.id === e.id)) return;
    if (rand(s, i + 1) < e.chance) {
      active = [...active, { id: e.id, until: s.tick + e.duration }];
      log = [...log, { tick: s.tick, text: e.startText }];
    }
  });
  return { ...s, active, log: log.slice(-6) };
}

/** На сколько часов вперёд игрок видит события. */
export const FORECAST_HOURS = 36;

/**
 * Прогноз событий: какие начнутся в ближайшие часы и через сколько. Точный, а не «примерный»:
 * случайность детерминирована (seed + тик), а на начало событий влияет только список активных.
 */
export function forecast(s: State, hours = FORECAST_HOURS): { id: string; inHours: number }[] {
  const out: { id: string; inHours: number }[] = [];
  let cur = s;
  for (let k = 1; k <= hours; k++) {
    const had = new Set(cur.active.map((a) => a.id));
    cur = updateEvents({ ...cur, tick: cur.tick + 1 });
    for (const a of cur.active) if (!had.has(a.id)) out.push({ id: a.id, inHours: k });
  }
  return out;
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

  // Топка: костры и хижины жгут дрова; кончились — всё гаснет, пока не хватит на час растопки.
  const need = fuelNeed(s);
  const lit = res.wood >= need;
  if (lit) res.wood -= need;
  const sl: State = { ...s, lit };

  const huts = s.buildings.filter((b) => b.kind === 'hut').length;
  let housed = huts * (HUT_CAPACITY + techSum(s, 'hutCapacity'));

  const settlers = s.settlers.map((p): Settler => {
    if (!p.alive) return p;
    const bId = workerOf.get(p.id);
    const wb = bId ? s.buildings.find((b) => b.id === bId) : undefined;
    const x = wb ? wb.x : s.reactor.x + ((p.id % 3) - 1);
    const y = wb ? wb.y : s.reactor.y + 1;
    let temp = tempAt(sl, x, y);
    const inHut = housed > 0;
    if (inHut) {
      housed--;
      if (lit) temp += 12 + techSum(s, 'hutWarmth');
    }
    let { warmth, hunger, thirst, health } = p;
    warmth = clamp(warmth + clamp((temp - COMFORT) * 0.08, -3, 1), 0, 100);
    hunger = clamp(hunger - HUNGER_DROP, 0, 100);
    thirst = clamp(thirst - THIRST_DROP, 0, 100);
    if (hunger < 50 && res.food >= 1) { res.food -= 1; hunger = clamp(hunger + FOOD_RESTORE, 0, 100); }
    if (thirst < 50 && res.water >= 1) { res.water -= 1; thirst = clamp(thirst + WATER_RESTORE, 0, 100); }
    const suffering = warmth <= 0 || hunger <= 0 || thirst <= 0;
    health = suffering ? health - 1.5 : warmth > 30 && hunger > 30 && thirst > 30 ? Math.min(100, health + 0.2) : health;
    for (const e of activeEvents(s)) {
      if (e.sickness && !inHut && warmth < e.sickness.warmthBelow) health -= e.sickness.healthLoss;
    }
    return { ...p, x, y, warmth, hunger, thirst, health, alive: health > 0 };
  });

  let next: State = { ...s, tick: s.tick + 1, res, settlers, lit };
  next = updateEvents(next);
  // Эпоха пройдена: награда — реактор усиливается (больше радиус тепла) и приходят знания.
  if (eraDone(next)) {
    return { ...next, era: next.era + 1, reactor: { ...next.reactor, level: next.reactor.level + 1 }, res: { ...res, knowledge: res.knowledge + 20 } };
  }
  return next;
}
