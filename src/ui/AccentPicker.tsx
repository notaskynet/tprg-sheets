import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover';
import { PRESETS, applyAccent, getSavedAccent, saveAccent } from '@/ui/theme';
import { cn } from '@/ui/lib/utils';

const HEX = /^#[0-9a-f]{6}$/i;

export function AccentPicker({ systemAccent }: { systemAccent?: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState<string | null>(getSavedAccent);
  const current = (value ?? systemAccent ?? PRESETS[0].hex).toLowerCase();
  const [draft, setDraft] = useState(current);
  const custom = !PRESETS.some((p) => p.hex === current);

  const choose = (hex: string | null) => {
    setValue(hex);
    saveAccent(hex);
    if (!hex) applyAccent(systemAccent);
    setDraft((hex ?? systemAccent ?? PRESETS[0].hex).toLowerCase());
  };

  return (
    <Popover>
      <PopoverTrigger aria-label={t('accentColor')} title={t('accentColor')} className="print-hidden border border-line2 text-text-mute rounded p-1.5 hover:text-text hover:border-text-mute transition-colors">
        <Palette className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[268px] bg-surf border-line2 p-4 flex flex-col gap-4">
        <div className="eyebrow">{t('accentColor')}</div>

        <div className="grid grid-cols-4 gap-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              aria-label={p.id}
              onClick={() => choose(p.hex)}
              style={{ background: p.hex }}
              className={cn('relative size-10 rounded-full inline-flex items-center justify-center ring-offset-2 ring-offset-surf transition-transform hover:scale-105', current === p.hex && 'ring-2 ring-text')}
            >
              {current === p.hex && <Check className="size-4 text-white drop-shadow" />}
            </button>
          ))}
          {/* Custom colour: a rainbow swatch with the native picker laid over it. */}
          <label
            title={t('customColor')}
            style={{ background: custom ? current : 'conic-gradient(from 0deg, #e5484d, #f5a524, #46a758, #3e63dd, #8e4ec6, #e5484d)' }}
            className={cn('relative size-10 rounded-full inline-flex items-center justify-center cursor-pointer ring-offset-2 ring-offset-surf transition-transform hover:scale-105', custom && 'ring-2 ring-text')}
          >
            {custom && <Check className="size-4 text-white drop-shadow" />}
            <input type="color" value={current} onChange={(e) => choose(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={t('customColor')} />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <span className="size-6 rounded shrink-0 border border-line2" style={{ background: current }} />
          <input
            value={draft}
            spellCheck={false}
            maxLength={7}
            onChange={(e) => { setDraft(e.target.value); if (HEX.test(e.target.value)) choose(e.target.value.toLowerCase()); }}
            className="flex-1 min-w-0 bg-ink border border-line2 rounded-md h-9 px-2.5 font-mono text-sm uppercase outline-none focus:border-brand"
          />
          <button
            onClick={() => choose(null)}
            disabled={!value}
            className="h-9 px-3 rounded-md border border-line2 text-xs text-text-mute hover:text-text hover:border-text-mute disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {t('resetColor')}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
