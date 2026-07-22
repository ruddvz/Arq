/**
 * ARQ-119: implement plan scene abstraction (renderer contract half).
 *
 * "Renderers consume these structures" (blueprint section 60): the one
 * seam every 2D renderer backend implements, so the rest of the editor
 * never has to know which backend is active. This is the concrete
 * abstraction ADR-0008 (ARQ-118) names as its own safeguard - Canvas 2D
 * is that ADR's chosen v1 backend, PixiJS WebGL is the documented
 * upgrade path, and switching later means implementing this interface
 * a second way, not rewriting call sites.
 *
 * Deliberately minimal: render() takes an already-built PlanScene
 * (ARQ-119's other half, plan-scene.ts) and a Viewport
 * (@arq/geometry-2d, ARQ-032/033) and draws it - nothing about pointer
 * input, animation, or a specific canvas/DOM element is part of this
 * contract, since those are backend-specific concerns each
 * implementation manages its own way (a Canvas 2D backend owns a
 * <canvas> element; a PixiJS backend owns a PIXI.Application). No
 * backend is implemented here - that is ARQ-120's job (stable line
 * weights) and onward; this issue only defines the seam they implement.
 */

import type { Viewport } from '@arq/geometry-2d';
import type { PlanScene } from './plan-scene';

export interface PlanRenderer<TId> {
  /** Draws `scene` as it should appear through `viewport` - a full redraw or an incremental update is entirely the implementation's choice. */
  render(scene: PlanScene<TId>, viewport: Viewport): void;
}
