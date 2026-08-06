import { describe, expect, it } from 'vitest';
import { typeSuffixFor } from './model-panel';

const node = (displayName: string, nodeType: string) => ({ displayName, nodeType });

describe('typeSuffixFor', () => {
  it('says nothing when the name is already the type', () => {
    // The regression: three of the first four rows in every project read
    // "Site Site", "Building Building", "Level 1 Level", and a screen reader
    // announced the stutter too.
    expect(typeSuffixFor(node('Site', 'Site'))).toBeNull();
    expect(typeSuffixFor(node('Building', 'Building'))).toBeNull();
    expect(typeSuffixFor(node('Level 1', 'Level'))).toBeNull();
  });

  it('says nothing when the name already contains the type as a word', () => {
    expect(typeSuffixFor(node('Interior Wall 100mm', 'Wall'))).toBeNull();
    expect(typeSuffixFor(node('Room 4.20 x 3.60', 'Room'))).toBeNull();
    expect(typeSuffixFor(node('Fixture wall 12', 'Wall'))).toBeNull();
  });

  it('names the type when a coded name does not', () => {
    // The case the suffix exists for. Suppressing it here would lose the only
    // indication of what the row is.
    expect(typeSuffixFor(node('W-101', 'Wall'))).toBe('Wall');
    expect(typeSuffixFor(node('A-201', 'Sheet'))).toBe('Sheet');
  });

  it('matches whole words only, so a substring does not suppress the type', () => {
    // "Walkway" contains "wal" but is not a wall, and a reader needs to be told.
    expect(typeSuffixFor(node('Walkway north', 'Wall'))).toBe('Wall');
    expect(typeSuffixFor(node('Doorway detail', 'Door'))).toBe('Door');
  });

  it('does not treat a type containing regex characters as a pattern', () => {
    expect(typeSuffixFor(node('Generic model', 'Model (2D)'))).toBe('Model (2D)');
  });
});
