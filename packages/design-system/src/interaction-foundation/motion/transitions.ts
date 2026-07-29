import { arqMotionDuration, arqMotionEase } from './tokens';

/**
 * Shared Motion transition builders - Level 2 (controls/HUD) and Level 3
 * (panels/dialogs) presets. Reduced motion keeps a perceivable micro fade so
 * controls do not appear broken or teleporting, while removing travel.
 */
export function arqControlTransition(reducedMotion: boolean) {
  return {
    duration: (reducedMotion ? arqMotionDuration.micro : arqMotionDuration.fast) / 1000,
    ease: arqMotionEase.standard,
  };
}

export function arqPanelTransition(reducedMotion: boolean) {
  return {
    duration: (reducedMotion ? arqMotionDuration.micro : arqMotionDuration.normal) / 1000,
    ease: arqMotionEase.enter,
  };
}
