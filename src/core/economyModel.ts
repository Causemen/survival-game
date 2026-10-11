/** Дневная модель экономики для проверки баланса. Бот-игрок строит и распределяет людей по правилам. */
import {
  ARRIVAL_EVERY, B, ERAS, FOOD_SPOIL, FOOD_SPOIL_CELLAR, HEAL_CARE, HEAL_NONE, HEAT_PER_RESIDENT,
  KNOWLEDGE_PER_PERSON, PERSON_DAY, REACTOR_HEAT, SICK_BASE, SICK_COLD, SICK_DEATH, START, TOOLS_BONUS, TOOLS_WEAR,
  type Bld, type Res,
} from '../data/economy';


type Stock = Record<Res, number>;
const ALL: Res[] = ['food', 'water', 'wood', 'stone', 'scrap', 'knowledge', 'herbs', 'medicine', 'fertilizer', 'bricks', 'metal', 'tools', 'power'];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export interface Sim {
  day: number; era: number; pop: number; sick: number; dead: number;
  res: Stock; built: Record<string, number>; eraDay: number[];
  idleDays: number; starveDays: number; coldDays: number; jobs: Record<string, number>;
  maxStock: Partial<Stock>; spentKnowledge: number;
  kDay: number[]; bDay: number[];
}

const bd = (k: string): Bld => B[k]!;
const count = (s: Sim, k: string) => s.built[k] ?? 0;
const unlocked = (s: Sim) => Object.keys(B).filter((k) => bd(k).era <= s.era);
const heatCap = (s: Sim) => (REACTOR_HEAT[s.era] ?? REACTOR_HEAT[REACTOR_HEAT.length - 1]!) + Object.keys(s.built).reduce((a, k) => a + Math.max(0, -bd(k).heat) * count(s, k), 0);
const heatUse = (s: Sim) => Object.keys(s.built).reduce((a, k) => a + Math.max(0, bd(k).heat) * count(s, k), 0) + s.pop * HEAT_PER_RESIDENT;
const housing = (s: Sim) => count(s, 'hut') * 4;

function affordable(s: Sim, k: string) {
  return Object.entries(bd(k).cost).every(([r, v]) => s.res[r as Res] >= (v ?? 0));
}
function pay(s: Sim, k: string) {
  for (const [r, v] of Object.entries(bd(k).cost)) s.res[r as Res] -= v ?? 0;
  s.built[k] = count(s, k) + 1;
}

/** Бот: что строить. Сначала аварийные нужды, потом обязательные здания эпохи, потом расширение. */
function wantBuild(s: Sim, need: Partial<Record<string, number>>): string[] {
  const q: string[] = [];
  if (count(s, 'woodcutter') < 1) q.push('woodcutter'); // без дерева — тупик
  const foodNeed = s.pop * PERSON_DAY.food * 1.2;
  const foodSlots = count(s, 'forager') * 2 * 6 + count(s, 'greenhouse') * 2 * 15;
  const waterNeed = s.pop * PERSON_DAY.water * 1.2 + count(s, 'greenhouse') * 6 + count(s, 'apothecary') * 2;
  if (foodSlots < foodNeed) q.push(s.era >= 2 ? 'greenhouse' : 'forager');
  if (count(s, 'melter') * 24 < waterNeed) q.push('melter');
  if (count(s, 'woodcutter') < 1 + (s.era >= 3 ? 2 : s.pop > 12 ? 1 : 0)) q.push('woodcutter');
  if (housing(s) < s.pop + 1) q.push('hut');
  if (heatUse(s) + 4 > heatCap(s)) q.push(s.era >= 3 ? 'pipes' : 'stove');
  for (const [k, n] of Object.entries(need)) if (count(s, k) < (n ?? 0)) q.push(k);
  if (count(s, 'quarry') < 1) q.push('quarry');
  if (count(s, 'scavenger') < (s.era >= 3 ? 2 : 1)) q.push('scavenger');
  if (count(s, 'study') < 1 + Math.floor(s.era / 2)) q.push('study');
  if (s.era >= 1 && count(s, 'herbs') < 1) q.push('herbs');
  if (s.era >= 3 && count(s, 'quarry') < 2) q.push('quarry');
  return q.filter((k) => unlocked(s).includes(k));
}

/** Работники: сначала вода и еда на 1.2 дня вперёд (или больше при малом запасе), затем входы цепочек, остаток — знания и материалы. */
function assign(s: Sim, workers: number, mult: number): Record<string, number> {
  const jobs: Record<string, number> = {};
  let free = workers;
  const slots = (k: string) => count(s, k) * (bd(k).slots ?? 0) - (jobs[k] ?? 0);
  const put = (k: string, want: number) => {
    const n = Math.max(0, Math.min(free, slots(k), Math.ceil(want)));
    jobs[k] = (jobs[k] ?? 0) + n; free -= n; return n;
  };
  const per = (k: string, r: Res) => (bd(k).out?.[r] ?? 0) * mult;
  const buffer = (r: Res, daily: number) => (s.res[r] < daily * 3 ? 1.5 : s.res[r] > daily * 8 ? 0.6 : 1.1);

  const ghWater = () => (jobs.greenhouse ?? 0) * 3;
  const foodDaily = s.pop * PERSON_DAY.food;
  // еда: теплицы выгоднее собирателей
  let foodLeft = foodDaily * buffer('food', foodDaily) - (s.res.fertilizer > 0 ? 0 : 0);
  for (const k of ['greenhouse', 'forager']) {
    if (!count(s, k)) continue;
    const boost = k === 'greenhouse' ? (count(s, 'compost') ? 1.4 : 1) * (count(s, 'lamps') && s.res.power > 0 ? 1.5 : 1) : 1;
    foodLeft -= put(k, foodLeft / (per(k, 'food') * boost)) * per(k, 'food') * boost;
  }
  if (count(s, 'compost') && count(s, 'greenhouse')) put('compost', 1);
  const waterDaily = s.pop * PERSON_DAY.water + ghWater() + count(s, 'apothecary') * 2;
  put('melter', (waterDaily * buffer('water', waterDaily)) / per('melter', 'water'));
  if (s.era >= 4) put('turbine', 2);
  if (s.sick > 0 || s.res.medicine < 4) { put('apothecary', 1); put('herbs', 2); }
  if (s.sick > 0) put('infirmary', Math.ceil(s.sick / 3));
  // материалы цепочек
  if (s.era >= 3) {
    put('scavenger', 2); put('brickworks', 2); put('smelter', 2);
    if (s.res.tools < 10) put('workshop', 1);
  }
  const woodUse = count(s, 'stove') * 3 + (jobs.brickworks ?? 0) + (jobs.smelter ?? 0) * 2 + (jobs.workshop ?? 0);
  put('woodcutter', Math.max(1, (woodUse + 8) / per('woodcutter', 'wood')));
  put('quarry', s.res.stone < 40 ? 2 : 1);
  put('scavenger', 1);
  put('study', 99);
  put('woodcutter', 99); put('quarry', 99); put('scavenger', 99);
  jobs.idle = free;
  return jobs;
}

export function run(seed: number, days = 140, noBuild = false): Sim {
  const r = rng(seed);
  const s: Sim = {
    day: 0, era: 0, pop: START.pop, sick: 0, dead: 0, built: {}, eraDay: [0],
    res: Object.fromEntries(ALL.map((k) => [k, START.res[k] ?? 0])) as Stock,
    idleDays: 0, starveDays: 0, coldDays: 0, jobs: {}, maxStock: {}, spentKnowledge: 0, kDay: [], bDay: [],
  };
  for (; s.day < days && s.era < ERAS.length; s.day++) {
    const era = ERAS[s.era]!;
    // стройка (до 2 зданий в день — бригада строителей)
    for (let i = 0; i < (noBuild ? 0 : 2); i++) {
      const k = wantBuild(s, era.need).find((x) => affordable(s, x));
      if (k) pay(s, k);
    }
    const cap = heatCap(s), use = heatUse(s);
    const heatRatio = Math.min(1, cap / Math.max(1, use));
    if (heatRatio < 1) s.coldDays++;
    const mult = (0.5 + 0.5 * heatRatio) * (s.res.tools > 0 ? 1 + TOOLS_BONUS : 1);
    const workers = s.pop - s.sick;
    const jobs = assign(s, workers, mult);
    s.jobs = jobs;
    // производство
    for (const [k, n] of Object.entries(jobs)) {
      const b = bd(k);
      if (!b || !n) continue;
      let eff = n;
      for (const [ri, v] of Object.entries(b.in ?? {})) eff = Math.min(eff, s.res[ri as Res] / (v ?? 1));
      for (const [ri, v] of Object.entries(b.in ?? {})) s.res[ri as Res] -= (v ?? 0) * eff;
      let boost = mult;
      if (k === 'greenhouse') {
        if (s.res.fertilizer >= count(s, 'greenhouse')) { s.res.fertilizer -= count(s, 'greenhouse'); boost *= 1.4; }
        if (count(s, 'lamps') && s.res.power >= 4 * count(s, 'lamps')) boost *= 1.5;
      }
      if (k === 'turbine' || k === 'apothecary' || k === 'brickworks' || k === 'smelter' || k === 'workshop' || k === 'compost') boost = 1;
      for (const [ro, v] of Object.entries(b.out ?? {})) s.res[ro as Res] += (v ?? 0) * eff * boost;
    }
    s.res.tools = Math.max(0, s.res.tools - TOOLS_WEAR * (workers - (jobs.idle ?? 0)) * (s.res.tools > 0 ? 1 : 0));
    for (const k of Object.keys(s.built)) for (const [ru, v] of Object.entries(bd(k).upkeep ?? {})) s.res[ru as Res] = Math.max(0, s.res[ru as Res] - (v ?? 0) * count(s, k));
    s.res.power = 0; // электричество не копится
    s.res.knowledge += s.pop * KNOWLEDGE_PER_PERSON;
    s.idleDays += (jobs.idle ?? 0) > 0 ? 1 : 0;
    // потребление
    let starving = 0;
    for (const res of ['food', 'water'] as const) {
      const need = s.pop * PERSON_DAY[res];
      if (s.res[res] < need) starving = Math.max(starving, 1 - s.res[res] / need);
      s.res[res] = Math.max(0, s.res[res] - need);
    }
    s.res.food *= 1 - (count(s, 'cellar') ? FOOD_SPOIL_CELLAR : FOOD_SPOIL);
    if (starving > 0) s.starveDays++;
    // болезни и смерти
    const pSick = SICK_BASE + (heatRatio < 1 ? SICK_COLD * (1 - heatRatio) * 4 : 0) + starving * 0.1;
    let newSick = 0;
    for (let i = 0; i < s.pop - s.sick; i++) if (r() < pSick) newSick++;
    let healed = 0, died = 0;
    const careSlots = count(s, 'infirmary') * 2 * 3;
    for (let i = 0; i < s.sick; i++) {
      const care = i < careSlots && s.res.medicine >= 1;
      if (care) s.res.medicine -= 1;
      if (r() < (care ? HEAL_CARE : HEAL_NONE)) healed++;
      else if (!care && r() < SICK_DEATH + starving * 0.2) died++;
    }
    s.sick += newSick - healed - died;
    s.pop -= died; s.dead += died;
    if (s.pop <= 0) break;
    // прибытие новых людей
    if (s.day % ARRIVAL_EVERY === 0 && s.pop < era.popCap && housing(s) > s.pop && heatRatio >= 1 && s.res.food > s.pop * 6) s.pop++;
    // переход эпохи
    const builtAll = Object.entries(era.need).every(([k, n]) => count(s, k) >= (n ?? 0));
    if (builtAll && s.bDay[s.era] === undefined) s.bDay[s.era] = s.day + 1;
    if (s.res.knowledge >= era.knowledge && s.kDay[s.era] === undefined) s.kDay[s.era] = s.day + 1;
    if (builtAll && s.res.knowledge >= era.knowledge) {
      s.res.knowledge -= era.knowledge; s.spentKnowledge += era.knowledge;
      s.era++; s.eraDay.push(s.day + 1);
    }
    for (const k of ALL) s.maxStock[k] = Math.max(s.maxStock[k] ?? 0, s.res[k]);
  }
  return s;
}

/** Контрольный сценарий: ничего не строить — сколько дней проживёт колония. */
function survivalWithoutBuilding(): number {
  let food = START.res.food ?? 0, water = START.res.water ?? 0, pop = START.pop;
  for (let d = 1; d < 60; d++) {
    food -= pop * 2; water -= pop * 2;
    if (food < 0 || water < 0) return d + 4; // ~4 дня до гибели без еды/воды (здоровье −25/день)
  }
  return 60;
}

