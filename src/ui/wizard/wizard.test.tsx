// Smoke test: every V20 creation step renders (SSR) with its title, hint and body.
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from '@/systems/builtin';
import { newCharacter, setValue } from '@/engine/character';
import { I18nProvider } from '@/i18n/I18nContext';
import { SystemProvider } from '@/ui/context';
import { Wizard } from './Wizard';

const pkg = BUILTIN_PACKAGES.find((p) => p.manifest.id === 'vtm-v20')!;

function render(step: number, patch: Record<string, unknown> = {}) {
  let ch = newCharacter(pkg.model, { id: pkg.manifest.id, version: pkg.manifest.version }, 'x');
  ch = { ...ch, creation: { step, done: false } };
  for (const [k, v] of Object.entries(patch)) ch = setValue(ch, k, v);
  return renderToString(
    <I18nProvider>
      <SystemProvider pkg={pkg}>
        <Wizard ch={ch} set={() => {}} onStep={() => {}} onFinish={() => {}} onExit={() => {}} />
      </SystemProvider>
    </I18nProvider>,
  );
}

describe('Wizard', () => {
  it('renders every step with title and hint', () => {
    pkg.creation.steps.forEach((s, i) => {
      const html = render(i);
      expect(html, s.id).toContain(pkg.locales.ru[`steps.${s.id}`]);
      expect(html, s.id).toContain(pkg.locales.ru[`hints.${s.id}`].slice(0, 20));
    });
  });

  it('shows budgets and validity messages', () => {
    expect(render(2)).toContain('0/0/0 → 7/5/3'); // attributes untouched
    expect(render(2, { 'attributes.strength': 5, 'attributes.stamina': 3 })).toContain('6/0/0');
    expect(render(1, { 'profile.clan': 'brujah' })).toContain('Запас крови'); // show = bloodMax
    expect(render(4, { 'profile.clan': 'brujah' })).toContain('0/3'); // disciplines
    expect(render(7)).toContain('0/15'); // freebies
  });

  it('recap lists unresolved checks for a blank character', () => {
    const html = render(8);
    expect(html).toContain('не закрыто');
    expect(html).toContain('Имя');
  });
});
