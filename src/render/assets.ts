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
  settlerMale: 'units/settler_male.png',
  settlerFemale: 'units/settler_female.png',
  campfire2: 'buildings/campfire_1.png',
} satisfies Record<string, string>;

export type ArtKey = keyof typeof ART_FILES;

/** Кадры анимации человека: units/settler_<male|female>_<действие>_<номер>.png */
export const ANIMS = { idle: 2, walk: 2, work: 2, cold: 2 } as const;
export type Anim = keyof typeof ANIMS;
export type Gender = 'male' | 'female';
export type PersonFrames = Record<Anim, Texture[]>;

/** Декор карты: decor/<имя>.png */
export const DECOR = ['tree_a', 'tree_b', 'bush', 'rocks', 'tuft', 'stump'] as const;
export type DecorKey = (typeof DECOR)[number];

/** Крупные персонажи из листов кадров (units/characters.json), см. docs/ART.md, раздел 9. */
export type CharacterFrames = Partial<Record<Anim, Texture[]>>;
interface CharacterManifest {
  characters: { name: string; anims: Partial<Record<Anim, { file: string; frames: number }>> }[];
}
const CHAR_MAX_HEIGHT = 128;

export interface Art extends Partial<Record<ArtKey, Texture>> {
  /** Все найденные варианты плиток земли (ground_cold.png, ground_cold_1.png, …). */
  variants: Record<TileKey, Texture[]>;
  people: Partial<Record<Gender, Partial<PersonFrames>>>;
  decor: Partial<Record<DecorKey, Texture>>;
  /** Персонажи по порядку из манифеста; если список не пуст, жители берут их вместо маленьких спрайтов. */
  characters: CharacterFrames[];
}

/** Тайлы земли заполняют клетку целиком, остальное — спрайты на фоне, который нужно вырезать. */
const TILES = ['groundCold', 'groundWarm'] as const satisfies readonly ArtKey[];
type TileKey = (typeof TILES)[number];
const TILE_VARIANTS = 4;
const MAX_SIDE = 256;
const PIXEL_ART_MAX = 64;

const variantFile = (file: string, i: number) => (i === 0 ? file : file.replace('.png', `_${i}.png`));

async function loadTexture(file: string, sprite: boolean, trimmed = true): Promise<Texture | undefined> {
  const img = await loadImage(`${import.meta.env.BASE_URL}assets/${file}`);
  if (!img) return undefined;
  const tex = Texture.from(prepare(img, sprite, trimmed));
  // Маленькие картинки — пиксель-арт: увеличиваем без размытия.
  if (Math.max(img.width, img.height) <= PIXEL_ART_MAX) tex.source.scaleMode = 'nearest';
  return tex;
}

export async function loadArt(): Promise<Art> {
  const art: Art = { variants: { groundCold: [], groundWarm: [] }, people: {}, decor: {}, characters: [] };
  await Promise.all([
    ...(Object.keys(ART_FILES) as ArtKey[]).map(async (key) => {
      if ((TILES as readonly ArtKey[]).includes(key)) {
        const tile = key as TileKey;
        const found = await Promise.all(
          Array.from({ length: TILE_VARIANTS }, (_, i) => loadTexture(variantFile(ART_FILES[tile], i), false)),
        );
        art.variants[tile] = found.filter((t): t is Texture => !!t);
        art[tile] = art.variants[tile][0];
        return;
      }
      const tex = await loadTexture(ART_FILES[key], true);
      if (tex) art[key] = tex;
    }),
    ...(['male', 'female'] as const).flatMap((g) =>
      (Object.keys(ANIMS) as Anim[]).map(async (anim) => {
        // Кадры не обрезаем: у всех одинаковый холст, чтобы ноги не «прыгали» между кадрами.
        const found = await Promise.all(
          Array.from({ length: ANIMS[anim] }, (_, i) => loadTexture(`units/settler_${g}_${anim}_${i}.png`, true, false)),
        );
        if (found.every((t): t is Texture => !!t)) (art.people[g] ??= {})[anim] = found;
      }),
    ),
    loadCharacters().then((c) => { art.characters = c; }),
    ...DECOR.map(async (name) => {
      const tex = await loadTexture(`decor/${name}.png`, true);
      if (tex) art.decor[name] = tex;
    }),
  ]);
  return art;
}

async function loadCharacters(): Promise<CharacterFrames[]> {
  let manifest: CharacterManifest;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/units/characters.json`);
    if (!res.ok) return [];
    manifest = (await res.json()) as CharacterManifest;
  } catch {
    return [];
  }
  const out = await Promise.all(
    (manifest.characters ?? []).map(async (ch) => {
      const frames: CharacterFrames = {};
      await Promise.all(
        (Object.keys(ch.anims) as Anim[]).map(async (anim) => {
          const spec = ch.anims[anim];
          if (!spec || !(anim in ANIMS) || !(spec.frames >= 1)) return;
          const img = await loadImage(`${import.meta.env.BASE_URL}assets/${spec.file}`);
          if (img) frames[anim] = sliceStrip(img, spec.frames);
        }),
      );
      return frames;
    }),
  );
  return out.filter((f) => f.idle || f.walk);
}

/**
 * Режет горизонтальный лист на равные кадры. Фон вырезаем по всему листу сразу, края не обрезаем:
 * у всех кадров один холст, чтобы ноги не «прыгали». Высокие кадры уменьшаем до CHAR_MAX_HEIGHT.
 */
function sliceStrip(img: HTMLImageElement, n: number): Texture[] {
  const sheet = canvasOf(img.width, img.height);
  sheet.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0);
  const clean = removeBackground(sheet);
  const fw = Math.floor(img.width / n);
  const k = Math.min(1, CHAR_MAX_HEIGHT / img.height);
  return Array.from({ length: n }, (_, i) => {
    const c = canvasOf(Math.max(1, Math.round(fw * k)), Math.max(1, Math.round(img.height * k)));
    c.getContext('2d')!.drawImage(clean, i * fw, 0, fw, img.height, 0, 0, c.width, c.height);
    const tex = Texture.from(c);
    if (img.height <= PIXEL_ART_MAX * 2) tex.source.scaleMode = 'nearest';
    return tex;
  });
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
function prepare(img: HTMLImageElement, sprite: boolean, trimmed = true): HTMLCanvasElement {
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  let c = canvasOf(Math.round(img.width * k), Math.round(img.height * k));
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, c.width, c.height);
  if (sprite) c = trimmed ? trim(removeBackground(c)) : removeBackground(c);
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
