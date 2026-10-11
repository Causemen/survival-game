import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { alive, tempAt } from '../core/sim';
import type { State } from '../core/types';
import { RU } from '../i18n';
import type { Art } from './assets';

/** 0 — смертельный холод, 1 — комфортное тепло. */
const warmthOf = (t: number) => Math.max(0, Math.min(1, (t + 20) / 55));

function tempColor(t: number): number {
  const k = warmthOf(t);
  const r = Math.round(20 + 200 * k), g = Math.round(40 + 70 * k), b = Math.round(90 - 60 * k);
  return (r << 16) | (g << 8) | b;
}

/**
 * Вариант плитки для клетки: одинаковый между перерисовками. Первые два варианта обычные и частые,
 * остальные (следы, лёд, лужа) редкие, чтобы не получался узор из одинаковых пятен.
 */
function pick(tiles: Texture[] | undefined, x: number, y: number): Texture | undefined {
  if (!tiles?.length) return undefined;
  const h = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
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
 * Спрайт, вписанный в рамку size×size с низом по точке (cx, bottom): так здания «стоят» на клетке.
 * Пиксель-арт (маленькие картинки без сглаживания) масштабируем только в целое число раз, чтобы пиксели были ровными.
 */
function place(tex: Texture, cx: number, bottom: number, size: number): Sprite {
  const s = new Sprite(tex);
  const fit = size / Math.max(tex.width, tex.height);
  s.scale.set(tex.source.scaleMode === 'nearest' ? Math.max(1, Math.floor(fit)) : fit);
  s.anchor.set(0.5, 1);
  s.position.set(Math.round(cx), Math.round(bottom));
  return s;
}

/** Рисует карту. Где картинки есть — спрайты, где нет — прежняя процедурная графика. */
export function drawWorld(layer: Container, state: State, cell: number, art: Art) {
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

  const rx = (state.reactor.x + 0.5) * cell, ry = state.reactor.y * cell;
  if (art.reactor) layer.addChild(place(art.reactor, rx, ry + cell, cell * 1.3));
  else g.circle(rx, ry + cell / 2, cell * 0.45).fill(0xffe066);

  for (const b of state.buildings) {
    const tex = art[b.kind];
    if (tex) {
      layer.addChild(place(tex, (b.x + 0.5) * cell, (b.y + 1) * cell - 1, cell * 0.95));
      continue;
    }
    g.rect(b.x * cell + 3, b.y * cell + 3, cell - 7, cell - 7).fill(0x2d6a4f);
    const t = new Text({ text: RU.icons[b.kind], style: { fontSize: cell * 0.5, fill: 0xffffff } });
    t.position.set(b.x * cell + cell * 0.28, b.y * cell + cell * 0.2);
    layer.addChild(t);
  }

  for (const p of alive(state)) {
    const px = (p.x + 0.5) * cell + (p.id % 5) * 3 - 6, py = (p.y + 0.5) * cell + (p.id % 3) * 3 - 3;
    const tex = (p.id % 2 ? art.settlerFemale : art.settlerMale) ?? art.settler;
    if (tex) layer.addChild(place(tex, px, py + cell * 0.2, cell * 0.5));
    else g.circle(px, py, cell * 0.12).fill(0xffffff);
  }
}
