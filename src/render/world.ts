import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { reactorRadius, tempAt } from '../core/sim';
import type { Building, State } from '../core/types';
import { RU } from '../i18n';
import type { Art, DecorKey } from './assets';

/** 0 — смертельный холод, 1 — комфортное тепло. */
export const warmthOf = (t: number) => Math.max(0, Math.min(1, (t + 20) / 55));

function tempColor(t: number): number {
  const k = warmthOf(t);
  const r = Math.round(20 + 200 * k), g = Math.round(40 + 70 * k), b = Math.round(90 - 60 * k);
  return (r << 16) | (g << 8) | b;
}

const hash = (x: number, y: number) => (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;

/**
 * Вариант плитки для клетки: одинаковый между перерисовками. Первые два варианта обычные и частые,
 * остальные (следы, лёд, лужа) редкие, чтобы не получался узор из одинаковых пятен.
 */
function pick(tiles: Texture[] | undefined, x: number, y: number): Texture | undefined {
  if (!tiles?.length) return undefined;
  const h = hash(x, y);
  if (tiles.length < 3) return tiles[h % tiles.length];
  const weights = tiles.map((_, i) => (i < 2 ? 5 : 1));
  let r = h % weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r < 0) return tiles[i];
  }
  return tiles[0];
}

/**
 * Масштаб спрайта под рамку size×size. Пиксель-арт (маленькие картинки без сглаживания)
 * увеличиваем только в целое число раз, чтобы пиксели были ровными.
 */
export function spriteScale(tex: Texture, size: number): number {
  const fit = size / Math.max(tex.width, tex.height);
  return tex.source.scaleMode === 'nearest' ? Math.max(1, Math.floor(fit)) : fit;
}

/** Спрайт с низом по точке (cx, bottom): так здания и люди «стоят» на земле. */
export function place(tex: Texture, cx: number, bottom: number, size: number): Sprite {
  const s = new Sprite(tex);
  s.scale.set(spriteScale(tex, size));
  s.anchor.set(0.5, 1);
  s.position.set(Math.round(cx), Math.round(bottom));
  s.zIndex = bottom;
  return s;
}

/** Земля: плитки снега и оттаявшей земли по температуре клетки. Где картинок нет — прежние цветные квадраты. */
export function drawGround(layer: Container, state: State, cell: number, art: Art) {
  const g = new Graphics();
  const textured = !!art.groundCold;
  const tint = new Graphics();
  for (let y = 0; y < state.h; y++)
    for (let x = 0; x < state.w; x++) {
      const t = tempAt(state, x, y);
      if (!textured) {
        g.rect(x * cell, y * cell, cell - 1, cell - 1).fill(tempColor(t));
        continue;
      }
      for (const [tex, alpha] of [[pick(art.variants.groundCold, x, y), 1], [pick(art.variants.groundWarm, x, y), warmthOf(t)]] as const) {
        if (!tex || alpha <= 0) continue;
        const s = new Sprite(tex);
        s.position.set(x * cell, y * cell);
        s.setSize(cell, cell);
        s.alpha = alpha;
        layer.addChild(s);
      }
      // Лёгкий оттенок, чтобы температура читалась и на картинках.
      tint.rect(x * cell, y * cell, cell, cell).fill({ color: tempColor(t), alpha: 0.25 });
    }
  if (textured) layer.addChild(tint);
  layer.addChild(g);
}

/** Размер декора в клетках по длинной стороне картинки: ёлка ~2 роста человека, кусты и камни по колено. */
const DECOR_SIZE: Record<DecorKey, number> = { tree_a: 2.1, tree_b: 1.8, bush: 0.85, rocks: 0.85, tuft: 0.55, stump: 0.7 };

/** Деревья, кусты и камни: расставляются по хэшу клетки, поэтому не меняются между перерисовками. */
export function drawDecor(layer: Container, state: State, cell: number, art: Art) {
  const taken = new Set(state.buildings.map((b) => `${b.x},${b.y}`));
  taken.add(`${state.reactor.x},${state.reactor.y}`);
  const R = reactorRadius(state.reactor.level);
  for (let y = 0; y < state.h; y++)
    for (let x = 0; x < state.w; x++) {
      if (taken.has(`${x},${y}`)) continue;
      const d = Math.hypot(x - state.reactor.x, y - state.reactor.y);
      if (d < 2) continue;
      const h = hash(x * 7 + 3, y * 13 + 5);
      const roll = (h % 1000) / 1000;
      let kind: DecorKey | undefined;
      if (d > R * 0.85) kind = roll < 0.2 ? (h & 0x1000 ? 'tree_a' : 'tree_b') : roll < 0.26 ? 'rocks' : roll < 0.31 ? 'bush' : undefined;
      else kind = roll < 0.05 ? 'tuft' : roll < 0.08 ? 'bush' : roll < 0.1 ? 'stump' : roll < 0.12 ? 'rocks' : undefined;
      const tex = kind && art.decor[kind];
      if (!tex) continue;
      const jx = ((h >> 4) % 5 - 2) * cell * 0.04;
      layer.addChild(place(tex, (x + 0.5) * cell + jx, (y + 1) * cell - 1, cell * DECOR_SIZE[kind!]));
    }
}

export interface ActorRefs {
  reactor?: Sprite;
  campfires: { b: Building; sprite: Sprite }[];
  /** Где у зданий выходит дым или пар (пиксели карты). */
  smoke: { x: number; y: number; kind: 'smoke' | 'steam' }[];
}

/** Ширина спрайта здания в клетках (по длинной стороне): картинки в стиле персонажей крупнее клетки. */
const BUILDING_SIZE: Partial<Record<Building['kind'], number>> = { campfire: 1.15, hut: 1.35 };
const DEFAULT_BUILDING_SIZE = 1.35;
const REACTOR_SIZE = 2.3;

/** Реактор и здания. Спрайты получают zIndex по низу, поэтому люди и деревья сортируются по глубине. */
export function drawActors(layer: Container, state: State, cell: number, art: Art): ActorRefs {
  const refs: ActorRefs = { campfires: [], smoke: [] };
  const g = new Graphics();
  layer.addChild(g);
  const rx = (state.reactor.x + 0.5) * cell, ry = state.reactor.y * cell;
  if (art.reactor) {
    const s = place(art.reactor, rx, ry + cell, cell * REACTOR_SIZE);
    layer.addChild(s);
    refs.reactor = s;
    refs.smoke.push({ x: rx, y: s.y - s.height + 2, kind: 'steam' });
  } else g.circle(rx, ry + cell / 2, cell * 0.45).fill(0xffe066);

  for (const b of state.buildings) {
    const tex = art[b.kind];
    if (tex) {
      const s = place(tex, (b.x + 0.5) * cell, (b.y + 1) * cell - 1, cell * (BUILDING_SIZE[b.kind] ?? DEFAULT_BUILDING_SIZE));
      layer.addChild(s);
      if (b.kind === 'campfire') {
        refs.campfires.push({ b, sprite: s });
        refs.smoke.push({ x: s.x, y: s.y - s.height + 4, kind: 'smoke' });
      }
      if (b.kind === 'purifier') refs.smoke.push({ x: s.x - s.width * 0.1, y: s.y - s.height + 2, kind: 'steam' });
      continue;
    }
    g.rect(b.x * cell + 3, b.y * cell + 3, cell - 7, cell - 7).fill(0x2d6a4f);
    const t = new Text({ text: RU.icons[b.kind], style: { fontSize: cell * 0.5, fill: 0xffffff } });
    t.position.set(b.x * cell + cell * 0.28, b.y * cell + cell * 0.2);
    layer.addChild(t);
  }
  return refs;
}
