// The character sheet — system-driven, two/three-column paper layout. Reads
// catalogs/rules from the active system; renders read-only when `readOnly` is set.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Character, TraitItem } from '@/domain/character';
import { useSystem } from '@/domain/SystemContext';
import { useI18n } from '@/i18n/I18nContext';
import { AVAILABLE_LANGS } from '@/i18n/lang';
import type { CheckItem } from '@/systems/types';
import { DotRow, SavePill, type SaveState } from './primitives';
import { HealthTrack, PoolTrack, AdaptivePool } from './tracks';
import { SheetActions } from './SheetActions';
import { disciplinePreset } from '@/domain/disciplines';

export function Sheet({ ch, setPath, setCh, saveState, onNewCharacter, onBack, readOnly, readOnlyBanner }: {
  ch: Character;
  setPath: (path: string, value: unknown) => void;
  setCh: (next: Character) => void;
  saveState: SaveState;
  onNewCharacter: () => void;
  onBack: () => void;
  readOnly?: boolean;
  readOnlyBanner?: ReactNode;
}) {
  const { system, label } = useSystem();
  const { t, lang, setLang, name } = useI18n();
  const { rules } = system;

  const humanity = rules.deriveHumanity(ch);
  const [bpMax, bpPerTurn] = rules.bloodPoolFor(ch.profile.generation || 13);
  const checklist = rules.validateCharacter(ch, lang);
  const okCount = checklist.filter((c) => c.ok).length;
  const allOk = okCount === checklist.length;

  return (
    <div className={readOnly ? 'pointer-events-none [&_a]:pointer-events-auto' : ''}>
      {readOnlyBanner && (
        <div className="sticky top-0 z-50 px-6 py-2.5 bg-gold/10 border-b border-gold/30 text-gold font-mono text-[11px] tracking-[0.12em] uppercase text-center backdrop-blur">
          {readOnlyBanner}
        </div>
      )}

      <div className="print-sheet max-w-[1200px] mx-auto px-4 sm:px-9 pt-6 sm:pt-8 pb-[60px] flex flex-col gap-[26px]">
        {/* Title plate */}
        <header className="flex flex-col gap-3.5">
          <div className="h-0.5 bg-text" />
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3">
            <div className="flex items-center gap-3.5 min-w-0 pointer-events-auto">
              {!readOnly && (
                <button
                  onClick={onBack}
                  className="print-hidden inline-flex items-center gap-1.5 bg-transparent border border-line2 text-text-mute rounded px-2.5 py-[5px] text-[11px] hover:text-text hover:border-text-mute transition-colors shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M10 3L5 8l5 5" /></svg>
                  {t('myCharacters')}
                </button>
              )}
              <div className="hidden lg:block font-mono text-[10px] tracking-[0.3em] text-text-mute truncate">VAMPIRE · THE MASQUERADE · V20</div>
            </div>
            <div className="print-hidden flex items-center gap-2.5 pointer-events-auto">
              <span className="hidden sm:inline-flex">
                <SavePill state={saveState} labels={{ saving: label('saving'), saved: label('saved'), offline: label('offline') }} />
              </span>
              <LangToggle lang={lang} onChange={setLang} />
              {!readOnly && <ChecklistButton checklist={checklist} okCount={okCount} allOk={allOk} title={label('checklist')} />}
              {!readOnly && <SheetActions ch={ch} onImport={setCh} onNewCharacter={onNewCharacter} onBack={onBack} />}
            </div>
          </div>
          <div className="flex items-end">
            <input
              className="bg-transparent border-0 outline-none font-display text-5xl print:text-3xl font-medium leading-none flex-1 min-w-0 placeholder:text-text-dim placeholder:italic"
              value={ch.profile.name}
              onChange={(e) => setPath('profile.name', e.target.value)}
              placeholder={lang === 'ru' ? 'Безымянный' : 'Unnamed'}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 print:grid-cols-4 gap-x-[26px] gap-y-4">
            <PlateField label={label('player')} value={ch.profile.player} onChange={(v) => setPath('profile.player', v)} />
            <PlateField label={label('chronicle')} value={ch.profile.chronicle} onChange={(v) => setPath('profile.chronicle', v)} />
            <PlateField label={label('concept')} value={ch.profile.concept} onChange={(v) => setPath('profile.concept', v)} />
            <PlateField
              label={label('clan')}
              value={ch.profile.clan}
              onChange={(v) => setPath('profile.clan', v)}
              options={system.clans.map((c) => ({ value: c.id, label: name(c.name) }))}
            />
            <PlateField label={label('generation')} type="number" value={String(ch.profile.generation)} onChange={(v) => setPath('profile.generation', Number(v))} />
            <PlateField label={label('nature')} value={ch.profile.nature} onChange={(v) => setPath('profile.nature', v)} list="archetypes" />
            <PlateField label={label('demeanor')} value={ch.profile.demeanor} onChange={(v) => setPath('profile.demeanor', v)} list="archetypes" />
            <PlateField label={label('sire')} value={ch.profile.sire} onChange={(v) => setPath('profile.sire', v)} />
          </div>
          <div className="h-px bg-line" />
          <datalist id="archetypes">
            {system.archetypes.map((a, i) => <option key={i} value={name(a.name)} />)}
          </datalist>
        </header>

        {/* Attributes */}
        <Triad title={label('attributes')}>
          {system.attributeCategories.map((cat) => (
            <TriadCol key={cat} sub={label(cat)}>
              {system.attributes.filter((a) => a.cat === cat).map((a) => (
                <NamedDots key={a.id} label={name(a.name)} value={ch.attributes[a.id] ?? 1} onChange={(n) => setPath(`attributes.${a.id}`, Math.max(1, n))} />
              ))}
            </TriadCol>
          ))}
        </Triad>

        {/* Abilities */}
        <Triad title={label('abilities')}>
          {system.abilityCategories.map((cat) => (
            <TriadCol key={cat} sub={label(cat)}>
              {system.abilities.filter((a) => a.cat === cat).map((a) => (
                <NamedDots
                  key={a.id}
                  label={name(a.name)}
                  specialty={ch.specialties[a.id] || ''}
                  value={ch.abilities[a.id] ?? 0}
                  onChange={(n) => setPath(`abilities.${a.id}`, n)}
                />
              ))}
            </TriadCol>
          ))}
        </Triad>

        {/* Advantages */}
        <Triad title={label('advantages')}>
          <TriadCol sub={label('disciplines')}>
            <ItemList items={ch.disciplines} onChange={(it) => setPath('disciplines', it)} preset={disciplinePreset(system, ch.profile.clan, name)} addLabel={label('addItem')} />
          </TriadCol>
          <TriadCol sub={label('backgrounds')}>
            <ItemList items={ch.backgrounds} onChange={(it) => setPath('backgrounds', it)} preset={system.backgrounds.map((b) => name(b.name))} addLabel={label('addItem')} />
          </TriadCol>
          <TriadCol sub={label('virtues')}>
            {system.virtues.map((v) => (
              <NamedDots key={v.id} label={name(v.name)} value={ch.virtues[v.id] ?? 1} onChange={(n) => setPath(`virtues.${v.id}`, Math.max(1, n))} />
            ))}
          </TriadCol>
        </Triad>

        {/* State strip */}
        <section className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-7 print:gap-x-5 print:gap-y-0 pt-1.5">
          <div className="flex flex-col gap-1.5">
            <CHeader title={label('health')} />
            <HealthTrack health={ch.health} levels={system.healthLevels} labelFor={label} onChange={(h) => setPath('health', h)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <CHeader title={label('humanity')} />
            <div className="flex items-center gap-2.5">
              <DotRow value={humanity} max={10} />
              <span className="font-mono text-sm text-text-mute">{humanity}</span>
            </div>
            <div className="eyebrow mt-1">{lang === 'ru' ? 'Совесть + Самоконтроль' : 'Conscience + Self-Control'}</div>

            <div className="mt-[18px]">
              <CHeader title={label('willpower')} small />
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-[80px_1fr] gap-3 items-center">
                  <div className="eyebrow">{lang === 'ru' ? 'постоянная' : 'permanent'}</div>
                  <DotRow
                    value={ch.willpowerPermanent}
                    max={10}
                    onChange={(n) => {
                      setPath('willpowerPermanent', n);
                      if (ch.willpowerCurrent > n) setPath('willpowerCurrent', n);
                    }}
                  />
                </div>
                <div className="grid grid-cols-[80px_1fr] gap-3 items-center">
                  <div className="eyebrow">{lang === 'ru' ? 'текущая' : 'current'}</div>
                  <PoolTrack value={ch.willpowerCurrent} max={Math.max(ch.willpowerPermanent, 1)} onChange={(n) => setPath('willpowerCurrent', n)} kind="willpower" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <CHeader title={label('bloodPool')} />
            <AdaptivePool
              value={ch.blood}
              max={bpMax}
              onChange={(n) => setPath('blood', n)}
              kind="blood"
              perTurnHint={`${lang === 'ru' ? 'за ход: ' : 'per turn: '}${bpPerTurn} · ${lang === 'ru' ? 'поколение ' : 'gen. '}${ch.profile.generation}`}
            />
            <div className="mt-[18px]">
              <CHeader title={label('experience')} small />
              <div className="grid grid-cols-2 gap-3.5">
                <PlateField label={lang === 'ru' ? 'Всего' : 'Total'} type="number" value={String(ch.experience.total)} onChange={(v) => setPath('experience.total', Number(v))} />
                <PlateField label={lang === 'ru' ? 'Потрач.' : 'Spent'} type="number" value={String(ch.experience.spent)} onChange={(v) => setPath('experience.spent', Number(v))} />
              </div>
            </div>
            <div className="mt-3">
              <PlateField label={label('weakness')} value={ch.weakness} onChange={(v) => setPath('weakness', v)} />
            </div>
          </div>
        </section>

        {/* Notes */}
        <section>
          <CHeader title={label('notes')} />
          <textarea
            className="w-full min-h-40 bg-bg border border-line rounded text-text p-3 text-[13px] leading-relaxed outline-none resize-y focus:border-blood"
            value={ch.notes}
            onChange={(e) => setPath('notes', e.target.value)}
            placeholder={lang === 'ru' ? 'История, события, контакты…' : 'Backstory, events, contacts…'}
          />
        </section>
      </div>
    </div>
  );
}

// ---------- Sheet sub-components ----------

function NamedDots({ label, value, onChange, specialty, max = 5 }: {
  label: string; value: number; onChange: (v: number) => void; specialty?: string; max?: number;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-[5px] print:py-[2px] border-b border-dashed border-line last:border-0">
      <span className="flex items-baseline gap-1.5 text-[13px] min-w-0">
        {label}
        {specialty ? <span className="text-[10px] text-text-dim italic">({specialty})</span> : null}
      </span>
      <DotRow value={value} max={max} onChange={onChange} />
    </div>
  );
}

function Triad({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-3.5">
        <h2 className="font-display text-xl font-medium">{title}</h2>
        <div className="flex-1 h-px bg-line mx-1" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-7 print:gap-x-5 print:gap-y-0 items-start">{children}</div>
    </section>
  );
}

function TriadCol({ sub, children }: { sub: string; children: ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{sub}</div>
      {children}
    </div>
  );
}

function CHeader({ title, small }: { title: string; small?: boolean }) {
  return (
    <div className="flex items-baseline gap-2.5 mb-2">
      <span className={`font-display font-medium ${small ? 'text-[15px]' : 'text-xl'}`}>{title}</span>
      <div className="flex-1 h-px bg-line mx-1" />
    </div>
  );
}

function PlateField({ label, value, onChange, type = 'text', options, list }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  options?: { value: string; label: string }[]; list?: string;
}) {
  const input = 'bg-transparent border-0 border-b border-line2 text-text py-0.5 outline-none font-display text-[17px] font-medium focus:border-blood min-w-0 w-full';
  return (
    <div className="flex flex-col gap-[3px] min-w-[100px]">
      <span className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-text-mute">{label}</span>
      {options ? (
        <select className={input + ' field-select cursor-pointer font-body text-sm'} value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {options.map((o) => <option key={o.value} value={o.value} className="bg-surf text-text">{o.label}</option>)}
        </select>
      ) : (
        <input className={input} type={type} value={value || ''} list={list} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function LangToggle({ lang, onChange }: { lang: string; onChange: (l: string) => void }) {
  return (
    <div className="inline-flex p-0.5 border border-line2 rounded font-mono text-[11px]">
      {AVAILABLE_LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code)}
          className={`px-2 py-1 rounded-[3px] transition-colors ${l.code === lang ? 'bg-text text-bg' : 'text-text-mute hover:text-text'}`}
        >
          {l.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function ChecklistButton({ checklist, okCount, allOk, title }: {
  checklist: CheckItem[]; okCount: number; allOk: boolean; title: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title={`${title} — ${okCount}/${checklist.length}`}
        className={`inline-flex items-center gap-1.5 bg-transparent border rounded px-2.5 py-[5px] font-mono text-[11px] cursor-pointer transition-colors hover:bg-surf ${allOk ? 'border-line2 text-text' : 'border-blood/45 text-blood2'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${allOk ? 'bg-good' : 'bg-blood'}`} />
        {okCount}/{checklist.length}
      </button>
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-[340px] max-w-[86vw] bg-surf border border-line2 rounded-md p-4 z-[100] shadow-[0_14px_40px_rgba(0,0,0,.55)]">
          <div className="flex items-baseline gap-2 mb-3 pb-2.5 border-b border-line">
            <h3 className="font-display text-lg font-medium m-0 flex-1">{title}</h3>
            <span className={`font-mono text-[10px] tracking-wider px-1.5 py-0.5 rounded-sm border ${allOk ? 'bg-good/20 text-good border-good/35' : 'bg-blood/15 text-blood2 border-blood/35'}`}>
              {okCount}/{checklist.length}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {checklist.map((c) => (
              <div key={c.id} className="grid grid-cols-[16px_1fr_auto] items-center gap-2 py-1.5 text-xs">
                <span className={`w-4 h-4 rounded-full border inline-flex items-center justify-center text-[10px] ${c.ok ? 'bg-good border-good text-white' : 'bg-blood border-blood text-white'}`}>
                  {c.ok ? '✓' : '!'}
                </span>
                <span className="text-text min-w-0 leading-tight">{c.label}</span>
                {c.val != null && (
                  <span className="font-mono text-[10.5px] text-text-dim text-right whitespace-nowrap tabular-nums">
                    {c.val}{c.need ? ` / ${c.need}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemList({ items, onChange, preset, addLabel }: {
  items: TraitItem[]; onChange: (items: TraitItem[]) => void; preset: string[]; addLabel: string;
}) {
  const { lang } = useI18n();
  const [picker, setPicker] = useState(false);

  function add(name: string) {
    onChange([...items, { id: 'i_' + Date.now(), name, level: 1 }]);
    setPicker(false);
  }
  function update(i: number, patch: Partial<TraitItem>) {
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  const unused = preset.filter((p) => !items.some((it) => it.name === p));

  return (
    <div>
      {items.length === 0 && <div className="text-text-dim text-xs py-1.5">—</div>}
      {items.map((it, i) => (
        <div key={it.id} className="grid grid-cols-[1fr_auto] items-center gap-2.5 py-[5px] border-b border-dashed border-line last:border-0 group">
          <div className="flex items-center gap-1.5 text-[13px] min-w-0">
            <input
              value={it.name}
              placeholder="—"
              onChange={(e) => update(i, { name: e.target.value })}
              className="bg-transparent border-0 p-0 flex-1 min-w-0 outline-none focus:text-blood2"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-blood2 p-1 transition-opacity"
              title="remove"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
          <DotRow value={it.level} onChange={(n) => update(i, { level: n })} />
        </div>
      ))}
      <div className="pt-2.5">
        {picker ? (
          <div className="flex flex-wrap gap-1.5">
            {unused.map((p) => (
              <button key={p} onClick={() => add(p)} className="bg-transparent border border-line2 text-text-mute px-2.5 py-1 rounded-sm text-xs hover:text-text hover:border-text-mute transition-colors">{p}</button>
            ))}
            <button onClick={() => add('')} className="bg-transparent border border-line2 text-text-mute px-2.5 py-1 rounded-sm text-xs">{lang === 'ru' ? '+ своё' : '+ custom'}</button>
            <button onClick={() => setPicker(false)} className="bg-transparent border-0 text-text-dim px-1.5 py-1 text-xs">×</button>
          </div>
        ) : (
          <button onClick={() => setPicker(true)} className="bg-transparent border-0 text-text-dim text-xs py-1 hover:text-text transition-colors">+ {addLabel.toLowerCase()}</button>
        )}
      </div>
    </div>
  );
}
