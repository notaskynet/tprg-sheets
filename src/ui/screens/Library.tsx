// Character library: cards for every saved character, sort, create, import.
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { MoreVertical, Package, Plus, Smartphone, Users } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { AVAILABLE_LANGS, localize } from '@/i18n/lang';
import { useCharacters, deleteCharacter, putCharacter, saveCharacter } from '@/storage/db';
import { getPackage, usePackages } from '@/systems/registry';
import { newCharacter, type Character } from '@/engine/character';
import { cardData } from '@/ui/cardData';
import { goSheet } from '@/routing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';
import { readCharacterFile } from '@/share/file';
import { AccentPicker } from '@/ui/AccentPicker';
import { Lazy, lazyNamed } from '@/ui/lazy';

const TransferDialog = lazyNamed(() => import('@/ui/TransferDialog'), 'TransferDialog');
const SessionDialog = lazyNamed(() => import('@/ui/SessionDialog'), 'SessionDialog');
const SystemsDialog = lazyNamed(() => import('@/ui/SystemsDialog'), 'SystemsDialog');

type SortBy = 'recent' | 'name';

// Drop ?join= / ?receive= once their dialog is closed so a reload doesn't reopen it.
const clearParams = () => { if (location.search) window.history.replaceState({}, '', location.pathname); };

function loadSort(): SortBy {
  try { return localStorage.getItem('trpg.sort') === 'name' ? 'name' : 'recent'; } catch { return 'recent'; }
}

export function Library({ join, receive }: { join?: string; receive?: string }) {
  const { t, lang, setLang } = useI18n();
  const characters = useCharacters();
  const packages = usePackages();
  const [sortBy, setSortBy] = useState<SortBy>(loadSort);
  const [picking, setPicking] = useState(false);
  const [transfer, setTransfer] = useState(!!receive);
  const [session, setSession] = useState(!!join);
  const [systems, setSystems] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sorted = useMemo(() => {
    const title = (c: Character) => String(c.values.profile && (c.values.profile as Record<string, unknown>).name || '');
    return sortBy === 'name' ? [...characters].sort((a, b) => title(a).localeCompare(title(b))) : characters;
  }, [characters, sortBy]);

  function create(systemId: string) {
    const pkg = getPackage(systemId)!;
    const ch = newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, crypto.randomUUID());
    putCharacter(ch);
    setPicking(false);
    goSheet(ch.id);
  }
  const startNew = () => (packages.length === 1 ? create(packages[0].manifest.id) : setPicking(true));

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const ch = await readCharacterFile(file);
      if (!getPackage(ch.system.id)) return void toast.error(`${t('unknownSystem')}: ${ch.system.id}`);
      putCharacter(ch);
      toast.success(t('imported'));
    } catch {
      toast.error(t('badFile'));
    }
  }

  return (
    <div className="min-h-full">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 sm:px-9 py-3 sm:py-4 border-b border-line">
        <span className="eyebrow truncate min-w-0"><span className="hidden sm:inline">{t('appTitle')} · </span>{t('myCharacters')}</span>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setTransfer(true)} title={t('devices')} className="inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-text hover:border-text-mute transition-colors"><Smartphone className="size-3.5" /><span className="hidden sm:inline">{t('devices')}</span></button>
          <button onClick={() => setSession(true)} title={t('game')} className="inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-text hover:border-text-mute transition-colors"><Users className="size-3.5" /><span className="hidden sm:inline">{t('game')}</span></button>
          <button onClick={() => setSystems(true)} title={t('systems')} className="inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-text hover:border-text-mute transition-colors"><Package className="size-3.5" /><span className="hidden sm:inline">{t('systems')}</span></button>
          <AccentPicker />
          <button onClick={() => fileRef.current?.click()} className="border border-line2 text-text-mute rounded px-3 py-1.5 text-xs hover:text-text hover:border-text-mute transition-colors">{t('importFile')}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <div className="inline-flex p-0.5 border border-line2 rounded font-mono text-[11px]">
            {AVAILABLE_LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} className={`px-2 py-1 rounded-[3px] transition-colors ${l.code === lang ? 'bg-text text-bg' : 'text-text-mute hover:text-text'}`}>{l.code.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-9 py-9">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 gap-5">
            <h2 className="font-display text-3xl font-medium">{t('noCharacters')}</h2>
            <button onClick={startNew} className="bg-brand border border-brand-bright text-on-brand px-6 py-3 rounded text-sm tracking-wide uppercase hover:bg-brand-bright transition-colors">{t('createCharacter')}</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end gap-2 mb-5">
              <span className="font-body font-medium text-[11px] tracking-[0.1em] uppercase text-text-dim">{t('sortBy')}</span>
              {(['recent', 'name'] as const).map((s) => (
                <button key={s} onClick={() => { setSortBy(s); try { localStorage.setItem('trpg.sort', s); } catch { /* ignore */ } }}
                  className={`text-xs px-2 py-1 rounded border ${sortBy === s ? 'border-text-mute text-text' : 'border-line2 text-text-mute hover:text-text'}`}>
                  {t(s === 'recent' ? 'sortRecent' : 'sortName')}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map((ch) => <CharacterCard key={ch.id} ch={ch} />)}
              <button onClick={startNew} className="border border-dashed border-line2 rounded-lg min-h-[200px] flex flex-col items-center justify-center gap-2 text-text-mute hover:text-text hover:border-text-mute transition-colors">
                <Plus className="size-7 font-light" />
                <span className="text-sm">{t('newCharacter')}</span>
              </button>
            </div>
          </>
        )}
      </div>

      <Lazy>
        {systems && <SystemsDialog open onOpenChange={setSystems} />}
        {transfer && <TransferDialog open onOpenChange={(o) => { setTransfer(o); if (!o) clearParams(); }} initialReceive={receive} />}
        {session && <SessionDialog open onOpenChange={(o) => { setSession(o); if (!o) clearParams(); }} initialJoin={join} />}
      </Lazy>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('chooseSystem')}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-2">
            {packages.map((p) => (
              <button key={p.manifest.id} onClick={() => create(p.manifest.id)} className="text-left border border-line2 rounded-md px-4 py-3 hover:border-text-mute transition-colors">
                <div className="font-display text-xl">{localize(p.manifest.name, lang)}</div>
                {p.manifest.description && <div className="text-[13px] text-text-mute mt-1 leading-snug">{localize(p.manifest.description, lang)}</div>}
                <div className="font-mono text-[10px] text-text-dim mt-1">{p.manifest.id} · v{p.manifest.version}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CharacterCard({ ch }: { ch: Character }) {
  const { t, lang } = useI18n();
  const pkg = getPackage(ch.system.id);
  if (!pkg) {
    return (
      <div className="border border-line rounded-lg p-5 text-text-mute text-sm">
        <div className="font-mono text-[10px] text-brand-bright">unknown system: {ch.system.id}</div>
        <button className="mt-3 text-brand-bright text-xs" onClick={() => deleteCharacter(ch.id)}>{t('delete')}</button>
      </div>
    );
  }
  const { title, subtitle, stats, valid } = cardData(pkg, ch, lang);

  function duplicate() {
    const copy: Character = { ...ch, id: crypto.randomUUID(), values: structuredClone(ch.values) };
    saveCharacter(copy);
  }

  return (
    <div className="relative bg-bg border border-line rounded-lg p-5 hover:border-text-mute hover:-translate-y-0.5 transition-all">
      <button type="button" onClick={() => goSheet(ch.id)} aria-label={title || t('unnamed')} className="absolute inset-0 z-0 rounded-lg cursor-pointer" />
      <div className="relative z-10 pointer-events-none flex flex-col gap-3.5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-surf2 border border-line2 flex items-center justify-center font-display text-xl shrink-0">
            {(title || '?').trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[22px] font-medium leading-tight truncate">{title || t('unnamed')}</div>
            <div className="font-body font-medium text-[11px] tracking-[0.1em] uppercase text-text-mute mt-1 truncate">{subtitle[0] ?? localize(pkg.manifest.name, lang)}</div>
          </div>
          <div className="pointer-events-auto">
            <DropdownMenu>
              <DropdownMenuTrigger className="text-text-mute hover:text-text p-1 -mr-1" aria-label={t('menu')}><MoreVertical className="size-4" /></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={duplicate}>{t('duplicate')}</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => { if (confirm(`${t('delete')}: ${title || t('unnamed')}?`)) deleteCharacter(ch.id); }}>{t('delete')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {subtitle[1] && <div className="text-text-mute text-[13px] italic leading-snug">{subtitle[1]}</div>}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 pt-3.5 border-t border-line">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-body font-medium text-[11px] tracking-[0.1em] uppercase text-text-dim">{s.label}</div>
                <div className={`font-display text-[22px] leading-none ${s.brand ? 'text-brand-bright' : ''}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2.5 text-[11.5px] text-text-mute">
          <span className="font-mono text-[10px] text-text-dim">{t('lastVisit')}: {timeAgo(ch.updatedAt, lang, t('justNow'))}</span>
          <span className={`ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded-sm ${valid ? 'bg-good/15 text-good' : 'bg-brand/15 text-brand-bright'}`}>{valid ? t('valid') : t('invalid')}</span>
        </div>
      </div>
    </div>
  );
}

function timeAgo(ts: number, lang: string, now: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 1) return now;
  if (mins < 60) return `${mins}${lang === 'ru' ? ' мин' : 'm'}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${lang === 'ru' ? ' ч' : 'h'}`;
  return `${Math.floor(hrs / 24)}${lang === 'ru' ? ' дн' : 'd'}`;
}
