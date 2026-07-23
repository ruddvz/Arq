import { describe, expect, it } from 'vitest';
import { tokenizeDxf } from './dxf-tokenizer';

describe('tokenizeDxf', () => {
  it('pairs alternating code/value lines', () => {
    const content = '0\nSECTION\n2\nHEADER\n0\nENDSEC\n';
    expect(tokenizeDxf(content)).toEqual([
      { code: 0, value: 'SECTION' },
      { code: 2, value: 'HEADER' },
      { code: 0, value: 'ENDSEC' },
    ]);
  });

  it('trims whitespace from both code and value lines', () => {
    const content = '  0  \n  LINE  \n';
    expect(tokenizeDxf(content)).toEqual([{ code: 0, value: 'LINE' }]);
  });

  it('handles CRLF line endings', () => {
    const content = '0\r\nSECTION\r\n2\r\nENTITIES\r\n';
    expect(tokenizeDxf(content)).toEqual([
      { code: 0, value: 'SECTION' },
      { code: 2, value: 'ENTITIES' },
    ]);
  });

  it('skips a non-numeric code line rather than throwing', () => {
    const content = 'not-a-code\nvalue\n0\nLINE\n';
    expect(() => tokenizeDxf(content)).not.toThrow();
  });

  it('returns an empty array for empty content', () => {
    expect(tokenizeDxf('')).toEqual([]);
  });

  it('ignores a final unpaired trailing line', () => {
    const content = '0\nSECTION\n2';
    expect(tokenizeDxf(content)).toEqual([{ code: 0, value: 'SECTION' }]);
  });
});
