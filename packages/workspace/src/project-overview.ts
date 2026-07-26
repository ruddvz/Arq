/**
 * Doc 35 ("Project Overview Dashboard") and doc 34 > "Project Overview".
 *
 * The rule both docs repeat, and the only reason this module exists rather than
 * a plain props object: "Sections, shown only when backed by real data... Never
 * invent project metrics to fill a card." Doc 35 spells out the failure mode -
 * "If health has never been calculated, say `Not checked yet`"; "show real
 * open/assigned counts only when review capability exists. Otherwise omit the
 * card... not fake zeros."
 *
 * So every section of `ProjectOverviewData` is optional, `undefined` means *no
 * data source*, and `selectProjectOverviewCards` is the one place that turns
 * absence into an omitted card. A zero that arrives from a real engine is
 * rendered as zero; a zero that would come from "no engine" never gets built.
 */

import {
  isCapabilityEnabled,
  type CapabilityId,
  type WorkspaceCapabilities,
} from './capability-gates';

export type ReferenceStatus = 'current' | 'missing' | 'outdated' | 'loading';

export interface RecentViewSummary {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly thumbnailUrl?: string;
  readonly lastOpenedIso?: string;
}

export interface ModelHealthSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly lastCheckedIso?: string;
}

export interface IssueSummary {
  readonly open: number;
  readonly assignedToMe?: number;
}

export interface RecoverySummary {
  readonly available: boolean;
  readonly lastRecoveryPointIso?: string;
}

export interface ReferenceSummary {
  readonly id: string;
  readonly name: string;
  readonly status: ReferenceStatus;
}

export interface ActivityEntry {
  readonly id: string;
  readonly description: string;
  readonly atIso: string;
}

/**
 * Every field past `projectName` is optional on purpose. A host that has no
 * model-health engine omits `modelHealth` entirely - it does not pass
 * `{ errors: 0, warnings: 0 }`, which would render a clean bill of health for a
 * model nothing has ever checked.
 */
export interface ProjectOverviewData {
  readonly projectName: string;
  readonly recentViews?: readonly RecentViewSummary[];
  readonly modelHealth?: ModelHealthSummary;
  readonly issues?: IssueSummary;
  readonly activity?: readonly ActivityEntry[];
  readonly references?: readonly ReferenceSummary[];
  readonly recovery?: RecoverySummary;
}

/** Doc 35's desktop composition, in its row order. */
export type ProjectOverviewCardId =
  | 'continue-working'
  | 'model-health'
  | 'recent-views'
  | 'issues'
  | 'activity'
  | 'references'
  | 'recovery';

export interface ProjectOverviewCard {
  readonly id: ProjectOverviewCardId;
  readonly title: string;
  /** Doc 35's 12-column grid: the column span at desktop width. */
  readonly desktopColumns: number;
  /**
   * Set when the card is shown but has nothing in it yet - doc 35's "`Not
   * checked yet`" case. Distinct from the card being omitted: "never checked"
   * is information, "no such feature" is not.
   */
  readonly emptyMessage?: string;
}

const CARD_TITLES: Readonly<Record<ProjectOverviewCardId, string>> = {
  'continue-working': 'Continue working',
  'model-health': 'Model health',
  'recent-views': 'Recent views',
  issues: 'Issues',
  activity: 'Activity',
  references: 'References',
  recovery: 'Recovery',
};

const CARD_COLUMNS: Readonly<Record<ProjectOverviewCardId, number>> = {
  'continue-working': 7,
  'model-health': 5,
  'recent-views': 8,
  issues: 4,
  activity: 7,
  references: 5,
  recovery: 5,
};

/** Cards whose data only means anything behind a capability gate. */
const CARD_CAPABILITY: Partial<Record<ProjectOverviewCardId, CapabilityId>> = {
  issues: 'CAP-collaboration',
};

function card(id: ProjectOverviewCardId, emptyMessage?: string): ProjectOverviewCard {
  return {
    id,
    title: CARD_TITLES[id],
    desktopColumns: CARD_COLUMNS[id],
    ...(emptyMessage === undefined ? {} : { emptyMessage }),
  };
}

/**
 * Builds the card list for the data actually available. Returns them in doc
 * 35's row order; the caller lays them out, but cannot add a card this function
 * did not authorise.
 */
export function selectProjectOverviewCards(
  data: ProjectOverviewData,
  capabilities: WorkspaceCapabilities,
): readonly ProjectOverviewCard[] {
  const cards: ProjectOverviewCard[] = [];

  // Doc 35: "Show the last active view and up to three recent views." With no
  // recent views at all the card still appears - a project that has never been
  // opened into a view is a real state with a real next action, unlike a
  // missing capability.
  if (data.recentViews !== undefined) {
    cards.push(
      card('continue-working', data.recentViews.length === 0 ? 'No views opened yet' : undefined),
    );
  }

  // Doc 35: "If health has never been calculated, say `Not checked yet`."
  if (data.modelHealth !== undefined) {
    cards.push(
      card(
        'model-health',
        data.modelHealth.lastCheckedIso === undefined ? 'Not checked yet' : undefined,
      ),
    );
  }

  if (data.recentViews !== undefined && data.recentViews.length > 3) {
    cards.push(card('recent-views'));
  }

  // Doc 35: "show real open/assigned counts only when review capability
  // exists. Otherwise omit the card... not fake zeros."
  const issuesGate = CARD_CAPABILITY.issues;
  if (
    data.issues !== undefined &&
    issuesGate !== undefined &&
    isCapabilityEnabled(capabilities, issuesGate)
  ) {
    cards.push(card('issues'));
  }

  if (data.activity !== undefined) {
    cards.push(card('activity', data.activity.length === 0 ? 'No recorded activity' : undefined));
  }

  if (data.references !== undefined && data.references.length > 0) {
    cards.push(card('references'));
  }

  // Doc 35: "Expose `Last local recovery point` and `Open recovery` only if
  // recovery data exists. Never imply cloud backup when only a local
  // checkpoint exists." `available: false` is a real answer from a real
  // recovery system, so it shows - with the honest empty message.
  if (data.recovery !== undefined) {
    cards.push(card('recovery', data.recovery.available ? undefined : 'No recovery point'));
  }

  return cards;
}

/**
 * Doc 35 > "Tablet and phone": tablet is two columns, phone is one. Returns the
 * span for a card at the given column count so the same card list drives every
 * width without a second, divergent layout table.
 */
export function overviewCardSpan(cardId: ProjectOverviewCardId, gridColumns: number): number {
  if (gridColumns <= 1) {
    return 1;
  }
  if (gridColumns === 2) {
    return 1;
  }
  return CARD_COLUMNS[cardId];
}
