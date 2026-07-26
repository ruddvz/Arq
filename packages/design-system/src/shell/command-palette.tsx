import { useMemo, useState, type KeyboardEvent } from 'react';
import { searchCommandPaletteEntries, type CommandPaletteEntry } from './command-palette-search';
import { ArqModalDialog } from './modal-dialog';

export interface CommandPaletteProps {
  readonly entries: readonly CommandPaletteEntry[];
  readonly onInvoke: (entry: CommandPaletteEntry) => void;
  readonly onClose: () => void;
}

/**
 * ARQ-029: build command palette shell. Blueprint section 30 ("Command
 * palette") - see command-palette-search.ts for the search algorithm and
 * its non-goals (recent-command persistence, no-result telemetry, AI
 * actions are all left to a caller/later issue).
 *
 * Accessible active-descendant handling (section 30's own explicit
 * requirement): the input keeps DOM focus at all times (so a screen
 * reader/IME never loses the text cursor); the currently-highlighted
 * result is tracked as `aria-activedescendant` on the input, pointing at
 * the highlighted `<li>`'s id, per the standard combobox/listbox pattern -
 * not by moving focus onto each list item.
 *
 * States: a disabled entry (`disabledReason` set) renders `aria-disabled`
 * and its reason as visible text (section 126: never colour-only), and
 * Enter on a disabled entry does not invoke it. Keyboard: ArrowUp/ArrowDown
 * move the highlight (wrapping), Enter invokes the highlighted entry,
 * Escape closes the palette (section 30: "keyboard-first"). iPad touch:
 * each result is also a real tap target rendered at the same 44px minimum
 * as every other shell control, via `.arq-shell-button`.
 *
 * UI-003: the outer chrome (backdrop, focus trap, outside-click close, opener
 * focus restoration on every close path) comes from `ArqModalDialog` - before
 * this wrapping, the palette was `role="dialog"` on a plain `<div>` with none
 * of that: Tab could escape into the background shell, and closing it never
 * returned focus to whatever button opened it. The palette's own
 * active-descendant combobox behaviour inside is unchanged - `ArqModalDialog`
 * only owns the boundary around it.
 */
export function CommandPalette(props: CommandPaletteProps): JSX.Element {
  const { entries, onInvoke, onClose } = props;
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const matches = useMemo(() => searchCommandPaletteEntries(entries, query), [entries, query]);
  const clampedIndex = matches.length === 0 ? -1 : Math.min(highlightedIndex, matches.length - 1);
  const activeDescendantId =
    clampedIndex >= 0 ? `arq-command-palette-option-${matches[clampedIndex]?.entry.id}` : undefined;

  function moveHighlight(delta: number): void {
    if (matches.length === 0) {
      return;
    }
    setHighlightedIndex((current) => {
      const base = Math.min(current, matches.length - 1);
      return (base + delta + matches.length) % matches.length;
    });
  }

  function invokeHighlighted(): void {
    if (clampedIndex < 0) {
      return;
    }
    const match = matches[clampedIndex];
    if (match === undefined || match.entry.disabledReason !== undefined) {
      return;
    }
    onInvoke(match.entry);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      invokeHighlighted();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <ArqModalDialog
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      aria-label="Command palette"
    >
      <div
        className="arq-command-palette arq-shell-panel"
        style={{
          borderRadius: 'var(--arq-radius-menu)',
          border: '1px solid var(--arq-ui-line-default)',
          padding: 'var(--arq-space-compact)',
          width: 480,
        }}
      >
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="arq-command-palette-listbox"
          aria-activedescendant={activeDescendantId}
          aria-label="Search commands"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          style={{ width: '100%' }}
        />
        <ul
          id="arq-command-palette-listbox"
          role="listbox"
          aria-label="Command results"
          style={{ listStyle: 'none', margin: 0, padding: 0 }}
        >
          {matches.map((match, index) => {
            const disabled = match.entry.disabledReason !== undefined;
            return (
              <li
                key={match.entry.id}
                id={`arq-command-palette-option-${match.entry.id}`}
                role="option"
                aria-selected={index === clampedIndex}
                aria-disabled={disabled}
                className="arq-shell-button"
                style={{ width: '100%', justifyContent: 'space-between' }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => {
                  if (!disabled) {
                    onInvoke(match.entry);
                  }
                }}
              >
                <span>{match.entry.label}</span>
                <span
                  style={{
                    color: 'var(--arq-ui-text-muted)',
                    display: 'inline-flex',
                    gap: 'var(--arq-space-control-group)',
                  }}
                >
                  <span>{disabled ? match.entry.disabledReason : match.entry.category}</span>
                  {!disabled && match.entry.shortcutLabel !== undefined && (
                    <kbd style={{ fontFamily: 'inherit' }}>{match.entry.shortcutLabel}</kbd>
                  )}
                </span>
              </li>
            );
          })}
          {matches.length === 0 && <li role="presentation">No results</li>}
        </ul>
      </div>
    </ArqModalDialog>
  );
}
