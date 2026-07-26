import type { SheetId } from '@arq/workspace';

export interface TabletDrawerBarProps {
  readonly openSheet: SheetId | null;
  readonly onToggleSheet: (sheet: SheetId) => void;
  readonly reviewDisabledReason?: string;
}

const ENTRIES: readonly { readonly id: SheetId; readonly label: string }[] = [
  { id: 'project-browser', label: 'Browser' },
  { id: 'tools', label: 'Tools' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'review', label: 'Review' },
];

/**
 * Doc 46 > iPad landscape: "floating tool palette, Browser drawer, Inspector
 * drawer". A drawer needs a handle, and on a tablet there is no phone dock to
 * hold one.
 *
 * Deliberately a thin horizontal bar rather than the phone's five-up dock. A
 * tablet keeps the view-tab strip and has room for labelled controls, so this
 * sits with the tabs as a peer rather than claiming a whole edge of the screen
 * — doc 46's rule for tablets is "canvas first", and a 56px bottom dock on an
 * 834px-tall portrait iPad is canvas the user does not get back.
 *
 * `aria-expanded` rather than `aria-pressed`: these open a drawer, they do not
 * toggle a setting, and a screen reader should say so.
 */
export function TabletDrawerBar(props: TabletDrawerBarProps): JSX.Element {
  const { openSheet, onToggleSheet, reviewDisabledReason } = props;

  return (
    <nav
      className="arq-tablet-drawer-bar arq-shell-panel"
      aria-label="Workspace panels"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 'var(--arq-space-micro)',
        padding: '0 var(--arq-space-compact)',
        borderBottom: '1px solid var(--arq-ui-line-subtle)',
        flex: '0 0 auto',
      }}
    >
      {ENTRIES.map((entry) => {
        const disabledReason = entry.id === 'review' ? reviewDisabledReason : undefined;
        const disabled = disabledReason !== undefined;
        return (
          <button
            key={entry.id}
            type="button"
            className="arq-shell-button"
            aria-expanded={openSheet === entry.id}
            aria-haspopup="dialog"
            disabled={disabled}
            aria-label={disabled ? `${entry.label}. ${disabledReason}` : entry.label}
            title={disabledReason}
            onClick={() => onToggleSheet(entry.id)}
          >
            {entry.label}
          </button>
        );
      })}
    </nav>
  );
}
