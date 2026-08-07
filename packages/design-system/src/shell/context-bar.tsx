import type { ReactNode } from 'react';
import { isContextBarVisible } from './context-bar-state';

export interface ContextBarAction {
  readonly id: string;
  readonly label: string;
  readonly icon?: ReactNode;
  readonly onActivate: () => void;
}

export interface ContextBarProps {
  readonly activeToolId: string | null;
  readonly selectionCount: number;
  readonly actions: readonly ContextBarAction[];
}

/**
 * ARQ-028: build context bar. Blueprint section 12 > "Context bar" - see
 * context-bar-state.ts for the visibility rule.
 *
 * Non-goal (section 12's own rule, enforced by omission): "it never
 * duplicates the whole inspector" - this component only ever renders the
 * caller-supplied `actions` list (the "most likely immediate controls"),
 * never a fields/groups view like inspector-shell.tsx.
 *
 * States: renders nothing at all when `isContextBarVisible` is false (not
 * an empty/disabled bar left on screen) - "it disappears after tool exit",
 * which includes having no actions to carry.
 * Keyboard: each action is a native button, Tab-reachable in order.
 * Positioning ("never covers critical model content without
 * repositioning") is left to the caller's layout (a fixed shell slot in
 * apps/web, not a floating overlay computed here - this component has no
 * knowledge of canvas content bounds).
 */
export function ContextBar(props: ContextBarProps): JSX.Element | null {
  const { activeToolId, selectionCount, actions } = props;
  if (!isContextBarVisible(activeToolId, selectionCount, actions.length)) {
    return null;
  }
  return (
    <div
      role="toolbar"
      aria-label="Context actions"
      className="arq-context-bar arq-shell-panel"
      style={{
        display: 'flex',
        gap: 'var(--arq-space-compact)',
        padding: 'var(--arq-space-compact)',
        borderTop: '1px solid var(--arq-ui-line-subtle)',
      }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className="arq-shell-button"
          onClick={action.onActivate}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}
