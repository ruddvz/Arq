/**
 * The Review Centre as a state machine, not a specification document.
 *
 * The reviewed MCP System 2.0 package described this panel in 262 lines of
 * prose - tabs, header states, disabled controls, empty states, accessible
 * equivalents - and shipped no code for any of it. Prose is where a UX
 * specification goes to drift: the copy for "read only" lives in a
 * document, the button that should be disabled lives in a component, and
 * nothing connects them, so the first honest state the product ships is
 * whichever one somebody remembered.
 *
 * This module is the connection. Given what is true - the connection, the
 * grant, the project's access state, the coverage verdict, the proposal's
 * state - it returns the header copy, which actions are available, and why
 * each unavailable one is unavailable. A view layer renders it. The rules
 * are testable without a browser, and a state with no copy is a failing
 * test rather than an empty panel.
 *
 * Two of 2.0's own UX findings are enforced here rather than described.
 *
 * "Saved means too many things" (its finding, and the reason its spec
 * demanded separate words for accepted locally, working copy, published
 * file, waiting to sync, recovery and read-only). `persistenceStatement`
 * is the single function that answers "what happened to my work", and it
 * never returns the word saved on its own.
 *
 * "A disabled control with no reason is a dead end." Every action carries
 * either `enabled: true` or a sentence naming the thing to change. A
 * reason is not optional in the type.
 */

import type { CoverageState } from '../adapter/coverage';
import type { ProjectAccessState } from '../profile/domain-profile';
import type { ProposalState } from '../domain/proposal';
import { canCancel } from '../domain/proposal';

export const ASSISTANT_TABS = [
  'program',
  'coverage',
  'proposal',
  'review',
  'history',
  'help',
] as const;

export type AssistantTab = (typeof ASSISTANT_TABS)[number];

export type ConnectionState = 'connected' | 'arq_unavailable';

export type GrantState = 'none' | 'active' | 'expired' | 'revoked';

export interface ReviewCentreProject {
  readonly name: string;
  readonly revision: string;
  readonly accessState: ProjectAccessState;
  readonly publishedFileState: 'not_published' | 'published';
  /** True when the model has moved since the last published checkpoint. */
  readonly hasUnpublishedWork: boolean;
}

export interface ReviewCentreProgram {
  readonly title: string;
  readonly version: number;
  readonly openQuestionCount: number;
  readonly unresolvedRightsCount: number;
  readonly passesGraphValidation: boolean;
}

export interface ReviewCentreCoverage {
  readonly state: CoverageState;
  readonly unavailableCount: number;
  readonly blockedByStateCount: number;
}

export interface ReviewCentreProposal {
  readonly state: ProposalState;
  readonly baseRevision: string;
  readonly affectedElementCount: number;
  readonly staleOutputs: readonly string[];
  readonly availablePreviews: readonly string[];
  readonly errorCount: number;
}

export interface ReviewCentreContext {
  readonly connection: ConnectionState;
  readonly grantState: GrantState;
  readonly grantSummary?: string;
  readonly project?: ReviewCentreProject;
  readonly program?: ReviewCentreProgram;
  readonly coverage?: ReviewCentreCoverage;
  readonly proposal?: ReviewCentreProposal;
}

export interface ContextHeader {
  /** A machine token for tests and telemetry. Never rendered. */
  readonly state: string;
  readonly text: string;
  /** True when the header describes a condition the operator has to resolve before work can continue. */
  readonly blocking: boolean;
}

/**
 * The header sentence, chosen by the most limiting fact.
 *
 * Order matters: a revoked grant is reported before a read-only project,
 * because telling someone their project is read-only when the real problem
 * is that access was withdrawn sends them to fix the wrong thing.
 */
export function contextHeader(context: ReviewCentreContext): ContextHeader {
  if (context.grantState === 'revoked') {
    return {
      state: 'grant_revoked',
      text: 'Access to this project was withdrawn in Arq. Nothing here can read or change it.',
      blocking: true,
    };
  }
  if (context.grantState === 'expired') {
    return {
      state: 'grant_expired',
      text: 'Access has expired. Renew it in Arq to continue.',
      blocking: true,
    };
  }
  if (context.grantState === 'none') {
    return {
      state: 'no_grant',
      text: 'Choose a project in Arq before sharing any project context.',
      blocking: true,
    };
  }
  if (context.connection === 'arq_unavailable') {
    return {
      state: 'runtime_unavailable',
      text: 'Arq is not running. Your plans are still here, and they are separate from any project data.',
      blocking: true,
    };
  }

  const project = context.project;
  if (project === undefined) {
    return {
      state: 'no_project_selected',
      text: 'No project is open. Choose one of the shared projects to see its state.',
      blocking: false,
    };
  }

  switch (project.accessState) {
    case 'read_only':
      return {
        state: 'read_only',
        text: `"${project.name}" is read only at revision ${project.revision}. You can read it, and Arq will not stage a change against it.`,
        blocking: true,
      };
    case 'migration_required':
      return {
        state: 'migration_required',
        text: `"${project.name}" needs to be migrated in Arq before it can accept changes.`,
        blocking: true,
      };
    case 'recovery':
      return {
        state: 'recovery',
        text: `"${project.name}" has work to recover. Resolve the recovery in Arq before proposing changes.`,
        blocking: true,
      };
    case 'editable':
      return {
        state: 'editable',
        text: `"${project.name}" is editable at revision ${project.revision}.`,
        blocking: false,
      };
  }
}

/**
 * What happened to the operator's work, in words that mean one thing each.
 *
 * The word "saved" never appears alone. A journalled edit, a working copy,
 * a published file and a plan stored beside a project are four different
 * facts, and collapsing them is how someone closes a window believing they
 * have a file they do not have.
 */
export function persistenceStatement(context: ReviewCentreContext): string {
  const project = context.project;
  if (project === undefined) {
    return 'Your plans are stored on their own. They are not part of any project.';
  }
  if (project.accessState === 'recovery') {
    return 'Arq has work it recovered for this project. Review it in Arq before adding anything else.';
  }
  if (project.publishedFileState === 'not_published') {
    return `The project exists as a working copy in Arq at revision ${project.revision}. No project file has been written yet, and where one goes is your choice in Arq.`;
  }
  if (project.hasUnpublishedWork) {
    return `The project file was written earlier. The working copy has moved on to revision ${project.revision} since then, so the file is behind.`;
  }
  return `The project file matches the working copy at revision ${project.revision}.`;
}

export const ASSISTANT_ACTIONS = [
  'create_program',
  'check_coverage',
  'open_in_arq',
  'stage_proposal',
  'request_review',
  'cancel_proposal',
  'request_publish',
  'copy_plan',
] as const;

export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

export type ActionAvailability =
  | { readonly action: AssistantAction; readonly enabled: true }
  | { readonly action: AssistantAction; readonly enabled: false; readonly reason: string };

/**
 * Which actions the panel offers, and for each unavailable one, the thing
 * that has to change.
 *
 * Every branch returns a reason. There is no "disabled with no explanation"
 * path, because the type has no shape for one.
 */
export function actionAvailability(context: ReviewCentreContext): readonly ActionAvailability[] {
  const header = contextHeader(context);
  const project = context.project;
  const program = context.program;
  const coverage = context.coverage;
  const proposal = context.proposal;

  const enabled = (action: AssistantAction): ActionAvailability => ({ action, enabled: true });
  const disabled = (action: AssistantAction, reason: string): ActionAvailability => ({
    action,
    enabled: false,
    reason,
  });

  return [
    // Planning is always available, including when nothing is shared. A
    // person who cannot yet reach a project can still describe what they
    // want, and refusing that would push the work back into a chat log.
    enabled('create_program'),
    enabled('copy_plan'),

    program === undefined
      ? disabled('check_coverage', 'Create a design program first.')
      : !program.passesGraphValidation
        ? disabled(
            'check_coverage',
            'Fix the problems marked in the design program before checking what Arq can build.',
          )
        : enabled('check_coverage'),

    context.connection === 'arq_unavailable'
      ? disabled('open_in_arq', 'Arq is not running.')
      : project === undefined
        ? disabled('open_in_arq', 'Choose one of the shared projects first.')
        : enabled('open_in_arq'),

    stageAvailability(),

    proposal === undefined
      ? disabled('request_review', 'Stage a change set first.')
      : proposal.state === 'validation_failed'
        ? disabled(
            'request_review',
            `The change set has ${proposal.errorCount} problem(s) to fix. A proposal that failed validation is not sent for review.`,
          )
        : proposal.state === 'ready_for_review'
          ? enabled('request_review')
          : disabled(
              'request_review',
              `This proposal is ${readableState(proposal.state)}, so there is nothing to send.`,
            ),

    proposal === undefined
      ? disabled('cancel_proposal', 'There is no proposal to withdraw.')
      : canCancel(proposal.state)
        ? enabled('cancel_proposal')
        : disabled(
            'cancel_proposal',
            `This proposal is ${readableState(proposal.state)} and can no longer be withdrawn.`,
          ),

    project === undefined
      ? disabled('request_publish', 'Choose one of the shared projects first.')
      : header.blocking
        ? disabled('request_publish', header.text)
        : enabled('request_publish'),
  ];

  function stageAvailability(): ActionAvailability {
    if (project === undefined) {
      return disabled('stage_proposal', 'Choose one of the shared projects first.');
    }
    if (header.blocking) {
      return disabled('stage_proposal', header.text);
    }
    if (coverage === undefined) {
      return disabled('stage_proposal', 'Check what Arq can build before preparing a change.');
    }
    if (coverage.unavailableCount > 0) {
      return disabled(
        'stage_proposal',
        `${coverage.unavailableCount} requested capabilit${coverage.unavailableCount === 1 ? 'y is' : 'ies are'} not registered in Arq. Those parts stay as a concept plan.`,
      );
    }
    if (coverage.blockedByStateCount > 0) {
      return disabled(
        'stage_proposal',
        `${coverage.blockedByStateCount} capabilit${coverage.blockedByStateCount === 1 ? 'y' : 'ies'} cannot be used in this project right now. Read the coverage table for the reason.`,
      );
    }
    if (coverage.state === 'concept_plan_only') {
      return disabled(
        'stage_proposal',
        'This program is a concept plan. Set it to require registered operations when you want to build part of it.',
      );
    }
    return enabled('stage_proposal');
  }
}

function readableState(state: ProposalState): string {
  return state.replace(/_/gu, ' ');
}

/** Which tabs are worth showing, and which is the one to land on. A tab with nothing in it is noise. */
export function visibleTabs(context: ReviewCentreContext): {
  readonly tabs: readonly AssistantTab[];
  readonly initial: AssistantTab;
} {
  const tabs: AssistantTab[] = ['program'];
  if (context.program !== undefined) {
    tabs.push('coverage');
  }
  if (context.coverage !== undefined || context.proposal !== undefined) {
    tabs.push('proposal');
  }
  if (context.proposal !== undefined) {
    tabs.push('review');
  }
  tabs.push('history', 'help');

  const initial: AssistantTab =
    context.proposal !== undefined && context.proposal.state === 'awaiting_user_approval'
      ? 'review'
      : context.proposal !== undefined
        ? 'proposal'
        : context.coverage !== undefined
          ? 'coverage'
          : 'program';

  return { tabs, initial };
}

/**
 * The text equivalent of the canvas highlight.
 *
 * A highlighted element is information a sighted person gets for free and a
 * screen-reader user gets only if something says it. This sentence is the
 * accessible name for the impact strip, and it never claims a preview
 * exists when none does: "Arq has no preview for this change" is a fact a
 * reviewer needs before approving.
 */
export function impactSummary(proposal: ReviewCentreProposal | undefined): string {
  if (proposal === undefined) {
    return 'No change is being reviewed.';
  }
  if (proposal.state === 'validation_failed') {
    return `This change set has ${proposal.errorCount} problem(s) and was not queued. Nothing in the project has changed.`;
  }

  const elements =
    proposal.affectedElementCount === 1 ? '1 element' : `${proposal.affectedElementCount} elements`;
  const stale =
    proposal.staleOutputs.length === 0
      ? 'Nothing else becomes out of date.'
      : `${proposal.staleOutputs.join(', ')} would need to be worked out again.`;
  const preview =
    proposal.availablePreviews.length === 0
      ? 'Arq has no drawn preview for this change, so review it from the element list.'
      : `Preview available as ${proposal.availablePreviews.join(', ')}.`;

  return `${elements} would change. ${stale} ${preview}`;
}

/**
 * The one sentence that must appear wherever coverage is shown.
 *
 * Repeated at every surface on purpose: a column of green ticks reads as
 * "this design is fine" unless something says otherwise in the same view.
 */
export const COVERAGE_VIEW_DISCLOSURE =
  'This compares the names of the operations Arq has registered. It says nothing about whether the design is buildable, safe, compliant or good.';

/** Empty-state copy, so a panel with nothing in it explains itself instead of looking broken. */
export function emptyStateText(tab: AssistantTab): string {
  switch (tab) {
    case 'program':
      return 'Describe what you want to design. Anything can be described here, whether or not Arq can build it.';
    case 'coverage':
      return 'Create a design program, then check which parts Arq has registered operations for.';
    case 'proposal':
      return 'Nothing is staged. A proposal is a validated request; it changes nothing until you approve it in Arq.';
    case 'review':
      return 'Nothing is waiting for you.';
    case 'history':
      return 'Plans, staged proposals and decisions appear here. A withdrawn or rejected proposal is kept as a record, and it is not part of the project.';
    case 'help':
      return 'What this assistant can and cannot do, and where each answer comes from.';
  }
}
