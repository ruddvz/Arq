import { describe, expect, it } from 'vitest';
import { lineTreatmentForToken } from './canvas2d-paint';
import type { StyleToken } from './plan-scene';

const ALL_TOKENS: readonly StyleToken[] = [
  'default',
  'hover',
  'active-tool',
  'selected-primary',
  'selected-secondary',
  'locked',
  'warning',
  'error',
  'imported',
  'proposed',
];

describe('lineTreatmentForToken', () => {
  it('defines a treatment for every style token', () => {
    for (const token of ALL_TOKENS) {
      const treatment = lineTreatmentForToken(token);
      expect(treatment.weight).toBeTruthy();
      expect(Array.isArray(treatment.dashCssPx)).toBe(true);
    }
  });

  it('never uses hue as the only signal: every non-default state differs from default in weight or pattern', () => {
    // DESIGN-SYSTEM.md: "Status must use icon, text, pattern and line
    // treatment. Hue cannot be the only signal." active-tool is the one
    // deliberate exception on the canvas: the live draft is exactly a
    // default-weight line whose colour signals "in progress", and its
    // second signal is the rubber-band motion itself.
    const base = lineTreatmentForToken('default');
    for (const token of ALL_TOKENS) {
      if (token === 'default' || token === 'active-tool') {
        continue;
      }
      const treatment = lineTreatmentForToken(token);
      const differs =
        treatment.weight !== base.weight ||
        JSON.stringify(treatment.dashCssPx) !== JSON.stringify(base.dashCssPx);
      expect(differs, `token "${token}" is indistinguishable from default`).toBe(true);
    }
  });

  it('gives every status state a distinct treatment from every other', () => {
    const statusTokens: readonly StyleToken[] = ['locked', 'warning', 'error', 'imported'];
    const seen = new Map<string, StyleToken>();
    for (const token of statusTokens) {
      const treatment = lineTreatmentForToken(token);
      const key = `${treatment.weight}|${treatment.dashCssPx.join(',')}`;
      expect(seen.has(key), `"${token}" repeats "${seen.get(key)}"'s treatment`).toBe(false);
      seen.set(key, token);
    }
  });

  it('keeps the section-18 selection pair: primary solid, secondary dashed', () => {
    expect(lineTreatmentForToken('selected-primary').dashCssPx).toEqual([]);
    expect(lineTreatmentForToken('selected-secondary').dashCssPx.length).toBeGreaterThan(0);
  });
});
