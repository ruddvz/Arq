import { describe, expect, it } from 'vitest';
import { PROPOSAL_STATES, type ProposalState } from '../domain/proposal';
import {
  ASSISTANT_ACTIONS,
  ASSISTANT_TABS,
  actionAvailability,
  contextHeader,
  emptyStateText,
  impactSummary,
  persistenceStatement,
  visibleTabs,
  type ReviewCentreContext,
} from './review-centre';

const editableProject = {
  name: 'Coach house',
  revision: 'rev-000012',
  accessState: 'editable' as const,
  publishedFileState: 'not_published' as const,
  hasUnpublishedWork: true,
};

/** `project: undefined` is meaningful here - it is the no-project-open case - so the helper takes it explicitly rather than through an optional property. */
function context(
  overrides: Partial<Omit<ReviewCentreContext, 'project'>> & {
    project?: ReviewCentreContext['project'] | undefined;
  } = {},
): ReviewCentreContext {
  const { project, ...rest } = overrides;
  const resolved = 'project' in overrides ? project : editableProject;
  return {
    connection: 'connected',
    grantState: 'active',
    ...rest,
    ...(resolved === undefined ? {} : { project: resolved }),
  };
}

function availability(ctx: ReviewCentreContext, action: (typeof ASSISTANT_ACTIONS)[number]) {
  const found = actionAvailability(ctx).find((entry) => entry.action === action);
  if (found === undefined) {
    throw new Error(`no availability reported for ${action}`);
  }
  return found;
}

describe('the context header', () => {
  it('reports the most limiting fact first', () => {
    expect(
      contextHeader(context({ grantState: 'revoked', connection: 'arq_unavailable' })).state,
    ).toBe('grant_revoked');
    expect(contextHeader(context({ grantState: 'expired' })).state).toBe('grant_expired');
    expect(contextHeader(context({ grantState: 'none' })).state).toBe('no_grant');
    expect(contextHeader(context({ connection: 'arq_unavailable' })).state).toBe(
      'runtime_unavailable',
    );
  });

  it('has copy for every project access state, and marks the blocking ones', () => {
    for (const accessState of [
      'editable',
      'read_only',
      'migration_required',
      'recovery',
    ] as const) {
      const header = contextHeader(context({ project: { ...editableProject, accessState } }));
      expect(header.text.length).toBeGreaterThan(0);
      expect(header.blocking).toBe(accessState !== 'editable');
    }
  });

  it('never says a plan or a proposal saved the project', () => {
    for (const state of ['none', 'active', 'expired', 'revoked'] as const) {
      expect(contextHeader(context({ grantState: state })).text.toLowerCase()).not.toContain(
        'saved',
      );
    }
  });
});

describe('persistence language', () => {
  it('never answers with the word saved on its own', () => {
    const answers = [
      persistenceStatement(context({ project: undefined })),
      persistenceStatement(context()),
      persistenceStatement(
        context({ project: { ...editableProject, publishedFileState: 'published' } }),
      ),
      persistenceStatement(
        context({
          project: {
            ...editableProject,
            publishedFileState: 'published',
            hasUnpublishedWork: false,
          },
        }),
      ),
      persistenceStatement(context({ project: { ...editableProject, accessState: 'recovery' } })),
    ];
    for (const answer of answers) {
      expect(answer.length).toBeGreaterThan(0);
      expect(/\bsaved\b/iu.test(answer)).toBe(false);
    }
  });

  it('distinguishes a working copy, a written file and a file that is behind', () => {
    expect(persistenceStatement(context())).toContain('No project file has been written yet');
    expect(
      persistenceStatement(
        context({ project: { ...editableProject, publishedFileState: 'published' } }),
      ),
    ).toContain('behind');
    expect(
      persistenceStatement(
        context({
          project: {
            ...editableProject,
            publishedFileState: 'published',
            hasUnpublishedWork: false,
          },
        }),
      ),
    ).toContain('matches the working copy');
  });
});

describe('action availability', () => {
  it('gives a reason for every unavailable action, in every reachable context', () => {
    const contexts: ReviewCentreContext[] = [
      context({ grantState: 'none', project: undefined }),
      context({ grantState: 'expired' }),
      context({ connection: 'arq_unavailable' }),
      context({ project: { ...editableProject, accessState: 'read_only' } }),
      context({ project: { ...editableProject, accessState: 'migration_required' } }),
      context({ project: { ...editableProject, accessState: 'recovery' } }),
      context(),
    ];
    for (const candidate of contexts) {
      for (const entry of actionAvailability(candidate)) {
        if (!entry.enabled) {
          expect(entry.reason.length).toBeGreaterThan(0);
        }
      }
      expect(
        actionAvailability(candidate)
          .map((entry) => entry.action)
          .sort(),
      ).toEqual([...ASSISTANT_ACTIONS].sort());
    }
  });

  it('lets someone plan even when nothing is shared with them', () => {
    const nothing = context({ grantState: 'none', project: undefined });
    expect(availability(nothing, 'create_program').enabled).toBe(true);
    expect(availability(nothing, 'copy_plan').enabled).toBe(true);
    expect(availability(nothing, 'stage_proposal').enabled).toBe(false);
  });

  it('refuses to stage while any requested capability is unregistered', () => {
    const blocked = availability(
      context({
        program: {
          title: 'Concept craft',
          version: 1,
          openQuestionCount: 1,
          unresolvedRightsCount: 0,
          passesGraphValidation: true,
        },
        coverage: { state: 'blocked_by_capability', unavailableCount: 2, blockedByStateCount: 0 },
      }),
      'stage_proposal',
    );
    expect(blocked.enabled).toBe(false);
    expect(blocked.enabled === false ? blocked.reason : '').toContain('concept plan');
  });

  it('refuses to stage while the project cannot accept the operation', () => {
    const blocked = availability(
      context({
        coverage: { state: 'blocked_by_capability', unavailableCount: 0, blockedByStateCount: 1 },
      }),
      'stage_proposal',
    );
    expect(blocked.enabled).toBe(false);
    expect(blocked.enabled === false ? blocked.reason : '').toContain('right now');
  });

  it('enables staging only when coverage is genuinely ready', () => {
    expect(
      availability(
        context({
          coverage: {
            state: 'ready_for_operation_planning',
            unavailableCount: 0,
            blockedByStateCount: 0,
          },
        }),
        'stage_proposal',
      ).enabled,
    ).toBe(true);
  });

  it('will not check coverage while the program has problems', () => {
    const blocked = availability(
      context({
        program: {
          title: 'Concept craft',
          version: 1,
          openQuestionCount: 0,
          unresolvedRightsCount: 0,
          passesGraphValidation: false,
        },
      }),
      'check_coverage',
    );
    expect(blocked.enabled).toBe(false);
  });

  it('offers withdrawal exactly while the proposal can still be withdrawn', () => {
    for (const state of PROPOSAL_STATES) {
      const entry = availability(
        context({
          proposal: {
            state,
            baseRevision: 'rev-000012',
            affectedElementCount: 1,
            staleOutputs: [],
            availablePreviews: [],
            errorCount: 0,
          },
        }),
        'cancel_proposal',
      );
      const expected = ['staged', 'ready_for_review', 'awaiting_user_approval'].includes(state);
      expect(entry.enabled).toBe(expected);
    }
  });

  it('never offers to send a failed proposal for review', () => {
    const entry = availability(
      context({
        proposal: {
          state: 'validation_failed',
          baseRevision: 'rev-000012',
          affectedElementCount: 0,
          staleOutputs: [],
          availablePreviews: [],
          errorCount: 3,
        },
      }),
      'request_review',
    );
    expect(entry.enabled).toBe(false);
    expect(entry.enabled === false ? entry.reason : '').toContain('3 problem');
  });
});

describe('tabs', () => {
  it('shows only what has content, and lands on the review when a decision is waiting', () => {
    expect(visibleTabs(context()).tabs).toEqual(['program', 'history', 'help']);
    expect(visibleTabs(context()).initial).toBe('program');

    const waiting = visibleTabs(
      context({
        program: {
          title: 't',
          version: 1,
          openQuestionCount: 0,
          unresolvedRightsCount: 0,
          passesGraphValidation: true,
        },
        coverage: {
          state: 'ready_for_operation_planning',
          unavailableCount: 0,
          blockedByStateCount: 0,
        },
        proposal: {
          state: 'awaiting_user_approval',
          baseRevision: 'rev-000012',
          affectedElementCount: 2,
          staleOutputs: [],
          availablePreviews: [],
          errorCount: 0,
        },
      }),
    );
    expect(waiting.initial).toBe('review');
    expect(waiting.tabs).toContain('review');
  });

  it('has empty-state copy for every tab', () => {
    for (const tab of ASSISTANT_TABS) {
      expect(emptyStateText(tab).length).toBeGreaterThan(0);
    }
  });
});

describe('the accessible impact summary', () => {
  it('says plainly when Arq cannot draw a preview', () => {
    const summary = impactSummary({
      state: 'ready_for_review' as ProposalState,
      baseRevision: 'rev-000012',
      affectedElementCount: 3,
      staleOutputs: ['plan-render-cache'],
      availablePreviews: [],
      errorCount: 0,
    });
    expect(summary).toContain('3 elements');
    expect(summary).toContain('plan-render-cache');
    expect(summary).toContain('no drawn preview');
  });

  it('names the previews when there are some, and reports a failed set as changing nothing', () => {
    expect(
      impactSummary({
        state: 'ready_for_review' as ProposalState,
        baseRevision: 'rev-000012',
        affectedElementCount: 1,
        staleOutputs: [],
        availablePreviews: ['plan', 'property-diff'],
        errorCount: 0,
      }),
    ).toContain('plan, property-diff');

    expect(
      impactSummary({
        state: 'validation_failed' as ProposalState,
        baseRevision: 'rev-000012',
        affectedElementCount: 0,
        staleOutputs: [],
        availablePreviews: [],
        errorCount: 2,
      }),
    ).toContain('Nothing in the project has changed');
  });

  it('says something when there is nothing to review', () => {
    expect(impactSummary(undefined)).toBe('No change is being reviewed.');
  });
});
