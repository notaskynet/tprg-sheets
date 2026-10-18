import { describe, expect, it } from 'vitest';
import { deriveAccent } from './theme';

describe('deriveAccent', () => {
  it('keeps the brand colour and brightens the hover shade', () => {
    const a = deriveAccent('#a01e2e');
    expect(a.brand).toBe('#a01e2e');
    expect(a.bright).not.toBe(a.brand);
    expect(a.onBrand).toBe('#ffffff');
  });
  it('switches to dark text on light colours', () => {
    expect(deriveAccent('#f2d16b').onBrand).toBe('#14121a');
  });
});
