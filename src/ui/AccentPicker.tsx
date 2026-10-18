import { useEffect, useState } from 'react';
import { Check, Palette, Plus, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover';
import { ColorPicker } from '@/ui/ColorPicker';
import { PRESETS, applyAccent, getSavedAccent, getSavedColors, hexToHsv, saveAccent, setSavedColors, type Hsv } from '@/ui/theme';
import { cn } from '@/ui/lib/utils';

const HEX = /^#[0-9a-f]{6}$/i;
const swatch = 'relative size-9 rounded-full inline-flex items-center justify-center ring-offset-2 ring-offset-surf transition-transform hover:scale-105';

export function AccentPicker({ systemAccent }: { systemAccent?: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState<string | null>(getSavedAccent);
  const [mine, setMine] = useState<string[]>(getSavedColors);
  const current = (value ?? systemAccent ?? PRESETS[0].hex).toLowerCase();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current));
  const [draft, setDraft] = useState(current);

  // Keep the HSV handle (hue survives s=0 / v=0) unless the colour was changed from outside.
  useEffect(() => { setDraft(current); }, [current]);

  const choose = (hex: string | null, nextHsv?: Hsv) => {
    setValue(hex);
    saveAccent(hex);
    if (!hex) applyAccent(systemAccent);
    const eff = (hex ?? systemAccent ?? PRESETS[0].hex).toLowerCase();
    setHsv(nextHsv ?? hexToHsv(eff));
  };

  const known = PRESETS.some((p) => p.hex === current) || mine.includes(current);
  const updateMine = (list: string[]) => { setMine(list); setSavedColors(list); };

  const Swatch = ({ hex, onRemove }: { hex: string; onRemove?: () => void }) => (
    <span className="relative group">
      <button aria-label={hex} onClick={() => choose(hex)} style={{ background: hex }} className={cn(swatch, current === hex && 'ring-2 ring-text')}>
        {current === hex && <Check className="size-4 text-white drop-shadow" />}
      </button>
      {onRemove && (
        <button aria-label="remove" onClick={onRemove} className="absolute -top-1 -right-1 size-4 rounded-full bg-ink border border-line2 text-text-mute hover:text-text hidden group-hover:inline-flex items-center justify-center">
          <X className="size-2.5" />
        </button>
      )}
    </span>
  );

  return (
    <Popover>
      <PopoverTrigger aria-label={t('accentColor')} title={t('accentColor')} className="print-hidden border border-line2 text-text-mute rounded p-1.5 hover:text-text hover:border-text-mute transition-colors">
        <Palette className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[288px] bg-surf border-line2 p-4 flex flex-col gap-4">
        <div className="eyebrow">{t('accentColor')}</div>

        <div className="flex flex-wrap gap-3">{PRESETS.map((p) => <Swatch key={p.id} hex={p.hex} />)}</div>

        {mine.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="eyebrow">{t('myColors')}</div>
            <div className="flex flex-wrap gap-3">
              {mine.map((hex) => <Swatch key={hex} hex={hex} onRemove={() => updateMine(mine.filter((m) => m !== hex))} />)}
            </div>
          </div>
        )}

        <ColorPicker hsv={hsv} onChange={(next, hex) => choose(hex, next)} />

        <div className="flex items-center gap-2">
          <span className="size-9 rounded-md shrink-0 border border-line2" style={{ background: current }} />
          <input
            value={draft}
            spellCheck={false}
            maxLength={7}
            onChange={(e) => { setDraft(e.target.value); if (HEX.test(e.target.value)) choose(e.target.value.toLowerCase()); }}
            className="flex-1 min-w-0 h-9 bg-ink border border-line2 rounded-md px-2.5 font-mono text-sm uppercase outline-none focus:border-brand"
          />
          <button
            onClick={() => updateMine([current, ...mine.filter((m) => m !== current)])}
            disabled={known}
            title={t('saveColor')}
            aria-label={t('saveColor')}
            className="size-9 shrink-0 rounded-md border border-line2 text-text-mute inline-flex items-center justify-center hover:text-text hover:border-text-mute disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <button
          onClick={() => choose(null)}
          disabled={!value}
          className="h-9 rounded-md border border-line2 text-xs text-text-mute hover:text-text hover:border-text-mute disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          {t('resetColor')}
        </button>
      </PopoverContent>
    </Popover>
  );
}
