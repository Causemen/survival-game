import type { Resources } from '../core/types';

/** Результат выбора. Числа правятся здесь, без изменений кода. */
export interface Effect {
  text: string;
  res?: Partial<Resources>;
  /** Изменение здоровья у всех живых. */
  health?: number;
  /** Потеря здоровья у одного случайного жителя. */
  victim?: number;
}

export interface DilemmaOption {
  label: string;
  /** Короткая подсказка о цене и риске. */
  hint: string;
  effect?: Effect;
  gamble?: { chance: number; win: Effect; lose: Effect };
}

export interface Dilemma {
  id: string;
  title: string;
  text: string;
  options: [DilemmaOption, DilemmaOption];
}

export const DILEMMA_FIRST_TICK = 60;
export const DILEMMA_GAP = { min: 30, spread: 20 };

export const DILEMMAS: Dilemma[] = [
  {
    id: 'ruins',
    title: 'Склад в руинах',
    text: 'Разведчик заметил в завалах магазина нетронутый склад. Но крыша держится на честном слове и паре сосулек.',
    options: [
      { label: 'Рискнуть', hint: '60%: +25 еды, +20 дерева, иначе ранен житель', gamble: { chance: 0.6, win: { text: 'Склад оказался настоящим! Принесли консервы и доски.', res: { food: 25, wood: 20 } }, lose: { text: 'Крыша обвалилась, один житель сильно ранен. Склад теперь ещё глубже под завалом.', victim: 45 } } },
      { label: 'Пройти мимо', hint: 'ничего не меняется', effect: { text: 'Склад оставили сосулькам. Живее будут.' } },
    ],
  },
  {
    id: 'cough',
    title: 'Кашель в хижине',
    text: 'Двое жителей кашляют и чихают на весь лагерь. Хуже всего, если расползётся на всех.',
    options: [
      { label: 'Лечить отваром', hint: '−10 воды, −8 еды, всем +15 здоровья', effect: { text: 'Отвар сварили, кашель отступил. Пахнет, правда, как носки.', res: { water: -10, food: -8 }, health: 15 } },
      { label: 'Перетерпеть', hint: 'всем −12 здоровья', effect: { text: 'Решили перетерпеть. Лагерь шмыгает носом.', health: -12 } },
    ],
  },
  {
    id: 'traders',
    title: 'Бродячие торговцы',
    text: 'К лагерю подошли закутанные в одеяла торговцы с санками. Выменять можно только одно.',
    options: [
      { label: 'Еда за дрова', hint: '−20 дерева, +25 еды', effect: { text: 'Обмен состоялся: вам еда, им дрова и вежливое «спасибо».', res: { wood: -20, food: 25 } } },
      { label: 'Вода за камень', hint: '−10 камня, +25 воды', effect: { text: 'Камни ушли на санки, вода пришла во фляги.', res: { stone: -10, water: 25 } } },
    ],
  },
  {
    id: 'night-shift',
    title: 'Ночная смена',
    text: 'Припасы тают быстрее, чем хотелось бы. Можно отправить всех на сверхурочную добычу, но ночью на улице не курорт.',
    options: [
      { label: 'Сверхурочно', hint: '+20 дерева, +10 камня, всем −10 здоровья', effect: { text: 'Поработали сверхурочно. Склад пополнился, спины ноют.', res: { wood: 20, stone: 10 }, health: -10 } },
      { label: 'Дать отдых', hint: 'всем +8 здоровья', effect: { text: 'Все отдохнули у реактора. Настроение растёт.', health: 8 } },
    ],
  },
];
