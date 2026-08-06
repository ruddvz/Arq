import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A control whose only child is a glyph has no accessible name.
 *
 * This is not hypothetical here. Swapping the project bar's words for marks
 * took the name off "Open" with the word, so the button announced nothing, and
 * nothing failed: the component rendered, the icon drew, every unit test
 * passed. It surfaced only because a browser check could no longer find a
 * control by name - which is the blueprint's "no mystery icons" rule failing in
 * the most literal way, and one step from shipping.
 *
 * Asserted against the source rather than a rendered tree because this package
 * tests in Node without a DOM. That is a real limit: this proves the attribute
 * is written, not that the browser computes the name from it. It is still the
 * check that would have caught the regression.
 */
const SOURCE = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'top-bar.tsx'),
  'utf8',
);

describe('project bar controls', () => {
  it('names every button that can render a glyph instead of a word', () => {
    // Each `<button …>` block, split on the opening tag.
    const buttons = SOURCE.split(/<button\b/).slice(1);
    const iconOnly = buttons.filter((block) =>
      block.slice(0, block.indexOf('</button>')).includes('actionIcons?.'),
    );

    expect(iconOnly.length).toBeGreaterThan(0);
    for (const block of iconOnly) {
      const open = block.slice(0, block.indexOf('>'));
      expect(open).toMatch(/aria-label=/);
    }
  });
});
