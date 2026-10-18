// Character <-> .trpg.json file.
import { CHARACTER_SCHEMA, type Character } from '@/engine/character';

export function characterToJson(ch: Character): string {
  return JSON.stringify(ch, null, 2);
}

export function parseCharacter(text: string): Character {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || !raw.system?.id || typeof raw.values !== 'object' || raw.schema > CHARACTER_SCHEMA)
    throw new Error('Not a trpg-sheets character file');
  return { ...raw, id: raw.id || crypto.randomUUID() } as Character;
}

export const readCharacterFile = async (file: File) => parseCharacter(await file.text());

export function downloadCharacter(ch: Character, name: string): void {
  const safe = name.replace(/[^\p{L}\p{N}_\- ]+/gu, '').trim() || 'character';
  const url = URL.createObjectURL(new Blob([characterToJson(ch)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${safe}.trpg.json` });
  a.click();
  URL.revokeObjectURL(url);
}
