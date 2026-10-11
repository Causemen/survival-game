import { Texture } from 'pixi.js';
import type { BuildingKind } from '../core/types';

/**
 * Список картинок игры. Файлы кладутся в public/assets/… (см. docs/ART.md).
 * Любого файла может не быть: тогда рисуем как раньше, процедурно.
 */
export const ART_FILES = {
  groundCold: 'tiles/ground_cold.png',
  groundWarm: 'tiles/ground_warm.png',
  reactor: 'buildings/reactor.png',
  hut: 'buildings/hut.png',
  campfire: 'buildings/campfire.png',
  gatherer: 'buildings/gatherer.png',
  woodcutter: 'buildings/woodcutter.png',
  quarry: 'buildings/quarry.png',
  purifier: 'buildings/purifier.png',
  settler: 'units/settler.png',
} satisfies Record<string, string>;

export type ArtKey = keyof typeof ART_FILES;
export type Art = Partial<Record<ArtKey, Texture>>;

/** Тайлы земли заполняют клетку целиком, остальное — спрайты на фоне, который нужно вырезать. */
const TILES: ArtKey[] = ['groundCold', 'groundWarm'];
const MAX_SIDE = 256;


export async function loadArt(): Promise<Art> {
  const art: Art = {};
  await Promise.all(
    (Object.keys(ART_FILES) as ArtKey[]).map(async (key) => {
      const img = await loadImage(`${import.meta.env.BASE_URL}assets/${ART_FILES[key]}`);
      if (img) art[key] = Texture.from(prepare(img, !TILES.includes(key)));
    }),
  );
  return art;
}

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

/**
 * Уменьшает картинку до MAX_SIDE. Для спрайтов ещё и убирает однотонный фон
 * (Gemini не умеет прозрачность — просим ярко-пурпурный фон) и обрезает пустые поля.
 */
function prepare(img: HTMLImageElement, sprite: boolean): HTMLCanvasElement {
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  let c = canvasOf(Math.round(img.width * k), Math.round(img.height * k));
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height);
  if (sprite) c = trim(removeBackground(c));
  return c;
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Заливка от краёв: стираем пиксели, близкие к цвету левого верхнего угла. Уже прозрачные PNG не трогаем. */
function removeBackground(c: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const { width: w, height: h } = c;
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  if (d[3]! < 255) return c;
  const [kr, kg, kb] = [d[0]!, d[1]!, d[2]!];
  const dist = (i: number) => Math.abs(d[i]! - kr) + Math.abs(d[i + 1]! - kg) + Math.abs(d[i + 2]! - kb);
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, x + (h - 1) * w);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const dd = dist(i);
    if (dd > 150) continue;
    d[i + 3] = dd < 90 ? 0 : Math.round(((dd - 90) / 60) * 255); // мягкий край
    if (dd >= 90) continue;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  ctx.putImageData(im, 0, 0);
  return c;
}

function trim(c: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = c;
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3]! > 16) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
  if (x1 < 0) return c;
  const out = canvasOf(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d')!.drawImage(c, -x0, -y0);
  return out;
}
