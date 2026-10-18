import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES } from './builtin';

describe('builtin packages', () => {
  it('bundles and validates every package under /systems', () => {
    expect(BUILTIN_PACKAGES.map((p) => p.manifest.id)).toEqual(expect.arrayContaining(['vtm-v20', 'dnd5e-srd', 'coc7']));
  });
});
