// Dice roller: a floating button + modal overlay, plus a useDice() hook so any
// component can open it pre-filled (e.g. clicking a trait's roll button).
// The roll math comes from the active system (system.dice.rollPool).
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useSystem } from '@/domain/SystemContext';
import { useI18n } from '@/i18n/I18nContext';
import { readJSON, writeJSON, key } from '@/store/storage';
import type { RollResult } from '@/systems/types';

interface RollRequest {
  pool?: number;
  label?: string;
  difficulty?: number;
  specialty?: boolean;
}

interface HistoryEntry extends RollResult {
  ts: number;
  label: string;
  pool: number;
  difficulty: number;
  specialty: boolean;
}

const DiceContext = createContext<{ roll: (req?: RollRequest) => void } | null>(null);
const HISTORY_KEY = key('dice', 'history');

export function useDice() {
  const ctx = useContext(DiceContext);
  if (!ctx) throw new Error('useDice must be used within <DiceProvider>');
  return ctx;
}

export function DiceProvider({ children }: { children: ReactNode }) {
  const { system, label: sysLabel } = useSystem();
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState(5);
  const [difficulty, setDifficulty] = useState(system.dice.defaultDifficulty);
  const [specialty, setSpecialty] = useState(false);
  const [label, setLabel] = useState('');
  const [result, setResult] = useState<RollResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => readJSON(HISTORY_KEY, []));

  useEffect(() => {
    writeJSON(HISTORY_KEY, history.slice(0, 20));
  }, [history]);

  const roll = useCallback((req: RollRequest = {}) => {
    if (req.pool != null) setPool(Math.max(1, Math.min(20, req.pool)));
    if (req.difficulty != null) setDifficulty(Math.max(2, Math.min(10, req.difficulty)));
    if (req.label != null) setLabel(req.label);
    if (req.specialty != null) setSpecialty(req.specialty);
    setResult(null);
    setOpen(true);
  }, []);

  function doRoll() {
    const r = system.dice.rollPool({ pool, difficulty, specialty });
    setResult(r);
    setHistory((h) =>
      [{ ts: Date.now(), label: label || `${pool}d10 / ${difficulty}`, pool, difficulty, specialty, ...r }, ...h].slice(0, 20),
    );
  }

  const value = useMemo(() => ({ roll }), [roll]);
  const bigText = !result ? '' : result.kind === 'success' ? String(result.net) : result.kind === 'botch' ? sysLabel('botch') : sysLabel('failure');

  return (
    <DiceContext value={value}>
      {children}

      <button
        onClick={() => setOpen(true)}
        title={sysLabel('roll')}
        aria-label={sysLabel('roll')}
        className="print-hidden fixed right-[18px] bottom-[18px] z-50 w-14 h-14 rounded-full bg-blood border border-blood2 text-white flex items-center justify-center shadow-[0_6px_24px_rgba(160,30,46,.4)] hover:bg-blood2 hover:-translate-y-0.5 transition-all"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2L3 7v10l9 5 9-5V7z" /><path d="M3 7l9 5 9-5" /><path d="M12 12v10" />
          <circle cx="8" cy="10" r=".7" fill="currentColor" />
          <circle cx="16" cy="10" r=".7" fill="currentColor" />
          <circle cx="12" cy="17" r=".7" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          className="print-hidden fixed inset-0 z-[60] bg-[rgba(8,6,12,0.7)] backdrop-blur-[4px] flex items-center justify-center p-6"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="bg-surf border border-line2 rounded-lg w-full max-w-[460px] max-h-full flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,.6)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h3 className="font-display text-[22px] font-medium m-0">{sysLabel('roll')}</h3>
              <button onClick={() => setOpen(false)} aria-label="close" className="text-text-mute hover:text-text p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3.5">
                <Stepper label={sysLabel('pool')} value={pool} min={1} max={20} onChange={setPool} />
                <Stepper label={sysLabel('difficulty')} value={difficulty} min={2} max={10} onChange={setDifficulty} />
              </div>

              <label className="flex items-center gap-2 text-text-mute text-xs cursor-pointer select-none">
                <input type="checkbox" checked={specialty} onChange={(e) => setSpecialty(e.target.checked)} className="w-3.5 h-3.5 accent-blood" />
                {sysLabel('specialty')} — +1 {lang === 'ru' ? 'кубик' : 'die'}
              </label>

              <button onClick={doRoll} className="bg-blood text-white border border-blood2 py-3.5 text-sm tracking-[0.08em] uppercase rounded font-semibold hover:bg-blood2 transition-colors">
                {sysLabel('rollIt')}
              </button>

              {result && (
                <div className={`bg-ink rounded p-[18px] flex flex-col gap-3 border ${result.kind === 'success' ? 'border-blood' : 'border-line'}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="eyebrow">{result.kind === 'success' ? sysLabel('successes') : result.kind === 'botch' ? sysLabel('botch') : sysLabel('failure')}</span>
                    <span className="font-mono text-[11px] text-text-mute">{pool}d10 / {difficulty}{specialty ? ' · spec' : ''}</span>
                  </div>
                  <div className={`font-display text-[56px] leading-none font-medium ${result.kind === 'success' ? 'text-blood2' : result.kind === 'botch' ? 'text-blood italic' : 'text-text-mute'}`}>
                    {bigText}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.dice.map((d, i) => {
                      const success = d >= difficulty;
                      const cls = d === 1
                        ? 'text-blood2 border-blood bg-blood/10'
                        : d === 10
                          ? success ? 'bg-gold text-ink border-gold' : 'text-gold border-gold bg-gold/10'
                          : success ? 'text-white bg-blood border-blood' : 'text-text-mute border-line2 bg-ink';
                      return (
                        <span key={i} className={`w-8 h-8 border rounded flex items-center justify-center font-mono text-sm font-medium ${cls}`}>{d}</span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {history.length > 0 && (
              <>
                <div className="px-5 pt-3 pb-2 eyebrow border-t border-line">{sysLabel('history20')}</div>
                <div className="border-t border-line max-h-[220px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr_auto_auto] gap-2.5 px-5 py-2.5 border-b border-line last:border-0 items-center text-xs">
                      <span className="font-mono text-[10px] text-text-dim">{timeStr(h.ts)}</span>
                      <span className="font-display text-sm">{h.label}</span>
                      <span className="font-mono text-[10px] text-text-mute">{h.pool}/{h.difficulty}</span>
                      <span className={`font-mono font-semibold ${h.kind === 'success' ? 'text-blood2' : h.kind === 'botch' ? 'text-blood italic' : 'text-text-mute'}`}>
                        {h.kind === 'success' ? '+' + h.net : h.kind === 'botch' ? '✱' : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DiceContext>
  );
}

function Stepper({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const btn = 'bg-ink border border-line2 text-text-mute w-8 h-10 rounded text-lg font-mono hover:text-text hover:border-text-mute transition-colors';
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(min, value - 1))} className={btn}>−</button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
          className="bg-ink border border-line2 rounded px-3.5 py-2.5 font-mono text-[22px] font-medium text-center w-full outline-none focus:border-blood"
        />
        <button onClick={() => onChange(Math.min(max, value + 1))} className={btn}>+</button>
      </div>
    </div>
  );
}

function timeStr(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
