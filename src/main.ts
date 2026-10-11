import { Application, Container, Graphics, Text } from 'pixi.js';
import { alive, build, initialState, isGameOver, step, tempAt } from './core/sim';
import type { BuildingKind, State } from './core/types';
import { BUILDINGS } from './data/buildings';
import { RU } from './i18n';

const TICK_MS = 500;
const GLYPH: Record<BuildingKind, string> = { hut: 'Х', campfire: 'К', gatherer: 'С', woodcutter: 'Л', quarry: 'М', purifier: 'В' };

let state: State = initialState();
let speed = 1;
let selected: BuildingKind = 'hut';

const root = document.getElementById('app')!;
root.innerHTML = `
<style>
  body{font-family:system-ui,sans-serif}
  #hud{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px;background:#121a24;font-size:14px}
  #bar{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#0e141c}
  #bar button{min-height:44px;min-width:44px;padding:6px 10px;border:1px solid #345;background:#1a2635;color:#cfe;border-radius:6px;font-size:14px}
  #bar button.on{background:#2d6a4f;border-color:#6c9}
  #msg{padding:4px 8px;min-height:20px;color:#fb7;font-size:13px}
  #view{touch-action:none}#view canvas{display:block}
</style>
<div id="hud"></div><div id="bar"></div><div id="msg"></div><div id="view"></div>`;
const hud = root.querySelector<HTMLElement>('#hud')!;
const bar = root.querySelector<HTMLElement>('#bar')!;
const msg = root.querySelector<HTMLElement>('#msg')!;
const view = root.querySelector<HTMLElement>('#view')!;

function buildBar() {
  bar.innerHTML = '';
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
    const c = BUILDINGS[kind].cost;
    const b = document.createElement('button');
    b.textContent = `${RU.buildings[kind]} (${c.wood ?? 0}д${c.stone ? ` ${c.stone}к` : ''})`;
    b.className = kind === selected ? 'on' : '';
    b.onclick = () => { selected = kind; buildBar(); };
    bar.append(b);
  }
  for (const [label, sp] of [[RU.pause, 0], ['1x', 1], ['2x', 2], ['4x', 4]] as const) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = speed === sp ? 'on' : '';
    b.onclick = () => { speed = sp; buildBar(); schedule(); };
    bar.append(b);
  }
}

const app = new Application();
const layer = new Container();
let cell = 32;

function tempColor(t: number): number {
  const k = Math.max(0, Math.min(1, (t + 20) / 55));
  const r = Math.round(20 + 200 * k), g = Math.round(40 + 70 * k), b = Math.round(90 - 60 * k);
  return (r << 16) | (g << 8) | b;
}

function draw() {
  layer.removeChildren().forEach((c) => c.destroy());
  const g = new Graphics();
  for (let y = 0; y < state.h; y++)
    for (let x = 0; x < state.w; x++)
      g.rect(x * cell, y * cell, cell - 1, cell - 1).fill(tempColor(tempAt(state, x, y)));
  g.circle((state.reactor.x + 0.5) * cell, (state.reactor.y + 0.5) * cell, cell * 0.45).fill(0xffe066);
  for (const b of state.buildings) g.rect(b.x * cell + 3, b.y * cell + 3, cell - 7, cell - 7).fill(0x2d6a4f);
  for (const p of alive(state)) g.circle((p.x + 0.5) * cell + (p.id % 5) * 3 - 6, (p.y + 0.5) * cell + (p.id % 3) * 3 - 3, cell * 0.12).fill(0xffffff);
  layer.addChild(g);
  for (const b of state.buildings) {
    const t = new Text({ text: GLYPH[b.kind], style: { fontSize: cell * 0.5, fill: 0xffffff } });
    t.position.set(b.x * cell + cell * 0.28, b.y * cell + cell * 0.2);
    layer.addChild(t);
  }
  const r = state.res;
  hud.textContent = `${RU.day} ${(state.tick / 24) | 0} · ${RU.people} ${alive(state).length} · ${RU.food} ${r.food | 0} · ${RU.water} ${r.water | 0} · ${RU.wood} ${r.wood | 0} · ${RU.stone} ${r.stone | 0} · ${RU.knowledge} ${r.knowledge | 0}`;
}

function resize() {
  const top = view.getBoundingClientRect().top;
  cell = Math.max(16, Math.floor(Math.min(innerWidth / state.w, (innerHeight - top - 4) / state.h)));
  app.renderer.resize(cell * state.w, cell * state.h);
  draw();
}

let timer: number | undefined;
function schedule() {
  clearInterval(timer);
  if (speed > 0) timer = window.setInterval(tick, TICK_MS / speed);
}
function tick() {
  state = step(state);
  if (isGameOver(state)) { clearInterval(timer); msg.textContent = RU.gameOver; }
  draw();
}

await app.init({ background: '#0b0f14', antialias: true, width: 10, height: 10 });
view.append(app.canvas);
app.stage.addChild(layer);
app.canvas.addEventListener('pointerdown', (e) => {
  if (isGameOver(state)) { state = initialState(); msg.textContent = ''; schedule(); draw(); return; }
  const rect = app.canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cell), y = Math.floor((e.clientY - rect.top) / cell);
  const next = build(state, selected, x, y);
  if (!next) { msg.textContent = RU.cantBuild; return; }
  msg.textContent = '';
  state = next;
  draw();
});
addEventListener('resize', resize);
buildBar();
resize();
schedule();
