import { Application, Container, Graphics, Text } from 'pixi.js';
import { alive, build, canAfford, research, initialState, isGameOver, step, tempAt } from './core/sim';
import type { BuildingKind, State } from './core/types';
import { BUILDINGS } from './data/buildings';
import { RU } from './i18n';
import { ERAS } from './data/eras';
import { TECHS } from './data/techs';
import { EVENTS } from './data/events';
import { goalProgress } from './core/goals';

const TICK_MS = 500;

let state: State = initialState();
let speed = 1;
let selected: BuildingKind = 'gatherer';
let lastEra = 0;
let banner = '';
let barSig = '';
let techSig = '';

function drawEvents() {
  const act = state.active.map((a) => {
    const e = EVENTS.find((x) => x.id === a.id);
    return e ? `<div>${e.id === 'blizzard' ? '❄️' : '🤒'} ${e.name}: ещё ${Math.max(0, a.until - state.tick)} ч</div>` : '';
  }).join('');
  const recent = state.log.slice(-3).reverse().map((l) => `<small>День ${(l.tick / 24) | 0}, ${l.tick % 24} ч: ${l.text}</small>`).join('');
  eventsEl.innerHTML = act + recent;
}

function drawTechs() {
  const kn = document.getElementById('kn');
  if (kn) kn.textContent = String(state.res.knowledge | 0);
  const sig = `${state.techs.join()}|${state.era}|${TECHS.map((t) => (state.res.knowledge >= t.cost ? 1 : 0)).join('')}`;
  if (sig === techSig) return;
  techSig = sig;
  techsEl.innerHTML = `<b>${RU.techs} · ${RU.knowledge} 📖 <span id="kn"></span></b>`;
  for (const t of TECHS.filter((x) => x.era <= state.era)) {
    const b = document.createElement('button');
    const done = state.techs.includes(t.id);
    const locked = !done && (state.res.knowledge < t.cost || !!t.requires?.some((r) => !state.techs.includes(r)));
    b.className = done ? 'done' : locked ? 'no' : '';
    const need = t.requires?.filter((r) => !state.techs.includes(r)).map((r) => TECHS.find((x) => x.id === r)?.name).join(', ');
    b.innerHTML = `${done ? '✓ ' : ''}${t.name}<small>${done ? RU.learned : `${t.cost} знаний`}${need ? ` · нужно: ${need}` : ''}</small><small>${t.desc}</small>`;
    b.onclick = () => { const n = research(state, t.id); if (n) { state = n; draw(); } else msg.textContent = RU.cantResearch; };
    techsEl.append(b);
  }
}

const root = document.getElementById('app')!;
root.innerHTML = `
<style>
  body{font-family:system-ui,sans-serif}
  #hud{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px;background:#121a24;font-size:14px}
  #bar{display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#0e141c}
  #bar button{min-height:44px;min-width:44px;padding:6px 10px;border:1px solid #345;background:#1a2635;color:#cfe;border-radius:6px;font-size:14px}
  #bar button.on{background:#2d6a4f;border-color:#6c9}
  #msg{padding:4px 8px;min-height:20px;color:#fb7;font-size:13px}
  #goals{padding:6px 8px;background:#101a14;font-size:13px}
  #goals .era{display:flex;flex-wrap:wrap;gap:4px 10px;margin-bottom:4px}
  #goals .era b{color:#8d8}
  #goals .era span.cur{color:#fff;font-weight:600}
  #goals ul{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:2px 12px}
  #goals li.done{color:#6c9}
  #events{padding:0 8px;font-size:13px;background:#1a1414}
  #events div{padding:4px 0;color:#f99}
  #events small{display:block;color:#a88}
  #techs{display:flex;flex-wrap:wrap;gap:6px;padding:6px 8px;background:#14121c;align-items:stretch}
  #techs b{width:100%;font-size:13px;color:#b9f}
  #techs button{min-height:44px;padding:6px 10px;border:1px solid #546;background:#201a2e;color:#dcf;border-radius:6px;font-size:13px;text-align:left;max-width:240px}
  #techs button small{display:block;font-size:12px;color:#ba9}
  #techs button.done{border-color:#6c9;color:#6c9}
  #techs button.no{opacity:.5}
  #bar button.no{opacity:.5}
  #bar button small{display:block;font-size:12px;color:#fc8}
  #bar button.on small{color:#fff}
  #info{padding:4px 8px;font-size:13px;color:#9ab}
  #needs{display:flex;flex-wrap:wrap;gap:4px 14px;padding:4px 8px;font-size:13px;background:#0e141c}
  .bar{display:inline-block;width:60px;height:8px;background:#233;border-radius:4px;vertical-align:middle;margin-left:4px}
  .bar i{display:block;height:100%;border-radius:4px}
  #legend{padding:4px 8px;font-size:12px;color:#789}
  #intro{position:fixed;inset:0;background:#000c;display:flex;align-items:center;justify-content:center;padding:12px;z-index:10}
  #intro div{max-width:520px;max-height:100%;overflow:auto;background:#16202c;border:1px solid #456;border-radius:10px;padding:16px;line-height:1.45;font-size:15px}
  #intro[hidden]{display:none}
  #intro p{margin:0 0 10px}
  #intro button{min-height:44px;width:100%;font-size:16px;background:#2d6a4f;color:#fff;border:0;border-radius:6px}
  #view{touch-action:none}#view canvas{display:block}
</style>
<div id="hud"></div><div id="goals"></div><div id="events"></div><div id="techs"></div><div id="needs"></div><div id="bar"></div><div id="info"></div><div id="msg"></div><div id="view"></div><div id="legend"></div><div id="intro" hidden></div>`;
const hud = root.querySelector<HTMLElement>('#hud')!;
const bar = root.querySelector<HTMLElement>('#bar')!;
const msg = root.querySelector<HTMLElement>('#msg')!;
const view = root.querySelector<HTMLElement>('#view')!;
const eventsEl = root.querySelector<HTMLElement>('#events')!;
const techsEl = root.querySelector<HTMLElement>('#techs')!;
const goalsEl = root.querySelector<HTMLElement>('#goals')!;
const needs = root.querySelector<HTMLElement>('#needs')!;
const info = root.querySelector<HTMLElement>('#info')!;
const intro = root.querySelector<HTMLElement>('#intro')!;
root.querySelector<HTMLElement>('#legend')!.textContent = RU.legend;

function showIntro() {
  speed = 0; schedule(); buildBar();
  intro.innerHTML = `<div><h2 style="margin-top:0">${RU.title}</h2>${RU.intro.map((t) => `<p>${t}</p>`).join('')}<button>${RU.start}</button></div>`;
  intro.hidden = false;
  intro.querySelector('button')!.onclick = () => { intro.hidden = true; speed = 1; schedule(); buildBar(); };
}

function buildBar() {
  bar.innerHTML = '';
  for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) {
    const c = BUILDINGS[kind].cost;
    const b = document.createElement('button');
    const price = [c.wood ? `${c.wood} дерева` : '', c.stone ? `${c.stone} камня` : ''].filter(Boolean).join(' + ');
    b.innerHTML = `${RU.icons[kind]} ${RU.buildings[kind]}<small>${price}</small>`;
    b.className = `${kind === selected ? 'on' : ''} ${canAfford(state.res, kind) ? '' : 'no'}`.trim();
    b.onclick = () => { selected = kind; buildBar(); };
    bar.append(b);
  }
  const sc = BUILDINGS[selected].cost;
  info.textContent = `${RU.icons[selected]} ${RU.buildings[selected]}: ${RU.desc[selected]} ${RU.costWord}: ${[sc.wood ? `${sc.wood} дерева` : '', sc.stone ? `${sc.stone} камня` : ''].filter(Boolean).join(' + ')}.`;
  const help = document.createElement('button');
  help.textContent = RU.help;
  help.onclick = showIntro;
  bar.append(help);
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
    const t = new Text({ text: RU.icons[b.kind], style: { fontSize: cell * 0.5, fill: 0xffffff } });
    t.position.set(b.x * cell + cell * 0.28, b.y * cell + cell * 0.2);
    layer.addChild(t);
  }
  const r = state.res;
  const living = alive(state);
  if (state.era > lastEra) { lastEra = state.era; banner = RU.eraDone; }
  const eraDef = ERAS[Math.min(state.era, ERAS.length - 1)]!;
  const gp = goalProgress(state);
  const doneN = gp.filter((g) => g.done).length;
  goalsEl.innerHTML = `<div class="era">` + ERAS.map((e, i) => `<span class="${i === state.era ? 'cur' : ''}">${i < state.era ? '✓' : i === state.era ? '▶' : '🔒'} ${e.name}</span>`).join('') + `</div>`
    + (banner ? `<div style="color:#fd6;margin-bottom:4px">${banner}</div>` : '')
    + (eraDef.playable && gp.length
      ? `<div><b>${RU.goals} «${eraDef.name}» ${doneN}/${gp.length}</b></div><ul>` + gp.map((g) => `<li class="${g.done ? 'done' : ''}">${g.done ? '✓' : '○'} ${g.label}${g.target > 1 ? ` (${Math.floor(g.cur)}/${g.target})` : ''}</li>`).join('') + '</ul>'
      : `<div>${RU.eraSoon}</div>`);
  const sig = (Object.keys(BUILDINGS) as BuildingKind[]).map((k) => (canAfford(state.res, k) ? 1 : 0)).join('');
  if (sig !== barSig) { barSig = sig; buildBar(); }
  drawEvents();
  drawTechs();
  hud.textContent = `${RU.day} ${(state.tick / 24) | 0} · 👥 ${living.length} · 🍎 ${r.food | 0} · 💧 ${r.water | 0} · 🪵 ${r.wood | 0} · 🪨 ${r.stone | 0} · 📖 ${r.knowledge | 0}`;
  const avg = (k: 'warmth' | 'hunger' | 'thirst' | 'health') => living.length ? living.reduce((a, p) => a + p[k], 0) / living.length : 0;
  needs.innerHTML = (['warmth', 'hunger', 'thirst', 'health'] as const).map((k) => {
    const v = avg(k);
    const col = v > 60 ? '#6c9' : v > 30 ? '#eb5' : '#e55';
    return `<span>${RU.needs[k]}<span class="bar"><i style="width:${v}%;background:${col}"></i></span></span>`;
  }).join('');
  const workplaces = state.buildings.filter((b) => BUILDINGS[b.kind].worker).length;
  const hints: string[] = [];
  if (avg('warmth') < 35) hints.push(RU.freezing);
  if (r.food < 15 || avg('hunger') < 35) hints.push(RU.starving);
  if (r.water < 15 || avg('thirst') < 35) hints.push(RU.thirsty);
  if (r.wood < 15) hints.push(RU.noWood);
  if (workplaces > living.length) hints.push(RU.noWorker);
  if (!isGameOver(state)) msg.textContent = hints[0] ?? '';
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
  if (isGameOver(state)) { state = initialState(); lastEra = 0; banner = ''; techSig = ''; msg.textContent = ''; schedule(); draw(); return; }
  const rect = app.canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / cell), y = Math.floor((e.clientY - rect.top) / cell);
  const next = build(state, selected, x, y);
  if (!next) { msg.textContent = RU.cantBuild; return; }
  state = next;
  draw();
});
addEventListener('resize', resize);
buildBar();
resize();
showIntro();
