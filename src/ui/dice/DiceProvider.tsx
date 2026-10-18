// Roll dialog + floating button. Traits clicked on the sheet are collected into a
// pick-set (one per group, per `[roll].pools` in sheet.toml); the dialog turns
// them into the mechanic's input (pool / modifier / skill).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dices, X } from 'lucide-react';
import { roll as doRoll, type RollRequest, type RollResult } from '@/engine/dice';
import { getIn } from '@/engine/expr/eval';
import { useI18n } from '@/i18n/I18nContext';
import { useScope, useSystem } from '@/ui/context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ui/components/dialog';
import { cn } from '@/ui/lib/utils';

interface HistoryEntry { ts: number; label: string; result: RollResult; summary: string }

interface DiceApi {
  /** Add a trait to the pending roll (replaces the pick from the same group) and open the dialog. */
  pick: (group: string, id: string) => void;
  open: () => void;
  enabled: (group: string) => boolean;
}
const Ctx = createContext<DiceApi | null>(null);
export const useDice = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDice outside <DiceProvider>');
  return v;
};

const HISTORY_KEY = 'trpg.dice.history';
const loadHistory = (): HistoryEntry[] => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
};

export function DiceProvider({ values, onRoll, children }: {
  values: Record<string, unknown>;
  onRoll?: (entry: { label: string; summary: string; result: RollResult }) => void; // session feed hook
  children: ReactNode;
}) {
  const { pkg, tr } = useSystem();
  const { t } = useI18n();
  const scope = useScope(values);
  const cfg = pkg.manifest.dice;
  // pools = slots; groups listed in one slot are alternatives (one pick), slots add up.
  // value = per-group derived template ("skill_{id}") when a pick's number isn't the stored value.
  const rollCfg = (pkg.sheet.roll ?? {}) as { pools?: string[][]; specialties?: string; penalty?: string; value?: Record<string, string> };
  const slotOf = useCallback((g: string) => (rollCfg.pools ?? []).findIndex((slot) => slot.includes(g)), [rollCfg.pools]);

  const [isOpen, setOpen] = useState(false);
  const [picks, setPicks] = useState<Record<number, { g: string; id: string }>>({});
  const [difficulty, setDifficulty] = useState(cfg.mechanic === 'pool-successes' ? cfg.defaultDifficulty : 10);
  const [extra, setExtra] = useState(0); // manual +/- on top of the picked traits
  const [specialty, setSpecialty] = useState(false);
  const [advantage, setAdvantage] = useState<'adv' | 'dis' | undefined>();
  const [bonus, setBonus] = useState(0);
  const [formula, setFormula] = useState('1d20');
  const [applyPenalty, setApplyPenalty] = useState(true);
  const [result, setResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  useEffect(() => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20))); } catch { /* ignore */ } }, [history]);

  const api = useMemo<DiceApi>(() => ({
    pick: (group, id) => { setPicks((p) => ({ ...p, [slotOf(group)]: { g: group, id } })); setResult(null); setOpen(true); },
    open: () => setOpen(true),
    enabled: (g) => slotOf(g) >= 0,
  }), [slotOf]);

  const valueOf = (g: string, id: string): number => {
    const tpl = rollCfg.value?.[g];
    return Number((tpl ? scope.get([tpl.replace('{id}', id)]) : getIn(values, [g, id])) ?? 0);
  };

  const pickedRows = Object.entries(picks).map(([slot, { g, id }]) => ({
    slot, g, id, label: tr(`${g}.${id}`), value: valueOf(g, id),
    specialty: rollCfg.specialties ? String(getIn(values, [rollCfg.specialties, id]) ?? '') : '',
  }));
  const base = pickedRows.reduce((s, r) => s + r.value, 0);
  const penalty = rollCfg.penalty && applyPenalty ? Number(scope.get([rollCfg.penalty]) ?? 0) : 0;
  const total = Math.max(0, base + extra + penalty);
  const specialtyName = pickedRows.find((r) => r.specialty)?.specialty;

  const label = pickedRows.map((r) => r.label).join(' + ') || t('roll');

  const submit = useCallback(() => {
    const req: RollRequest = {
      pool: total, difficulty, specialty,
      modifier: base + extra + penalty, advantage, skill: base + extra, bonus, notation: formula,
    };
    const r = doRoll(cfg, req);
    setResult(r);
    const summary = summarize(r, t);
    setHistory((h) => [{ ts: Date.now(), label, result: r, summary }, ...h].slice(0, 20));
    onRoll?.({ label, summary, result: r });
  }, [cfg, total, base, extra, penalty, difficulty, specialty, advantage, bonus, formula, label, onRoll, t]);

  const inputLabel = cfg.mechanic === 'pool-successes' ? t('pool') : cfg.mechanic === 'd20-modifier' ? t('modifier') : t('skillValue');

  return (
    <Ctx value={api}>
      {children}
      <button
        onClick={() => setOpen(true)}
        title={t('roll')}
        aria-label={t('roll')}
        className="print-hidden fixed right-[18px] bottom-[18px] z-50 w-14 h-14 rounded-full bg-brand border border-brand-bright text-on-brand flex items-center justify-center shadow-[0_6px_24px_color-mix(in_srgb,var(--color-brand)_40%,transparent)] hover:bg-brand-bright hover:-translate-y-0.5 transition-all"
      >
        <Dices className="size-6" />
      </button>

      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="bg-surf border-line2 max-w-[460px] max-h-[92dvh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-5 py-4 border-b border-line"><DialogTitle className="font-display text-[22px] font-medium">{t('roll')}</DialogTitle></DialogHeader>
          <div className="p-5 flex flex-col gap-4">
            {cfg.mechanic !== 'notation' && (
              <div className="min-h-8">
                {pickedRows.length === 0 ? (
                  <p className="text-text-dim text-xs">{t('pickHint')}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pickedRows.map((r) => (
                      <span key={r.slot} className="inline-flex items-center gap-1.5 border border-line2 rounded px-2 py-1 text-xs">
                        {r.label} <b className="font-mono">{r.value}</b>
                        <button aria-label="remove" onClick={() => setPicks(({ [Number(r.slot)]: _, ...rest }) => rest)} className="text-text-dim hover:text-brand-bright"><X className="size-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {cfg.mechanic === 'notation' ? (
              <label className="flex flex-col gap-1.5"><span className="eyebrow">{t('notation')}</span>
                <input value={formula} onChange={(e) => setFormula(e.target.value)} className="bg-ink border border-line2 rounded px-3 py-2 font-mono text-lg outline-none focus:border-brand" />
              </label>
            ) : (
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-4">
                <Stepper label={inputLabel} value={extra} display={total} onChange={(v) => setExtra(v - (total - extra))} min={0} max={99} />
                {cfg.mechanic === 'pool-successes' && <Stepper label={t('difficulty')} value={difficulty} onChange={setDifficulty} min={2} max={10} />}
                {cfg.mechanic === 'd20-modifier' && <Stepper label={t('dc')} value={difficulty} onChange={setDifficulty} min={1} max={40} />}
                {cfg.mechanic === 'd100-under' && <Stepper label={t('bonusDice')} value={bonus} onChange={setBonus} min={-2} max={2} />}
              </div>
            )}

            {cfg.mechanic === 'pool-successes' && cfg.specialty === 'extra-die' && (
              <label className="flex items-center gap-2 text-text-mute text-xs cursor-pointer select-none">
                <input type="checkbox" checked={specialty} onChange={(e) => setSpecialty(e.target.checked)} className="w-3.5 h-3.5 accent-brand" />
                {t('specialty')}{specialtyName ? ` (${specialtyName})` : ''} — +1
              </label>
            )}
            {cfg.mechanic === 'd20-modifier' && (
              <div className="flex gap-1.5">
                {([undefined, 'adv', 'dis'] as const).map((a) => (
                  <button key={a ?? 'n'} onClick={() => setAdvantage(a)} className={cn('flex-1 border rounded px-2 py-1.5 text-xs', advantage === a ? 'border-text-mute text-text' : 'border-line2 text-text-mute')}>
                    {t(a === 'adv' ? 'advantage' : a === 'dis' ? 'disadvantage' : 'normal')}
                  </button>
                ))}
              </div>
            )}
            {rollCfg.penalty && cfg.mechanic !== 'notation' && Number(scope.get([rollCfg.penalty]) ?? 0) !== 0 && (
              <label className="flex items-center gap-2 text-text-mute text-xs cursor-pointer select-none">
                <input type="checkbox" checked={applyPenalty} onChange={(e) => setApplyPenalty(e.target.checked)} className="w-3.5 h-3.5 accent-brand" />
                {t('woundPenalty')}: {Number(scope.get([rollCfg.penalty]))}
              </label>
            )}

            <button onClick={submit} className="bg-brand text-on-brand border border-brand-bright h-12 text-base tracking-[0.06em] uppercase rounded font-semibold hover:bg-brand-bright transition-colors">{t('rollIt')}</button>

            {result && <ResultView result={result} difficulty={difficulty} />}
          </div>

          {history.length > 0 && (
            <>
              <div className="px-5 pt-3 pb-2 eyebrow border-t border-line">{t('rollHistory')}</div>
              <div className="border-t border-line max-h-[220px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-2.5 px-5 py-2.5 border-b border-line last:border-0 items-center text-xs">
                    <span className="font-mono text-[10px] text-text-dim">{timeStr(h.ts)}</span>
                    <span className="font-display text-sm truncate">{h.label}</span>
                    <span className="font-mono font-semibold text-text-mute">{h.summary}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Ctx>
  );
}

export function summarize(r: RollResult, t: (k: string) => string): string {
  switch (r.mechanic) {
    case 'pool-successes': return r.kind === 'success' ? `+${r.result}` : r.kind === 'botch' ? '✱' : '—';
    case 'd20-modifier': return `${r.result}${r.kind === 'crit' ? ' ★' : r.kind === 'critfail' ? ' ✱' : ''}`;
    case 'd100-under': return `${r.result} · ${t(r.degree === 'fail' ? 'failure' : r.degree!)}`;
    default: return String(r.result);
  }
}

function ResultView({ result, difficulty }: { result: RollResult; difficulty: number }) {
  const { t } = useI18n();
  const pool = result.mechanic === 'pool-successes';
  const good = result.kind === 'success' || result.kind === 'crit';
  const headline = pool ? (result.kind === 'success' ? String(result.result) : result.kind === 'botch' ? t('botch') : t('failure')) : String(result.result);
  const kindLabel = result.degree ? t(result.degree === 'fail' ? 'failure' : result.degree) : pool ? (good ? t('successes') : result.kind === 'botch' ? t('botch') : t('failure')) : t(result.kind);
  return (
    <div className={cn('bg-ink rounded p-[18px] flex flex-col gap-3 border', good ? 'border-brand' : 'border-line')}>
      <span className="eyebrow">{kindLabel}</span>
      <div className={cn('font-display text-[56px] leading-none font-medium', good ? 'text-brand-bright' : result.kind === 'botch' || result.kind === 'critfail' ? 'text-brand italic' : 'text-text-mute')}>{headline}</div>
      <div className="flex flex-wrap gap-1.5">
        {result.dice.map((d, i) => {
          const hit = pool && d >= difficulty;
          const cls = pool && d === 1 ? 'text-brand-bright border-brand bg-brand/10'
            : pool && d === 10 ? (hit ? 'bg-gold text-ink border-gold' : 'text-gold border-gold bg-gold/10')
            : hit ? 'text-on-brand bg-brand border-brand' : 'text-text-mute border-line2 bg-ink';
          return <span key={i} className={cn('min-w-8 h-8 px-1 border rounded flex items-center justify-center font-mono text-sm font-medium', cls)}>{d}</span>;
        })}
      </div>
    </div>
  );
}

function Stepper({ label, value, display, min, max, onChange }: {
  label: string; value: number; display?: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const shown = display ?? value;
  const btn = 'bg-ink border border-line2 text-text-mute w-12 h-12 shrink-0 rounded-md text-2xl font-mono hover:text-text hover:border-text-mute active:bg-surf transition-colors';
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(min, shown - 1))} className={btn}>−</button>
        <input type="number" value={shown} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
          className="bg-ink border border-line2 rounded-md h-12 px-2 font-mono text-2xl font-medium text-center w-full min-w-0 outline-none focus:border-brand" />
        <button onClick={() => onChange(Math.min(max, shown + 1))} className={btn}>+</button>
      </div>
    </div>
  );
}

const timeStr = (ts: number) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
