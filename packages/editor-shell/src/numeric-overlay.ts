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
import { parseMetricLength } from './metric-numeric-input';

export type NumericOverlayField = 'distance' | 'angle';

/**
 * Whole-text validity while the user is mid-edit: everything a keystroke
 * sequence toward a parseable value passes through. Distance follows
 * parseMetricLength's grammar (digits, one dot, optional space, optional
 * mm/cm/m suffix - partial suffixes like a lone 'c' are valid *in-progress*
 * states even though they do not parse yet); angle is degrees with an
 * optional leading minus. This is what lets a DOM input support selection
 * and replacement (setFieldText) without a second parser: the text is
 * validated here and parsed only by parseMetricLength / Number.
 */
const DISTANCE_TEXT_PATTERN = /^\d*\.?\d*\s?(m|mm|c|cm)?$/i;
const ANGLE_TEXT_PATTERN = /^-?\d*\.?\d*$/;

export function isValidOverlayFieldText(field: NumericOverlayField, text: string): boolean {
  return field === 'distance' ? DISTANCE_TEXT_PATTERN.test(text) : ANGLE_TEXT_PATTERN.test(text);
}

export interface NumericOverlayState {
  readonly field: NumericOverlayField | null;
  readonly distanceText: string;
  readonly angleText: string;
}

function isValidChar(field: NumericOverlayField, text: string, char: string): boolean {
  return isValidOverlayFieldText(field, text + char);
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

  /**
   * Replaces a field's whole text - the DOM-input path (select-all + retype,
   * paste, IME commit) as opposed to typeChar's per-keystroke path. Invalid
   * text leaves the state unchanged, so a controlled input simply refuses
   * the edit. Focuses the field as a side effect: replacing text is editing.
   */
  function setFieldText(target: NumericOverlayField, text: string): NumericOverlayState {
    if (!isValidOverlayFieldText(target, text)) {
      return snapshot();
    }
    field = target;
    if (target === 'distance') {
      distanceText = text;
    } else {
      angleText = text;
    }
    return snapshot();
  }

  return { snapshot, focusField, typeChar, backspace, escape, reset, setFieldText };
}

export interface ParsedNumericOverlay {
  readonly distance: number | null;
  readonly angleRadians: number | null;
}

/**
 * Parses typed text into validated numbers; an empty or non-parseable field
 * parses to null (use the cursor-derived fallback). Distance goes through
 * parseMetricLength (ARQ-054) - plain numbers stay millimetres exactly as
 * before, and mm/cm/m suffixes now resolve ('3.5m' -> 3500) - one parser,
 * not a HUD-local reimplementation. Angle is degrees -> radians.
 */
export function parseNumericOverlay(state: NumericOverlayState): ParsedNumericOverlay {
  const distance = state.distanceText === '' ? null : parseMetricLength(state.distanceText);
  const angleDegrees = state.angleText === '' ? NaN : Number(state.angleText);
  return {
    distance: distance !== null && Number.isFinite(distance) && distance >= 0 ? distance : null,
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
