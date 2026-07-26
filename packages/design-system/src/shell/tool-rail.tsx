import type { ReactNode } from 'react';
import {
  TOOL_RAIL_CATEGORIES,
  isCategoryExpanded,
  isToolActive,
  type ToolRailCategory,
  type ToolRailState,
} from './tool-rail-state';

export interface ToolRailToolDefinition {
  readonly id: string;
  readonly label: string;
  /** An already-resolved icon element (e.g. `<WallIcon />` from @arq/icons) - this package stays icon-agnostic, per its own doc comment. */
  readonly icon?: ReactNode;
  /**
   * Package 3.0 execution prompt §3 ("Every control must have a contract"):
   * "No mystery icons. Every icon/action must map to a registry ID, accessible
   * label, enabled/disabled reason..." A tool that cannot be used carries the
   * sentence explaining why, and the rail renders it disabled-but-visible - the
   * context-menu registry's "Unavailable action stays visible with reason when
   * discoverability matters". Absent means the tool is available.
   */
  readonly disabledReason?: string;
}

export interface ToolRailProps {
  readonly toolsByCategory: Readonly<
    Partial<Record<ToolRailCategory, readonly ToolRailToolDefinition[]>>
  >;
  readonly state: ToolRailState;
  readonly onToggleCategory: (category: ToolRailCategory) => void;
  readonly onSelectTool: (category: ToolRailCategory, toolId: string) => void;
  /**
   * Which categories this rail shows, in `TOOL_RAIL_CATEGORIES` order. Package
   * 3.0 doc 34 gives each workspace mode a different set (Present shows View
   * only); omitting the prop shows every category, which is the pre-Package-3.0
   * behaviour.
   */
  readonly visibleCategories?: readonly ToolRailCategory[];
}

const CATEGORY_LABEL: Readonly<Record<ToolRailCategory, string>> = {
  select: 'Select',
  draw: 'Draw',
  build: 'Build',
  modify: 'Modify',
  annotate: 'Annotate',
  measure: 'Measure',
  view: 'View',
  review: 'Review',
};

/**
 * ARQ-024: build tool rail. Blueprint section 12 > "Left tool rail" - see
 * tool-rail-state.ts for rules and the category-icon non-goal (categories
 * are labelled by text, not a category-level pictogram: no such icon exists
 * yet in design/icons/svg/, which only covers individual tools within a
 * category, e.g. Wall/Door/Window under Build - and section 174 already
 * warns "generic icon libraries are insufficient," so an invented category
 * glyph would be worse than a clear label, not better).
 *
 * States: `aria-expanded` on each category button drives hover/active via
 * shell-controls.css's `.arq-shell-button`; the active tool gets
 * `aria-pressed="true"`, which that same stylesheet renders as the
 * blueprint's "black icon container with white glyph" (section 18) - an
 * unmistakable state, not colour-only, since `aria-pressed` is also
 * announced to assistive tech. Keyboard: category buttons are a native
 * disclosure pattern (button + aria-expanded/aria-controls); tool buttons
 * inside an expanded category are reachable by Tab once expanded. iPad
 * touch: inherits `.arq-shell-button`'s 44px minimum target.
 */
/**
 * The rendered width of this rail, in CSS px.
 *
 * Exported because it is a layout fact other code has to reason about, not just
 * a style. Package 3.0's `workspace-layout-slots.json` allows 48px for the tool
 * rail - an icon-only rail - and this one is 200px because its categories are
 * labelled by text (see the component doc above for why). The canvas-floor
 * calculation in @arq/workspace has to be told the real number; hard-coding the
 * registry's 48 there would leave the floor ~150px optimistic.
 */
export const TOOL_RAIL_WIDTH_PX = 200;

export function ToolRail(props: ToolRailProps): JSX.Element {
  const { toolsByCategory, state, onToggleCategory, onSelectTool, visibleCategories } = props;
  const shown =
    visibleCategories === undefined
      ? TOOL_RAIL_CATEGORIES
      : TOOL_RAIL_CATEGORIES.filter((category) => visibleCategories.includes(category));

  return (
    <nav
      className="arq-tool-rail arq-shell-panel"
      aria-label="Tools"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--arq-ui-line-subtle)',
        width: TOOL_RAIL_WIDTH_PX,
        flex: '0 0 auto',
      }}
    >
      {shown.map((category) => {
        const expanded = isCategoryExpanded(state, category);
        const panelId = `arq-tool-rail-panel-${category}`;
        return (
          <div key={category}>
            <button
              type="button"
              className="arq-shell-button"
              aria-expanded={expanded}
              aria-controls={panelId}
              style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => onToggleCategory(category)}
            >
              {CATEGORY_LABEL[category]}
            </button>
            {expanded && (
              <div id={panelId} role="group" aria-label={`${CATEGORY_LABEL[category]} tools`}>
                {(toolsByCategory[category] ?? []).map((tool) => {
                  const disabled = tool.disabledReason !== undefined;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className="arq-shell-button"
                      aria-pressed={isToolActive(state, tool.id)}
                      disabled={disabled}
                      // The reason goes into the accessible name, not only the
                      // tooltip: a `title` is unreachable by keyboard and by
                      // touch, so a tooltip-only explanation is no explanation.
                      aria-label={disabled ? `${tool.label}. ${tool.disabledReason}` : undefined}
                      title={tool.disabledReason}
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        paddingLeft: 'var(--arq-space-section)',
                      }}
                      onClick={() => onSelectTool(category, tool.id)}
                    >
                      {tool.icon}
                      {tool.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
