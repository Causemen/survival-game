import { describe, it, expect } from 'vitest';
import { build, initialState, step } from './sim';
import { clearSave, loadGame, parse, saveGame, SAVE_KEY, serialize, type KV } from './save';

const memory = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('сохранение', () => {
  it('туда и обратно сохраняет состояние', () => {
    let s = build(initialState(), 'gatherer', 3, 3)!;
    for (let i = 0; i < 30; i++) s = step(s);
    const store = memory();
    expect(saveGame(store, s)).toBe(true);
    expect(loadGame(store)).toEqual(s);
  });
  it('продолжает игру тем же ходом: после загрузки симуляция идёт как без сохранения', () => {
    let s = initialState();
    for (let i = 0; i < 100; i++) s = step(s);
    const store = memory();
    saveGame(store, s);
    expect(step(loadGame(store)!)).toEqual(step(s));
  });
  it('пусто, мусор и чужая версия дают null', () => {
    expect(parse(null)).toBeNull();
    expect(parse('не json')).toBeNull();
    expect(parse(JSON.stringify({ v: 999, state: initialState() }))).toBeNull();
    expect(parse(JSON.stringify({ v: 1, state: { tick: 'x' } }))).toBeNull();
    expect(parse(JSON.stringify({ v: 1 }))).toBeNull();
  });
  it('старое сохранение без новых полей дополняется значениями по умолчанию', () => {
    const { log: _l, active: _a, ...old } = initialState();
    const s = parse(JSON.stringify({ v: 1, state: old }));
    expect(s?.active).toEqual([]);
    expect(s?.log).toEqual([]);
  });
  it('сохранение вымершей колонии стирается, а не загружается', () => {
    const store = memory();
    const dead = initialState();
    dead.settlers = dead.settlers.map((p) => ({ ...p, alive: false }));
    store.setItem(SAVE_KEY, serialize(initialState()));
    saveGame(store, dead);
    expect(store.getItem(SAVE_KEY)).toBeNull();
    store.setItem(SAVE_KEY, serialize(dead));
    expect(loadGame(store)).toBeNull();
  });
  it('переполненное или недоступное хранилище не роняет игру', () => {
    const broken: KV = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('x'); } };
    expect(saveGame(broken, initialState())).toBe(false);
    expect(loadGame(broken)).toBeNull();
    expect(() => clearSave(broken)).not.toThrow();
  });
});
