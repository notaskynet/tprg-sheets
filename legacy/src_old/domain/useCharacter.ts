// Character editing state with debounced autosave to the multi-character store.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Character } from './character';
import { loadCharacter, saveCharacter } from '@/store/characters';
import type { SaveState } from '@/components/primitives';

export interface CharacterEditor {
  ch: Character | null;
  setCh: (next: Character | ((prev: Character) => Character)) => void;
  /** Set a dotted path, e.g. setPath('profile.name', 'X') or 'attributes.strength'. */
  setPath: (path: string, value: unknown) => void;
  saveState: SaveState;
}

export function useCharacter(id: string | null): CharacterEditor {
  const [ch, setChState] = useState<Character | null>(() => (id ? loadCharacter(id) : null));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reload when the selected character changes.
  useEffect(() => {
    setChState(id ? loadCharacter(id) : null);
  }, [id]);

  const setCh = useCallback((next: Character | ((prev: Character) => Character)) => {
    setChState((prev) => {
      if (!prev) return prev;
      return typeof next === 'function' ? (next as (p: Character) => Character)(prev) : next;
    });
  }, []);

  const setPath = useCallback((path: string, value: unknown) => {
    setChState((prev) => {
      if (!prev) return prev;
      const parts = path.split('.');
      const next: Record<string, unknown> = { ...prev };
      let cur = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = { ...(cur[parts[i]] as Record<string, unknown>) };
        cur = cur[parts[i]] as Record<string, unknown>;
      }
      cur[parts[parts.length - 1]] = value;
      return next as unknown as Character;
    });
  }, []);

  // Debounced persistence.
  useEffect(() => {
    if (!ch) return;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveCharacter(ch);
      setSaveState('saved');
    }, 350);
    return () => clearTimeout(timer.current);
  }, [ch]);

  return { ch, setCh, setPath, saveState };
}
