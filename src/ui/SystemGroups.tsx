// A list of game systems grouped by family (World of Darkness, d20 ...) with a text search and tag
// filter. The filters only show up once there are enough systems for them to matter.
import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { useI18n } from '@/i18n/I18nContext';
import { localize } from '@/i18n/lang';
import type { SystemPackage } from '@/engine/schema';
import { cn } from '@/ui/lib/utils';

const FILTER_FROM = 5;

export function SystemGroups({ packages, children }: { packages: SystemPackage[]; children: (p: SystemPackage) => ReactNode }) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => [...new Set(packages.flatMap((p) => p.manifest.tags ?? []))].sort(), [packages]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, SystemPackage[]>();
    for (const p of packages) {
      const m = p.manifest;
      if (tag && !(m.tags ?? []).includes(tag)) continue;
      const hay = [localize(m.name, lang), m.id, m.author ?? '', ...(m.tags ?? []), m.family ? localize(m.family, lang) : ''].join(' ').toLowerCase();
      if (q && !hay.includes(q)) continue;
      const key = m.family ? localize(m.family, lang) : '';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    // Named families alphabetically, systems without a family last.
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, lang)));
  }, [packages, query, tag, lang]);

  const showFilters = packages.length >= FILTER_FROM;
  const named = groups.some(([k]) => k !== '');
  return (
    <div className="flex flex-col gap-4">
      {showFilters && (
        <div className="flex flex-col gap-2">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-dim" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchSystems')} className="h-10 w-full rounded-md border border-line2 bg-ink pl-9 pr-3 text-sm outline-none focus:border-brand" />
          </label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((x) => (
                <button key={x} onClick={() => setTag(tag === x ? null : x)} className={cn('rounded-full border px-2.5 py-0.5 text-[11px] transition-colors', tag === x ? 'border-brand bg-brand/15 text-text' : 'border-line2 text-text-mute hover:text-text')}>{x}</button>
              ))}
            </div>
          )}
        </div>
      )}
      {groups.length === 0 && <p className="text-sm text-text-dim">{t('noSystemsFound')}</p>}
      {groups.map(([family, list]) => (
        <section key={family} className="flex flex-col gap-2">
          {named && <h3 className="eyebrow">{family || t('otherSystems')}</h3>}
          {list.map((p) => <div key={p.manifest.id}>{children(p)}</div>)}
        </section>
      ))}
    </div>
  );
}
