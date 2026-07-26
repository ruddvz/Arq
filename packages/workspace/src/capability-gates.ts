/**
 * `workspace-capability-gates.json` and the Package 3.0 execution prompt §6
 * ("Capability truth"): "Collaboration, AI, broad exchange, native shells and
 * other not-yet-shipped systems are fully designed but must remain
 * feature-gated until current repository evidence enables them. Do not put
 * screenshot/demo claims into production as facts."
 *
 * The defaults in `DEFAULT_WORKSPACE_CAPABILITIES` are the honest ones: every
 * gate whose registry status is `gated-until-current-repo-evidence` or stronger
 * starts **off**. Turning one on is a deliberate act by the host application
 * once the backing system exists, not something this package assumes because a
 * package directory with a matching name is present in the monorepo.
 */

import { CAPABILITY_GATES, type CapabilityGateContract } from './registry';

export type CapabilityId =
  | 'CAP-core-plan'
  | 'CAP-3d'
  | 'CAP-document'
  | 'CAP-collaboration'
  | 'CAP-ai'
  | 'CAP-native'
  | 'CAP-broad-exchange';

export type WorkspaceCapabilities = Readonly<Record<CapabilityId, boolean>>;

/**
 * `CAP-core-plan` is the only gate on by default. Its registry status is
 * "current/protected-path" - 2D plan authoring is the path this repository has
 * actually built and tested (@arq/plan-renderer, @arq/editor-shell tools,
 * @arq/operations). Everything else is off until a caller proves otherwise.
 *
 * `CAP-3d`, `CAP-document` and `CAP-broad-exchange` are off despite having
 * near-term registry statuses. Prototype adapters exist in this repository, but
 * "a prototype exists" is not "the workspace may present it as a capability",
 * and the execution prompt is explicit that demo evidence is not a shipping
 * claim.
 */
export const DEFAULT_WORKSPACE_CAPABILITIES: WorkspaceCapabilities = Object.freeze({
  'CAP-core-plan': true,
  'CAP-3d': false,
  'CAP-document': false,
  'CAP-collaboration': false,
  'CAP-ai': false,
  'CAP-native': false,
  'CAP-broad-exchange': false,
});

export function isCapabilityEnabled(
  capabilities: WorkspaceCapabilities,
  id: CapabilityId,
): boolean {
  return capabilities[id];
}

/**
 * The user-facing reason a gated surface is unavailable, or null when it is
 * available. Deliberately does not leak the registry's internal status strings
 * ("gated-until-current-repo-evidence") into the interface - those are notes to
 * implementers, not sentences to show an architect.
 */
export function capabilityUnavailableReason(
  capabilities: WorkspaceCapabilities,
  id: CapabilityId,
): string | null {
  if (capabilities[id]) {
    return null;
  }
  switch (id) {
    case 'CAP-core-plan':
      return 'Plan authoring is not available in this build';
    case 'CAP-3d':
      return '3D views are not available yet';
    case 'CAP-document':
      return 'Sheets and schedules are not available yet';
    case 'CAP-collaboration':
      return 'Sharing, issues and comments are not available yet';
    case 'CAP-ai':
      return 'AI proposals are not available yet';
    case 'CAP-native':
      return 'This action needs a desktop or mobile app build';
    case 'CAP-broad-exchange':
      return 'This file format is not supported yet';
  }
}

/**
 * `workspace-capability-gates.json` maps each gate to the workspace surfaces
 * (`WS-01`…`WS-30`) it governs. Inverting that here means a surface asks one
 * question - "am I allowed?" - instead of every call site re-deriving which
 * gate applies to it and drifting from the registry.
 */
const GATES_BY_SURFACE = ((): ReadonlyMap<string, readonly CapabilityId[]> => {
  const index = new Map<string, CapabilityId[]>();
  for (const gate of CAPABILITY_GATES) {
    for (const surface of gate.surfaces) {
      const existing = index.get(surface);
      if (existing === undefined) {
        index.set(surface, [gate.id as CapabilityId]);
      } else {
        existing.push(gate.id as CapabilityId);
      }
    }
  }
  return index;
})();

export function capabilitiesForSurface(surfaceId: string): readonly CapabilityId[] {
  return GATES_BY_SURFACE.get(surfaceId) ?? [];
}

/**
 * A surface governed by several gates needs all of them: `WS-13` (share) is
 * collaboration, and a share dialog that opens with sharing switched off is a
 * lie regardless of what else is enabled. A surface governed by *no* gate is
 * ungated and available - that is the registry's own default, not a fallback.
 */
export function isSurfaceAvailable(
  capabilities: WorkspaceCapabilities,
  surfaceId: string,
): boolean {
  return capabilitiesForSurface(surfaceId).every((id) => capabilities[id]);
}

export function surfaceUnavailableReason(
  capabilities: WorkspaceCapabilities,
  surfaceId: string,
): string | null {
  for (const id of capabilitiesForSurface(surfaceId)) {
    const reason = capabilityUnavailableReason(capabilities, id);
    if (reason !== null) {
      return reason;
    }
  }
  return null;
}

/** Exposed for the registry-integrity test. */
export function registryGates(): readonly CapabilityGateContract[] {
  return CAPABILITY_GATES;
}
