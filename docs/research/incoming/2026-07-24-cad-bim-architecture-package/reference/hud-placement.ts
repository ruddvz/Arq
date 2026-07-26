/**
 * Contextual HUD placement is presentation-only. It must never alter a
 * document, a tool state, or the current model transaction.
 *
 * The function chooses a corner around the pointer, avoids protected screen
 * areas such as a palette or a text caret, and keeps the panel in the usable
 * viewport. Velocity tilt is intentionally a separate calculation so an
 * active text input can keep the HUD steady.
 */

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ScreenInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export type HudCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface HudPlacementOptions {
  readonly offset?: number;
  readonly protectedRects?: readonly ScreenRect[];
  readonly insets?: Partial<ScreenInsets>;
}

export interface HudPlacement {
  readonly x: number;
  readonly y: number;
  readonly corner: HudCorner;
  readonly wasClamped: boolean;
  readonly protectedOverlapArea: number;
}

const DEFAULT_INSETS: ScreenInsets = { top: 8, right: 8, bottom: 8, left: 8 };
const CORNERS: readonly HudCorner[] = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];

export function placeContextualHud(
  anchor: ScreenPoint,
  panel: ScreenSize,
  viewport: ScreenSize,
  options: HudPlacementOptions = {},
): HudPlacement {
  assertFinitePositive(panel.width, 'panel.width');
  assertFinitePositive(panel.height, 'panel.height');
  assertFinitePositive(viewport.width, 'viewport.width');
  assertFinitePositive(viewport.height, 'viewport.height');

  const offset = options.offset ?? 16;
  assertFiniteNonNegative(offset, 'offset');
  const insets: ScreenInsets = { ...DEFAULT_INSETS, ...options.insets };
  const protectedRects = options.protectedRects ?? [];

  let best: HudPlacement | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let order = 0; order < CORNERS.length; order += 1) {
    const corner = CORNERS[order];
    const preferred = preferredPosition(anchor, panel, offset, corner);
    const clamped = clampPosition(preferred, panel, viewport, insets);
    const rect: ScreenRect = { x: clamped.x, y: clamped.y, ...panel };
    const overlap = protectedRects.reduce(
      (area, protectedRect) => area + intersectionArea(rect, protectedRect),
      0,
    );
    const displacement = Math.hypot(clamped.x - preferred.x, clamped.y - preferred.y);
    const score = overlap * 1_000_000 + displacement * 1_000 + order;

    if (score < bestScore) {
      bestScore = score;
      best = {
        x: clamped.x,
        y: clamped.y,
        corner,
        wasClamped: displacement > 0,
        protectedOverlapArea: overlap,
      };
    }
  }

  return best!;
}

export interface VelocityTiltOptions {
  readonly maxDegrees?: number;
  readonly saturationPixelsPerSecond?: number;
  readonly reducedMotion?: boolean;
  readonly inputFocused?: boolean;
}

/**
 * Convert horizontal pointer velocity into a small visual tilt. This should be
 * applied only to a decorative inner surface, not to focusable controls.
 */
export function velocityTilt(velocityX: number, options: VelocityTiltOptions = {}): number {
  if (!Number.isFinite(velocityX) || options.reducedMotion || options.inputFocused) {
    return 0;
  }

  const maxDegrees = options.maxDegrees ?? 1.5;
  const saturation = options.saturationPixelsPerSecond ?? 1_200;
  assertFiniteNonNegative(maxDegrees, 'maxDegrees');
  assertFinitePositive(saturation, 'saturationPixelsPerSecond');

  return clamp((velocityX / saturation) * maxDegrees, -maxDegrees, maxDegrees);
}

function preferredPosition(
  anchor: ScreenPoint,
  panel: ScreenSize,
  offset: number,
  corner: HudCorner,
): ScreenPoint {
  const right = anchor.x + offset;
  const left = anchor.x - panel.width - offset;
  const bottom = anchor.y + offset;
  const top = anchor.y - panel.height - offset;

  switch (corner) {
    case 'bottom-right':
      return { x: right, y: bottom };
    case 'bottom-left':
      return { x: left, y: bottom };
    case 'top-right':
      return { x: right, y: top };
    case 'top-left':
      return { x: left, y: top };
  }
}

function clampPosition(
  position: ScreenPoint,
  panel: ScreenSize,
  viewport: ScreenSize,
  insets: ScreenInsets,
): ScreenPoint {
  const maxX = Math.max(insets.left, viewport.width - insets.right - panel.width);
  const maxY = Math.max(insets.top, viewport.height - insets.bottom - panel.height);
  return {
    x: clamp(position.x, insets.left, maxX),
    y: clamp(position.y, insets.top, maxY),
  };
}

function intersectionArea(a: ScreenRect, b: ScreenRect): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(name + ' must be a finite positive number.');
  }
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(name + ' must be a finite non-negative number.');
  }
}
