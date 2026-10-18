// Smoke test: the V20 package renders end-to-end through SheetRenderer (SSR, no browser).
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from '@/systems/builtin';
import { newCharacter, setValue } from '@/engine/character';
import { I18nProvider } from '@/i18n/I18nContext';
import { SystemProvider } from '@/ui/context';
import { DiceProvider } from '@/ui/dice/DiceProvider';
import { SheetRenderer } from './SheetRenderer';

const pkg = BUILTIN_PACKAGES.find((p) => p.manifest.id === 'vtm-v20')!;

describe('SheetRenderer', () => {
  it('renders every section of the V20 sheet', () => {
    let ch = newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 'x');
    ch = setValue(ch, 'profile.clan', 'ventrue');
    ch = setValue(ch, 'abilities.brawl', 3);
    ch = setValue(ch, 'specialties.brawl', 'Boxing');
    ch = setValue(ch, 'disciplines', [{ id: 'd', name: '', ref: 'dominate', level: 2 }]);
    const html = renderToString(
      <I18nProvider>
        <SystemProvider pkg={pkg}>
          <DiceProvider values={ch.values}>
            <SheetRenderer values={ch.values} set={() => {}} />
          </DiceProvider>
        </SystemProvider>
      </I18nProvider>,
    );
    for (const s of ['Атрибуты', 'Способности', 'Физические', 'Знания', 'Сила', 'Драка', 'Boxing', 'Доминирование', 'Добродетели', 'Совесть', 'Здоровье', 'Ушиблен', 'Запас крови', 'Человечность', 'Воля', 'Заметки']) {
      expect(html, s).toContain(s);
    }
    expect(html).not.toContain('unknown block');
    expect(html.match(/health-box/g)).toHaveLength(7);
  });
});
