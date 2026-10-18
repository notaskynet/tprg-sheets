// Generic damage track + pools, driven by the system's field definitions.
import { cn } from '@/ui/lib/utils';

const BOX_TONE = [
  'border-line2 text-transparent',
  'border-line2 text-text-mute bg-text/5',
  'border-brand text-brand-bright bg-brand/10',
  'border-brand text-on-brand bg-brand',
];

/** Boxes fill strongest kind first; clicking a box cycles its kind weakest → strongest → empty. */
export function DamageTrack({ kinds, levels, value, onChange, levelLabel, penaltyFor, readOnly }: {
  kinds: string[]; // weakest → strongest
  levels: string[];
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  levelLabel: (id: string) => string;
  penaltyFor: (levelIndex: number) => string;
  readOnly?: boolean;
}) {
  const count = (k: string) => value[k] ?? 0;
  const total = kinds.reduce((s, k) => s + count(k), 0);
  const strongestFirst = [...kinds].reverse();

  function kindAt(i: number): number {
    let start = 0;
    for (const k of strongestFirst) {
      if (i < start + count(k)) return kinds.indexOf(k) + 1;
      start += count(k);
    }
    return 0;
  }

  function cycle(i: number) {
    const cur = kindAt(i); // 0 = empty
    if (cur === 0 && total >= levels.length) return;
    const next = { ...value };
    if (cur > 0) next[kinds[cur - 1]] = count(kinds[cur - 1]) - 1;
    if (cur < kinds.length) next[kinds[cur]] = count(kinds[cur]) + 1;
    onChange(next);
  }

  return (
    <div>
      {levels.map((l, i) => {
        const k = kindAt(i);
        return (
          <div key={l} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 py-1.5 print:py-[2px] border-b border-dashed border-line last:border-0">
            <span className="text-xs">{levelLabel(l)}</span>
            <span className="font-mono text-[11px] text-text-mute min-w-7 text-right">{penaltyFor(i)}</span>
            <button
              type="button"
              data-k={k}
              disabled={readOnly}
              onClick={() => cycle(i)}
              aria-label={l}
              className={cn('health-box w-[18px] h-[18px] border rounded-[2px] cursor-pointer inline-flex items-center justify-center font-mono text-[11px] leading-none transition-colors', BOX_TONE[Math.min(k, BOX_TONE.length - 1)])}
            />
          </div>
        );
      })}
    </div>
  );
}

export function PoolTrack({ value, max, onChange, tone = 'blood', groupBy = Infinity }: {
  value: number;
  max: number;
  onChange?: (v: number) => void;
  tone?: 'blood' | 'light';
  groupBy?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i + 1 === value ? i : i + 1)}
          className={cn(
            'w-3.5 h-3.5 border rounded-[2px] p-0 cursor-pointer transition-colors',
            i < value ? (tone === 'light' ? 'bg-text border-text' : 'bg-brand border-brand') : 'bg-transparent border-line2',
            Number.isFinite(groupBy) && i > 0 && i % groupBy === 0 && 'ml-1.5',
          )}
        />
      ))}
    </div>
  );
}

export function BigCounter({ value, max, onChange, tone = 'blood', hint }: {
  value: number; max: number; onChange: (v: number) => void; tone?: 'blood' | 'light'; hint?: string;
}) {
  const step = 'bg-bg border border-line2 text-text-mute w-10 h-10 rounded-md cursor-pointer font-mono text-xl hover:text-text hover:border-text-mute transition-colors';
  return (
    <div className="flex flex-col gap-2 min-w-40">
      <div className="flex items-center gap-2.5">
        <button type="button" className={step} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <div className="flex items-baseline gap-1 flex-1 justify-center font-display">
          <span className="text-4xl font-medium leading-none">{value}</span>
          <span className="font-mono text-[13px] text-text-mute">/ {max}</span>
        </div>
        <button type="button" className={step} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
      </div>
      <div className="h-1 bg-line rounded-sm overflow-hidden">
        <div className={cn('h-full transition-[width] duration-300', tone === 'light' ? 'bg-text' : 'bg-brand')} style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      {hint != null && <div className="font-mono text-[10px] text-text-dim tracking-wider text-center">{hint}</div>}
    </div>
  );
}

/** Boxes up to `threshold`, a +/- counter beyond it (e.g. 50-point blood pools). */
export function AdaptivePool({ value, max, onChange, tone, hint, threshold = 20 }: {
  value: number; max: number; onChange: (v: number) => void; tone?: 'blood' | 'light'; hint?: string; threshold?: number;
}) {
  const v = Math.min(value, max);
  if (max > threshold) return <BigCounter value={v} max={max} onChange={onChange} tone={tone} hint={hint} />;
  return (
    <div className="flex flex-col gap-1.5">
      <PoolTrack value={v} max={max} onChange={onChange} tone={tone} groupBy={5} />
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[11px] text-text-mute">{v}/{max}</span>
        {hint != null && <span className="font-mono text-[10px] text-text-dim tracking-wide">{hint}</span>}
      </div>
    </div>
  );
}
