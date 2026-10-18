// Kebab menu: new character (via wizard), JSON export/import, back to dashboard.
// Cloud actions (Drive/Firestore/share) are added in Phase 4.
import { useEffect, useRef, useState } from 'react';
import type { Character } from '@/domain/character';
import { useI18n } from '@/i18n/I18nContext';
import { useSystem } from '@/domain/SystemContext';
import { useAuth } from '@/cloud/AuthContext';
import { shareLink } from '@/routing';
import { getSystem, hasSystem } from '@/systems';

export function SheetActions({ ch, onImport, onNewCharacter, onBack }: {
  ch: Character;
  onImport: (ch: Character) => void;
  onNewCharacter: () => void;
  onBack: () => void;
}) {
  const { t, lang } = useI18n();
  const { system } = useSystem();
  const { configured, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shared, setShared] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function share() {
    if (!user) return;
    const link = shareLink(user.uid, ch.id);
    try {
      await navigator.clipboard.writeText(link);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      prompt(lang === 'ru' ? 'Ссылка для мастера:' : 'Storyteller link:', link);
    }
  }

  async function exportPdf() {
    setOpen(false);
    setExporting(true);
    try {
      const { exportCharacterPdf } = await import('@/pdf/export');
      await exportCharacterPdf(system, ch, lang);
    } catch (e) {
      alert((lang === 'ru' ? 'Не удалось создать PDF: ' : 'PDF export failed: ') + (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function exportJson() {
    const safe = (ch.profile.name || 'character').replace(/[^a-z0-9_\-Ѐ-ӿ ]+/gi, '').trim() || 'character';
    const blob = new Blob([JSON.stringify(ch, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vtm20-${safe}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setOpen(false);
  }

  function importJson() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const obj = JSON.parse(String(r.result));
          if (obj && typeof obj === 'object') {
            const systemId = obj.systemId && hasSystem(obj.systemId) ? obj.systemId : ch.systemId;
            const base = getSystem(systemId).defaultCharacter();
            onImport({ ...base, ...obj, id: ch.id, systemId });
            setOpen(false);
          }
        } catch (e) {
          alert((lang === 'ru' ? 'Не удалось разобрать JSON: ' : 'Could not parse JSON: ') + (e as Error).message);
        }
      };
      r.readAsText(f);
    };
    inp.click();
  }

  const item = 'flex items-center gap-2.5 w-full px-3 py-2.5 bg-transparent border-0 text-text text-[13px] text-left cursor-pointer rounded hover:bg-surf transition-colors';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-transparent border border-line2 text-text-mute w-8 h-[30px] rounded inline-flex items-center justify-center hover:text-text hover:border-text-mute transition-colors"
        aria-label="actions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="8" cy="13" r="1.4" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] bg-surf border border-line2 rounded-md p-1 min-w-[220px] z-[100] shadow-[0_12px_32px_rgba(0,0,0,.4)]">
          <button className={item} onClick={() => { onNewCharacter(); setOpen(false); }}>{t('newCharacter')}</button>
          <div className="h-px bg-line mx-2 my-1" />
          <button className={item} onClick={exportPdf} disabled={exporting}>
            {exporting ? (lang === 'ru' ? 'Создаю PDF…' : 'Generating PDF…') : t('print')}
          </button>
          <div className="h-px bg-line mx-2 my-1" />
          <button className={item} onClick={exportJson}>{lang === 'ru' ? 'Экспорт JSON' : 'Export JSON'}</button>
          <button className={item} onClick={importJson}>{lang === 'ru' ? 'Импорт JSON' : 'Import JSON'}</button>
          {configured && user && (
            <>
              <div className="h-px bg-line mx-2 my-1" />
              <button className={item} onClick={share}>
                {shared ? (lang === 'ru' ? '✓ Ссылка скопирована' : '✓ Link copied') : (lang === 'ru' ? 'Поделиться с мастером' : 'Share with storyteller')}
              </button>
            </>
          )}
          <div className="h-px bg-line mx-2 my-1" />
          <button className={item} onClick={() => { onBack(); setOpen(false); }}>← {t('myCharacters')}</button>
        </div>
      )}
    </div>
  );
}
