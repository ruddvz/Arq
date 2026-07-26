import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_CAPABILITIES } from './capability-gates';
import {
  overviewCardSpan,
  selectProjectOverviewCards,
  type ProjectOverviewData,
} from './project-overview';

const COLLAB_ON = { ...DEFAULT_WORKSPACE_CAPABILITIES, 'CAP-collaboration': true };

function cardIds(
  data: ProjectOverviewData,
  capabilities = DEFAULT_WORKSPACE_CAPABILITIES,
): string[] {
  return selectProjectOverviewCards(data, capabilities).map((card) => card.id);
}

describe('selectProjectOverviewCards', () => {
  /**
   * Doc 34/35: "Never invent project metrics to fill a card." A host with no
   * data sources gets a dashboard with nothing but its project name, which is
   * the honest state of this repository today.
   */
  it('shows no cards when no data source exists', () => {
    expect(cardIds({ projectName: 'Riverside House' })).toEqual([]);
  });

  it('omits the issues card entirely when review capability is off', () => {
    const data: ProjectOverviewData = { projectName: 'P', issues: { open: 4, assignedToMe: 2 } };
    expect(cardIds(data)).not.toContain('issues');
    expect(cardIds(data, COLLAB_ON)).toContain('issues');
  });

  /** Doc 35: "If health has never been calculated, say `Not checked yet`." */
  it('distinguishes never-checked health from a clean result', () => {
    const never = selectProjectOverviewCards(
      { projectName: 'P', modelHealth: { errors: 0, warnings: 0 } },
      DEFAULT_WORKSPACE_CAPABILITIES,
    );
    expect(never[0]?.emptyMessage).toBe('Not checked yet');

    const checked = selectProjectOverviewCards(
      {
        projectName: 'P',
        modelHealth: { errors: 0, warnings: 0, lastCheckedIso: '2026-07-25T09:00:00Z' },
      },
      DEFAULT_WORKSPACE_CAPABILITIES,
    );
    expect(checked[0]?.emptyMessage).toBeUndefined();
  });

  it('shows an empty continue-working card but no card at all without the source', () => {
    expect(cardIds({ projectName: 'P', recentViews: [] })).toEqual(['continue-working']);
    expect(cardIds({ projectName: 'P' })).toEqual([]);
  });

  it('adds the recent-views card only past what continue-working already shows', () => {
    const three = Array.from({ length: 3 }, (_, i) => ({
      id: `v${i}`,
      title: `V${i}`,
      kind: 'plan',
    }));
    expect(cardIds({ projectName: 'P', recentViews: three })).toEqual(['continue-working']);

    const five = Array.from({ length: 5 }, (_, i) => ({
      id: `v${i}`,
      title: `V${i}`,
      kind: 'plan',
    }));
    expect(cardIds({ projectName: 'P', recentViews: five })).toEqual([
      'continue-working',
      'recent-views',
    ]);
  });

  /** Doc 35: "Never imply cloud backup when only a local checkpoint exists." */
  it('shows recovery honestly in both directions', () => {
    const none = selectProjectOverviewCards(
      { projectName: 'P', recovery: { available: false } },
      DEFAULT_WORKSPACE_CAPABILITIES,
    );
    expect(none[0]?.emptyMessage).toBe('No recovery point');

    const present = selectProjectOverviewCards(
      {
        projectName: 'P',
        recovery: { available: true, lastRecoveryPointIso: '2026-07-25T08:00:00Z' },
      },
      DEFAULT_WORKSPACE_CAPABILITIES,
    );
    expect(present[0]?.emptyMessage).toBeUndefined();
  });

  it('omits references when the list is empty rather than showing an empty shell', () => {
    expect(cardIds({ projectName: 'P', references: [] })).toEqual([]);
    expect(
      cardIds({ projectName: 'P', references: [{ id: 'r', name: 'site.dxf', status: 'current' }] }),
    ).toEqual(['references']);
  });

  it('returns cards in doc 35 row order', () => {
    const data: ProjectOverviewData = {
      projectName: 'P',
      recentViews: Array.from({ length: 5 }, (_, i) => ({
        id: `v${i}`,
        title: `V${i}`,
        kind: 'plan',
      })),
      modelHealth: { errors: 1, warnings: 2, lastCheckedIso: '2026-07-25T09:00:00Z' },
      issues: { open: 3 },
      activity: [{ id: 'a', description: 'Imported site.dxf', atIso: '2026-07-25T08:00:00Z' }],
      references: [{ id: 'r', name: 'site.dxf', status: 'current' }],
      recovery: { available: true },
    };
    expect(cardIds(data, COLLAB_ON)).toEqual([
      'continue-working',
      'model-health',
      'recent-views',
      'issues',
      'activity',
      'references',
      'recovery',
    ]);
  });
});

describe('overviewCardSpan', () => {
  it('collapses to one column on phone and two-up on tablet', () => {
    expect(overviewCardSpan('continue-working', 1)).toBe(1);
    expect(overviewCardSpan('continue-working', 2)).toBe(1);
    expect(overviewCardSpan('continue-working', 12)).toBe(7);
    expect(overviewCardSpan('model-health', 12)).toBe(5);
  });
});
