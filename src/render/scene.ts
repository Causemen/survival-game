import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { alive, reactorRadius } from '../core/sim';
import type { Settler, State } from '../core/types';
import { BUILDINGS } from '../data/buildings';
import { type Anim, type Art, type Gender } from './assets';
import { type ActorRefs, drawActors, drawDecor, drawGround, drawHeatMap, place, spriteScale } from './world';

/** Кадров в секунду для каждого действия. */
const FPS: Record<Anim, number> = { idle: 1.5, walk: 6, work: 3, cold: 7 };
const WALK_CELLS_PER_SEC = 1.7;
const COLD_BELOW = 35;

interface Person {
  id: number;
  gender: Gender;
  /** Индекс крупного персонажа из art.characters, -1 — маленький житель. */
  char: number;
  view: Sprite | Graphics;
  x: number;
  y: number;
  /** Куда идёт, и откуда начинать топтаться на месте. */
  tx: number;
  ty: number;
  anim: Anim;
  t: number;
  face: 1 | -1;
  working: boolean;
  cold: boolean;
  wander: number;
  gone: boolean;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Радиальное свечение: центр тёплый, к краю прозрачный. */
function glowTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,196,96,0.95)');
  g.addColorStop(0.35, 'rgba(255,150,70,0.45)');
  g.addColorStop(1, 'rgba(255,120,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return Texture.from(c);
}

/**
 * Живая карта: земля и здания перерисовываются только при изменениях, а люди, огонь, дым, снег,
 * свечение и смена дня и ночи считаются каждый кадр. Логика симуляции здесь не меняется, всё берётся из State.
 */
export class Scene {
  readonly root = new Container();
  private ground = new Container();
  private actors = new Container();
  private fx = new Graphics();
  private night = new Graphics();
  private glows = new Container();
  private people = new Map<number, Person>();
  private particles: Particle[] = [];
  private flakes: { x: number; y: number; ph: number; s: number }[] = [];
  private glowTex = glowTexture();
  private refs: ActorRefs = { campfires: [], smoke: [] };
  private glowSprites: { sprite: Sprite; base: number; kind: 'reactor' | 'fire'; phase: number }[] = [];
  private state?: State;
  private cell = 32;
  private groundSig = '';
  private heat = false;
  private actorSig = '';
  private time = 0;
  private timeScale = 1;
  private night01 = 0;

  constructor(private art: Art) {
    this.actors.sortableChildren = true;
    this.glows.blendMode = 'add';
    this.root.addChild(this.ground, this.actors, this.fx, this.night, this.glows);
  }

  /** Скорость игры: 0 ставит анимацию на паузу. */
  setSpeed(speed: number) {
    this.timeScale = speed;
  }

  /** Тепловая карта: цветные зоны поверх земли. */
  setHeatMap(on: boolean) {
    this.heat = on;
  }

  setState(state: State, cell: number) {
    this.state = state;
    const resized = cell !== this.cell;
    this.cell = cell;
    const campfires = state.buildings.filter((b) => b.kind === 'campfire').map((b) => `${b.x},${b.y}`).join(';');
    const groundSig = `${this.heat ? 'h' : ''}${cell}|${state.w}x${state.h}|${state.reactor.level}|${campfires}|${state.active.map((a) => a.id).join()}`;
    if (groundSig !== this.groundSig) {
      this.groundSig = groundSig;
      this.ground.removeChildren().forEach((c) => c.destroy());
      drawGround(this.ground, state, cell, this.art);
      if (this.heat) drawHeatMap(this.ground, state, cell);
    }
    const actorSig = `${cell}|${state.reactor.level}|${state.buildings.map((b) => b.id).join()}`;
    if (actorSig !== this.actorSig) {
      this.actorSig = actorSig;
      // Люди живут в actors вместе со зданиями (сортировка по глубине), поэтому их не уничтожаем.
      for (const c of [...this.actors.children]) {
        if (![...this.people.values()].some((p) => p.view === c)) this.actors.removeChild(c).destroy();
      }
      drawDecor(this.actors, state, cell, this.art);
      this.refs = drawActors(this.actors, state, cell, this.art);
      this.rebuildGlows(state);
      this.night.clear().rect(0, 0, state.w * cell, state.h * cell).fill(0x0a1030);
      this.flakes = [];
    }
    if (resized) for (const p of this.people.values()) { p.x = p.tx; p.y = p.ty; }
    this.syncPeople(state);
  }

  private rebuildGlows(state: State) {
    this.glows.removeChildren().forEach((c) => c.destroy());
    this.glowSprites = [];
    const add = (x: number, y: number, radius: number, kind: 'reactor' | 'fire') => {
      const s = new Sprite(this.glowTex);
      s.anchor.set(0.5);
      s.position.set(x, y);
      s.setSize(radius * 2, radius * 2);
      this.glows.addChild(s);
      this.glowSprites.push({ sprite: s, base: radius * 2, kind, phase: Math.random() * 6 });
    };
    add((state.reactor.x + 0.5) * this.cell, (state.reactor.y + 0.5) * this.cell, reactorRadius(state.reactor.level) * this.cell * 0.55, 'reactor');
    for (const { b } of this.refs.campfires) add((b.x + 0.5) * this.cell, (b.y + 0.55) * this.cell, this.cell * 1.8, 'fire');
  }

  // ---------- люди ----------

  private homeOf(p: Settler, state: State): { x: number; y: number; working: boolean } {
    const c = this.cell;
    const wb = state.buildings.find((b) => b.x === p.x && b.y === p.y && BUILDINGS[b.kind].worker);
    if (wb) return { x: (wb.x + 0.5) * c + c * 0.34, y: (wb.y + 1) * c - 1, working: true };
    return { x: (p.x + 0.5) * c + ((p.id % 5) - 2) * c * 0.1, y: (p.y + 0.5) * c + c * 0.2 + ((p.id % 3) - 1) * c * 0.07, working: false };
  }

  private syncPeople(state: State) {
    const living = new Map(alive(state).map((p) => [p.id, p]));
    for (const [id, person] of this.people) {
      if (!living.has(id)) {
        person.gone = true;
        this.people.delete(id);
        this.actors.removeChild(person.view).destroy();
      }
    }
    for (const p of living.values()) {
      const home = this.homeOf(p, state);
      let person = this.people.get(p.id);
      if (!person) {
        const gender: Gender = p.id % 2 ? 'female' : 'male';
        const char = this.art.characters.length ? p.id % this.art.characters.length : -1;
        person = {
          id: p.id, gender, char, view: this.makeView(gender, char), x: home.x, y: home.y, tx: home.x, ty: home.y, anim: 'idle',
          t: Math.random() * 3, face: p.id % 3 ? 1 : -1, working: home.working, cold: false, wander: 2 + Math.random() * 5, gone: false,
        };
        this.people.set(p.id, person);
        this.actors.addChild(person.view);
      }
      person.working = home.working;
      person.cold = p.warmth < COLD_BELOW;
      person.tx = home.x;
      person.ty = home.y;
    }
  }

  private framesOf(p: { gender: Gender; char: number }, anim: Anim): Texture[] | undefined {
    if (p.char >= 0) {
      const ch = this.art.characters[p.char]!;
      return ch[anim] ?? (anim === 'walk' ? undefined : ch.idle) ?? ch.walk;
    }
    return this.art.people[p.gender]?.[anim];
  }

  private makeView(gender: Gender, char: number): Sprite | Graphics {
    const frames = this.framesOf({ gender, char }, 'idle');
    const tex = frames?.[0] ?? this.art[gender === 'male' ? 'settlerMale' : 'settlerFemale'] ?? this.art.settler;
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5, 1);
      // Лист кадров без тени (она вырезана вместе с фоном): рисуем мягкую свою, в координатах картинки.
      if (char >= 0) s.addChild(new Graphics().ellipse(0, -tex.height * 0.045 - 1, tex.height * 0.2, tex.height * 0.04).fill({ color: 0x000000, alpha: 0.28 }));
      return s;
    }
    return new Graphics().circle(0, -this.cell * 0.12, this.cell * 0.12).fill(0xffffff);
  }

  private updatePeople(dt: number) {
    const c = this.cell;
    for (const p of this.people.values()) {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      let moving = false;
      if (dist > 0.75) {
        const step = Math.min(dist, WALK_CELLS_PER_SEC * c * dt);
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        moving = dist - step > 0.75;
        if (Math.abs(dx) > 1) p.face = dx > 0 ? 1 : -1;
      }
      if (!moving && !p.working) {
        p.wander -= dt;
        if (p.wander < 0) {  // скучающий человек иногда переминается рядом
          p.wander = 3 + Math.random() * 6;
          const home = this.homeOf({ id: p.id, x: Math.round(p.tx / c - 0.5), y: Math.round(p.ty / c - 0.7) } as Settler, this.state!);
          p.tx = home.x + (Math.random() - 0.5) * c * 0.5;
          p.ty = home.y + (Math.random() - 0.5) * c * 0.3;
        }
      }
      if (!moving && p.working) p.face = -1;  // стоит справа от здания и смотрит на него
      const anim: Anim = moving ? 'walk' : p.cold ? 'cold' : p.working ? 'work' : 'idle';
      if (anim !== p.anim) { p.anim = anim; p.t = 0; }
      p.t += dt;
      const frames = this.framesOf(p, anim);
      const frame = frames ? Math.floor(p.t * FPS[anim]) % frames.length : 0;
      const v = p.view;
      if (v instanceof Sprite) {
        if (frames) v.texture = frames[frame]!;
        const k = p.char >= 0 ? (c * 1.15) / v.texture.height : spriteScale(v.texture, c * 0.5);
        v.scale.set(k * p.face, k);
        // Покачивание в пикселях картинки: на ходу подпрыгивает, мёрзнущий дрожит.
        const bob = moving && frame === 1 && p.char < 0 ? k : 0;
        const shiver = anim === 'cold' && frame === 1 && p.char < 0 ? k * p.face : 0;
        v.position.set(Math.round(p.x + shiver), Math.round(p.y - bob));
      } else v.position.set(Math.round(p.x), Math.round(p.y));
      v.zIndex = p.y + 0.5;
    }
  }

  // ---------- кадр ----------

  update(dtMs: number) {
    const state = this.state;
    if (!state) return;
    const dt = Math.min(dtMs, 100) / 1000 * this.timeScale;
    this.time += dt;
    const c = this.cell;
    const u = Math.max(1, Math.round(c / 18));  // «пиксель» эффектов в экранных пикселях
    const blizzard = state.active.some((a) => a.id === 'blizzard');

    // День и ночь по игровому часу (тик = час), плавно: светло около 13:00, темно около 1:00.
    const hour = state.tick % 24;
    const sun = clamp(0.5 + 0.9 * Math.cos(((hour - 13) / 24) * Math.PI * 2), 0, 1);
    this.night01 += ((1 - sun) - this.night01) * Math.min(1, dt * 2);
    this.night.alpha = this.night01 * 0.42 + (blizzard ? 0.12 : 0);

    // Свечение реактора и костров: дышит, ночью ярче.
    for (const g of this.glowSprites) {
      const pulse = g.kind === 'reactor' ? Math.sin(this.time * 1.6 + g.phase) * 0.06 : Math.sin(this.time * 11 + g.phase) * 0.08 + Math.sin(this.time * 17) * 0.05;
      g.sprite.alpha = clamp((g.kind === 'reactor' ? 0.22 : 0.3) + pulse + this.night01 * (g.kind === 'reactor' ? 0.3 : 0.45), 0, 1);
      const sc = 1 + pulse * 0.3;
      g.sprite.setSize(g.base * sc, g.base * sc);
    }
    // Огонь костров мерцает двумя кадрами.
    for (const f of this.refs.campfires) {
      const tex = (Math.floor(this.time * 4 + f.b.id) % 2 ? this.art.campfire2 : this.art.campfire) ?? this.art.campfire;
      if (tex) f.sprite.texture = tex;
    }

    this.updatePeople(dt);
    this.updateFx(dt, u, blizzard);
  }

  private updateFx(dt: number, u: number, blizzard: boolean) {
    const state = this.state!;
    const c = this.cell;
    const W = state.w * c, H = state.h * c;

    for (const s of this.refs.smoke) {
      const rate = s.kind === 'steam' ? 1.4 : 2.2;
      if (Math.random() < rate * dt) {
        this.particles.push({
          x: s.x + (Math.random() - 0.5) * u * 3, y: s.y, vx: (Math.random() - 0.3) * 6 * u, vy: -(10 + Math.random() * 8) * u,
          life: 0, max: 1.4 + Math.random() * 1.2, size: u * (Math.random() < 0.4 ? 3 : 2), color: s.kind === 'smoke' ? 0xcfd8dc : 0xf2ffff,
        });
      }
    }
    const want = blizzard ? 220 : 70;
    while (this.flakes.length < want) this.flakes.push({ x: Math.random() * W, y: Math.random() * H, ph: Math.random() * 6, s: 0.6 + Math.random() * 0.8 });
    if (this.flakes.length > want) this.flakes.length = want;

    const g = this.fx.clear();
    this.particles = this.particles.filter((p) => (p.life += dt) < p.max);
    for (const p of this.particles) {
      p.x += (p.vx + Math.sin(this.time * 2 + p.max * 5) * 3 * u) * dt;
      p.y += p.vy * dt;
      const k = p.life / p.max;
      g.rect(Math.round(p.x), Math.round(p.y), p.size * (1 + k), p.size * (1 + k)).fill({ color: p.color, alpha: 0.85 * (1 - k) });
    }
    const wind = blizzard ? 70 : 8;
    for (const f of this.flakes) {
      f.y += (blizzard ? 55 : 22) * f.s * u * 0.5 * dt;
      f.x += (wind + Math.sin(this.time * 1.3 + f.ph) * 8) * f.s * u * 0.5 * dt;
      if (f.y > H) { f.y = -u; f.x = Math.random() * W; }
      if (f.x > W) f.x -= W;
      else if (f.x < 0) f.x += W;
      g.rect(Math.round(f.x), Math.round(f.y), u * (f.s > 1 ? 2 : 1), u * (f.s > 1 ? 2 : 1)).fill({ color: 0xffffff, alpha: 0.55 + f.s * 0.3 });
    }
  }
}
