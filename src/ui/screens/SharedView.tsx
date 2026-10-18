// Read-only view of a snapshot received through a link (#s=…).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Character } from '@/engine/character';
import { decodeSnapshot } from '@/share/snapshot';
import { getPackage } from '@/systems/registry';
import { getCharacter, putCharacter } from '@/storage/db';
import { SystemProvider } from '@/ui/context';
import { DiceProvider } from '@/ui/dice/DiceProvider';
import { SheetBody } from '@/ui/screens/SheetScreen';
import { useI18n } from '@/i18n/I18nContext';
import { goLibrary, goSheet } from '@/routing';

export function SharedView({ data }: { data: string }) {
  const { t } = useI18n();
  const [ch, setCh] = useState<Character | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    decodeSnapshot(data).then(setCh).catch((e) => setError((e as Error).message));
  }, [data]);

  if (error) return <ViewMessage text={error} />;
  if (!ch) return <div className="flex min-h-full items-center justify-center text-text-mute">{t('loading')}</div>;
  return <ReadOnlyView ch={ch} label={t('readOnlySnapshot')} />;
}

export function ViewMessage({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-full gap-4 text-text-mute text-center px-6">
      <p>{text}</p>
      <button onClick={() => { window.history.replaceState({}, '', window.location.pathname); goLibrary(); }} className="border border-line2 rounded px-4 py-2 hover:border-text-mute">← {t('myCharacters')}</button>
    </div>
  );
}

/** A sheet someone else shared: read-only, with "save a copy to my library". */
export function ReadOnlyView({ ch, label }: { ch: Character; label: string }) {
  const { t } = useI18n();
  const pkg = getPackage(ch.system.id);
  if (!pkg) return <ViewMessage text={`${t('unknownSystem')}: ${ch.system.id}`} />;

  function save() {
    const copy: Character = { ...ch, id: getCharacter(ch.id) ? crypto.randomUUID() : ch.id, updatedAt: Date.now() };
    putCharacter(copy);
    toast.success(t('savedToLibrary'));
    window.history.replaceState({}, '', window.location.pathname);
    goSheet(copy.id);
  }

  return (
    <SystemProvider pkg={pkg}>
      <DiceProvider values={ch.values}>
        <SheetBody
          ch={ch}
          set={() => {}}
          readOnly
          banner={<>
            <span>{label}</span>
            <button onClick={save} className="bg-gold text-ink rounded px-3 py-1 normal-case tracking-normal font-body font-medium text-xs">{t('saveToLibrary')}</button>
            <button onClick={() => { window.history.replaceState({}, '', window.location.pathname); goLibrary(); }} className="underline normal-case tracking-normal font-body text-xs">{t('myCharacters')}</button>
          </>}
        />
      </DiceProvider>
    </SystemProvider>
  );
}
