/**
 * ARQ-172: ipad: prototype native hover.
 *
 * Blueprint section 13 ("iPad shell") assigns "hover preview" to Apple
 * Pencil specifically, not to Finger or Keyboard/trackpad's own action
 * lists (pointer-role.ts, ARQ-171) - this tracker enforces that
 * separation directly: only a pointer `classifyPointerInputRole`s as
 * `'pencil'` can start a hover-preview session at all. A mouse or touch
 * `over`/`move` sample is a no-op here, not a silently-different
 * behaviour - a desktop mouse-hover-highlight feature, if this
 * repository ever builds one, is a distinct, separately-scoped concern
 * from this section-13-specific Pencil interaction.
 *
 * Section 108 lists "Apple Pencil hover" under native-only "value", and
 * section 102's own principle ("Native iPad work continues only where
 * it is measurably better than the browser") means the web version
 * should be built and measured first, not skipped - ARQ-171 already
 * confirmed the real `pointerover`/`pointerout` mechanism this tracker
 * depends on works in a real browser engine (headless Chromium) even
 * without a preceding `pointerdown`; this module is the actual
 * hover-preview state machine built on top of that confirmed capability.
 *
 * A real contact (`pointerdown`) always ends the current hover-preview
 * session for that pointer - hover and drag are mutually exclusive
 * states for the same physical pointer, matching how a real Pencil
 * transitions from "hovering above the surface" to "touching it".
 *
 * Deliberately DOM-free, like pointer-gesture.ts: plain samples rather
 * than PointerEvent, testable without a browser.
 */

import { classifyPointerInputRole } from './pointer-role';

export interface HoverSample {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly x: number;
  readonly y: number;
}

export type HoverPreviewEvent =
  | { readonly type: 'hover-start'; readonly x: number; readonly y: number }
  | { readonly type: 'hover-move'; readonly x: number; readonly y: number }
  | { readonly type: 'hover-end' };

/** A single-pointer hover-preview tracker, gated to the Pencil role only (section 13). */
export function createHoverPreviewTracker() {
  let activePointerId: number | null = null;

  function over(sample: HoverSample): readonly HoverPreviewEvent[] {
    if (classifyPointerInputRole(sample.pointerType) !== 'pencil') {
      return [];
    }
    activePointerId = sample.pointerId;
    return [{ type: 'hover-start', x: sample.x, y: sample.y }];
  }

  function move(sample: HoverSample): readonly HoverPreviewEvent[] {
    if (activePointerId === null || activePointerId !== sample.pointerId) {
      return [];
    }
    return [{ type: 'hover-move', x: sample.x, y: sample.y }];
  }

  function out(sample: { readonly pointerId: number }): readonly HoverPreviewEvent[] {
    if (activePointerId === null || activePointerId !== sample.pointerId) {
      return [];
    }
    activePointerId = null;
    return [{ type: 'hover-end' }];
  }

  /** Real contact ends hover preview for this pointer, same event shape as `out`. */
  function down(sample: { readonly pointerId: number }): readonly HoverPreviewEvent[] {
    return out(sample);
  }

  function isHovering(): boolean {
    return activePointerId !== null;
  }

  return { over, move, out, down, isHovering };
}
