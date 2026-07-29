import { useEffect, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useArqReducedMotion } from '../motion/use-arq-reduced-motion';
import { arqControlTransition } from '../motion/transitions';
import { formatFeedbackTitle, type CommandFeedbackStore } from './command-feedback-state';
import './command-feedback.css';

/**
 * W135 ToastRegion (CMP-029): the visible half of the command-feedback
 * queue. `aria-live="polite"` announces additions without stealing focus;
 * entries never contain controls the user must reach, so the region itself
 * stays out of the tab order. Hover/focus pauses expiry per CMP-029. Sits at
 * --arq-z-toast, the top presentation tier, and bottom-right so it obstructs
 * neither the active pointer nor a cursor-anchored HUD.
 */
export function CommandFeedbackRegion({
  store,
}: Readonly<{ store: CommandFeedbackStore }>): JSX.Element {
  const reducedMotion = useArqReducedMotion();
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);

  useEffect(() => {
    const interval = window.setInterval(() => store.expire(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [store]);

  return (
    <div
      className="arq-command-feedback"
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      onPointerEnter={() => store.pause(Date.now())}
      onPointerLeave={() => store.resume(Date.now())}
      onFocus={() => store.pause(Date.now())}
      onBlur={() => store.resume(Date.now())}
    >
      <AnimatePresence initial={false}>
        {state.entries.map((entry) => (
          <motion.p
            key={entry.id}
            className="arq-command-feedback__entry"
            data-tone={entry.tone}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={arqControlTransition(reducedMotion)}
          >
            {/* Tone is exposed as text for screen readers and as a leading
                glyph for sighted users - colour is never the only indicator. */}
            <span className="arq-command-feedback__tone" aria-hidden="true">
              {entry.tone === 'success' ? '✓' : entry.tone === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="arq-visually-hidden">
              {entry.tone === 'success' ? 'Success:' : entry.tone === 'error' ? 'Failed:' : ''}
            </span>
            {formatFeedbackTitle(entry)}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
