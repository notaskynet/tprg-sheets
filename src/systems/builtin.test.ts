import { describe, expect, it } from 'vitest';
import { BUILTIN_PACKAGES, DEFAULT_SYSTEM_ID } from './builtin';

describe('builtin packages', () => {
  it('bundles and validates every package under /systems', () => {
    expect(BUILTIN_PACKAGES.map((p) => p.manifest.id)).toContain(DEFAULT_SYSTEM_ID);
  });
});
