// Creation wizard — fullscreen overlay. Steps come from system.wizardSteps and
// are rendered by kind; budgets/validators come from system.creation + rules.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Character, TraitItem } from '@/domain/character';
import type { GameSystem, Lang, WizardStepKind } from '@/systems/types';
import type { LocalizedText } from '@/i18n/lang';
import { useSystem } from '@/domain/SystemContext';
import { useI18n } from '@/i18n/I18nContext';
import { AVAILABLE_LANGS } from '@/i18n/lang';
import { disciplinePreset } from '@/domain/disciplines';
import { Field, DotRow } from './primitives';
import { readString, writeJSON, remove } from '@/store/storage';
import { wizardStepKey } from '@/store/characters';

interface StepValidity {
  ok: boolean;
  message: string;
  tone: 'ok' | 'over' | 'under';
}

export function Wizard({ ch, setPath, onClose, onExit }: {
  ch: Character;
  setPath: (path: string, value: unknown) => void;
  onClose: () => void; // close the wizard, stay on the sheet
  onExit: () => void; // leave to the character list
}) {
  const { system, label } = useSystem();
  const { t, lang, setLang, name } = useI18n();
  const steps = system.wizardSteps;
  const stepKey = wizardStepKey(ch.id);
  const [step, setStep] = useState(() => {
    const saved = Number(readString(stepKey));
    return Number.isFinite(saved) ? Math.min(Math.max(saved, 0), steps.length - 1) : 0;
  });

  function goto(i: number) {
    const next = Math.min(Math.max(i, 0), steps.length - 1);
    setStep(next);
    writeJSON(stepKey, next);
  }

  const cur = steps[Math.min(step, steps.length - 1)];
  const valid = useMemo(() => validateStep(cur.kind, ch, system, lang), [cur.kind, ch, system, lang]);
  const isLast = step === steps.length - 1;

  function finish() {
    remove(stepKey);
    onClose();
  }

  const rootRef = useRef<HTMLDivElement>(null);

  // Lock background scroll and pin the overlay to the visual viewport. On iOS
  // Safari the software keyboard doesn't shrink dvh/layout units and raises
  // fixed elements (revealing the sheet behind), so we size/offset the overlay
  // to window.visualViewport, which DOES track the keyboard.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const vv = window.visualViewport;
    const el = rootRef.current;
    const apply = () => {
      if (!vv || !el) return;
      el.style.height = `${vv.height}px`;
      el.style.top = `${vv.offsetTop}px`;
    };
    apply();
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    return () => {
      document.body.style.overflow = prev;
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
    };
  }, []);

  return (
    <div ref={rootRef} className="fixed inset-x-0 top-0 h-[100dvh] z-[200] bg-ink flex flex-col text-text overflow-hidden">
      <header className="px-8 py-3.5 border-b border-line flex items-center gap-5 bg-surf">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 bg-transparent border border-line2 text-text-mute rounded px-2.5 py-[5px] text-[11px] hover:text-text hover:border-text-mute transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3L5 8l5 5" /></svg>
          {t('myCharacters')}
        </button>
        <div className="eyebrow shrink-0">VAMPIRE · V20</div>
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
          {steps.map((s, i) => {
            const done = validateStep(s.kind, ch, system, lang).ok && i < step;
            return (
              <button
                key={s.id}
                onClick={() => goto(i)}
                className={[
                  'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] tracking-wide rounded-sm border transition-colors',
                  i === step ? 'text-text border-text-mute bg-surf2' : done ? 'text-good border-transparent' : 'text-text-dim border-transparent hover:text-text-mute',
                ].join(' ')}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                <span>{label(s.titleKey)}</span>
              </button>
            );
          })}
        </div>
        <div className="inline-flex p-0.5 border border-line2 rounded font-mono text-[11px] shrink-0">
          {AVAILABLE_LANGS.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)} className={`px-2 py-1 rounded-[3px] transition-colors ${l.code === lang ? 'bg-text text-bg' : 'text-text-mute hover:text-text'}`}>
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>
        <button
          onClick={finish}
          className="bg-transparent border border-line2 text-text-mute w-8 h-8 rounded inline-flex items-center justify-center hover:text-text hover:border-text-mute transition-colors"
          title={lang === 'ru' ? 'Закрыть' : 'Close'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" /></svg>
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto px-8 pt-9 pb-6">
        <div className="max-w-[880px] mx-auto flex flex-col gap-6">
          <div>
            <div className="eyebrow mb-2">{lang === 'ru' ? 'Шаг' : 'Step'} {step + 1} / {steps.length}</div>
            <h1 className="font-display font-medium text-[40px] m-0 leading-tight">{label(cur.titleKey)}</h1>
            <p className="text-text-mute text-sm leading-relaxed max-w-[620px] mt-2.5">{HINTS[cur.kind][lang === 'ru' ? 'ru' : 'en']}</p>
          </div>
          <StepBody kind={cur.kind} ch={ch} setPath={setPath} system={system} label={label} name={name} lang={lang} />
        </div>
      </main>

      <footer className="px-4 sm:px-8 py-3 sm:py-4 border-t border-line flex items-center gap-2 sm:gap-3.5 bg-surf">
        <NavBtn onClick={() => goto(step - 1)} disabled={step === 0}>← {lang === 'ru' ? 'Назад' : 'Back'}</NavBtn>
        <button onClick={finish} className="hidden sm:inline-block whitespace-nowrap bg-transparent border-0 text-text-dim px-3 py-2.5 text-[13px] hover:text-text-mute transition-colors">
          {lang === 'ru' ? 'Сразу к листу' : 'Skip to sheet'}
        </button>
        <div className="flex-1 min-w-0" />
        {valid.message && (
          <div className={`font-mono text-[11px] whitespace-nowrap ${valid.tone === 'ok' ? 'text-good' : valid.tone === 'over' ? 'text-blood2' : 'text-gold'}`}>{valid.message}</div>
        )}
        {isLast ? (
          <PrimaryBtn onClick={finish}>{lang === 'ru' ? 'Готово' : 'Done'} ✓</PrimaryBtn>
        ) : (
          <PrimaryBtn onClick={() => goto(step + 1)}>{lang === 'ru' ? 'Далее' : 'Next'} →</PrimaryBtn>
        )}
      </footer>
    </div>
  );
}

// ---------- Step bodies (module-level so inputs keep focus across renders) ----------

interface StepProps {
  kind: WizardStepKind;
  ch: Character;
  setPath: (path: string, value: unknown) => void;
  system: GameSystem;
  label: (k: string) => string;
  name: (t: LocalizedText | undefined) => string;
  lang: Lang;
}

function StepBody({ kind, ch, setPath, system, label, name, lang }: StepProps) {
  switch (kind) {
    case 'concept':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-[22px] gap-y-4">
          <Field label={label('name')} value={ch.profile.name} onChange={(v) => setPath('profile.name', v)} />
          <Field label={label('player')} value={ch.profile.player} onChange={(v) => setPath('profile.player', v)} />
          <Field label={label('chronicle')} value={ch.profile.chronicle} onChange={(v) => setPath('profile.chronicle', v)} />
          <Field label={label('concept')} value={ch.profile.concept} onChange={(v) => setPath('profile.concept', v)} />
          <Field label={label('nature')} value={ch.profile.nature} onChange={(v) => setPath('profile.nature', v)} list="wz-arch" />
          <Field label={label('demeanor')} value={ch.profile.demeanor} onChange={(v) => setPath('profile.demeanor', v)} list="wz-arch" />
          <datalist id="wz-arch">{system.archetypes.map((a, i) => <option key={i} value={name(a.name)} />)}</datalist>
        </div>
      );

    case 'clanGeneration': {
      const [bpMax, bpPerTurn] = system.rules.bloodPoolFor(ch.profile.generation || 13);
      return (
        <div className="grid grid-cols-2 gap-[22px] items-start">
          <Field label={label('clan')} value={ch.profile.clan} onChange={(v) => setPath('profile.clan', v)} options={system.clans.map((c) => ({ value: c.id, label: name(c.name) }))} />
          <Field label={label('generation')} type="number" value={ch.profile.generation} onChange={(v) => setPath('profile.generation', Number(v))} />
          <InfoBox className="col-span-2" label={lang === 'ru' ? 'запас крови' : 'blood pool'}>
            {bpMax} <span className="text-text-mute text-sm font-mono">· {bpPerTurn}/{lang === 'ru' ? 'ход' : 'turn'}</span>
          </InfoBox>
          <Field label={label('sire')} value={ch.profile.sire} onChange={(v) => setPath('profile.sire', v)} />
          <Field label={label('weakness')} value={ch.weakness} onChange={(v) => setPath('weakness', v)} />
        </div>
      );
    }

    case 'attributes':
      return (
        <TriadEditor
          categories={system.attributeCategories}
          traitsFor={(cat) => system.attributes.filter((a) => a.cat === cat)}
          valueFor={(id) => ch.attributes[id] ?? 1}
          onChange={(id, n) => setPath(`attributes.${id}`, Math.max(1, n))}
          budgetFor={(cat) => sumCat(ch.attributes, system.attributes, cat) - 3}
          caps={[system.creation.attrPrimary, system.creation.attrSecondary, system.creation.attrTertiary]}
          labelFor={label}
          nameFor={name}
        />
      );

    case 'abilities':
      return (
        <TriadEditor
          categories={system.abilityCategories}
          traitsFor={(cat) => system.abilities.filter((a) => a.cat === cat)}
          valueFor={(id) => ch.abilities[id] ?? 0}
          onChange={(id, n) => setPath(`abilities.${id}`, n)}
          budgetFor={(cat) => sumCat(ch.abilities, system.abilities, cat)}
          caps={[system.creation.abilPrimary, system.creation.abilSecondary, system.creation.abilTertiary]}
          labelFor={label}
          nameFor={name}
          dimFrom={0}
        />
      );

    case 'disciplines':
      return <ItemsEditor field="disciplines" items={ch.disciplines} preset={disciplinePreset(system, ch.profile.clan, name)} budget={system.creation.disciplines} setPath={setPath} lang={lang} />;

    case 'backgrounds':
      return <ItemsEditor field="backgrounds" items={ch.backgrounds} preset={system.backgrounds.map((b) => name(b.name))} budget={system.creation.backgrounds} setPath={setPath} lang={lang} />;

    case 'virtues':
      return (
        <div>
          <div className="grid grid-cols-3 gap-[22px]">
            {system.virtues.map((v) => (
              <div key={v.id}>
                <div className="eyebrow mb-2">{name(v.name)}</div>
                <DotRow value={ch.virtues[v.id] ?? 1} max={5} onChange={(n) => setPath(`virtues.${v.id}`, Math.max(1, n))} />
              </div>
            ))}
          </div>
          <div className="mt-[22px] p-4 bg-surf border border-line rounded-md grid grid-cols-2 gap-[18px]">
            <InfoInline label={lang === 'ru' ? 'человечность' : 'humanity'}>{system.rules.deriveHumanity(ch)}</InfoInline>
            <InfoInline label={lang === 'ru' ? 'воля (старт)' : 'willpower (start)'}>{system.rules.deriveWillpower(ch)}</InfoInline>
          </div>
        </div>
      );

    case 'freebies': {
      const spent = system.rules.spentFreebies(ch);
      const budget = system.creation.freebie;
      return (
        <div>
          <p className="text-text-mute text-sm mb-2">
            {lang === 'ru' ? 'Чтобы потратить — вернитесь на предыдущие шаги и добавьте больше точек.' : 'To spend freebies, go back to earlier steps and add more dots.'}
          </p>
          <div className="p-4 bg-surf border border-line rounded-md flex items-end gap-8">
            <InfoInline label={lang === 'ru' ? 'потрачено' : 'spent'}>
              <span className={spent > budget ? 'text-blood2' : ''}>{spent}</span>
              <span className="text-text-mute text-sm font-mono"> / {budget}</span>
            </InfoInline>
            <InfoInline label={lang === 'ru' ? 'осталось' : 'remaining'}>
              <span className={budget - spent < 0 ? 'text-blood2' : ''}>{budget - spent}</span>
            </InfoInline>
          </div>
        </div>
      );
    }

    case 'recap': {
      const checklist = system.rules.validateCharacter(ch, lang);
      const issues = checklist.filter((c) => !c.ok);
      const [bpMax] = system.rules.bloodPoolFor(ch.profile.generation || 13);
      const clan = system.clans.find((c) => c.id === ch.profile.clan);
      return (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
            <RecapRow label={label('name')} value={ch.profile.name || '—'} />
            <RecapRow label={label('clan')} value={clan ? name(clan.name) : '—'} />
            <RecapRow label={label('concept')} value={ch.profile.concept || '—'} />
            <RecapRow label={label('generation')} value={`${ch.profile.generation} · ${bpMax} ${lang === 'ru' ? 'крови' : 'blood'}`} />
            <RecapRow label={label('humanity')} value={String(system.rules.deriveHumanity(ch))} />
            <RecapRow label={label('willpower')} value={String(system.rules.deriveWillpower(ch))} />
          </div>
          <div className={`p-4 rounded-md bg-surf border ${issues.length ? 'border-blood/45' : 'border-good/35'}`}>
            <div className={`eyebrow mb-2 ${issues.length ? 'text-blood2' : 'text-good'}`}>
              {issues.length ? `${issues.length} ${lang === 'ru' ? 'не закрыто' : 'unresolved'}` : lang === 'ru' ? 'всё валидно' : 'all valid'}
            </div>
            {issues.length === 0 ? (
              <div className="text-sm text-text-mute">{lang === 'ru' ? 'Все проверки пройдены. Можно играть.' : 'All checks passed. Ready to play.'}</div>
            ) : (
              issues.map((i) => (
                <div key={i.id} className="text-[12.5px] text-text-mute py-0.5">
                  · {i.label} {i.val != null && <span className="font-mono text-text-dim"> — {i.val}{i.need ? ` / ${i.need}` : ''}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

// ---------- Validation per step kind ----------

function sumCat(values: Record<string, number>, traits: { id: string; cat?: string }[], cat: string): number {
  return traits.filter((t) => t.cat === cat).reduce((s, t) => s + (values[t.id] || 0), 0);
}

function validateStep(kind: WizardStepKind, ch: Character, system: GameSystem, lang: Lang): StepValidity {
  const ok = (message: string): StepValidity => ({ ok: true, message, tone: 'ok' });
  const fail = (message: string, over = false): StepValidity => ({ ok: false, message, tone: over ? 'over' : 'under' });
  const c = system.creation;

  switch (kind) {
    case 'concept': {
      const good = !!ch.profile.name && !!ch.profile.concept;
      return good ? ok(lang === 'ru' ? 'заполнено' : 'filled') : fail(lang === 'ru' ? 'имя и концепт' : 'name & concept');
    }
    case 'clanGeneration':
      return ch.profile.clan ? ok(lang === 'ru' ? 'клан выбран' : 'clan set') : fail(lang === 'ru' ? 'выберите клан' : 'choose clan');
    case 'attributes': {
      const t = system.attributeCategories.map((cat) => sumCat(ch.attributes, system.attributes, cat) - 3).sort((a, b) => b - a);
      const want = [c.attrPrimary, c.attrSecondary, c.attrTertiary];
      const good = t[0] === want[0] && t[1] === want[1] && t[2] === want[2];
      return good ? ok(want.join('/')) : fail(`${t.join('/')} → ${want.join('/')}`, t.some((x, i) => x > want[i]));
    }
    case 'abilities': {
      const t = system.abilityCategories.map((cat) => sumCat(ch.abilities, system.abilities, cat)).sort((a, b) => b - a);
      const want = [c.abilPrimary, c.abilSecondary, c.abilTertiary];
      const good = t[0] === want[0] && t[1] === want[1] && t[2] === want[2];
      return good ? ok(want.join('/')) : fail(`${t.join('/')} → ${want.join('/')}`, t.some((x, i) => x > want[i]));
    }
    case 'disciplines': {
      const sum = ch.disciplines.reduce((s, it) => s + (it.level || 0), 0);
      return sum === c.disciplines ? ok(`${sum}/${c.disciplines}`) : fail(`${sum}/${c.disciplines}`, sum > c.disciplines);
    }
    case 'backgrounds': {
      const sum = ch.backgrounds.reduce((s, it) => s + (it.level || 0), 0);
      return sum === c.backgrounds ? ok(`${sum}/${c.backgrounds}`) : fail(`${sum}/${c.backgrounds}`, sum > c.backgrounds);
    }
    case 'virtues': {
      const total = system.virtues.reduce((s, v) => s + (ch.virtues[v.id] || 0), 0) - system.virtues.length;
      return total === c.virtues ? ok(`${total}/${c.virtues}`) : fail(`${total}/${c.virtues}`, total > c.virtues);
    }
    case 'freebies': {
      const f = system.rules.spentFreebies(ch);
      return f <= c.freebie ? ok(`${f}/${c.freebie}`) : fail(`+${f - c.freebie}`, true);
    }
    default:
      return { ok: true, message: '', tone: 'ok' };
  }
}

// ---------- Small building blocks ----------

function NavBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`whitespace-nowrap bg-transparent border border-line2 text-text px-3 sm:px-[18px] py-2.5 rounded text-[13px] hover:border-text-mute transition-colors ${disabled ? 'opacity-35 cursor-not-allowed' : ''}`}>
      {children}
    </button>
  );
}

function PrimaryBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="whitespace-nowrap bg-blood border border-blood text-white px-3 sm:px-[18px] py-2.5 rounded text-[13px] hover:bg-blood2 hover:border-blood2 transition-colors">
      {children}
    </button>
  );
}

function InfoBox({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 bg-surf border border-line rounded-md ${className}`}>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="font-display text-[28px] leading-none">{children}</div>
    </div>
  );
}

function InfoInline({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="font-display text-[28px] leading-none mt-1">{children}</div>
    </div>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-1.5">
      <span className="eyebrow">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

function TriadEditor({ categories, traitsFor, valueFor, onChange, budgetFor, caps, labelFor, nameFor, dimFrom }: {
  categories: string[];
  traitsFor: (cat: string) => { id: string; name: LocalizedText }[];
  valueFor: (id: string) => number;
  onChange: (id: string, n: number) => void;
  budgetFor: (cat: string) => number;
  caps: number[];
  labelFor: (k: string) => string;
  nameFor: (t: LocalizedText) => string;
  dimFrom?: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-7 items-start">
      {categories.map((cat) => {
        const budget = budgetFor(cat);
        const tone = caps.includes(budget) ? 'text-good' : budget > caps[0] ? 'text-blood2' : 'text-text-mute';
        return (
          <div key={cat}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="eyebrow">{labelFor(cat)}</span>
              <span className={`font-mono text-xs ${tone}`}>{budget}</span>
            </div>
            {traitsFor(cat).map((tr) => (
              <div key={tr.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-[5px] border-b border-dashed border-line last:border-0">
                <span className="text-[13px]">{nameFor(tr.name)}</span>
                <DotRow value={valueFor(tr.id)} onChange={(n) => onChange(tr.id, n)} dimFrom={dimFrom} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ItemsEditor({ field, items, preset, budget, setPath, lang }: {
  field: 'disciplines' | 'backgrounds';
  items: TraitItem[];
  preset: string[];
  budget: number;
  setPath: (path: string, value: unknown) => void;
  lang: Lang;
}) {
  const sum = items.reduce((s, it) => s + (it.level || 0), 0);
  const update = (i: number, patch: Partial<TraitItem>) => setPath(field, items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = (n: string) => setPath(field, [...items, { id: 'i_' + Date.now(), name: n, level: 1 }]);
  const unused = preset.filter((p) => !items.some((it) => it.name === p));

  return (
    <div>
      <div className="font-mono text-[11px] text-text-mute mb-2">{lang === 'ru' ? 'потрачено' : 'spent'} {sum} / {budget}</div>
      {items.length === 0 && <div className="text-text-dim text-[13px] py-3">{lang === 'ru' ? 'Пусто — добавьте из списка' : 'Empty — add from list'}</div>}
      {items.map((it, i) => (
        <div key={it.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-[5px] border-b border-dashed border-line last:border-0 group">
          <div className="flex items-center gap-1.5 text-[13px] min-w-0">
            <input value={it.name} placeholder="—" onChange={(e) => update(i, { name: e.target.value })} className="bg-transparent border-0 p-0 flex-1 min-w-0 outline-none focus:text-blood2" />
            <button onClick={() => setPath(field, items.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-blood2 px-1 transition-opacity">×</button>
          </div>
          <DotRow value={it.level} onChange={(n) => update(i, { level: n })} />
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5 pt-3">
        {unused.map((p) => (
          <button key={p} onClick={() => add(p)} className="bg-transparent border border-line2 text-text-mute px-2.5 py-1 rounded-sm text-xs hover:text-text hover:border-text-mute transition-colors">{p}</button>
        ))}
        <button onClick={() => add('')} className="bg-transparent border border-line2 text-text-mute px-2.5 py-1 rounded-sm text-xs">+ {lang === 'ru' ? 'своё' : 'custom'}</button>
      </div>
    </div>
  );
}

// V20-flavoured creation hints by step kind (a future system can override these).
const HINTS: Record<WizardStepKind, { ru: string; en: string }> = {
  concept: {
    ru: 'Кто этот вампир? Натура — что им движет внутри. Маска — что он показывает миру.',
    en: 'Who is this vampire? Nature is their inner drive. Demeanor is what they show the world.',
  },
  clanGeneration: {
    ru: 'Клан задаёт стартовые дисциплины и слабость. Поколение определяет запас крови.',
    en: 'Clan sets your starting disciplines and weakness. Generation determines blood pool.',
  },
  attributes: {
    ru: 'Распределите 7 / 5 / 3 точки между Физическими, Социальными, Ментальными. Каждый атрибут стартует с 1.',
    en: 'Distribute 7 / 5 / 3 dots across Physical, Social, Mental. Each attribute starts at 1.',
  },
  abilities: {
    ru: 'Распределите 13 / 9 / 5 точек между Талантами, Навыками, Знаниями. Максимум 3 точки в одной способности.',
    en: 'Distribute 13 / 9 / 5 dots across Talents, Skills, Knowledges. Max 3 dots in any one ability.',
  },
  disciplines: { ru: '3 точки в клановых дисциплинах. Быстрый выбор показывает дисциплины вашего клана (Каитиф — любые).', en: '3 dots in your clan disciplines. Quick-pick shows your clan’s disciplines (Caitiff — any).' },
  backgrounds: { ru: '5 точек. Связи, ресурсы, влияние — то, что у вас есть в мире.', en: '5 dots. Allies, resources, influence — what you have in the world.' },
  virtues: { ru: '7 точек сверх базы 1. От них зависят Человечность и Воля.', en: '7 dots above base 1. They drive Humanity and Willpower.' },
  freebies: { ru: '15 свободных очков на тонкую настройку. Курсы: атрибут 5, способность 2, дисциплина 7, преимущество 1, добродетель 2, воля 1, человечность 2.', en: '15 freebies to fine-tune. Rates: attribute 5, ability 2, discipline 7, background 1, virtue 2, willpower 1, humanity 2.' },
  recap: { ru: 'Проверьте итоги. Можно вернуться и подправить.', en: 'Check the summary. You can go back to adjust.' },
};
