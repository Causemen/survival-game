import { initialState, step } from './core/state';

let s = initialState();
const el = document.getElementById('app')!;
const render = () => {
  el.textContent = `День ${(s.tick / 24) | 0} | люди ${s.people} | еда ${s.food.toFixed(0)} | тепло ${s.heat.toFixed(0)} | вода ${s.water.toFixed(0)}`;
};
setInterval(() => { s = step(s); render(); }, 500);
render();
