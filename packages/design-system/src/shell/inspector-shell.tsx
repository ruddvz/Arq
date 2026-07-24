import { useState } from 'react';
import {
  describeFieldState,
  hasOverrideMarker,
  isFieldEditable,
  type InspectorGroup,
} from './inspector-groups';

export interface InspectorShellProps {
  readonly groups: readonly InspectorGroup[];
  readonly selectedElementDescription: string | null;
}

/**
 * ARQ-026: build inspector shell. Blueprint section 12 > "Right inspector" -
 * see inspector-groups.ts for group order, rules, and the Placement/
 * Constraints/Visibility/Source empty-state non-goal.
 *
 * States: each group is a native `<details>` disclosure (expanded by
 * default) - keyboard-operable without any custom JS (Space/Enter on the
 * `<summary>` toggles it natively), matching "keyboard focus... specified"
 * without reinventing a disclosure widget. An overridden field shows a
 * visible "●" marker plus the `describeFieldState` text (never colour
 * alone, section 126); a calculated/missing field's input is disabled
 * (section 12: "read-only"); an invalid field's input carries
 * `aria-invalid` and stays enabled, with `describeFieldState`'s reason
 * shown as visible help text right under it. iPad touch: field rows use
 * the shared 44px-minimum `.arq-shell-button`-equivalent spacing via the
 * panel's own padding tokens (section 19).
 */
export function InspectorShell(props: InspectorShellProps): JSX.Element {
  const { groups, selectedElementDescription } = props;
  const [openGroups] = useState(() => new Set(groups.map((g) => g.id)));

  if (selectedElementDescription === null) {
    return (
      <aside className="arq-inspector-shell arq-shell-panel" aria-label="Inspector">
        <p>No selection</p>
      </aside>
    );
  }

  return (
    <aside
      className="arq-inspector-shell arq-shell-panel"
      aria-label="Inspector"
      style={{
        borderLeft: '1px solid var(--arq-ui-line-subtle)',
        padding: 'var(--arq-space-panel)',
        width: 280,
      }}
    >
      <p>{selectedElementDescription}</p>
      {groups.map((group) => (
        <details key={group.id} open={openGroups.has(group.id)}>
          <summary>{group.label}</summary>
          {group.content.kind === 'fields' ? (
            group.content.fields.length === 0 ? (
              <p style={{ color: 'var(--arq-ui-text-muted)' }}>No data</p>
            ) : (
              <dl>
                {group.content.fields.map((field) => {
                  const editable = isFieldEditable(field);
                  const invalid = field.kind === 'invalid';
                  return (
                    <div key={field.key}>
                      <dt>
                        {field.label}
                        {hasOverrideMarker(field) && <span aria-hidden="true"> ●</span>}
                      </dt>
                      <dd>
                        <input
                          aria-label={field.label}
                          aria-invalid={invalid}
                          disabled={!editable}
                          defaultValue={field.displayValue ?? ''}
                        />
                        <span>{describeFieldState(field)}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            )
          ) : group.content.lines.length === 0 ? (
            <p style={{ color: 'var(--arq-ui-text-muted)' }}>No data</p>
          ) : (
            <ul>
              {group.content.lines.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          )}
        </details>
      ))}
    </aside>
  );
}
