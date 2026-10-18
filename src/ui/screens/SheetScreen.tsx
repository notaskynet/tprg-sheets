// One character: header (back, name, language, checklist, actions) + rendered sheet.
import { useEffect, useMemo } from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { AVAILABLE_LANGS } from '@/i18n/lang';
import { getPackage } from '@/systems/registry';
import { SystemProvider, useScope, useSystem } from '@/ui/context';
import { useCharacterEditor } from '@/ui/useEditor';
import { SheetRenderer } from '@/ui/sheet/SheetRenderer';
import { DiceProvider } from '@/ui/dice/DiceProvider';
import { SavePill } from '@/ui/primitives';
import { evaluateCreation } from '@/engine/creation';
import { getIn } from '@/engine/expr/eval';
import { deleteCharacter } from '@/storage/db';
import { downloadCharacter } from '@/share/file';
import { goLibrary } from '@/routing';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/components/dropdown-menu';
import { cn } from '@/ui/lib/utils';
import { AccentPicker } from '@/ui/AccentPicker';
import { applyAccent, getSavedAccent } from '@/ui/theme';
import type { Character } from '@/engine/character';

export function SheetScreen({ charId }: { charId: string }) {
  const { t } = useI18n();
  const editor = useCharacterEditor(charId);
  const pkg = editor.ch ? getPackage(editor.ch.system.id) : undefined;

  if (!editor.ch || !pkg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full gap-4 text-text-mute">
        <p>{editor.ch ? `Unknown system: ${editor.ch.system.id}` : t('notFound')}</p>
        <button onClick={goLibrary} className="border border-line2 rounded px-4 py-2 hover:border-text-mute">← {t('myCharacters')}</button>
      </div>
    );
  }
  return (
    <SystemProvider pkg={pkg}>
      <DiceProvider values={editor.ch.values}>
        <SheetBody ch={editor.ch} set={editor.set} saveState={editor.saveState} />
      </DiceProvider>
    </SystemProvider>
  );
}

function SheetBody({ ch, set, saveState }: { ch: Character; set: (p: string, v: unknown) => void; saveState: 'saving' | 'saved' | 'offline' }) {
  const { pkg } = useSystem();
  const { t, lang, setLang } = useI18n();
  const scope = useScope(ch.values);
  const report = useMemo(() => evaluateCreation(pkg, ch, scope), [pkg, ch, scope]);
  const okCount = report.checklist.filter((c) => c.ok).length;
  const allOk = okCount === report.checklist.length;
  // The system's default accent applies on its sheets unless the user picked one.
  useEffect(() => {
    if (!getSavedAccent()) applyAccent(pkg.manifest.accent);
    return () => { if (!getSavedAccent()) applyAccent(null); };
  }, [pkg]);
  const titlePath = pkg.manifest.summary?.title;
  const title = titlePath ? String(getIn(ch.values, titlePath.split('.')) ?? '') : '';

  return (
    <div>
      <div className="print-sheet max-w-[1200px] mx-auto px-4 sm:px-9 pt-6 sm:pt-8 pb-[60px] flex flex-col gap-[26px]">
        <header className="flex flex-col gap-3.5">
          <div className="h-0.5 bg-text" />
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <button onClick={goLibrary} className="print-hidden inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-2.5 py-[5px] text-[11px] hover:text-text hover:border-text-mute transition-colors shrink-0">
                <ArrowLeft className="size-3" /> {t('myCharacters')}
              </button>
              <div className="hidden lg:block font-body font-medium text-[11px] tracking-[0.1em] text-text-mute truncate uppercase">{pkg.manifest.name[lang] ?? Object.values(pkg.manifest.name)[0]}</div>
            </div>
            <div className="print-hidden flex items-center gap-2.5">
              <span className="hidden sm:inline-flex"><SavePill state={saveState} labels={{ saving: t('saving'), saved: t('saved'), offline: t('offline') }} /></span>
              <div className="inline-flex p-0.5 border border-line2 rounded font-mono text-[11px]">
                {AVAILABLE_LANGS.map((l) => (
                  <button key={l.code} onClick={() => setLang(l.code)} className={`px-2 py-1 rounded-[3px] transition-colors ${l.code === lang ? 'bg-text text-bg' : 'text-text-mute hover:text-text'}`}>{l.code.toUpperCase()}</button>
                ))}
              </div>
              <AccentPicker systemAccent={pkg.manifest.accent} />
              <Checklist report={report} okCount={okCount} allOk={allOk} />
              <Actions ch={ch} title={title} />
            </div>
          </div>
          {titlePath && (
            <input
              className="bg-transparent border-0 outline-none font-display text-5xl print:text-3xl font-medium leading-none w-full min-w-0 placeholder:text-text-dim placeholder:italic"
              value={title}
              onChange={(e) => set(titlePath, e.target.value)}
              placeholder={t('unnamed')}
            />
          )}
        </header>
        <SheetRenderer values={ch.values} set={set} />
      </div>
    </div>
  );
}

function Checklist({ report, okCount, allOk }: { report: ReturnType<typeof evaluateCreation>; okCount: number; allOk: boolean }) {
  const { tr } = useSystem();
  const { t } = useI18n();
  const total = report.checklist.length;
  return (
    <Popover>
      <PopoverTrigger className={cn('inline-flex items-center gap-1.5 border rounded px-2.5 py-[5px] font-mono text-[11px] hover:bg-surf transition-colors', allOk ? 'border-line2 text-text' : 'border-brand/45 text-brand-bright')}>
        <span className={cn('w-1.5 h-1.5 rounded-full', allOk ? 'bg-good' : 'bg-brand')} />{okCount}/{total}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] max-w-[86vw] bg-surf border-line2 p-4">
        <div className="flex items-baseline gap-2 mb-3 pb-2.5 border-b border-line">
          <h3 className="font-display text-lg font-medium flex-1">{t('checklist')}</h3>
          <span className={cn('font-mono text-[10px] px-1.5 py-0.5 rounded-sm border', allOk ? 'bg-good/20 text-good border-good/35' : 'bg-brand/15 text-brand-bright border-brand/35')}>{okCount}/{total}</span>
        </div>
        {report.checklist.map((c) => (
          <div key={c.id} className="grid grid-cols-[16px_1fr_auto] items-center gap-2 py-1.5 text-xs">
            <span className={cn('w-4 h-4 rounded-full border inline-flex items-center justify-center text-[10px] text-on-brand', c.ok ? 'bg-good border-good' : 'bg-brand border-brand')}>{c.ok ? '✓' : '!'}</span>
            <span className="min-w-0 leading-tight">{tr(c.labelKey)}</span>
            {c.val != null && <span className="font-mono text-[10.5px] text-text-dim whitespace-nowrap tabular-nums">{c.val}{c.need != null ? ` / ${c.need}` : ''}</span>}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Actions({ ch, title }: { ch: Character; title: string }) {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border border-line2 text-text-mute rounded p-1.5 hover:text-text hover:border-text-mute transition-colors" aria-label="menu"><MoreVertical className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => downloadCharacter(ch, title)}>{t('exportFile')}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}>{t('print')}</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => { if (confirm(`${t('delete')}: ${title || t('unnamed')}?`)) { deleteCharacter(ch.id); goLibrary(); } }}>{t('delete')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
