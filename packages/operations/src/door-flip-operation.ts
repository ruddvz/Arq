/**
 * ARQ-106: implement door flip controls.
 *
 * Wraps flipSide/flipHand (bim-core's door-instance.ts, ARQ-104 - the
 * pure side/hand toggle) as UpdateProperty operations (ARQ-068), so
 * flipping an already-placed, committed Door goes through the same
 * operation log / undo-stack path every other property edit does,
 * rather than inventing a new operation type. No new operation *kind*
 * is introduced (non-goal: don't introduce unreviewed dependencies) -
 * buildFlipDoorSideOperation/buildFlipDoorHandOperation only compute
 * the flipped value and hand it to buildUpdatePropertyOperation;
 * applying either one is exactly applyUpdateProperty, unchanged, which
 * is why this module does not re-export an "apply" wrapper of its own.
 *
 * This is deliberately about a door that already exists as a committed
 * project element. During initial placement, before a Door is
 * committed at all, flipping is door-placement-tool.ts's own
 * flipSide/flipHand (ARQ-105) - a live preview toggle with nothing yet
 * to log to an operation history.
 *
 * Escape/Enter: flipping is a single, instantaneous, fully-specified
 * edit - there is no multi-step preview to cancel (unlike
 * wall-draw-tool.ts's chain or door-placement-tool.ts's in-progress
 * placement), so Escape/Enter have no meaning at this
 * operation-construction layer; whatever UI triggers a flip (a toolbar
 * button, a keyboard shortcut on a selected door) either builds and
 * applies this operation immediately or does not invoke it at all -
 * there is no intermediate state to escape out of.
 *
 * Invalid input leaves committed project state unchanged the same way
 * every UpdateProperty operation already does: applyUpdateProperty
 * rejects, and leaves the door list untouched, when the target
 * elementId does not exist (verified in this module's test file by
 * calling applyUpdateProperty directly against a built flip operation).
 */

import { flipHand, flipSide, type Door } from '@arq/bim-core';
import type { ProjectId } from '@arq/bim-core';
import type { ModelOperation, OperationId } from './operation';
import {
  buildUpdatePropertyOperation,
  type UpdatePropertyPayload,
} from './update-property-operation';

export interface BuildFlipDoorParams {
  readonly id: OperationId;
  readonly actorId: string;
  readonly projectId: ProjectId;
  readonly baseRevision: number;
  readonly timestamp: string;
  readonly door: Door;
}

/** Section 46's "flip side": an UpdateProperty operation setting Door.side to its flipped value. */
export function buildFlipDoorSideOperation(
  params: BuildFlipDoorParams,
): ModelOperation<UpdatePropertyPayload<Door, 'side'>> {
  return buildUpdatePropertyOperation<Door, 'side'>({
    id: params.id,
    actorId: params.actorId,
    projectId: params.projectId,
    baseRevision: params.baseRevision,
    timestamp: params.timestamp,
    elementId: params.door.id,
    propertyKey: 'side',
    newValue: flipSide(params.door).side,
  });
}

/** Section 46's "flip hand": an UpdateProperty operation setting Door.hand to its flipped value. */
export function buildFlipDoorHandOperation(
  params: BuildFlipDoorParams,
): ModelOperation<UpdatePropertyPayload<Door, 'hand'>> {
  return buildUpdatePropertyOperation<Door, 'hand'>({
    id: params.id,
    actorId: params.actorId,
    projectId: params.projectId,
    baseRevision: params.baseRevision,
    timestamp: params.timestamp,
    elementId: params.door.id,
    propertyKey: 'hand',
    newValue: flipHand(params.door).hand,
  });
}
