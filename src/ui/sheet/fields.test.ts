import { describe, expect, it } from 'vitest';
import { clampNumber, parseNumber } from './fields';

describe('number input helpers', () => {
  it('parses typed text', () => {
    expect(parseNumber('12')).toBe(12);
    expect(parseNumber('1,5')).toBe(1.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('-')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
  it('clamps into soft limits', () => {
    expect(clampNumber(0, 4, 15)).toBe(4);
    expect(clampNumber(-1, 4, 15)).toBe(4);
    expect(clampNumber(99, 4, 15)).toBe(15);
    expect(clampNumber(9, 4, 15)).toBe(9);
    expect(clampNumber(-50)).toBe(-50);
  });
});
