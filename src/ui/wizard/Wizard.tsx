// Creation wizard: full-screen, rendered *instead of* the sheet (see the iOS
// keyboard note below). Steps come from creation.toml; the body per kind is in steps.tsx.
import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import type { Character } from '@/engine/character';
import { evaluateCreation, type StepStatus } from '@/engine/creation';
import { useI18n } from '@/i18n/I18nContext';
import { AVAILABLE_LANGS, localize } from '@/i18n/lang';
import { useScope, useSystem } from '@/ui/context';
import { StepBody } from './steps';
import { cn } from '@/ui/lib/utils';

type Tone = 'ok' | 'over' | 'under';
const toneOf = (s: StepStatus): Tone => ((s.overflow ?? 0) > 0 ? 'over' : s.ok ? 'ok' : 'under');

export function Wizard({ ch, set, onStep, onFinish, onExit }: {
  ch: Character;
  set: (path: string, value: unknown) => void;
  onStep: (step: number) => void;
  onFinish: () => void; // leave the wizard for the sheet (done)
  onExit: () => void; // leave to the library
}) {
  const { pkg, tr } = useSystem();
  const { t, lang, setLang } = useI18n();
  const scope = useScope(ch.values);
  const steps = pkg.creation.steps;
  const report = useMemo(() => evaluateCreation(pkg, ch, scope), [pkg, ch, scope]);
  const index = Math.min(Math.max(ch.creation?.step ?? 0, 0), steps.length - 1);
  const step = steps[index];
  const status = report.steps.find((s) => s.id === step.id) ?? { id: step.id, kind: step.kind, ok: true };
  const isLast = index === steps.length - 1;
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [index]);

  // Lock background scroll and pin the overlay to the visual viewport. On iOS
  // Safari the software keyboard doesn't shrink dvh/layout units and raises fixed
  // elements (revealing what's behind), so we size/offset to window.visualViewport.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const vv = window.visualViewport;
    const el = rootRef.current;
    const apply = () => { if (vv && el) { el.style.height = `${vv.height}px`; el.style.top = `${vv.offsetTop}px`; } };
    apply();
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    return () => { document.body.style.overflow = prev; vv?.removeEventListener('resize', apply); vv?.removeEventListener('scroll', apply); };
  }, []);

  const message = (() => {
    if (step.kind === 'recap') return '';
    if (step.kind === 'fields' || step.kind === 'pick')
      return status.ok ? t('filled') : `${t('needFields')}: ${(status.missing ?? []).map((f) => tr(`fields.${f}`)).join(', ')}`;
    if (step.kind === 'priority') {
      const want = [...step.budgets].sort((a, b) => b - a).join('/');
      return status.ok && !status.overflow ? want : `${status.ranks?.map((r) => r.spent).join('/')} → ${want}`;
    }
    if (step.kind === 'list') return `${(status.spent ?? 0) + (status.overflow ?? 0)}/${step.budget}`;
    if (step.kind === 'freebies') return status.ok ? `${status.spent}/${status.budget}` : `+${status.overflow}`;
    return '';
  })();
  const tone = toneOf(status);
  const hint = tr(`hints.${step.id}`);

  return (
    <div ref={rootRef} className="fixed inset-x-0 top-0 h-[100dvh] z-[200] bg-ink flex flex-col text-text overflow-hidden">
      <header className="px-4 sm:px-8 py-3.5 border-b border-line flex items-center gap-3 sm:gap-5 bg-surf">
        <button onClick={onExit} className="inline-flex items-center gap-1.5 border border-line2 text-text-mute rounded px-2.5 py-[5px] text-[11px] hover:text-text hover:border-text-mute transition-colors shrink-0">
          <ArrowLeft className="size-3" /> <span className="hidden sm:inline">{t('myCharacters')}</span>
        </button>
        <div className="eyebrow shrink-0 hidden md:block">{localize(pkg.manifest.name, lang)}</div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
          {steps.map((s, i) => {
            const st = report.steps.find((x) => x.id === s.id);
            const done = !!st?.ok && i < index;
            return (
              <button
                key={s.id}
                onClick={() => onStep(i)}
                className={cn('shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px] tracking-wide rounded-sm border transition-colors',
                  i === index ? 'text-text border-text-mute bg-surf2' : done ? 'text-good border-transparent' : 'text-text-dim border-transparent hover:text-text-mute')}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span>{tr(s.title ?? `steps.${s.id}`)}</span>
              </button>
            );
          })}
        </div>
        <div className="hidden sm:inline-flex p-0.5 border border-line2 rounded font-mono text-[11px] shrink-0">
          {AVAILABLE_LANGS.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} className={cn('px-2 py-1 rounded-[3px] transition-colors', l.code === lang ? 'bg-text text-bg' : 'text-text-mute hover:text-text')}>{l.code.toUpperCase()}</button>
          ))}
        </div>
        <button onClick={onFinish} title={t('close')} aria-label={t('close')} className="border border-line2 text-text-mute w-8 h-8 rounded inline-flex items-center justify-center hover:text-text hover:border-text-mute transition-colors shrink-0">
          <X className="size-3.5" />
        </button>
      </header>

      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 pt-9 pb-6">
        <div className="max-w-[880px] mx-auto flex flex-col gap-6">
          <div>
            <div className="eyebrow mb-2">{t('stepN')} {index + 1} / {steps.length}</div>
            <h1 className="font-display font-semibold text-[40px] m-0 leading-tight">{tr(step.title ?? `steps.${step.id}`)}</h1>
            {hint && hint !== step.id && <p className="text-text-mute text-sm leading-relaxed max-w-[620px] mt-2.5">{hint}</p>}
          </div>
          <StepBody key={step.id} step={step} status={status} report={report} values={ch.values} set={set} />
        </div>
      </main>

      <footer className="px-4 sm:px-8 py-3 sm:py-4 border-t border-line flex items-center gap-2 sm:gap-3.5 bg-surf">
        <button onClick={() => onStep(index - 1)} disabled={index === 0} className="whitespace-nowrap border border-line2 px-3 sm:px-[18px] h-10 rounded text-[13px] hover:border-text-mute transition-colors disabled:opacity-35 disabled:pointer-events-none">← {t('backBtn')}</button>
        <button onClick={onFinish} className="hidden sm:inline-block whitespace-nowrap text-text-dim px-3 h-10 text-[13px] hover:text-text-mute transition-colors">{t('skipToSheet')}</button>
        <div className="flex-1 min-w-0" />
        {message && <div className={cn('font-mono text-[11px] truncate', tone === 'ok' ? 'text-good' : tone === 'over' ? 'text-brand-bright' : 'text-gold')}>{message}</div>}
        <button onClick={() => (isLast ? onFinish() : onStep(index + 1))} className="whitespace-nowrap bg-brand border border-brand text-on-brand px-3 sm:px-[18px] h-10 rounded text-[13px] hover:bg-brand-bright hover:border-brand-bright transition-colors">
          {isLast ? `${t('doneBtn')} ✓` : `${t('nextBtn')} →`}
        </button>
      </footer>
    </div>
  );
}
