import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type ReactNode } from 'react';
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import { AnimatePresence, motion } from 'motion/react';
import { createScreenPointAnchor, type ScreenPoint } from './screen-anchor';
import { useArqReducedMotion } from '../motion/use-arq-reduced-motion';
import { arqControlTransition } from '../motion/transitions';
import './context-hud.css';

export interface ContextHudHandle {
  /**
   * Recompute placement from the current anchor ref. Called imperatively from
   * pointer handlers so anchor movement never routes through React state -
   * a plain function call per move, not a render.
   */
  reposition: () => void;
}

export type ContextHudProps = Readonly<{
  open: boolean;
  /**
   * Mutable client-coordinate anchor. The HUD holds one stable virtual
   * element over this ref for its whole life; the caller mutates
   * `anchorRef.current` and calls `reposition()`. A null anchor parks the
   * HUD off-viewport, which is why `open` must also be false whenever the
   * anchor is invalid (W014's stale-anchor rule).
   */
  anchorRef: { readonly current: ScreenPoint | null };
  children: ReactNode;
  label: string;
  testId?: string;
}>;

/**
 * W014-adjacent spatial presentation primitive: one reusable cursor/geometry
 * anchored HUD engine (wall drawing today; move/rotate/offset/placement
 * tools later). Presentation only - tool state, geometry, units, validation
 * and commits remain owned by the editor. Positioning is Floating UI
 * (offset + flip + shift keep it inside the viewport and off the pointer
 * target); presence is a Level 2 fade with reduced-motion support; the layer
 * sits at --arq-z-context-hud (90), below menus, dialogs and toasts by the
 * shell-tokens.css tier policy.
 */
export const ContextHud = forwardRef<ContextHudHandle, ContextHudProps>(function ContextHud(
  { open, anchorRef, children, label, testId },
  handleRef,
) {
  const reducedMotion = useArqReducedMotion();
  const virtualAnchor = useMemo(() => createScreenPointAnchor(anchorRef), [anchorRef]);

  const { refs, floatingStyles, update } = useFloating({
    placement: 'right-start',
    strategy: 'fixed',
    // autoUpdate re-anchors on scroll/resize/browser zoom while mounted;
    // pointer-driven movement comes through reposition() instead.
    whileElementsMounted: autoUpdate,
    middleware: [offset(14), flip({ padding: 12 }), shift({ padding: 12 })],
  });

  const updateRef = useRef(update);
  updateRef.current = update;
  useImperativeHandle(handleRef, () => ({ reposition: () => updateRef.current() }), []);

  useEffect(() => {
    refs.setReference(virtualAnchor);
  }, [refs, virtualAnchor]);

  return (
    <AnimatePresence>
      {open ? (
        // Positioning (Floating UI) and presence (Motion) are deliberately on
        // separate elements: the outer div is pure screen geometry, the inner
        // motion element is pure presentation - neither can interfere with
        // the other, and neither ever touches tool or model state.
        <div
          ref={refs.setFloating}
          className="arq-context-hud"
          style={floatingStyles}
          onWheel={(event) => {
            // The HUD is not a scroll surface: stop wheel events here so they
            // neither zoom the viewport underneath nor scroll an ancestor. A
            // child that genuinely owns scrolling must opt in and manage its
            // own wheel behaviour.
            event.stopPropagation();
          }}
        >
          <motion.div
            className="arq-context-hud__surface"
            role="group"
            aria-label={label}
            data-testid={testId}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={arqControlTransition(reducedMotion)}
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
});
