// The live table. GM: every player's shared sheets (live, read-only) + roll feed.
// Player: connection status, own shared sheets, roll feed.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { ArrowLeft, Copy } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { formatCode } from '@/share/protocol';
import { leaveSession, setSharedIds, useActive, useSessionState } from '@/share/active';
import type { RollEntry } from '@/share/protocol';
import type { Character } from '@/engine/character';
import { getPackage } from '@/systems/registry';
import { useCharacters } from '@/storage/db';
import { SystemProvider } from '@/ui/context';
import { DiceProvider } from '@/ui/dice/DiceProvider';
import { SheetBody } from '@/ui/screens/SheetScreen';
import { cardData } from '@/ui/cardData';
import { Dialog, DialogContent, DialogTitle } from '@/ui/components/dialog';
import { cn } from '@/ui/lib/utils';
import { goLibrary, goSheet } from '@/routing';

export function SessionScreen() {
  const { t } = useI18n();
  const active = useActive();
  const state = useSessionState();

  useEffect(() => { if (active.status === 'idle') goLibrary(); }, [active.status]);

  if (active.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 text-text-mute text-center px-6">
        <p>{t('connError')}: {active.error}</p>
        <button onClick={() => { void leaveSession(); goLibrary(); }} className="border border-line2 rounded px-4 py-2">← {t('myCharacters')}</button>
      </div>
    );
  }
  if (!state) return <div className="flex min-h-full items-center justify-center text-text-mute">{t('sessionConnecting')}</div>;
  return state.role === 'gm' ? <GmTable /> : <PlayerView />;
}

function Header({ code, right }: { code: string; right?: React.ReactNode }) {
  const { t } = useI18n();
  const state = useSessionState()!;
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-9 py-3 border-b border-line">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={goLibrary} className="inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-2.5 py-[5px] text-[11px] hover:text-text hover:border-text-mute"><ArrowLeft className="size-3" /> {t('myCharacters')}</button>
        <span className="eyebrow">{t('game')} · {state.role === 'gm' ? t('gmDefault') : t('playerDefault')}</span>
        <span className="font-mono tracking-[0.15em] text-sm">{formatCode(code)}</span>
      </div>
      <div className="flex items-center gap-3">
        {right}
        <button onClick={() => { void leaveSession(); goLibrary(); }} className="border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-brand-bright hover:border-brand">{t('leaveSession')}</button>
      </div>
    </header>
  );
}

function RollFeed({ feed }: { feed: RollEntry[] }) {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-semibold">{t('rollFeed')}</h2>
      {feed.length === 0 && <p className="text-text-dim text-sm">{t('noRollsYet')}</p>}
      <div className="flex flex-col">
        {feed.map((r, i) => (
          <div key={`${r.ts}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-baseline py-2 border-b border-dashed border-line text-sm">
            <span className="font-mono text-[10px] text-text-dim">{new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="truncate"><b className="font-medium">{r.who}</b> <span className="text-text-mute">{r.label}</span></span>
            <span className="font-mono font-semibold">{r.summary}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ ch, onClick }: { ch: Character; onClick: () => void }) {
  const { t, lang } = useI18n();
  const pkg = getPackage(ch.system.id);
  if (!pkg) return null;
  const d = cardData(pkg, ch, lang);
  return (
    <button onClick={onClick} className="text-left bg-bg border border-line rounded-lg p-4 hover:border-text-mute transition-colors flex flex-col gap-2.5">
      <div className="font-display text-xl font-semibold truncate">{d.title || t('unnamed')}</div>
      {d.subtitle[0] && <div className="eyebrow truncate">{d.subtitle[0]}</div>}
      <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-line">
        {d.stats.map((s) => (
          <div key={s.label}><div className="eyebrow">{s.label}</div><div className={cn('font-display text-xl leading-none', s.brand && 'text-brand-bright')}>{s.value}</div></div>
        ))}
      </div>
    </button>
  );
}

function GmTable() {
  const { t } = useI18n();
  const state = useSessionState()!;
  const [openRef, setOpenRef] = useState<{ player: string; id: string } | null>(null);
  const [qr, setQr] = useState('');
  const invite = `${location.origin}${location.pathname}?join=${state.code}`;

  useEffect(() => {
    QRCode.toString(invite, { type: 'svg', margin: 1, color: { dark: '#14121a', light: '#ffffff' } }).then(setQr).catch(() => {});
  }, [invite]);

  const current = openRef ? state.players.find((p) => p.name === openRef.player)?.chars.find((c) => c.id === openRef.id) : undefined;
  const pkg = current ? getPackage(current.system.id) : undefined;

  return (
    <div className="min-h-full">
      <Header code={state.code} right={
        <button onClick={async () => { try { await navigator.clipboard.writeText(invite); toast.success(t('linkCopied')); } catch { window.prompt(t('inviteLink'), invite); } }} className="inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-text hover:border-text-mute"><Copy className="size-3" /> {t('inviteLink')}</button>
      } />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-9 py-8 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-10 items-start">
        <section className="flex flex-col gap-8">
          {state.players.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <h2 className="font-display text-2xl font-semibold">{t('waitingForPlayers')}</h2>
              <p className="text-text-dim text-xs max-w-sm">{t('sessionNote')}</p>
            </div>
          )}
          {state.players.map((p) => (
            <div key={p.name} className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className={cn('size-2 rounded-full', p.online ? 'bg-good' : 'bg-text-dim')} />
                <h2 className="font-display text-xl font-semibold">{p.name}</h2>
                <span className="eyebrow">{p.online ? t('onlineLbl') : t('offlineLbl')}</span>
              </div>
              {p.chars.length === 0 ? <p className="text-text-dim text-sm">{t('noCharsShared')}</p> : (
                <div className="grid sm:grid-cols-2 gap-4">{p.chars.map((c) => <SummaryCard key={c.id} ch={c} onClick={() => setOpenRef({ player: p.name, id: c.id })} />)}</div>
              )}
            </div>
          ))}
        </section>
        <aside className="flex flex-col gap-8">
          {qr && (
            <section className="flex items-center gap-4">
              <div className="w-28 shrink-0 rounded-md overflow-hidden bg-white p-1.5 [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="flex flex-col gap-1 min-w-0">
                <span className="eyebrow">{t('roomCode')}</span>
                <span className="font-mono text-lg tracking-[0.15em]">{formatCode(state.code)}</span>
                <span className="text-text-dim text-xs">{t('scanToJoin')}</span>
              </div>
            </section>
          )}
          <RollFeed feed={state.feed} />
        </aside>
      </div>

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpenRef(null)}>
        <DialogContent className="bg-bg border-line2 w-[96vw] max-w-[1250px] h-[94dvh] overflow-y-auto p-0 sm:max-w-[1250px]" showCloseButton>
          <DialogTitle className="sr-only">{openRef?.player}</DialogTitle>
          {current && pkg && (
            <SystemProvider pkg={pkg}>
              <DiceProvider values={current.values}>
                <SheetBody ch={current} set={() => {}} readOnly banner={<span>{openRef?.player} · {t('readOnlySnapshot')}</span>} />
              </DiceProvider>
            </SystemProvider>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayerView() {
  const { t, lang } = useI18n();
  const state = useSessionState()!;
  const chars = useCharacters();
  const { sharedIds = [] } = useActive();
  const mine = chars; // sheets the player can open from here; which of them the GM sees can be changed at any time
  return (
    <div className="min-h-full">
      <Header code={state.code} right={<span className={cn('inline-flex items-center gap-2 text-xs', state.gmPresent ? 'text-good' : 'text-gold')}><span className={cn('size-2 rounded-full', state.gmPresent ? 'bg-good' : 'bg-gold')} />{state.gmPresent ? t('gmConnected') : t('gmWaiting')}</span>} />
      <div className="max-w-[1000px] mx-auto px-4 sm:px-9 py-8 grid md:grid-cols-[minmax(0,1fr)_320px] gap-10 items-start">
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-semibold">{t('myCharacters')}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {mine.map((c) => {
              const pkg = getPackage(c.system.id);
              if (!pkg) return null;
              const on = sharedIds.includes(c.id);
              return (
                <div key={c.id} className="flex flex-col gap-2">
                  <SummaryCard ch={c} onClick={() => goSheet(c.id)} />
                  <label className="flex items-center gap-2 text-xs text-text-mute cursor-pointer">
                    <input type="checkbox" className="accent-brand" checked={on} onChange={(e) => setSharedIds(e.target.checked ? [...sharedIds, c.id] : sharedIds.filter((id) => id !== c.id))} />
                    {t('shownToGm')}
                  </label>
                </div>
              );
            })}
          </div>
          <p className="text-text-dim text-xs">{lang && t('sharedHint')}</p>
        </section>
        <RollFeed feed={state.feed} />
      </div>
    </div>
  );
}
