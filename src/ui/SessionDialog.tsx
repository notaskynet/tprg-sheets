// Start or join a live game session.
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { normalizeCode } from '@/share/protocol';
import { startSession } from '@/share/active';
import { useCharacters } from '@/storage/db';
import { getPackage } from '@/systems/registry';
import { cardData } from '@/ui/cardData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { goSession } from '@/routing';

const NAME_KEY = 'trpg.playerName';
const SHARED_KEY = 'trpg.sharedIds';
const loadShared = (): string[] => { try { const v = JSON.parse(localStorage.getItem(SHARED_KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const loadName = () => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } };
const primary = 'h-11 rounded-md bg-brand text-on-brand border border-brand hover:bg-brand-bright disabled:opacity-40 disabled:pointer-events-none transition-colors';
const input = 'h-11 bg-ink border border-line2 rounded-md px-3 outline-none focus:border-brand';

export function SessionDialog({ open, onOpenChange, initialJoin }: { open: boolean; onOpenChange: (o: boolean) => void; initialJoin?: string }) {
  const { t, lang } = useI18n();
  const chars = useCharacters();
  const [gmName, setGmName] = useState(t('gmDefault'));
  const [name, setName] = useState(loadName() || t('playerDefault'));
  const [codeInput, setCodeInput] = useState(initialJoin ?? '');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const code = normalizeCode(codeInput);

  // Nothing is shared unless the player chooses it; the last choice is remembered.
  useEffect(() => { const ids = new Set(chars.map((c) => c.id)); setPicked(new Set(loadShared().filter((id) => ids.has(id)))); }, [chars.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function host() {
    onOpenChange(false);
    goSession();
    await startSession({ role: 'gm', name: gmName.trim() || t('gmDefault') });
  }
  async function join() {
    if (!code) return;
    try { localStorage.setItem(NAME_KEY, name); localStorage.setItem(SHARED_KEY, JSON.stringify([...picked])); } catch { /* ignore */ }
    onOpenChange(false);
    goSession();
    await startSession({ role: 'player', name: name.trim() || t('playerDefault'), code, sharedIds: [...picked] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surf border-line2 max-w-[480px] max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-[22px] font-semibold">{t('game')}</DialogTitle></DialogHeader>
        <Tabs defaultValue={initialJoin ? 'join' : 'host'}>
          <TabsList className="w-full"><TabsTrigger value="host">{t('hostGame')}</TabsTrigger><TabsTrigger value="join">{t('joinGame')}</TabsTrigger></TabsList>
          <TabsContent value="host" className="pt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5"><span className="eyebrow">{t('yourName')}</span><input value={gmName} onChange={(e) => setGmName(e.target.value)} className={input} /></label>
            <button onClick={host} className={primary}>{t('startSession')}</button>
            <p className="text-text-dim text-xs">{t('sessionNote')}</p>
          </TabsContent>
          <TabsContent value="join" className="pt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5"><span className="eyebrow">{t('roomCode')}</span>
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="ABCD-EFGH" maxLength={9} autoCapitalize="characters" spellCheck={false} className={`${input} h-12 font-mono text-2xl tracking-[0.2em] text-center uppercase`} />
            </label>
            <label className="flex flex-col gap-1.5"><span className="eyebrow">{t('yourName')}</span><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">{t('chooseChars')}</span>
                {chars.length > 0 && <button type="button" onClick={() => setPicked(picked.size === chars.length ? new Set() : new Set(chars.map((c) => c.id)))} className="text-xs text-text-mute hover:text-text">{picked.size === chars.length ? t('selectNone') : t('selectAll')}</button>}
              </div>
              <p className="text-text-dim text-xs">{t('sharedHint')}</p>
              {chars.length === 0 && <p className="text-text-dim text-sm">{t('noChars')}</p>}
              {chars.map((c) => {
                const pkg = getPackage(c.system.id);
                return (
                  <label key={c.id} className="flex items-center gap-3 border border-line2 rounded-md px-3 py-2 cursor-pointer">
                    <input type="checkbox" className="accent-brand" checked={picked.has(c.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} />
                    <span className="font-display text-lg truncate">{(pkg ? cardData(pkg, c, lang).title : '') || t('unnamed')}</span>
                  </label>
                );
              })}
            </div>
            <button onClick={join} disabled={!code} className={primary}>{code ? t('joinBtn') : t('codeInvalid')}</button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
