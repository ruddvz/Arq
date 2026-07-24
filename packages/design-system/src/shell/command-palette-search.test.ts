import { describe, expect, it } from 'vitest';
import { searchCommandPaletteEntries, type CommandPaletteEntry } from './command-palette-search';

const ENTRIES: readonly CommandPaletteEntry[] = [
  { id: 'wall-draw', label: 'Wall draw', category: 'Draw' },
  { id: 'sidewalk-allowance', label: 'Sidewalk allowance', category: 'Settings' },
  { id: 'window-insert', label: 'Insert window', category: 'Build', synonyms: ['fenestration'] },
  { id: 'export-dxf', label: 'Export DXF', category: 'File', disabledReason: 'No project open' },
];

describe('searchCommandPaletteEntries', () => {
  it('returns every entry, in input order, for an empty query', () => {
    const matches = searchCommandPaletteEntries(ENTRIES, '');
    expect(matches.map((m) => m.entry.id)).toEqual([
      'wall-draw',
      'sidewalk-allowance',
      'window-insert',
      'export-dxf',
    ]);
  });

  it('matches non-contiguous characters in order (fuzzy, not substring)', () => {
    const matches = searchCommandPaletteEntries(ENTRIES, 'wldr');
    expect(matches.map((m) => m.entry.id)).toContain('wall-draw');
  });

  it('ranks a tighter, earlier match above a looser one for the same query', () => {
    const matches = searchCommandPaletteEntries(ENTRIES, 'wall');
    const ids = matches.map((m) => m.entry.id);
    expect(ids.indexOf('wall-draw')).toBeLessThan(ids.indexOf('sidewalk-allowance'));
  });

  it('matches a synonym even when the label does not contain the query', () => {
    const matches = searchCommandPaletteEntries(ENTRIES, 'fenestr');
    expect(matches.map((m) => m.entry.id)).toContain('window-insert');
  });

  it('excludes entries with no matching characters', () => {
    const matches = searchCommandPaletteEntries(ENTRIES, 'zzz');
    expect(matches).toEqual([]);
  });

  it('carries the category and disabledReason through unchanged', () => {
    const matches = searchCommandPaletteEntries(ENTRIES, 'export');
    const match = matches.find((m) => m.entry.id === 'export-dxf');
    expect(match?.entry.category).toBe('File');
    expect(match?.entry.disabledReason).toBe('No project open');
  });

  it('is case-insensitive', () => {
    const matches = searchCommandPaletteEntries(ENTRIES, 'WALL');
    expect(matches.map((m) => m.entry.id)).toContain('wall-draw');
  });
});
