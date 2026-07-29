import { describe, expect, it } from 'vitest';
import { arqMotionDuration, arqMotionSpring } from './tokens';

describe('ARQ motion tokens', () => {
  it('keeps editor UI transitions short - restraint is the vocabulary', () => {
    expect(arqMotionDuration.instant).toBe(0);
    expect(arqMotionDuration.micro).toBeLessThanOrEqual(120);
    expect(arqMotionDuration.fast).toBe(120);
    expect(arqMotionDuration.normal).toBeLessThanOrEqual(240);
    expect(arqMotionDuration.deliberate).toBeLessThanOrEqual(300);
  });

  it('orders the vocabulary monotonically so names mean what they say', () => {
    expect(arqMotionDuration.instant).toBeLessThan(arqMotionDuration.micro);
    expect(arqMotionDuration.micro).toBeLessThan(arqMotionDuration.fast);
    expect(arqMotionDuration.fast).toBeLessThan(arqMotionDuration.normal);
    expect(arqMotionDuration.normal).toBeLessThan(arqMotionDuration.deliberate);
  });

  it('keeps springs heavily damped - precision instruments do not overshoot', () => {
    for (const profile of Object.values(arqMotionSpring)) {
      expect(profile.damping).toBeGreaterThanOrEqual(40);
    }
  });
});
