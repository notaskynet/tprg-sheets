// Live read-only view of a sheet the owner shared by link (?view=<id>). Updates as the owner edits.
import { useEffect, useState } from 'react';
import type { Character } from '@/engine/character';
import { watchShare } from '@/cloud/firebase';
import { isCloudConfigured } from '@/cloud/config';
import { useI18n } from '@/i18n/I18nContext';
import { ReadOnlyView, ViewMessage } from './SharedView';

export function LiveView({ shareId }: { shareId: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<{ ch: Character | null } | 'error' | null>(null);

  useEffect(() => {
    if (!isCloudConfigured()) { setState('error'); return; }
    let alive = true;
    let unsub: (() => void) | undefined;
    watchShare(
      shareId,
      (data) => { if (alive) setState({ ch: data && typeof data === 'object' ? { ...(data as Character), creation: { step: 0, done: true } } : null }); },
      () => { if (alive) setState('error'); },
    ).then((fn) => { if (alive) unsub = fn; else fn(); }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; unsub?.(); };
  }, [shareId]);

  if (state === null) return <div className="flex min-h-full items-center justify-center text-text-mute">{t('loading')}</div>;
  if (state === 'error') return <ViewMessage text={t('liveViewError')} />;
  if (!state.ch) return <ViewMessage text={t('linkDisabled')} />;
  return <ReadOnlyView ch={state.ch} label={t('readOnlyLive')} />;
}
