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
}

export interface ToolRailProps {
  readonly toolsByCategory: Readonly<Record<ToolRailCategory, readonly ToolRailToolDefinition[]>>;
  readonly state: ToolRailState;
  readonly onToggleCategory: (category: ToolRailCategory) => void;
  readonly onSelectTool: (category: ToolRailCategory, toolId: string) => void;
}

const CATEGORY_LABEL: Readonly<Record<ToolRailCategory, string>> = {
  select: 'Select',
  draw: 'Draw',
  build: 'Build',
  modify: 'Modify',
  annotate: 'Annotate',
  measure: 'Measure',
  view: 'View',
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
export function ToolRail(props: ToolRailProps): JSX.Element {
  const { toolsByCategory, state, onToggleCategory, onSelectTool } = props;

  return (
    <nav
      className="arq-tool-rail arq-shell-panel"
      aria-label="Tools"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--arq-ui-line-subtle)',
        width: 200,
      }}
    >
      {TOOL_RAIL_CATEGORIES.map((category) => {
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
                {toolsByCategory[category].map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    className="arq-shell-button"
                    aria-pressed={isToolActive(state, tool.id)}
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
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
