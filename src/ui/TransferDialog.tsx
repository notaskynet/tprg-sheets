// Move characters between your own devices through a one-off room.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nContext';
import { formatCode, newRoomCode, normalizeCode } from '@/share/protocol';
import { openRoom, type Transport } from '@/share/transport';
import { planImport, runReceiver, runSender, type ImportItem, type TransferPayload } from '@/share/transfer';
import { getCharacter, getPackageFiles, putCharacter, useCharacters } from '@/storage/db';
import { addPackage, getPackage } from '@/systems/registry';
import { cardData } from '@/ui/cardData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/components/tabs';
import { cn } from '@/ui/lib/utils';
import type { Files } from '@/engine/loader';

export function TransferDialog({ open, onOpenChange, initialReceive }: { open: boolean; onOpenChange: (o: boolean) => void; initialReceive?: string }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surf border-line2 max-w-[480px] max-h-[92dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-[22px] font-semibold">{t('devices')}</DialogTitle></DialogHeader>
        <Tabs defaultValue={initialReceive ? 'receive' : 'send'}>
          <TabsList className="w-full"><TabsTrigger value="send">{t('sendToDevice')}</TabsTrigger><TabsTrigger value="receive">{t('receiveOnDevice')}</TabsTrigger></TabsList>
          <TabsContent value="send" className="pt-4"><Send active={open} /></TabsContent>
          <TabsContent value="receive" className="pt-4"><Receive active={open} initialCode={initialReceive} onDone={() => onOpenChange(false)} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function useRoomCleanup(active: boolean) {
  const ref = useRef<Transport | null>(null);
  useEffect(() => { if (!active) { void ref.current?.leave(); ref.current = null; } }, [active]);
  useEffect(() => () => { void ref.current?.leave(); }, []);
  return ref;
}

function Send({ active }: { active: boolean }) {
  const { t, lang } = useI18n();
  const chars = useCharacters();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [code, setCode] = useState('');
  const [qr, setQr] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const room = useRoomCleanup(active);

  useEffect(() => { setPicked(new Set(chars.map((c) => c.id))); }, [chars.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    const c = newRoomCode();
    const list = chars.filter((x) => picked.has(x.id));
    const pkgs: Record<string, Files> = {};
    for (const id of new Set(list.map((x) => x.system.id))) {
      const files = await getPackageFiles(id); // only custom systems are stored; built-ins ship with the app
      if (files) pkgs[id] = files;
    }
    try {
      const transport = await openRoom({ code: c, kind: 'x' });
      room.current = transport;
      runSender(transport, { chars: list, pkgs }, { sent: () => setSentCount((n) => n + 1) });
      setCode(c);
      setQr(await QRCode.toString(`${location.origin}${location.pathname}?receive=${c}`, { type: 'svg', margin: 1, color: { dark: '#14121a', light: '#ffffff' } }));
    } catch (e) { toast.error((e as Error).message); }
  }

  if (code) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="font-mono text-4xl tracking-[0.2em]">{formatCode(code)}</div>
        {qr && <div className="w-44 rounded-md overflow-hidden bg-white p-2 [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: qr }} />}
        <p className="text-text-mute text-sm">{sentCount ? `${t('sentTo')}${sentCount > 1 ? ` ×${sentCount}` : ''}` : t('waitingReceiver')}</p>
        <p className="text-text-dim text-xs">{t('transferHint')}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {chars.length === 0 && <p className="text-text-mute text-sm">{t('noChars')}</p>}
      {chars.map((c) => {
        const pkg = getPackage(c.system.id);
        const title = pkg ? cardData(pkg, c, lang).title : c.id;
        return (
          <label key={c.id} className="flex items-center gap-3 border border-line2 rounded-md px-3 py-2.5 cursor-pointer">
            <input type="checkbox" className="accent-brand" checked={picked.has(c.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} />
            <span className="font-display text-lg truncate">{title || t('unnamed')}</span>
          </label>
        );
      })}
      <button onClick={start} disabled={picked.size === 0} className="h-11 rounded-md bg-brand text-on-brand border border-brand hover:bg-brand-bright disabled:opacity-40 disabled:pointer-events-none transition-colors">{t('createCode')}</button>
    </div>
  );
}

function Receive({ active, initialCode, onDone }: { active: boolean; initialCode?: string; onDone: () => void }) {
  const { t, lang } = useI18n();
  const [input, setInput] = useState(initialCode ?? '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'review'>('idle');
  const [payload, setPayload] = useState<TransferPayload | null>(null);
  const [plan, setPlan] = useState<ImportItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const room = useRoomCleanup(active);
  const code = normalizeCode(input);
  const started = useRef(false);

  async function connect(c: string) {
    setStatus('connecting');
    try {
      const transport = await openRoom({ code: c, kind: 'x' });
      room.current = transport;
      runReceiver(transport, {
        received: (p) => {
          const items = planImport(getCharacter, p.chars);
          setPayload(p);
          setPlan(items);
          setPicked(new Set(items.filter((i) => i.status === 'new' || i.status === 'newer').map((i) => i.char.id)));
          setStatus('review');
        },
      });
    } catch (e) { toast.error((e as Error).message); setStatus('idle'); }
  }

  useEffect(() => {
    const c = initialCode && normalizeCode(initialCode);
    if (c && !started.current) { started.current = true; void connect(c); }
  }, [initialCode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function doImport() {
    const chosen = plan.filter((i) => picked.has(i.char.id));
    for (const [id, files] of Object.entries(payload?.pkgs ?? {})) if (!getPackage(id)) await addPackage(files).catch((e) => toast.error((e as Error).message));
    for (const i of chosen) if (getPackage(i.char.system.id)) putCharacter(i.char);
    toast.success(`${t('importedN')}${chosen.length}`);
    void room.current?.leave();
    onDone();
  }

  if (status === 'review') {
    const label: Record<string, string> = { new: t('stNew'), newer: t('stNewer'), older: t('stOlder'), same: t('stSame') };
    return (
      <div className="flex flex-col gap-3">
        {plan.map(({ char, status: st }) => {
          const pkg = getPackage(char.system.id);
          const title = pkg ? cardData(pkg, char, lang).title : String((char.values.profile as { name?: string } | undefined)?.name ?? char.id);
          return (
            <label key={char.id} className="flex items-center gap-3 border border-line2 rounded-md px-3 py-2.5 cursor-pointer">
              <input type="checkbox" className="accent-brand" checked={picked.has(char.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); e.target.checked ? n.add(char.id) : n.delete(char.id); return n; })} />
              <span className="font-display text-lg truncate flex-1">{title || t('unnamed')}</span>
              <span className={cn('font-mono text-[10px] px-1.5 py-0.5 rounded-sm', st === 'new' || st === 'newer' ? 'bg-good/15 text-good' : 'bg-line text-text-mute')}>{label[st]}</span>
            </label>
          );
        })}
        <button onClick={doImport} disabled={picked.size === 0} className="h-11 rounded-md bg-brand text-on-brand border border-brand hover:bg-brand-bright disabled:opacity-40 disabled:pointer-events-none transition-colors">{t('importSelected')} ({picked.size})</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-mute text-sm">{t('enterCode')}</p>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="ABCD-EFGH"
        maxLength={9}
        autoCapitalize="characters"
        spellCheck={false}
        className="h-12 bg-ink border border-line2 rounded-md px-3 font-mono text-2xl tracking-[0.2em] text-center uppercase outline-none focus:border-brand"
      />
      <button onClick={() => code && connect(code)} disabled={!code || status === 'connecting'} className="h-11 rounded-md bg-brand text-on-brand border border-brand hover:bg-brand-bright disabled:opacity-40 disabled:pointer-events-none transition-colors">
        {status === 'connecting' ? t('receivingFrom') : t('receiveBtn')}
      </button>
    </div>
  );
}
