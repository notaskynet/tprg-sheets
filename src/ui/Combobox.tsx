// Searchable picker with a one-line description under each option. Used for catalog
// selects and for free-text fields that offer suggestions (`allowCustom`).
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/components/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/ui/components/command';
import { cn } from '@/ui/lib/utils';

export interface Option { value: string; label: string; desc?: string }

export function Combobox({ value, display, options, onChange, allowCustom, disabled, className, placeholder }: {
  value: string;
  display?: string; // shown on the trigger (defaults to the matching option's label, else the raw value)
  options: Option[];
  onChange: (value: string, option?: Option) => void;
  allowCustom?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shown = display ?? options.find((o) => o.value === value)?.label ?? value;
  const pick = (v: string, o?: Option) => { onChange(v, o); setOpen(false); setQuery(''); };
  const custom = allowCustom && query.trim() && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger
        disabled={disabled}
        className={cn('flex items-center justify-between gap-2 min-w-0 w-full text-left bg-transparent border-0 border-b border-line2 py-0.5 outline-none focus-visible:border-brand data-[state=open]:border-brand disabled:cursor-default', className)}
      >
        <span className={cn('truncate', !shown && 'text-text-dim')}>{shown || placeholder || '—'}</span>
        {!disabled && <ChevronDown className="size-3.5 shrink-0 text-text-mute print:hidden" />}
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[min(340px,92vw)] bg-surf border-line2">
        <Command>
          <CommandInput value={query} onValueChange={setQuery} placeholder={t('search')} />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{t('noMatch')}</CommandEmpty>
            {options.map((o) => (
              <CommandItem key={o.value} value={`${o.label} ${o.desc ?? ''}`} onSelect={() => pick(o.value, o)} className="items-start gap-2.5 py-2">
                <Check className={cn('size-3.5 mt-1 shrink-0', o.value === value ? 'opacity-100 text-brand-bright' : 'opacity-0')} />
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm">{o.label}</span>
                  {o.desc && <span className="text-xs text-text-mute leading-snug">{o.desc}</span>}
                </span>
              </CommandItem>
            ))}
            {custom && (
              <CommandItem forceMount value={`__custom ${query}`} onSelect={() => pick(query.trim())} className="py-2">
                {t('useCustom')} «{query.trim()}»
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
