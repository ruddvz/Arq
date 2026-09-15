import type { CollapsiblePanelId, PanelDockSide } from '@arq/workspace';

export interface PanelCollapseControlProps {
  readonly panel: CollapsiblePanelId;
  readonly side: PanelDockSide;
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
}

const PANEL_LABEL: Readonly<Record<CollapsiblePanelId, string>> = {
  'project-browser': 'Project browser',
  inspector: 'Inspector',
};

/**
 * Stable edge control for desktop panel collapse/reopen.
 *
 * The control remains mounted in both states so keyboard focus does not vanish
 * when the panel body becomes inert. The host owns panel state; this component
 * only expresses the user's collapse intent.
 */
export function PanelCollapseControl(props: PanelCollapseControlProps): JSX.Element {
  const { panel, side, collapsed, onCollapsedChange } = props;
  const label = PANEL_LABEL[panel];
  const action = collapsed ? 'Expand' : 'Collapse';
  const glyph = side === 'left' ? (collapsed ? '›' : '‹') : collapsed ? '‹' : '›';

  return (
    <button
      type="button"
      className="arq-shell-button arq-workspace__panel-collapse-control"
      data-panel-collapse-control={panel}
      aria-controls={`arq-workspace-panel-${panel}`}
      aria-expanded={!collapsed}
      aria-label={`${action} ${label.toLowerCase()}`}
      title={`${action} ${label}`}
      onClick={() => onCollapsedChange(!collapsed)}
      style={{
        alignSelf: 'stretch',
        flex: '0 0 28px',
        width: 28,
        minWidth: 28,
        padding: 0,
        borderRadius: 0,
      }}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
