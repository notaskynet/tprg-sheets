// Renders sheet.toml: sections → columns → blocks. Every block type reads the
// system package (labels, fields, groups) and edits the character via `set`.
import type { ReactNode } from 'react';
import { getIn, tableLookup } from '@/engine/expr/eval';
import { groupItems } from '@/engine/schema';
import { useScope, useSystem } from '@/ui/context';
import { DotRow } from '@/ui/primitives';
import { DamageTrack, AdaptivePool } from '@/ui/primitives/tracks';
import { useDice } from '@/ui/dice/DiceProvider';
import { FieldEditor } from './fields';
import { ListEditor } from './ListEditor';
import { cn } from '@/ui/lib/utils';

export interface SheetProps {
  values: Record<string, unknown>;
  set: (path: string, value: unknown) => void;
  readOnly?: boolean;
}
type BlockCfg = { type: string; [k: string]: unknown };

const COLS: Record<number, string> = {
  1: '', 2: 'md:grid-cols-2 print:grid-cols-2', 3: 'md:grid-cols-3 print:grid-cols-3', 4: 'md:grid-cols-4 print:grid-cols-4',
};

export function SheetRenderer(props: SheetProps) {
  const { pkg, tr } = useSystem();
  return (
    <>
      {pkg.sheet.sections.map((s) => {
        const plate = s.blocks.length === 1 && s.blocks[0].type === 'plate';
        return (
          <section key={s.id} className="flex flex-col gap-3.5">
            {s.title && <Heading title={tr(s.title)} />}
            <div className={cn('grid grid-cols-1 gap-7 print:gap-x-5 print:gap-y-0 items-start', plate ? 'grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-x-[26px] gap-y-4' : COLS[s.columns])}>
              {s.blocks.map((b, i) => <Block key={i} cfg={b as BlockCfg} {...props} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Heading({ title, small }: { title: string; small?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 mb-0.5">
      <h2 className={cn('font-display font-semibold', small ? 'text-[15px]' : 'text-xl')}>{title}</h2>
      <div className="flex-1 h-px bg-line mx-1" />
    </div>
  );
}

function Block({ cfg, ...p }: { cfg: BlockCfg } & SheetProps) {
  const { pkg, tr } = useSystem();
  const scope = useScope(p.values);
  const dice = useDice();
  const str = (k: string) => cfg[k] as string;

  switch (cfg.type) {
    case 'plate':
      return <>{(cfg.fields as string[]).map((f) => <FieldEditor key={f} path={f} variant="plate" {...p} />)}</>;

    case 'fields':
      return (
        <div className="grid grid-cols-2 gap-3.5">
          {(cfg.fields as string[]).map((f) => <FieldEditor key={f} path={f} variant="plate" {...p} />)}
        </div>
      );

    case 'stack':
      return <div className="flex flex-col gap-[18px]">{(cfg.blocks as BlockCfg[]).map((b, i) => <Block key={i} cfg={b} {...p} />)}</div>;

    case 'text':
      return <FieldEditor path={str('field')} variant="form" {...p} />;

    case 'group-columns':
    case 'group': {
      const gid = str('group');
      const g = pkg.model.groups[gid];
      const items = groupItems(pkg.model, gid);
      const cats: (string | null)[] = cfg.type === 'group' || !g.categories.length ? [null] : g.categories;
      const spec = cfg.specialties as string | undefined;
      const canRoll = dice.enabled(gid);
      const field = g.field as { type: string; min?: number; max?: number };
      return (
        <>
          {cats.map((cat) => (
            <div key={cat ?? 'all'}>
              <div className="eyebrow mb-1.5">{cat ? tr(`${gid}.cat.${cat}`) : tr(`${gid}.title`)}</div>
              {items.filter((i) => !cat || i.cat === cat).map((it) => {
                const val = Number(getIn(p.values, [gid, it.id]) ?? field.min ?? 0);
                const sp = spec ? String(getIn(p.values, [spec, it.id]) ?? '') : '';
                return (
                  <div key={it.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-[5px] print:py-[2px] border-b border-dashed border-line last:border-0">
                    <span className="flex items-baseline gap-1.5 text-[13px] min-w-0">
                      {canRoll && !p.readOnly ? (
                        <button type="button" onClick={() => dice.pick(gid, it.id)} className="text-left hover:text-brand-bright transition-colors">{tr(`${gid}.${it.id}`)}</button>
                      ) : tr(`${gid}.${it.id}`)}
                      {sp && <span className="text-[10px] text-text-dim italic">({sp})</span>}
                    </span>
                    <DotRow value={val} max={field.max ?? 5} onChange={p.readOnly ? undefined : (n) => p.set(`${gid}.${it.id}`, Math.max(field.min ?? 0, n))} />
                  </div>
                );
              })}
            </div>
          ))}
        </>
      );
    }

    case 'list': {
      const path = str('field');
      const def = pkg.model.fields[path];
      if (def?.type !== 'list') return null;
      return (
        <div>
          <div className="eyebrow mb-1.5">{tr(`fields.${path}`)}</div>
          <ListEditor path={path} def={def} values={p.values} set={p.set} scopeExpr={cfg.scope as string | undefined} readOnly={p.readOnly} />
        </div>
      );
    }

    case 'track': {
      const path = str('field');
      const def = pkg.model.fields[path];
      if (def?.type !== 'damage-track') return null;
      const table = cfg.penalty ? pkg.model.tables[str('penalty')] : undefined;
      const value = (getIn(p.values, path.split('.')) ?? {}) as Record<string, number>;
      return (
        <div className="flex flex-col gap-1.5">
          <Heading title={tr(`fields.${path}`)} />
          <DamageTrack
            kinds={def.kinds}
            levels={def.levels}
            value={value}
            readOnly={p.readOnly}
            onChange={(v) => p.set(path, v)}
            levelLabel={(l) => tr(`levels.${l}`)}
            penaltyFor={(i) => {
              if (!table) return '';
              if (i === def.levels.length - 1) return '—'; // last level = out of action
              const pen = Number(tableLookup(table, i + 1));
              return pen === 0 ? '' : String(pen);
            }}
          />
        </div>
      );
    }

    case 'stepper': {
      // Edits a stored bonus field but displays the derived total as dots.
      const bonusPath = str('field');
      const total = Number(scope.get([str('derived')]) ?? 0);
      const bonus = Number(getIn(p.values, bonusPath.split('.')) ?? 0);
      const baseVal = total - bonus;
      return (
        <div className="flex flex-col gap-1.5">
          <Heading title={tr(`derived.${str('derived')}`)} />
          <div className="flex items-center gap-2.5">
            <DotRow value={total} max={Number(cfg.max ?? 10)} onChange={p.readOnly ? undefined : (n) => p.set(bonusPath, n - baseVal)} />
            <span className="font-mono text-sm text-text-mute">{total}</span>
          </div>
        </div>
      );
    }

    case 'pool': {
      const path = str('field');
      const def = pkg.model.fields[path];
      if (def?.type !== 'pool') return null;
      const max = Math.max(Number(scope.run(def.max) ?? 0), 1);
      const value = Number(getIn(p.values, path.split('.')) ?? 0);
      const noteKey = cfg.note as string | undefined;
      const hint = noteKey ? `${tr(`derived.${noteKey}`)}: ${scope.get([noteKey])}` : undefined;
      return (
        <div className="flex flex-col gap-1.5">
          <Heading title={tr(`fields.${path}`)} small={path === 'willpowerCurrent'} />
          <AdaptivePool value={value} max={max} onChange={(n) => p.set(path, n)} tone={path.toLowerCase().includes('blood') || path === 'blood' ? 'blood' : 'light'} hint={hint} />
        </div>
      );
    }

    default:
      return <div className="text-xs text-brand-bright font-mono">unknown block: {cfg.type as ReactNode as string}</div>;
  }
}
