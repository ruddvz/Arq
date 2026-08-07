import {
  selectProjectOverviewCards,
  type ProjectOverviewCard,
  type ProjectOverviewData,
  type WorkspaceCapabilities,
} from '@arq/workspace';
import { viewKindQualifier } from './view-kind-label';

export interface ProjectOverviewSurfaceProps {
  readonly data: ProjectOverviewData;
  readonly capabilities: WorkspaceCapabilities;
  readonly onOpenView: (viewId: string) => void;
  /** Doc 35's 12-column desktop grid, 2 on tablet, 1 on phone. */
  readonly gridColumns: number;
}

function CardBody(props: {
  readonly card: ProjectOverviewCard;
  readonly data: ProjectOverviewData;
  readonly onOpenView: (viewId: string) => void;
}): JSX.Element {
  const { card, data, onOpenView } = props;

  if (card.emptyMessage !== undefined) {
    return <p style={{ color: 'var(--arq-ui-text-muted)', margin: 0 }}>{card.emptyMessage}</p>;
  }

  switch (card.id) {
    case 'continue-working':
    case 'recent-views': {
      // Doc 35: "Show the last active view and up to three recent views." The
      // recent-views card picks up where continue-working stops.
      const views = data.recentViews ?? [];
      const shown = card.id === 'continue-working' ? views.slice(0, 4) : views.slice(4);
      return (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((view) => (
            <li key={view.id}>
              <button
                type="button"
                className="arq-shell-button"
                style={{ width: '100%', justifyContent: 'flex-start' }}
                onClick={() => onOpenView(view.id)}
              >
                {view.title}
                {/* Only when the title does not already say it - "Level 1 Plan
                    plan" was what printing the registry token produced. */}
                {viewKindQualifier(view.title, view.kind) === null ? null : (
                  <span style={{ color: 'var(--arq-ui-text-muted)' }}>
                    {' '}
                    {viewKindQualifier(view.title, view.kind)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      );
    }
    case 'model-health': {
      const health = data.modelHealth;
      if (health === undefined) {
        return <></>;
      }
      // Section 126: "status not colour-only" - counts are written out in
      // words, never conveyed by a red or amber dot alone.
      return (
        <p style={{ margin: 0 }}>
          {health.errors} error{health.errors === 1 ? '' : 's'}, {health.warnings} warning
          {health.warnings === 1 ? '' : 's'}
        </p>
      );
    }
    case 'issues': {
      const issues = data.issues;
      if (issues === undefined) {
        return <></>;
      }
      return (
        <p style={{ margin: 0 }}>
          {issues.open} open
          {issues.assignedToMe === undefined ? '' : `, ${issues.assignedToMe} assigned to you`}
        </p>
      );
    }
    case 'activity':
      return (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {(data.activity ?? []).map((entry) => (
            <li key={entry.id}>{entry.description}</li>
          ))}
        </ul>
      );
    case 'references':
      return (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {(data.references ?? []).map((reference) => (
            <li key={reference.id}>
              {reference.name}{' '}
              <span style={{ color: 'var(--arq-ui-text-muted)' }}>{reference.status}</span>
            </li>
          ))}
        </ul>
      );
    case 'recovery': {
      const recovery = data.recovery;
      if (recovery === undefined) {
        return <></>;
      }
      // Doc 35: "Never imply cloud backup when only a local checkpoint exists."
      // The word "local" is load-bearing.
      return (
        <p style={{ margin: 0 }}>
          Last local recovery point
          {recovery.lastRecoveryPointIso === undefined ? '' : `: ${recovery.lastRecoveryPointIso}`}
        </p>
      );
    }
  }
}

/**
 * Package 3.0 doc 35 ("Project Overview Dashboard") - the internal dashboard
 * for an already-open project, distinct from the external Recent Projects page.
 *
 * The card list comes entirely from `selectProjectOverviewCards`, which is what
 * enforces doc 34/35's "shown only when backed by real data... Never invent
 * project metrics to fill a card." This component cannot render a card the
 * selector did not authorise, so a host with no model-health engine gets no
 * model-health card rather than a reassuring pair of zeros.
 *
 * An overview with no cards at all is a legitimate result and renders as an
 * explicit statement rather than an empty page - it is the honest state of a
 * build whose data sources do not exist yet, and saying so is more useful than
 * a blank grid the user reads as a loading failure.
 */
export function ProjectOverviewSurface(props: ProjectOverviewSurfaceProps): JSX.Element {
  const { data, capabilities, onOpenView, gridColumns } = props;
  const cards = selectProjectOverviewCards(data, capabilities);

  return (
    <section
      className="arq-project-overview"
      aria-label={`${data.projectName} overview`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
        gap: 'var(--arq-space-section)',
        /*
         * Block padding only. The inline sides come from the stylesheet, which
         * is where the floating panels' footprints are known - a document
         * cannot be panned out from under one the way a drawing can, and this
         * page was rendering the project's own name behind the project browser.
         */
        paddingBlock: 'var(--arq-space-page)',
        overflow: 'auto',
      }}
    >
      <h1 style={{ gridColumn: '1 / -1', margin: 0 }}>{data.projectName}</h1>

      {cards.length === 0 ? (
        <p style={{ gridColumn: '1 / -1', color: 'var(--arq-ui-text-muted)' }}>
          Nothing to show yet. Project activity, model health and recovery appear here once this
          build records them.
        </p>
      ) : (
        cards.map((card) => (
          <article
            key={card.id}
            className="arq-project-overview__card arq-shell-panel"
            aria-labelledby={`arq-overview-card-${card.id}`}
            style={{
              gridColumn: `span ${Math.min(card.desktopColumns, gridColumns)}`,
              border: '1px solid var(--arq-ui-line-subtle)',
              borderRadius: 'var(--arq-radius-dialog)',
              padding: 'var(--arq-space-panel)',
            }}
          >
            <h2
              id={`arq-overview-card-${card.id}`}
              style={{ margin: '0 0 var(--arq-space-compact) 0', fontSize: '1rem' }}
            >
              {card.title}
            </h2>
            <CardBody card={card} data={data} onOpenView={onOpenView} />
          </article>
        ))
      )}
    </section>
  );
}
