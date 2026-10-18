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

  const pkg = ch ? getPackage(ch.system.id) : undefined;
  if (error || (ch && !pkg)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 text-text-mute text-center px-6">
        <p>{error || `${t('unknownSystem')}: ${ch!.system.id}`}</p>
        <button onClick={goLibrary} className="border border-line2 rounded px-4 py-2 hover:border-text-mute">← {t('myCharacters')}</button>
      </div>
    );
  }
  if (!ch || !pkg) return <div className="flex min-h-full items-center justify-center text-text-mute">{t('loading')}</div>;

  function save() {
    const copy: Character = { ...ch!, id: getCharacter(ch!.id) ? crypto.randomUUID() : ch!.id, updatedAt: Date.now() };
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
            <span>{t('readOnlySnapshot')}</span>
            <button onClick={save} className="bg-gold text-ink rounded px-3 py-1 normal-case tracking-normal font-body font-medium text-xs">{t('saveToLibrary')}</button>
            <button onClick={() => { window.history.replaceState({}, '', window.location.pathname); goLibrary(); }} className="underline normal-case tracking-normal font-body text-xs">{t('myCharacters')}</button>
          </>}
        />
      </DiceProvider>
    </SystemProvider>
  );
}
