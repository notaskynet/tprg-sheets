import { useState } from 'react';
import { Palette } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover';
import { PRESETS, applyAccent, getSavedAccent, saveAccent } from '@/ui/theme';
import { cn } from '@/ui/lib/utils';

export function AccentPicker({ systemAccent }: { systemAccent?: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState<string | null>(getSavedAccent);
  const choose = (hex: string | null) => { setValue(hex); saveAccent(hex); if (!hex) applyAccent(systemAccent); };
  const current = value ?? systemAccent ?? PRESETS[0].hex;
  return (
    <Popover>
      <PopoverTrigger aria-label={t('accentColor')} title={t('accentColor')} className="print-hidden border border-line2 text-text-mute rounded p-1.5 hover:text-text hover:border-text-mute transition-colors">
        <Palette className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 bg-surf border-line2 p-4">
        <div className="eyebrow mb-3">{t('accentColor')}</div>
        <div className="grid grid-cols-6 gap-2 mb-3">
          {PRESETS.map((p) => (
            <button key={p.id} aria-label={p.id} onClick={() => choose(p.hex)} style={{ background: p.hex }}
              className={cn('size-7 rounded-full border-2 transition-transform hover:scale-110', current.toLowerCase() === p.hex ? 'border-text' : 'border-transparent')} />
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-text-mute">
          <input type="color" value={current} onChange={(e) => choose(e.target.value)} className="size-7 bg-transparent border border-line2 rounded cursor-pointer p-0" />
          {t('customColor')}
        </label>
        {value && <button onClick={() => choose(null)} className="mt-3 text-xs text-text-dim hover:text-text">{t('resetColor')}</button>}
      </PopoverContent>
    </Popover>
  );
}
