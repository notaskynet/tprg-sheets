// Editing state for one character with debounced write-through to storage.
import { useCallback, useEffect, useRef, useState } from 'react';
import { setValue, type Character } from '@/engine/character';
import { getCharacter, saveCharacter } from '@/storage/db';
import type { SaveState } from '@/ui/primitives';

export interface Editor {
  ch: Character | null;
  set: (path: string, value: unknown) => void;
  replace: (next: Character) => void;
  saveState: SaveState;
}

export function useCharacterEditor(id: string): Editor {
  const [ch, setCh] = useState<Character | null>(() => getCharacter(id) ?? null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const set = useCallback((path: string, value: unknown) => {
    dirty.current = true;
    setCh((prev) => (prev ? setValue(prev, path, value) : prev));
  }, []);
  const replace = useCallback((next: Character) => {
    dirty.current = true;
    setCh(next);
  }, []);

  useEffect(() => {
    if (!ch || !dirty.current) return;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveCharacter(ch);
      dirty.current = false;
      setSaveState('saved');
    }, 350);
    return () => clearTimeout(timer.current);
  }, [ch]);

  // Flush a pending save when leaving the sheet or closing the tab.
  const latest = useRef(ch);
  latest.current = ch;
  useEffect(() => {
    const flush = () => { if (dirty.current && latest.current) { saveCharacter(latest.current); dirty.current = false; } };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  return { ch, set, replace, saveState };
}
