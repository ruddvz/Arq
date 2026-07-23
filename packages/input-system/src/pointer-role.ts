/**
 * ARQ-171: ipad: test Pencil web input.
 *
 * Blueprint section 13 ("iPad shell")'s "Input roles" assigns distinct
 * interaction capabilities to Apple Pencil, Finger, and Keyboard/
 * trackpad, and requires this separation to be real: "Touch, Pencil,
 * keyboard and mouse have distinct interaction rules" (section 11).
 * "Web support must use capability detection. It must not assume native
 * Pencil APIs" (section 13) - this module classifies purely from the
 * standard W3C Pointer Events API's `pointerType` string
 * ('pen' | 'touch' | 'mouse'), the only Pencil-detection mechanism the
 * web platform actually exposes; there is no native/proprietary Pencil
 * API used or assumed anywhere here.
 *
 * Named `'mouse'`, not `'keyboard'`, for the third role: a PointerEvent
 * can only ever report `pointerType: 'mouse'` for a trackpad or mouse
 * click - it cannot observe keyboard input at all (keyboard events are
 * an entirely separate DOM event family; see keyboard-gesture.ts).
 * Section 13 labels this role "Keyboard and trackpad" because both
 * happen to share the same interaction rules, not because a single
 * PointerEvent field can distinguish them - this module's role name
 * stays accurate to what it can actually detect.
 *
 * Deliberately DOM-free like pointer-gesture.ts: takes a plain
 * `pointerType` string rather than a real `PointerEvent`, so it is
 * testable without a browser and usable from any input source.
 */

export type PointerInputRole = 'pencil' | 'finger' | 'mouse';

/** Classifies a raw `PointerEvent.pointerType` into its interaction role. Any value other than 'pen' or 'touch' (including 'mouse' and any future/unrecognized value) safely defaults to 'mouse' - the mouse/trackpad role's rules are the least input-specific, so treating an unknown pointer type as one is the safe default. */
export function classifyPointerInputRole(pointerType: string): PointerInputRole {
  if (pointerType === 'pen') {
    return 'pencil';
  }
  if (pointerType === 'touch') {
    return 'finger';
  }
  return 'mouse';
}

/** Section 13's own per-role interaction list, verbatim, as checkable data rather than only prose. */
export const POINTER_ROLE_ACTIONS: Readonly<Record<PointerInputRole, readonly string[]>> = {
  pencil: [
    'precise-point-selection',
    'drawing',
    'hover-preview',
    'handle-manipulation',
    'annotation',
    'contextual-tool-action',
  ],
  finger: ['pan', 'pinch-zoom', 'orbit', 'broad-selection', 'interface-controls'],
  mouse: [
    'commands',
    'numeric-entry',
    'shortcuts',
    'precision-selection',
    'desktop-like-navigation',
  ],
};

/** True when `action` is one of `role`'s own interaction rules (section 13) - the check a tool should make before letting a given pointer role trigger it. */
export function pointerRoleAllows(role: PointerInputRole, action: string): boolean {
  return POINTER_ROLE_ACTIONS[role].includes(action);
}
