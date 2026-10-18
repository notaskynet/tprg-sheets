// Health track + blood/willpower pools.
import type { HealthState } from '@/domain/character';
import type { HealthLevel } from '@/systems/types';

type DamageKind = '' | 'bashing' | 'lethal' | 'aggravated';

export function HealthTrack({ health, levels, labelFor, onChange }: {
  health: HealthState;
  levels: HealthLevel[];
  labelFor: (id: string) => string;
  onChange?: (next: HealthState) => void;
}) {
  const { aggravated, lethal, bashing } = health;

  function boxState(i: number): DamageKind {
    if (i < aggravated) return 'aggravated';
    if (i < aggravated + lethal) return 'lethal';
    if (i < aggravated + lethal + bashing) return 'bashing';
    return '';
  }

  function cycle(i: number) {
    if (!onChange) return;
    const cur = boxState(i);
    // Don't add damage past the last health level.
    if (cur === '' && aggravated + lethal + bashing >= levels.length) return;
    if (cur === '') return onChange({ ...health, bashing: bashing + 1 });
    if (cur === 'bashing') return onChange({ ...health, bashing: bashing - 1, lethal: lethal + 1 });
    if (cur === 'lethal') return onChange({ ...health, lethal: lethal - 1, aggravated: aggravated + 1 });
    return onChange({ ...health, aggravated: aggravated - 1 });
  }

  const boxColor: Record<DamageKind, string> = {
    '': 'border-line2 text-transparent',
    bashing: 'border-line2 text-text-mute bg-text/5',
    lethal: 'border-blood text-blood2 bg-blood/10',
    aggravated: 'border-blood text-white bg-blood',
  };

  return (
    <div>
      {levels.map((l, i) => {
        const state = boxState(i);
        return (
          <div
            key={l.id}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-2.5 py-1.5 print:py-[2px] border-b border-dashed border-line last:border-0"
          >
            <span className="text-xs">{labelFor(l.id)}</span>
            <span className="font-mono text-[11px] text-text-mute min-w-7 text-right">
              {l.penalty == null ? '—' : l.penalty === 0 ? '' : l.penalty}
            </span>
            <button
              type="button"
              data-state={state}
              onClick={() => cycle(i)}
              aria-label={l.id}
              className={`health-box w-[18px] h-[18px] border rounded-[2px] cursor-pointer inline-flex items-center justify-center font-mono text-[11px] leading-none transition-colors ${boxColor[state]}`}
            />
          </div>
        );
      })}
    </div>
  );
}

export type PoolKind = 'blood' | 'willpower' | 'permanent';

export function PoolTrack({ value, max, onChange, kind = 'blood', groupBy = Infinity }: {
  value: number;
  max: number;
  onChange?: (v: number) => void;
  kind?: PoolKind;
  groupBy?: number;
}) {
  const fill =
    kind === 'willpower' ? 'bg-text border-text' : kind === 'permanent' ? 'bg-transparent border-text' : 'bg-blood border-blood';
  return (
    <div className="flex flex-wrap items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const filled = kind === 'permanent' ? true : i < value;
        const gap = Number.isFinite(groupBy) && i > 0 && i % groupBy === 0;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange?.(i + 1 === value ? i : i + 1)}
            className={[
              'w-3.5 h-3.5 border rounded-[2px] p-0 cursor-pointer transition-colors',
              filled ? fill : 'bg-transparent border-line2',
              gap ? 'ml-1.5' : '',
            ].join(' ')}
          />
        );
      })}
    </div>
  );
}

export function BigCounter({ value, max, onChange, kind = 'blood', perTurnHint }: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  kind?: PoolKind;
  perTurnHint?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const fill = kind === 'willpower' ? 'bg-text' : 'bg-blood';
  const step = 'bg-bg border border-line2 text-text-mute w-7 h-9 rounded cursor-pointer font-mono text-base hover:text-text hover:border-text-mute transition-colors';
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
        <div className={`h-full ${fill} transition-[width] duration-300`} style={{ width: `${pct.toFixed(0)}%` }} />
      </div>
      {perTurnHint != null && (
        <div className="font-mono text-[10px] text-text-dim tracking-wider text-center">{perTurnHint}</div>
      )}
    </div>
  );
}

export function AdaptivePool({ value, max, onChange, kind = 'blood', perTurnHint, threshold = 20 }: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  kind?: PoolKind;
  perTurnHint?: string;
  threshold?: number;
}) {
  if (max <= threshold) {
    return (
      <div className="flex flex-col gap-1.5">
        <PoolTrack value={value} max={max} onChange={onChange} kind={kind} groupBy={5} />
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[11px] text-text-mute">{value}/{max}</span>
          {perTurnHint != null && (
            <span className="font-mono text-[10px] text-text-dim tracking-wide">{perTurnHint}</span>
          )}
        </div>
      </div>
    );
  }
  return <BigCounter value={value} max={max} onChange={onChange} kind={kind} perTurnHint={perTurnHint} />;
}
