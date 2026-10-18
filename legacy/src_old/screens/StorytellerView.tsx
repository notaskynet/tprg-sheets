// Read-only storyteller view (?view=<uid>/<charId>). Shows a *snapshot* of the
// character as of its last cloud write, with "version as of <time>". Reads once
// on load (and on a manual refresh / page reload) — no live subscription, which
// is cheaper and honest about freshness. Falls back to the local store when
// cloud isn't configured (offline / local testing).
import { useCallback, useEffect, useState } from 'react';
import type { Character } from '@/domain/character';
import { SystemProvider } from '@/domain/SystemContext';
import { useI18n } from '@/i18n/I18nContext';
import { hasSystem } from '@/systems';
import { isCloudConfigured } from '@/cloud/config';
import { loadCharacter } from '@/store/characters';
import { Sheet } from '@/components/Sheet';
import { goDashboard } from '@/routing';

const noop = () => {};

export function StorytellerView({ uid, charId }: { uid: string; charId?: string }) {
  const { lang } = useI18n();
  const [ch, setCh] = useState<Character | null | 'loading'>('loading');
  const [loadedAt, setLoadedAt] = useState<number>(0);
  const id = charId ?? uid; // legacy single-char links pass only a uid

  const load = useCallback(async () => {
    setCh('loading');
    if (!isCloudConfigured() || uid === 'local') {
      setCh(loadCharacter(id));
      setLoadedAt(Date.now());
      return;
    }
    try {
      const { loadRemote } = await import('@/cloud/firebase');
      setCh(await loadRemote(uid, id));
    } catch {
      setCh(null);
    }
    setLoadedAt(Date.now());
  }, [uid, id]);

  useEffect(() => { void load(); }, [load]);

  if (ch === 'loading') {
    return <Centered>{lang === 'ru' ? 'Загрузка…' : 'Loading…'}</Centered>;
  }
  if (!ch || !hasSystem(ch.systemId)) {
    return (
      <Centered>
        <p>{lang === 'ru' ? 'Персонаж не найден' : 'Character not found'}</p>
        <button onClick={goDashboard} className="border border-line2 rounded px-4 py-2 mt-3 hover:border-text-mute">
          {lang === 'ru' ? 'На главную' : 'Home'}
        </button>
      </Centered>
    );
  }

  const ts = ch.updatedAt ?? loadedAt;
  const when = new Date(ts).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const banner = (
    <span className="inline-flex items-center gap-3">
      <span>{lang === 'ru' ? 'Просмотр мастера · версия от' : 'Storyteller view · version as of'} {when}</span>
      <button
        onClick={() => void load()}
        className="pointer-events-auto border border-gold/40 text-gold rounded px-2 py-0.5 normal-case tracking-normal hover:bg-gold/10 transition-colors"
      >
        {lang === 'ru' ? 'обновить' : 'refresh'}
      </button>
    </span>
  );

  return (
    <SystemProvider systemId={ch.systemId}>
      <Sheet
        ch={ch}
        setPath={noop}
        setCh={noop}
        saveState="saved"
        onNewCharacter={noop}
        onBack={goDashboard}
        readOnly
        readOnlyBanner={banner}
      />
    </SystemProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center min-h-full text-text-mute">{children}</div>;
}
