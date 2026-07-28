import { useRef, type RefObject } from 'react';

/**
 * The wall tool's Context HUD content: one distance field over the numeric
 * overlay (ARQ-053) that createWallDrawTool already owns. This component
 * renders text and reports edits - it never parses units itself
 * (parseMetricLength via parseNumericOverlay is the only parser), never
 * commits (Enter/Escape are owned by PlanCanvas's capture-phase wall
 * listener, the same dispatch point clicks use), and never holds state the
 * tool does not: the value shown IS the overlay's distanceText.
 *
 * The placeholder is the live cursor-derived length, so the field always
 * communicates the current preview even before the user types. mm is the
 * app's display unit (App.tsx's own unitLabel), written with a space per
 * the voice standard for measurements.
 */
export interface WallHudEntryProps {
  readonly valueText: string;
  readonly placeholder: string;
  readonly invalid: boolean;
  readonly onValueChange: (text: string) => void;
  readonly inputRef: RefObject<HTMLInputElement>;
}

export function WallHudEntry(props: WallHudEntryProps): JSX.Element {
  const { valueText, placeholder, invalid, onValueChange, inputRef } = props;
  const composingRef = useRef(false);

  return (
    <div style={{ display: 'flex', gap: 'var(--arq-space-micro)', alignItems: 'baseline' }}>
      <label
        htmlFor="arq-wall-length-input"
        style={{ fontSize: '0.8125em', color: 'var(--arq-ui-text-secondary)' }}
      >
        Length
      </label>
      <input
        id="arq-wall-length-input"
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={valueText}
        placeholder={placeholder}
        aria-label="Wall length in millimetres"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'arq-wall-length-error' : 'arq-wall-length-hint'}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          // IME text is offered to the overlay only once composition ends -
          // a mid-composition commit would take half-formed text. A refused
          // value snaps the input back to the overlay's accepted text.
          composingRef.current = false;
          onValueChange(event.currentTarget.value);
          const input = inputRef.current;
          if (input !== null && input.value !== valueText) {
            input.value = valueText;
          }
        }}
        onChange={(event) => {
          if (composingRef.current) {
            return;
          }
          onValueChange(event.currentTarget.value);
        }}
        style={{
          width: '7ch',
          font: 'inherit',
          padding: '2px var(--arq-space-micro)',
          border: '1px solid var(--arq-ui-line-default)',
          borderRadius: 'var(--arq-radius-control)',
          background: 'var(--arq-ui-paper)',
          color: 'var(--arq-ui-text-primary)',
        }}
      />
      <span aria-hidden="true" style={{ fontSize: '0.8125em', color: 'var(--arq-ui-text-muted)' }}>
        mm
      </span>
      {invalid ? (
        <span
          id="arq-wall-length-error"
          role="status"
          style={{ fontSize: '0.75em', color: 'var(--arq-ui-ink)', fontWeight: 600 }}
        >
          Not a length - try 3500 or 3.5m
        </span>
      ) : (
        <span id="arq-wall-length-hint" hidden>
          Type a length in millimetres, or with an mm, cm or m suffix. Enter places the point;
          Escape clears.
        </span>
      )}
    </div>
  );
}
