import type { BuildingKind } from './core/types';

export const RU = {
  title: 'Реактор',
  day: 'День',
  people: 'Люди',
  food: 'Еда',
  water: 'Вода',
  wood: 'Дерево',
  stone: 'Камень',
  knowledge: 'Знания',
  pause: 'Пауза',
  gameOver: 'Все поселенцы погибли. Нажмите, чтобы начать заново.',
  cantBuild: 'Нельзя построить здесь или не хватает ресурсов',
  buildings: {
    hut: 'Хижина',
    campfire: 'Костёр',
    gatherer: 'Собиратель',
    woodcutter: 'Лесоруб',
    quarry: 'Каменоломня',
    purifier: 'Фильтр воды',
  } satisfies Record<BuildingKind, string>,
};
