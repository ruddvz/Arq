import { describe, expect, it } from 'vitest';
import { viewKindLabel, viewKindQualifier } from './view-kind-label';

describe('viewKindLabel', () => {
  it('never returns a registry token', () => {
    // The defect this exists to prevent: "3D 3d" and "Level 1 Plan plan" on the
    // Project overview, the first card on the first surface an opened project
    // shows.
    expect(viewKindLabel('3d')).toBe('3D');
    expect(viewKindLabel('ai-proposal')).toBe('Proposal');
    expect(viewKindLabel('model-health')).toBe('Model health');
  });

  it('gives every kind a written name, none of them a raw token', () => {
    const kinds = [
      'project-overview',
      'plan',
      '3d',
      'section',
      'elevation',
      'sheet',
      'schedule',
      'report',
      'issues',
      'compare',
      'model-health',
      'ai-proposal',
    ] as const;
    for (const kind of kinds) {
      const label = viewKindLabel(kind);
      expect(label).not.toBe(kind);
      expect(label).not.toMatch(/-/);
      expect(label[0]).toBe(label[0]?.toUpperCase());
    }
  });
});

describe('viewKindQualifier', () => {
  it('says nothing when the title already says it', () => {
    expect(viewKindQualifier('Level 1 Plan', 'plan')).toBeNull();
    expect(viewKindQualifier('3D', '3d')).toBeNull();
    // Case is not the reader's problem.
    expect(viewKindQualifier('level 1 plan', 'plan')).toBeNull();
  });

  it('qualifies a title that does not', () => {
    // "Ground floor" alone does not distinguish a plan from a ceiling plan.
    expect(viewKindQualifier('Ground floor', 'plan')).toBe('Plan');
    expect(viewKindQualifier('North', 'elevation')).toBe('Elevation');
  });
});
