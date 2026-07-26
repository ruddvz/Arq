/**
 * Contracts for renderer-assisted semantic picking.
 *
 * A GPU draw ID is an ephemeral packet-local handle. It is resolved through a
 * revision-matched table before it can affect selection in the semantic model.
 * The helpers below deliberately contain no WebGPU objects so they can be
 * tested in Node and shared by WebGL2 and WebGPU renderer adapters.
 */

export type Revision = number;
export type SemanticElementId = string;

/** WebGPU texture-to-buffer rows must use this byte alignment. */
export const WEBGPU_COPY_BYTES_PER_ROW_ALIGNMENT = 256;
export const PICK_ID_BYTES = Uint32Array.BYTES_PER_ELEMENT;

export interface PickReadbackLayout {
  readonly layerCount: number;
  readonly bytesPerRow: number;
  readonly bytesPerLayer: number;
  readonly totalBytes: number;
}

export interface PhysicalPixel {
  readonly x: number;
  readonly y: number;
}

export interface CanvasRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface RenderExtent {
  readonly width: number;
  readonly height: number;
}

export interface RenderPickTarget {
  readonly elementId: SemanticElementId;
  readonly subelement?: 'body' | 'face' | 'edge' | 'opening' | 'layer';
  readonly sourceRevision: Revision;
}

export interface PickFrame {
  readonly renderRevision: Revision;
  readonly drawIdToTarget: ReadonlyMap<number, RenderPickTarget>;
}

export interface RawPickLayer {
  readonly layerIndex: number;
  readonly drawId: number;
  readonly normalizedDepth?: number;
}

export interface SemanticPickLayer {
  readonly layerIndex: number;
  readonly drawId: number;
  readonly target: RenderPickTarget;
  readonly normalizedDepth?: number;
}

export interface PickRequestStamp {
  readonly requestId: string;
  readonly renderRevision: Revision;
}

export interface CurrentPickState {
  readonly requestId: string;
  readonly renderRevision: Revision;
}

function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

/**
 * Layout for a single pixel copied from each inspect-through layer into one
 * reusable staging buffer. The caller sets copyTextureToBuffer.offset to
 * layerIndex * bytesPerLayer and bytesPerRow to this layout's bytesPerRow.
 */
export function createPickReadbackLayout(layerCount: number): PickReadbackLayout {
  if (!Number.isSafeInteger(layerCount) || layerCount < 1) {
    throw new Error('Pick layer count must be a positive safe integer.');
  }

  const bytesPerRow = alignTo(PICK_ID_BYTES, WEBGPU_COPY_BYTES_PER_ROW_ALIGNMENT);

  return {
    layerCount,
    bytesPerRow,
    bytesPerLayer: bytesPerRow,
    totalBytes: bytesPerRow * layerCount,
  };
}

/**
 * Converts a CSS pointer location into the top-left physical-pixel coordinate
 * used by the render target. Callers pass the current backing-store extent,
 * which already reflects device-pixel ratio and any renderer rounding policy.
 * This avoids assuming that CSS size multiplied by devicePixelRatio equals the
 * actual WebGPU texture size.
 */
export function toPhysicalPixel(
  cssX: number,
  cssY: number,
  rect: CanvasRect,
  extent: RenderExtent,
): PhysicalPixel | undefined {
  if (
    !Number.isFinite(cssX) ||
    !Number.isFinite(cssY) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    !Number.isSafeInteger(extent.width) ||
    !Number.isSafeInteger(extent.height) ||
    extent.width <= 0 ||
    extent.height <= 0
  ) {
    return undefined;
  }

  const x = Math.floor(((cssX - rect.left) / rect.width) * extent.width);
  const y = Math.floor(((cssY - rect.top) / rect.height) * extent.height);

  if (x < 0 || y < 0 || x >= extent.width || y >= extent.height) {
    return undefined;
  }

  return { x, y };
}

/**
 * Resolves one or more GPU layers to semantic targets. Draw ID 0 is reserved
 * for the background. A result is rejected when its render revision is no
 * longer the current revision, preventing stale buffer mappings from selecting
 * a different model after a rebuild.
 */
export function resolveSemanticPickLayers(
  frame: PickFrame,
  currentRenderRevision: Revision,
  layers: readonly RawPickLayer[],
): readonly SemanticPickLayer[] {
  if (frame.renderRevision !== currentRenderRevision) {
    return [];
  }

  const results: SemanticPickLayer[] = [];
  for (const layer of layers) {
    if (layer.drawId === 0) {
      continue;
    }
    const target = frame.drawIdToTarget.get(layer.drawId);
    if (!target || target.sourceRevision !== currentRenderRevision) {
      continue;
    }
    results.push({
      layerIndex: layer.layerIndex,
      drawId: layer.drawId,
      target,
      normalizedDepth: layer.normalizedDepth,
    });
  }
  return results;
}

export function acceptsPickResult(request: PickRequestStamp, current: CurrentPickState): boolean {
  return (
    request.requestId === current.requestId && request.renderRevision === current.renderRevision
  );
}
