import type { Cost, Resources } from '../core/types';

export type ResKey = keyof Resources;

/** «15 дерева + 10 камня». */
export function costText(c: Cost): string {
  return [c.wood ? `${c.wood} дерева` : '', c.stone ? `${c.stone} камня` : ''].filter(Boolean).join(' + ');
}

/** Чего не хватает на постройку: «ещё 5 дерева»; пусто, если хватает всего. */
export function missingText(res: Resources, c: Cost): string {
  const wood = Math.ceil((c.wood ?? 0) - res.wood);
  const stone = Math.ceil((c.stone ?? 0) - res.stone);
  const parts = [wood > 0 ? `${wood} дерева` : '', stone > 0 ? `${stone} камня` : ''].filter(Boolean);
  return parts.length ? `ещё ${parts.join(' + ')}` : '';
}

/** «+12», «−3», «0» для скорости изменения ресурса. */
export function rateText(perDay: number): string {
  const v = Math.round(perDay);
  if (v === 0) return '0';
  return v > 0 ? `+${v}` : `−${-v}`;
}

/**
 * Сглаженная скорость изменения ресурсов за игровые сутки (24 тика).
 * Учитывает только изменения внутри шага симуляции, без трат на стройку.
 */
export class RateTracker {
  perDay: Record<ResKey, number> = { wood: 0, stone: 0, food: 0, water: 0, knowledge: 0 };
  private warm = false;

  record(before: Resources, after: Resources): void {
    for (const k of Object.keys(this.perDay) as ResKey[]) {
      const d = (after[k] - before[k]) * 24;
      this.perDay[k] = this.warm ? this.perDay[k] * 0.85 + d * 0.15 : d;
    }
    this.warm = true;
  }

  reset(): void {
    for (const k of Object.keys(this.perDay) as ResKey[]) this.perDay[k] = 0;
    this.warm = false;
  }
}
