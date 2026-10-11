import { Application, Container, Graphics, Text } from 'pixi.js';
import { alive, build, canAfford, initialState, isFree, isGameOver, step, tempAt } from './core/sim';
import type { BuildingKind, State } from './core/types';
import { BUILDINGS } from './data/buildings';
import { RU } from './i18n';
import { ERAS } from './data/eras';
import { goalProgress } from './core/goals';
import { costText, missingText, RateTracker, rateText, type ResKey } from './ui/format';
import './ui/style.css';

const TICK_MS = 500;
const KINDS = Object.keys(BUILDINGS) as BuildingKind[];
const RES_ICONS: Record<ResKey, string> = { food: '🍎', water: '💧', wood: '🪵', stone: '🪨', knowledge: '📖' };

let state: State = initialState();
let speed = 1;
let selected: BuildingKind = 'gatherer';
let lastEra = 0;
let hover: { x: number; y: number } | null = null;
let flash: { text: string; until: number } | null = null;
let bannerTimer: number | undefined;
const rates = new RateTracker();

const root = document.getElementById('app')!;
root.className = 'game';
root.innerHTML = `
<header id="top">
  <div id="res"></div>
  <div id="time"><span id="day"></span><span id="speed"></span><button class="tbtn" id="helpBtn" title="${RU.help}">?</button></div>
  <div id="needs"></div>
</header>
<div id="main">
  <div id="stage">
    <div id="view"></div>
    <div id="alert" hidden></div>
    <div id="banner" hidden></div>
    <button id="goalsBtn"></button>
  </div>
  <aside id="side">
    <div id="goals"></div>
    <h3>${RU.selected}</h3>
    <div id="sel"></div>
    <h3>${RU.legendTitle}</h3>
    <div class="legend">${RU.legendHtml}</div>
    <button id="sideClose">${RU.close}</button>
  </aside>
</div>
<footer id="build"><div id="tip"></div><div id="bar"></div></footer>
<div id="intro" hidden></div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
const resEl = $('res'), needsEl = $('needs'), dayEl = $('day'), speedEl = $('speed');
const stage = $('stage'), view = $('view'), alertEl = $('alert'), bannerEl = $('banner');
const goalsBtn = $('goalsBtn'), goalsEl = $('goals'), selEl = $('sel');
const tip = $('tip'), bar = $('bar'), intro = $('intro');

// ——— Панели ———

function renderSpeed() {
  speedEl.innerHTML = '';
  for (const [label, sp, title] of [['⏸', 0, RU.pause], ['1×', 1, ''], ['2×', 2, ''], ['4×', 4, '']] as const) {
    const b = document.createElement('button');
    b.className = `tbtn${speed === sp ? ' on' : ''}`;
    b.textContent = label;
    if (title) b.title = title;
    b.onclick = () => setSpeed(sp);
    speedEl.append(b);
  }
}

function setSpeed(sp: number) {
  speed = sp;
  schedule();
  renderSpeed();
}

function renderBar() {
  bar.innerHTML = '';
  KINDS.forEach((kind, i) => {
    const c = BUILDINGS[kind].cost;
    const ok = canAfford(state.res, kind);
    const b = document.createElement('button');
    b.className = `bbtn${kind === selected ? ' on' : ''}${ok ? '' : ' no'}`;
    b.innerHTML = `<span class="ic">${RU.icons[kind]}</span><span class="nm">${RU.buildings[kind]}<span class="key">${i + 1}</span></span><span class="pr">${ok ? costText(c) : missingText(state.res, c)}</span>`;
    b.title = `${RU.desc[kind]} ${RU.costWord}: ${costText(c)}`;
    b.onclick = () => select(kind);
    bar.append(b);
  });
  const c = BUILDINGS[selected].cost;
  const ok = canAfford(state.res, selected);
  tip.textContent = `${RU.icons[selected]} ${RU.desc[selected]} ${RU.tapToBuild}`;
  selEl.innerHTML = `<div><b>${RU.icons[selected]} ${RU.buildings[selected]}</b></div><div>${RU.desc[selected]}</div>`
    + `<div class="cost${ok ? '' : ' no'}">${RU.costWord}: ${costText(c)}${ok ? '' : ` (${missingText(state.res, c)})`}</div>`;
}

function select(kind: BuildingKind) {
  selected = kind;
  barSig = '';
  renderBar();
  draw();
}

let barSig = '';
function renderPanels() {
  const r = state.res;
  const living = alive(state);

  resEl.innerHTML = `<span class="chip" title="${RU.people}">👥 <b>${living.length}</b></span>`
    + (Object.keys(RES_ICONS) as ResKey[]).map((k) => {
      const rate = rates.perDay[k];
      const cls = Math.round(rate) > 0 ? 'up' : Math.round(rate) < 0 ? 'down' : '';
      const low = k !== 'knowledge' && r[k] < 15;
      return `<span class="chip${low ? ' low' : ''}" title="${RU[k]}: ${rateText(rate)} ${RU.perDay}">${RES_ICONS[k]} <span class="name">${RU[k]}</span> <b>${r[k] | 0}</b> <span class="rate ${cls}">${rateText(rate)}</span></span>`;
    }).join('');

  const avg = (k: 'warmth' | 'hunger' | 'thirst' | 'health') => living.length ? living.reduce((a, p) => a + p[k], 0) / living.length : 0;
  needsEl.innerHTML = (['warmth', 'hunger', 'thirst', 'health'] as const).map((k) => {
    const v = avg(k);
    const col = v > 60 ? '#6c9' : v > 30 ? '#eb5' : '#e55';
    return `<span title="${RU.needs[k]}: ${v | 0}%">${RU.needIcons[k]}<span class="lbl">${RU.needs[k]}</span><span class="meter"><i style="width:${v}%;background:${col}"></i></span></span>`;
  }).join('');

  dayEl.textContent = `${RU.day} ${((state.tick / 24) | 0) + 1}, ${String(state.tick % 24).padStart(2, '0')}:00`;

  // Цели и эпохи
  if (state.era > lastEra) { lastEra = state.era; showBanner(RU.eraDone); }
  const eraDef = ERAS[Math.min(state.era, ERAS.length - 1)]!;
  const gp = goalProgress(state);
  const doneN = gp.filter((g) => g.done).length;
  const nextIdx = gp.findIndex((g) => !g.done);
  goalsEl.innerHTML = `<h3>${RU.era}</h3><div class="eras">`
    + ERAS.map((e, i) => `<span class="${i < state.era ? 'done' : i === state.era ? 'cur' : ''}">${i < state.era ? '✓' : i === state.era ? '▶' : '🔒'} ${e.name}</span>`).join('') + '</div>'
    + (eraDef.playable && gp.length
      ? `<h3>${RU.goals} · ${doneN}/${gp.length}</h3><div class="progress"><i style="width:${(doneN / gp.length) * 100}%"></i></div><ul class="goals">`
        + gp.map((g, i) => `<li class="${g.done ? 'done' : i === nextIdx ? 'next' : ''}">${g.done ? '✓' : i === nextIdx ? '▶' : '○'} ${g.label}${g.target > 1 ? `<small>${Math.floor(g.cur)}/${g.target}</small>` : ''}</li>`).join('') + '</ul>'
      : `<div>${RU.eraSoon}</div>`);
  goalsBtn.textContent = gp.length ? `🎯 ${RU.goals} ${doneN}/${gp.length}` : `🎯 ${eraDef.name}`;

  // Предупреждения: временное сообщение важнее постоянных подсказок
  const workplaces = state.buildings.filter((b) => BUILDINGS[b.kind].worker).length;
  const hints: string[] = [];
  if (avg('warmth') < 35) hints.push(RU.freezing);
  if (r.food < 15 || avg('hunger') < 35) hints.push(RU.starving);
  if (r.water < 15 || avg('thirst') < 35) hints.push(RU.thirsty);
  if (r.wood < 15) hints.push(RU.noWood);
  if (workplaces > living.length) hints.push(RU.noWorker);
  if (flash && flash.until < performance.now()) flash = null;
  const over = isGameOver(state);
  const text = over ? RU.gameOver : flash?.text ?? hints[0] ?? '';
  alertEl.hidden = !text;
  alertEl.textContent = text;
  alertEl.classList.toggle('bad', over || !!flash);

  const sig = KINDS.map((k) => (canAfford(state.res, k) ? 1 : 0)).join('') + (state.res.wood | 0) + (state.res.stone | 0);
  if (sig !== barSig) { barSig = sig; renderBar(); }
}

function showBanner(text: string) {
  bannerEl.textContent = text;
  bannerEl.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => { bannerEl.hidden = true; }, 5000);
}

function showFlash(text: string) {
  flash = { text, until: performance.now() + 2000 };
  renderPanels();
}

function showIntro() {
  setSpeed(0);
  intro.innerHTML = `<div><h2 style="margin-top:0">${RU.title}</h2>${RU.intro.map((t) => `<p>${t}</p>`).join('')}<button>${RU.start}</button></div>`;
  intro.hidden = false;
  intro.querySelector('button')!.onclick = () => { intro.hidden = true; setSpeed(1); };
}

// ——— Карта ———

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
  // Предпросмотр постройки под курсором: зелёный — можно, красный — нельзя
  if (hover && !isGameOver(state)) {
    const ok = isFree(state, hover.x, hover.y) && canAfford(state.res, selected);
    g.rect(hover.x * cell + 1, hover.y * cell + 1, cell - 3, cell - 3).stroke({ width: 2, color: ok ? 0x7ddc9c : 0xff6b6b });
  }
  layer.addChild(g);
  for (const b of state.buildings) {
    const t = new Text({ text: RU.icons[b.kind], style: { fontSize: cell * 0.5, fill: 0xffffff } });
    t.position.set(b.x * cell + cell * 0.28, b.y * cell + cell * 0.2);
    layer.addChild(t);
  }
  if (hover && isFree(state, hover.x, hover.y)) {
    const t = new Text({ text: RU.icons[selected], style: { fontSize: cell * 0.5, fill: 0xffffff } });
    t.alpha = 0.55;
    t.position.set(hover.x * cell + cell * 0.28, hover.y * cell + cell * 0.2);
    layer.addChild(t);
  }
  renderPanels();
}

// Камера: карта занимает всю область, её можно двигать пальцем/мышью и приближать.
let fit = 32;
let zoom = 1;
const MIN_TOUCH_CELL = 30;

function clampPan() {
  const w = stage.clientWidth, h = stage.clientHeight;
  const mw = cell * state.w, mh = cell * state.h;
  layer.x = mw <= w ? (w - mw) / 2 : Math.min(0, Math.max(w - mw, layer.x));
  layer.y = mh <= h ? (h - mh) / 2 : Math.min(0, Math.max(h - mh, layer.y));
}

/** Меняет масштаб, удерживая точку (px, py) экрана на месте. */
function setZoom(z: number, px: number, py: number) {
  const prev = cell;
  zoom = Math.max(1, Math.min(4, z));
  cell = Math.max(12, Math.round(fit * zoom));
  layer.x = px - ((px - layer.x) * cell) / prev;
  layer.y = py - ((py - layer.y) * cell) / prev;
  clampPan();
  draw();
}

function centerOnReactor() {
  layer.x = stage.clientWidth / 2 - (state.reactor.x + 0.5) * cell;
  layer.y = stage.clientHeight / 2 - (state.reactor.y + 0.5) * cell;
  clampPan();
}

let firstLayout = true;
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  fit = Math.max(8, Math.min(w / state.w, h / state.h));
  // На телефоне клетки не мельче пальца: карта крупнее экрана и прокручивается
  if (firstLayout && matchMedia('(pointer: coarse)').matches && fit < MIN_TOUCH_CELL) zoom = MIN_TOUCH_CELL / fit;
  cell = Math.max(12, Math.round(fit * zoom));
  app.renderer.resize(w, h);
  if (firstLayout) { centerOnReactor(); firstLayout = false; } else clampPan();
  draw();
}

function cellAt(e: { clientX: number; clientY: number }) {
  const rect = app.canvas.getBoundingClientRect();
  return { x: Math.floor((e.clientX - rect.left - layer.x) / cell), y: Math.floor((e.clientY - rect.top - layer.y) / cell) };
}

let timer: number | undefined;
function schedule() {
  clearInterval(timer);
  if (speed > 0 && !isGameOver(state)) timer = window.setInterval(tick, TICK_MS / speed);
}
function tick() {
  const before = state.res;
  state = step(state);
  rates.record(before, state.res);
  if (isGameOver(state)) clearInterval(timer);
  draw();
}

function restart() {
  state = initialState();
  lastEra = 0;
  rates.reset();
  schedule();
  draw();
}

await app.init({ background: '#0b0f14', antialias: true, width: 10, height: 10 });
view.append(app.canvas);
app.stage.addChild(layer);
function tryBuild(e: PointerEvent) {
  if (isGameOver(state)) { restart(); return; }
  const { x, y } = cellAt(e);
  const next = build(state, selected, x, y);
  if (!next) {
    showFlash(!canAfford(state.res, selected) ? `${RU.notEnough}: ${missingText(state.res, BUILDINGS[selected].cost)}` : RU.cellBusy);
    return;
  }
  state = next;
  if (e.pointerType !== 'mouse') hover = null;
  draw();
}

// Касание без сдвига — постройка; перетаскивание — сдвиг карты; два пальца — масштаб.
const pointers = new Map<number, { x: number; y: number }>();
let dragFrom: { x: number; y: number; lx: number; ly: number } | null = null;
let dragged = false;
let pinch: { d: number; zoom: number } | null = null;
const dist = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a!.x - b!.x, a!.y - b!.y); };

app.canvas.addEventListener('pointerdown', (e) => {
  app.canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) { dragFrom = { x: e.clientX, y: e.clientY, lx: layer.x, ly: layer.y }; dragged = false; }
  else if (pointers.size === 2) { pinch = { d: dist(), zoom }; dragged = true; }
});
app.canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const rect = app.canvas.getBoundingClientRect();
      setZoom(pinch.zoom * (dist() / pinch.d), (a!.x + b!.x) / 2 - rect.left, (a!.y + b!.y) / 2 - rect.top);
      return;
    }
    if (dragFrom) {
      const dx = e.clientX - dragFrom.x, dy = e.clientY - dragFrom.y;
      if (!dragged && Math.hypot(dx, dy) > 8) dragged = true;
      if (dragged) { layer.x = dragFrom.lx + dx; layer.y = dragFrom.ly + dy; clampPan(); hover = null; draw(); return; }
    }
  }
  if (e.pointerType !== 'mouse') return;
  const c = cellAt(e);
  if (hover?.x === c.x && hover.y === c.y) return;
  hover = c;
  draw();
});
const endPointer = (e: PointerEvent) => {
  if (!pointers.delete(e.pointerId)) return;
  if (pointers.size === 0) {
    if (!dragged && e.type === 'pointerup') tryBuild(e);
    dragFrom = null;
    pinch = null;
  } else if (pointers.size === 1) {
    const [p] = [...pointers.values()];
    dragFrom = { x: p!.x, y: p!.y, lx: layer.x, ly: layer.y };
    pinch = null;
  }
};
app.canvas.addEventListener('pointerup', endPointer);
app.canvas.addEventListener('pointercancel', endPointer);
app.canvas.addEventListener('pointerleave', () => { if (!pointers.size) { hover = null; draw(); } });
app.canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = app.canvas.getBoundingClientRect();
  setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - rect.left, e.clientY - rect.top);
}, { passive: false });

goalsBtn.onclick = () => root.classList.add('sheet');
$('sideClose').onclick = () => root.classList.remove('sheet');
$('helpBtn').onclick = showIntro;
addEventListener('keydown', (e) => {
  if (!intro.hidden) return;
  const n = Number(e.key);
  if (n >= 1 && n <= KINDS.length) select(KINDS[n - 1]!);
  else if (e.key === ' ') { e.preventDefault(); setSpeed(speed === 0 ? 1 : 0); }
});
new ResizeObserver(resize).observe(stage);
renderSpeed();
renderBar();
resize();
showIntro();
