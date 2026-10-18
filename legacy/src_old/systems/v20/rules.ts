// V20 derived values + creation validators.
import type { Character } from '@/domain/character';
import type { CheckItem, Lang } from '@/systems/types';
import { ATTRIBUTES, ABILITIES, HEALTH_LEVELS, CREATION, bloodPoolFor } from './data';

export function deriveHumanity(ch: Character): number {
  return (ch.virtues.conscience || 0) + (ch.virtues.selfControl || 0);
}

export function deriveWillpower(ch: Character): number {
  return ch.virtues.courage || 0;
}

export function healthPenalty(ch: Character): number | null {
  const total = ch.health.bashing + ch.health.lethal + ch.health.aggravated;
  if (total <= 0) return 0;
  if (total > 7) return null; // incapacitated / dead
  const penalties = HEALTH_LEVELS.map((l) => l.penalty);
  return penalties[Math.min(total - 1, 6)];
}

const attrSumByCat = (ch: Character, cat: string) =>
  ATTRIBUTES.filter((a) => a.cat === cat).reduce((s, a) => s + (ch.attributes[a.id] || 0), 0);

const abilSumByCat = (ch: Character, cat: string) =>
  ABILITIES.filter((a) => a.cat === cat).reduce((s, a) => s + (ch.abilities[a.id] || 0), 0);

export function spentFreebies(ch: Character): number {
  let cost = 0;

  // Attributes: each triad sum minus base 3, charged 5/dot over the 7/5/3 caps.
  const attrTotals = ['physical', 'social', 'mental']
    .map((cat) => attrSumByCat(ch, cat) - 3)
    .sort((a, b) => b - a);
  const attrCaps = [CREATION.attrPrimary, CREATION.attrSecondary, CREATION.attrTertiary];
  attrTotals.forEach((total, i) => {
    cost += Math.max(0, total - attrCaps[i]) * CREATION.freebieAttr;
  });

  // Abilities: 2/dot over the 13/9/5 caps.
  const abilTotals = ['talents', 'skills', 'knowledges']
    .map((cat) => abilSumByCat(ch, cat))
    .sort((a, b) => b - a);
  const abilCaps = [CREATION.abilPrimary, CREATION.abilSecondary, CREATION.abilTertiary];
  abilTotals.forEach((total, i) => {
    cost += Math.max(0, total - abilCaps[i]) * CREATION.freebieAbil;
  });

  const bgTotal = ch.backgrounds.reduce((s, b) => s + (b.level || 0), 0);
  if (bgTotal > CREATION.backgrounds) cost += (bgTotal - CREATION.backgrounds) * CREATION.freebieBg;

  const discTotal = ch.disciplines.reduce((s, d) => s + (d.level || 0), 0);
  if (discTotal > CREATION.disciplines)
    cost += (discTotal - CREATION.disciplines) * CREATION.freebieDisc;

  const vTotal =
    (ch.virtues.conscience || 0) + (ch.virtues.selfControl || 0) + (ch.virtues.courage || 0);
  if (vTotal > 10) cost += (vTotal - 10) * CREATION.freebieVirtue;

  const baseHum = deriveHumanity(ch);
  if (ch.humanity > baseHum) cost += (ch.humanity - baseHum) * CREATION.freebieHumanity;

  const baseWp = deriveWillpower(ch);
  if (ch.willpowerPermanent > baseWp)
    cost += (ch.willpowerPermanent - baseWp) * CREATION.freebieWillpower;

  return cost;
}

export function validateCharacter(ch: Character, lang: Lang = 'ru'): CheckItem[] {
  const L = (ru: string, en: string) => (lang === 'ru' ? ru : en);
  const items: CheckItem[] = [];

  const attrSums = ['physical', 'social', 'mental']
    .map((cat) => attrSumByCat(ch, cat))
    .sort((a, b) => b - a);
  items.push({
    id: 'attrs',
    ok: attrSums[0] >= 10 && attrSums[1] >= 8 && attrSums[2] >= 6,
    label: L('Атрибуты 7/5/3', 'Attributes 7/5/3'),
    val: attrSums.join('/'),
    need: '10/8/6',
  });

  const abilSums = ['talents', 'skills', 'knowledges']
    .map((cat) => abilSumByCat(ch, cat))
    .sort((a, b) => b - a);
  items.push({
    id: 'abils',
    ok: abilSums[0] >= 13 && abilSums[1] >= 9 && abilSums[2] >= 5,
    label: L('Способности 13/9/5', 'Abilities 13/9/5'),
    val: abilSums.join('/'),
    need: '13/9/5',
  });

  const vTotal =
    (ch.virtues.conscience || 0) + (ch.virtues.selfControl || 0) + (ch.virtues.courage || 0);
  items.push({
    id: 'virtues',
    ok: vTotal >= 10,
    label: L('Добродетели 7 (база 3)', 'Virtues 7 (base 3)'),
    val: vTotal,
    need: 10,
  });

  const dTotal = ch.disciplines.reduce((s, d) => s + (d.level || 0), 0);
  items.push({
    id: 'disc',
    ok: dTotal >= 3,
    label: L('Дисциплины 3', 'Disciplines 3'),
    val: dTotal,
    need: 3,
  });

  const bTotal = ch.backgrounds.reduce((s, b) => s + (b.level || 0), 0);
  items.push({
    id: 'bg',
    ok: bTotal >= 5,
    label: L('Преимущества 5', 'Backgrounds 5'),
    val: bTotal,
    need: 5,
  });

  items.push({ id: 'name', ok: !!ch.profile.name, label: L('Имя заполнено', 'Name set') });
  items.push({ id: 'clan', ok: !!ch.profile.clan, label: L('Клан выбран', 'Clan chosen') });
  items.push({ id: 'concept', ok: !!ch.profile.concept, label: L('Концепт описан', 'Concept written') });

  const freebies = spentFreebies(ch);
  items.push({
    id: 'freebies',
    ok: freebies <= CREATION.freebie,
    label: L('Свободные очки ≤ 15', 'Freebies ≤ 15'),
    val: freebies,
    need: CREATION.freebie,
  });

  return items;
}

export { bloodPoolFor };
