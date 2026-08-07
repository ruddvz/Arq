import type { SheetId } from '@arq/workspace';

export interface PhoneDockProps {
  readonly openSheet: SheetId | null;
  readonly onSelectTool: () => void;
  readonly onToggleSheet: (sheet: SheetId) => void;
  /**
   * Doc 47 lists Review in the dock, but its sheet is gated on
   * `CAP-collaboration`. Passing the reason keeps the control visible and
   * explained rather than silently missing — the same rule the tool rail
   * follows.
   */
  readonly reviewDisabledReason?: string;
}

interface DockEntry {
  readonly id: 'select' | SheetId;
  readonly label: string;
}

/**
 * Doc 47 > "Base screen": `Select | Tools | View | Review | More`.
 *
 * This is the phone's entire navigation, so every entry is a real 44px target
 * and nothing here is hover-dependent — a phone has no hover.
 *
 * `Select` is not a sheet. It activates the select tool directly, because doc
 * 47 wants the most common action to be one tap rather than a sheet the user
 * must open and then choose from.
 *
 * Doc 47's "selected tool remains visible in bottom dock or a compact tool
 * chip" used to be a chip rendered here, between the status strip and the dock.
 * That made three stacked strips under the canvas - "No selection  No issues",
 * then "Tool: Select", then five dock buttons - two of which said one thing
 * each. The status strip carries the tool now; this component is the dock.
 *
 * `More` maps to the project browser: on a phone the browser *is* the "where
 * else can I go" surface, and doc 47's own View entry already covers switching
 * between open views.
 */
const ENTRIES: readonly DockEntry[] = [
  { id: 'select', label: 'Select' },
  { id: 'tools', label: 'Tools' },
  { id: 'view-switcher', label: 'View' },
  { id: 'review', label: 'Review' },
  { id: 'project-browser', label: 'More' },
];

export function PhoneDock(props: PhoneDockProps): JSX.Element {
  const { openSheet, onSelectTool, onToggleSheet, reviewDisabledReason } = props;

  return (
    <div className="arq-phone-dock-region" style={{ flex: '0 0 auto' }}>
      <nav
        className="arq-phone-dock arq-shell-panel"
        aria-label="Workspace"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--arq-ui-line-subtle)',
          // Doc 47 gestures: "No edge-only destructive swipe." Respecting the
          // home indicator keeps the dock's own targets clear of the system
          // gesture area rather than fighting it.
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {ENTRIES.map((entry) => {
          const isSheet = entry.id !== 'select';
          const disabledReason = entry.id === 'review' ? reviewDisabledReason : undefined;
          const disabled = disabledReason !== undefined;
          const expanded = isSheet && openSheet === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              className="arq-shell-button arq-phone-dock__button"
              style={{ flex: 1, flexDirection: 'column', gap: 0 }}
              aria-expanded={isSheet ? expanded : undefined}
              aria-haspopup={isSheet ? 'dialog' : undefined}
              aria-pressed={entry.id === 'select' ? undefined : undefined}
              disabled={disabled}
              aria-label={disabled ? `${entry.label}. ${disabledReason}` : entry.label}
              title={disabledReason}
              onClick={() => {
                if (entry.id === 'select') {
                  onSelectTool();
                } else {
                  onToggleSheet(entry.id);
                }
              }}
            >
              {entry.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
