import { useReducedMotion } from 'motion/react';

/**
 * ARQ presentation-motion preference. Reduced motion removes travel and
 * decorative transition, never visibility, state feedback, focus movement or
 * error/success communication - and it must never change command semantics,
 * input precision or commit behaviour.
 */
export function useArqReducedMotion(): boolean {
  return Boolean(useReducedMotion());
}
