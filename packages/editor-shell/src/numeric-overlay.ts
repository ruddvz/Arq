/**
 * ARQ-053: numeric overlay.
 *
 * Implements docs/components/CMP-054-numeric-overlay.md's purpose ("Enter
 * distance and angle during a command"): typing a precise distance and/or
 * angle overrides whatever the raw cursor position would otherwise imply,
 * exactly like AutoCAD-style dynamic input. This module is pure text/state
 * handling and geometry - no rendering, no DOM.
 *
 * Two independent fields (distance, angle) can each be empty (use the
 * cursor-derived fallback) or hold typed text. Only one field is focused
 * at a time; Tab-between-fields is the caller's concern (via focusField),
 * same layering as the keyboard/command modules.
 *
 * Escape/Enter (matching command-lifecycle.ts, ARQ-038, whose "clears
 * field" tier this implements the content of): escape() clears the
 * focused field's text if it has any, otherwise defocuses entirely
 * (leaving the *other* field's typed value intact - clearing one field
 * must not discard the other). Enter has no behaviour of its own here;
 * committing the resolved point is the caller's command lifecycle.
 */

import type { WorldPoint } from '@arq/geometry-2d';
import { worldPoint } from '@arq/geometry-2d';

export type NumericOverlayField = 'distance' | 'angle';

export interface NumericOverlayState {
  readonly field: NumericOverlayField | null;
  readonly distanceText: string;
  readonly angleText: string;
}

function isValidChar(field: NumericOverlayField, text: string, char: string): boolean {
  if (char >= '0' && char <= '9') {
    return true;
  }
  if (char === '.') {
    return !text.includes('.');
  }
  if (char === '-' && field === 'angle') {
    return text === '';
  }
  return false;
}

export function createNumericOverlay() {
  let field: NumericOverlayField | null = null;
  let distanceText = '';
  let angleText = '';

  function snapshot(): NumericOverlayState {
    return { field, distanceText, angleText };
  }

  function focusField(target: NumericOverlayField): NumericOverlayState {
    field = target;
    return snapshot();
  }

  function typeChar(char: string): NumericOverlayState {
    if (!field) {
      return snapshot();
    }
    const current = field === 'distance' ? distanceText : angleText;
    if (!isValidChar(field, current, char)) {
      return snapshot();
    }
    if (field === 'distance') {
      distanceText += char;
    } else {
      angleText += char;
    }
    return snapshot();
  }

  function backspace(): NumericOverlayState {
    if (!field) {
      return snapshot();
    }
    if (field === 'distance') {
      distanceText = distanceText.slice(0, -1);
    } else {
      angleText = angleText.slice(0, -1);
    }
    return snapshot();
  }

  /** Clears the focused field's text first; only defocuses once it is already empty. */
  function escape(): NumericOverlayState {
    if (!field) {
      return snapshot();
    }
    const current = field === 'distance' ? distanceText : angleText;
    if (current.length > 0) {
      if (field === 'distance') {
        distanceText = '';
      } else {
        angleText = '';
      }
      return snapshot();
    }
    field = null;
    return snapshot();
  }

  function reset(): NumericOverlayState {
    field = null;
    distanceText = '';
    angleText = '';
    return snapshot();
  }

  return { snapshot, focusField, typeChar, backspace, escape, reset };
}

export interface ParsedNumericOverlay {
  readonly distance: number | null;
  readonly angleRadians: number | null;
}

/** Parses typed text into validated numbers; an empty or non-numeric field parses to null (use the fallback). Distance must be non-negative. */
export function parseNumericOverlay(state: NumericOverlayState): ParsedNumericOverlay {
  const distance = state.distanceText === '' ? NaN : Number(state.distanceText);
  const angleDegrees = state.angleText === '' ? NaN : Number(state.angleText);
  return {
    distance: Number.isFinite(distance) && distance >= 0 ? distance : null,
    angleRadians: Number.isFinite(angleDegrees) ? (angleDegrees * Math.PI) / 180 : null,
  };
}

export function pointFromDistanceAndAngle(
  from: WorldPoint,
  distance: number,
  angleRadians: number,
): WorldPoint {
  return worldPoint(
    from.x + distance * Math.cos(angleRadians),
    from.y + distance * Math.sin(angleRadians),
  );
}

/** Resolves the point to use: a validly-typed field overrides the cursor-derived fallback for that field only. */
export function resolveNumericOverlayPoint(
  parsed: ParsedNumericOverlay,
  from: WorldPoint,
  fallbackDistance: number,
  fallbackAngleRadians: number,
): WorldPoint {
  return pointFromDistanceAndAngle(
    from,
    parsed.distance ?? fallbackDistance,
    parsed.angleRadians ?? fallbackAngleRadians,
  );
}
