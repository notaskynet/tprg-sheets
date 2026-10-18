// V20 catalogs (attributes, abilities, clans, disciplines, backgrounds, …).
// Trait names are localized maps so adding a language is just another key.
import type { Trait, Archetype, HealthLevel } from '@/systems/types';

export const ATTRIBUTES: Trait[] = [
  { id: 'strength', cat: 'physical', name: { ru: 'Сила', en: 'Strength' } },
  { id: 'dexterity', cat: 'physical', name: { ru: 'Ловкость', en: 'Dexterity' } },
  { id: 'stamina', cat: 'physical', name: { ru: 'Выносливость', en: 'Stamina' } },
  { id: 'charisma', cat: 'social', name: { ru: 'Харизма', en: 'Charisma' } },
  { id: 'manipulation', cat: 'social', name: { ru: 'Манипулирование', en: 'Manipulation' } },
  { id: 'appearance', cat: 'social', name: { ru: 'Внешность', en: 'Appearance' } },
  { id: 'perception', cat: 'mental', name: { ru: 'Восприятие', en: 'Perception' } },
  { id: 'intelligence', cat: 'mental', name: { ru: 'Интеллект', en: 'Intelligence' } },
  { id: 'wits', cat: 'mental', name: { ru: 'Сообразительность', en: 'Wits' } },
];

export const ABILITIES: Trait[] = [
  { id: 'alertness', cat: 'talents', name: { ru: 'Бдительность', en: 'Alertness' } },
  { id: 'athletics', cat: 'talents', name: { ru: 'Атлетика', en: 'Athletics' } },
  { id: 'awareness', cat: 'talents', name: { ru: 'Осознание', en: 'Awareness' } },
  { id: 'brawl', cat: 'talents', name: { ru: 'Драка', en: 'Brawl' } },
  { id: 'empathy', cat: 'talents', name: { ru: 'Эмпатия', en: 'Empathy' } },
  { id: 'expression', cat: 'talents', name: { ru: 'Выразительность', en: 'Expression' } },
  { id: 'intimidation', cat: 'talents', name: { ru: 'Запугивание', en: 'Intimidation' } },
  { id: 'leadership', cat: 'talents', name: { ru: 'Лидерство', en: 'Leadership' } },
  { id: 'streetwise', cat: 'talents', name: { ru: 'Уличные знания', en: 'Streetwise' } },
  { id: 'subterfuge', cat: 'talents', name: { ru: 'Хитрость', en: 'Subterfuge' } },
  { id: 'animal_ken', cat: 'skills', name: { ru: 'Понимание животных', en: 'Animal Ken' } },
  { id: 'crafts', cat: 'skills', name: { ru: 'Ремёсла', en: 'Crafts' } },
  { id: 'drive', cat: 'skills', name: { ru: 'Вождение', en: 'Drive' } },
  { id: 'etiquette', cat: 'skills', name: { ru: 'Этикет', en: 'Etiquette' } },
  { id: 'firearms', cat: 'skills', name: { ru: 'Огнестрел', en: 'Firearms' } },
  { id: 'larceny', cat: 'skills', name: { ru: 'Воровство', en: 'Larceny' } },
  { id: 'melee', cat: 'skills', name: { ru: 'Холодное оружие', en: 'Melee' } },
  { id: 'performance', cat: 'skills', name: { ru: 'Лицедейство', en: 'Performance' } },
  { id: 'stealth', cat: 'skills', name: { ru: 'Скрытность', en: 'Stealth' } },
  { id: 'survival', cat: 'skills', name: { ru: 'Выживание', en: 'Survival' } },
  { id: 'academics', cat: 'knowledges', name: { ru: 'Академ. знания', en: 'Academics' } },
  { id: 'computer', cat: 'knowledges', name: { ru: 'Компьютеры', en: 'Computer' } },
  { id: 'finance', cat: 'knowledges', name: { ru: 'Финансы', en: 'Finance' } },
  { id: 'investigation', cat: 'knowledges', name: { ru: 'Расследование', en: 'Investigation' } },
  { id: 'law', cat: 'knowledges', name: { ru: 'Право', en: 'Law' } },
  { id: 'medicine', cat: 'knowledges', name: { ru: 'Медицина', en: 'Medicine' } },
  { id: 'occult', cat: 'knowledges', name: { ru: 'Оккультизм', en: 'Occult' } },
  { id: 'politics', cat: 'knowledges', name: { ru: 'Политика', en: 'Politics' } },
  { id: 'science', cat: 'knowledges', name: { ru: 'Наука', en: 'Science' } },
  { id: 'technology', cat: 'knowledges', name: { ru: 'Технологии', en: 'Technology' } },
];

export const ATTRIBUTE_CATEGORIES = ['physical', 'social', 'mental'];
export const ABILITY_CATEGORIES = ['talents', 'skills', 'knowledges'];

export const COMMON_DISCIPLINES: Trait[] = [
  { id: 'animalism', name: { ru: 'Анимализм', en: 'Animalism' } },
  { id: 'auspex', name: { ru: 'Прорицание', en: 'Auspex' } },
  { id: 'celerity', name: { ru: 'Стремительность', en: 'Celerity' } },
  { id: 'chimerstry', name: { ru: 'Химерия', en: 'Chimerstry' } },
  { id: 'dementation', name: { ru: 'Помешательство', en: 'Dementation' } },
  { id: 'dominate', name: { ru: 'Доминирование', en: 'Dominate' } },
  { id: 'fortitude', name: { ru: 'Стойкость', en: 'Fortitude' } },
  { id: 'necromancy', name: { ru: 'Некромантия', en: 'Necromancy' } },
  { id: 'obfuscate', name: { ru: 'Затемнение', en: 'Obfuscate' } },
  { id: 'obtenebration', name: { ru: 'Тенеплетение', en: 'Obtenebration' } },
  { id: 'potence', name: { ru: 'Мощь', en: 'Potence' } },
  { id: 'presence', name: { ru: 'Очарование', en: 'Presence' } },
  { id: 'protean', name: { ru: 'Превращение', en: 'Protean' } },
  { id: 'quietus', name: { ru: 'Безмолвие', en: 'Quietus' } },
  { id: 'serpentis', name: { ru: 'Змеинство', en: 'Serpentis' } },
  { id: 'thaumaturgy', name: { ru: 'Чародейство', en: 'Thaumaturgy' } },
  { id: 'vicissitude', name: { ru: 'Изменчивость', en: 'Vicissitude' } },
];

// In-clan disciplines (V20). Caitiff have none (free choice). Used to scope the
// quick-pick at creation to the clan's three disciplines.
export const CLAN_DISCIPLINES: Record<string, string[]> = {
  brujah: ['celerity', 'potence', 'presence'],
  gangrel: ['animalism', 'fortitude', 'protean'],
  malkavian: ['auspex', 'dementation', 'obfuscate'],
  nosferatu: ['animalism', 'obfuscate', 'potence'],
  toreador: ['auspex', 'celerity', 'presence'],
  tremere: ['auspex', 'dominate', 'thaumaturgy'],
  ventrue: ['dominate', 'fortitude', 'presence'],
  assamite: ['celerity', 'obfuscate', 'quietus'],
  followers_of_set: ['obfuscate', 'presence', 'serpentis'],
  giovanni: ['dominate', 'necromancy', 'potence'],
  lasombra: ['dominate', 'obtenebration', 'potence'],
  ravnos: ['animalism', 'chimerstry', 'fortitude'],
  tzimisce: ['animalism', 'auspex', 'vicissitude'],
  caitiff: [],
};

export const COMMON_BACKGROUNDS: Trait[] = [
  { id: 'allies', name: { ru: 'Союзники', en: 'Allies' } },
  { id: 'contacts', name: { ru: 'Контакты', en: 'Contacts' } },
  { id: 'fame', name: { ru: 'Известность', en: 'Fame' } },
  { id: 'herd', name: { ru: 'Стадо', en: 'Herd' } },
  { id: 'influence', name: { ru: 'Влияние', en: 'Influence' } },
  { id: 'mentor', name: { ru: 'Наставник', en: 'Mentor' } },
  { id: 'resources', name: { ru: 'Ресурсы', en: 'Resources' } },
  { id: 'retainers', name: { ru: 'Слуги', en: 'Retainers' } },
  { id: 'status', name: { ru: 'Статус', en: 'Status' } },
  { id: 'domain', name: { ru: 'Владение', en: 'Domain' } },
];

export const CLANS: Trait[] = [
  { id: 'brujah', name: { ru: 'Бруха', en: 'Brujah' } },
  { id: 'gangrel', name: { ru: 'Гангрел', en: 'Gangrel' } },
  { id: 'malkavian', name: { ru: 'Малкавиан', en: 'Malkavian' } },
  { id: 'nosferatu', name: { ru: 'Носферату', en: 'Nosferatu' } },
  { id: 'toreador', name: { ru: 'Тореадор', en: 'Toreador' } },
  { id: 'tremere', name: { ru: 'Тремер', en: 'Tremere' } },
  { id: 'ventrue', name: { ru: 'Вентру', en: 'Ventrue' } },
  { id: 'assamite', name: { ru: 'Ассамит', en: 'Assamite' } },
  { id: 'followers_of_set', name: { ru: 'Последователи Сета', en: 'Followers of Set' } },
  { id: 'giovanni', name: { ru: 'Джованни', en: 'Giovanni' } },
  { id: 'lasombra', name: { ru: 'Ласомбра', en: 'Lasombra' } },
  { id: 'ravnos', name: { ru: 'Равнос', en: 'Ravnos' } },
  { id: 'tzimisce', name: { ru: 'Цимисхи', en: 'Tzimisce' } },
  { id: 'caitiff', name: { ru: 'Каитиф', en: 'Caitiff' } },
];

export const VIRTUES: Trait[] = [
  { id: 'conscience', name: { ru: 'Совесть', en: 'Conscience' } },
  { id: 'selfControl', name: { ru: 'Самоконтроль', en: 'Self-Control' } },
  { id: 'courage', name: { ru: 'Смелость', en: 'Courage' } },
];

export const HEALTH_LEVELS: HealthLevel[] = [
  { id: 'bruised', penalty: 0 },
  { id: 'hurt', penalty: -1 },
  { id: 'injured', penalty: -1 },
  { id: 'wounded', penalty: -2 },
  { id: 'mauled', penalty: -2 },
  { id: 'crippled', penalty: -5 },
  { id: 'incapacitated', penalty: null },
];

export const ARCHETYPES: Archetype[] = [
  { name: { ru: 'Архитектор', en: 'Architect' } }, { name: { ru: 'Бунтарь', en: 'Rebel' } },
  { name: { ru: 'Воспитатель', en: 'Caregiver' } }, { name: { ru: 'Гедонист', en: 'Bon Vivant' } },
  { name: { ru: 'Грубиян', en: 'Bravo' } }, { name: { ru: 'Дикарь', en: 'Savage' } },
  { name: { ru: 'Защитник', en: 'Defender' } }, { name: { ru: 'Игрок', en: 'Gallant' } },
  { name: { ru: 'Конформист', en: 'Conformist' } }, { name: { ru: 'Критик', en: 'Critic' } },
  { name: { ru: 'Любопытный', en: 'Curious' } }, { name: { ru: 'Мыслитель', en: 'Thinker' } },
  { name: { ru: 'Одиночка', en: 'Loner' } }, { name: { ru: 'Перфекционист', en: 'Perfectionist' } },
  { name: { ru: 'Победитель', en: 'Competitor' } }, { name: { ru: 'Слуга', en: 'Servant' } },
  { name: { ru: 'Судья', en: 'Judge' } }, { name: { ru: 'Трикстер', en: 'Trickster' } },
  { name: { ru: 'Фанатик', en: 'Fanatic' } }, { name: { ru: 'Хитрец', en: 'Schemer' } },
];

// Creation point pools (V20 standard).
export const CREATION = {
  attrPrimary: 7, attrSecondary: 5, attrTertiary: 3, // +1 each over base 1
  abilPrimary: 13, abilSecondary: 9, abilTertiary: 5, // 0 start; max 3 dots at creation
  backgrounds: 5,
  disciplines: 3,
  virtues: 7, // +1 each over base 1
  freebie: 15,
  // freebie exchange rates
  freebieAttr: 5, freebieAbil: 2, freebieDisc: 7,
  freebieBg: 1, freebieVirtue: 2, freebieHumanity: 2, freebieWillpower: 1,
};

const BLOOD_BY_GEN: Record<number, [number, number]> = {
  13: [10, 1], 12: [11, 1], 11: [12, 1], 10: [13, 1],
  9: [14, 2], 8: [15, 3], 7: [20, 4], 6: [30, 6], 5: [40, 8], 4: [50, 10],
};

export function bloodPoolFor(gen: number): [number, number] {
  return BLOOD_BY_GEN[gen] ?? [10, 1];
}
