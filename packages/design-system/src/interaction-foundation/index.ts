/**
 * ARQ Interaction Foundation 1.0: motion vocabulary, spatial overlays
 * (Context HUD), command feedback and input-ownership helpers.
 *
 * Boundaries (docs 00-DECISIONS, adapted into this repository):
 * - React Aria remains the accessibility foundation; nothing here duplicates
 *   its dialog/menu/focus behaviour.
 * - Motion is presentation-only: it never owns semantic project state,
 *   geometry, camera, snapping, pointer truth or command state, and no
 *   semantic commit lives in an animation callback.
 * - Floating UI owns overlay screen geometry only.
 * - Virtualisation (TanStack Virtual) is deliberately NOT part of this
 *   foundation: the one large list (the model tree's 5,000-row fixture
 *   level) is already virtualised by the repo-owned model-panel
 *   implementation, and "one coherent system" beats a second virtualiser.
 *   Adopt TanStack only with a measured case it serves better, stable
 *   semantic row identity, and focus/selection tests - never with array
 *   indices as identity.
 * - Lenis is prohibited in editor-critical paths and enforced by
 *   scripts/check-editor-dependency-boundaries.mjs.
 */

export * from './motion';
export * from './overlays';
export * from './feedback';
export * from './interaction';
