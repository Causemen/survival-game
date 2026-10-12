import { initialState, isGameOver } from './sim';
import type { State } from './types';

export const SAVE_KEY = 'reactor-survival-save';
/** Поднимайте при несовместимых изменениях State: старые сохранения будут отброшены. */
export const SAVE_VERSION = 1;

/** Минимум, который нужен от Storage (подходит localStorage и подмена в тестах). */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serialize(s: State): string {
  return JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), state: s });
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Разбирает сохранение; при любом сомнении возвращает null (лучше новая игра, чем сломанная). */
export function parse(text: string | null): State | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as { v?: unknown; state?: Record<string, unknown> };
    if (raw.v !== SAVE_VERSION || !raw.state || typeof raw.state !== 'object') return null;
    // Недостающие поля (добавленные позже) берём из начального состояния
    const s = { ...initialState(), ...raw.state } as State;
    if (![s.tick, s.w, s.h, s.era, s.nextId, s.seed].every(isNum)) return null;
    if (!Array.isArray(s.settlers) || !Array.isArray(s.buildings) || !Array.isArray(s.techs)) return null;
    if (!Array.isArray(s.active) || !Array.isArray(s.log)) return null;
    if (!s.reactor || !isNum(s.reactor.x) || !isNum(s.reactor.y) || !isNum(s.reactor.level)) return null;
    if (!s.res || !(['wood', 'stone', 'food', 'water', 'knowledge'] as const).every((k) => isNum(s.res[k]))) return null;
    return s;
  } catch {
    return null;
  }
}

/** Сохраняет игру; false, если хранилище недоступно или переполнено. */
export function saveGame(store: KV, s: State): boolean {
  try {
    if (isGameOver(s)) { store.removeItem(SAVE_KEY); return true; }
    store.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(store: KV): State | null {
  try {
    const s = parse(store.getItem(SAVE_KEY));
    return s && !isGameOver(s) ? s : null;
  } catch {
    return null;
  }
}

export function clearSave(store: KV): void {
  try { store.removeItem(SAVE_KEY); } catch { /* хранилище недоступно */ }
}
