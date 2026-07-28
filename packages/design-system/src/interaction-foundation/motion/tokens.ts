/**
 * ARQ Interaction Foundation: the motion vocabulary.
 *
 * The single source for every scripted duration/easing in product UI - the
 * TypeScript mirror of the `--arq-motion-*` / `--arq-ease-*` custom properties
 * in shell-tokens.css. `fast` is 120ms because that is what every shipped
 * transition already used as a literal before these tokens existed
 * (modal-dialog.css, workspace-shell.css) - the vocabulary promotes the
 * de-facto value rather than inventing a new one.
 *
 * Restraint rules (blueprint section 20, docs 02-MOTION-GRAMMAR):
 * - Level 0 surfaces (geometry, camera, snapping, pointer) get NO motion -
 *   these tokens must never be used to interpolate world coordinates, zoom,
 *   or drawn geometry.
 * - No `transition: all`, no decorative bounce, no ambient movement.
 * - Springs only where a named profile justifies them.
 */

export const arqMotionDuration = {
  instant: 0,
  micro: 90,
  fast: 120,
  normal: 180,
  deliberate: 260,
} as const;

export type ArqMotionDuration = keyof typeof arqMotionDuration;

export const arqMotionEase = {
  standard: [0.2, 0, 0, 1],
  enter: [0.16, 1, 0.3, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export type ArqMotionEase = keyof typeof arqMotionEase;

/**
 * Named spring profiles - the only springs permitted in editor UI. `control`
 * is for small control feedback, `panel` for panel/sheet travel. Both are
 * heavily damped: precision instruments do not overshoot.
 */
export const arqMotionSpring = {
  control: { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 },
  panel: { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 },
} as const;

export type ArqMotionSpring = keyof typeof arqMotionSpring;
