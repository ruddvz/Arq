import type { ReactNode } from 'react';
import {
  BROWSER_SECTION_LABELS,
  BROWSER_SECTION_PURPOSE,
  browserSectionsForMode,
  type BrowserPanelState,
  type BrowserSection,
  type WorkspaceMode,
} from '@arq/workspace';

export interface ProjectBrowserPanelProps {
  readonly state: BrowserPanelState;
  readonly mode: WorkspaceMode;
  readonly reviewCapabilityEnabled: boolean;
  readonly onSelectSection: (section: BrowserSection) => void;
  /**
   * Body per section. A section with no entry renders its own honest empty
   * state rather than an blank pane — see `EmptySection`. Slots rather than
   * data because each section's content is a different shape (a semantic tree,
   * a view list, a sheet list, a reference list) and flattening them into one
   * generic node type would lose exactly the distinctions doc 39 draws.
   */
  readonly sections: Partial<Record<BrowserSection, ReactNode>>;
}

function EmptySection(props: { readonly section: BrowserSection }): JSX.Element {
  return (
    <p style={{ padding: 'var(--arq-space-panel)', color: 'var(--arq-ui-text-muted)', margin: 0 }}>
      Nothing here yet. {BROWSER_SECTION_PURPOSE[props.section]}.
    </p>
  );
}

/**
 * Doc 39 ("Left Project Browser Panel").
 *
 * Doc 39's first sentence is the design: "The left panel is a browser, not a
 * second command system." Four named sections — Project, Views, Documents,
 * Files — answer *where a thing lives*, which the single undifferentiated model
 * tree this replaced could not: a sheet and a level were rendered as
 * indistinguishable rows in one list.
 *
 * A `tablist` rather than a row of toggle buttons, so a screen reader announces
 * "tab 2 of 4" and arrow keys work the way they do in every other tabbed panel.
 * Roving tabindex keeps the whole section strip to one Tab stop, which matters
 * in a panel the user tabs past to reach the canvas.
 *
 * Sections the host does not fill still render, with the section's own purpose
 * as the empty message. An empty Documents tab that says what documents are is
 * more useful than a hidden tab, and hiding it would make the panel's shape
 * change as a project grows — doc 39 calls these "stable top tabs".
 */
export function ProjectBrowserPanel(props: ProjectBrowserPanelProps): JSX.Element {
  const { state, mode, reviewCapabilityEnabled, onSelectSection, sections } = props;
  const available = browserSectionsForMode(mode, reviewCapabilityEnabled);
  const active = available.includes(state.section) ? state.section : (available[0] ?? 'model');

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    const index = available.indexOf(active);
    const next = available[(index + delta + available.length) % available.length];
    if (next !== undefined) {
      onSelectSection(next);
    }
  }

  return (
    <nav
      className="arq-project-browser arq-shell-panel"
      aria-label="Project browser"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        borderRight: '1px solid var(--arq-ui-line-subtle)',
      }}
    >
      <div
        role="tablist"
        aria-label="Browser sections"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="arq-project-browser__tabs"
        style={{
          display: 'flex',
          flex: '0 0 auto',
          borderBottom: '1px solid var(--arq-ui-line-subtle)',
          overflowX: 'auto',
        }}
      >
        {available.map((section) => (
          <button
            key={section}
            type="button"
            role="tab"
            id={`arq-browser-tab-${section}`}
            aria-selected={section === active}
            aria-controls={`arq-browser-panel-${section}`}
            tabIndex={section === active ? 0 : -1}
            title={BROWSER_SECTION_PURPOSE[section]}
            className="arq-shell-button arq-project-browser__tab"
            style={{ flex: 1, minWidth: 0 }}
            onClick={() => onSelectSection(section)}
          >
            {BROWSER_SECTION_LABELS[section]}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`arq-browser-panel-${active}`}
        aria-labelledby={`arq-browser-tab-${active}`}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        {sections[active] ?? <EmptySection section={active} />}
      </div>
    </nav>
  );
}
