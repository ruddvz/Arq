import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_CAPABILITIES,
  capabilitiesForSurface,
  capabilityUnavailableReason,
  isCapabilityEnabled,
  isSurfaceAvailable,
  registryGates,
  surfaceUnavailableReason,
  type CapabilityId,
} from './capability-gates';

describe('DEFAULT_WORKSPACE_CAPABILITIES', () => {
  /**
   * Execution prompt §6: "Do not put screenshot/demo claims into production as
   * facts." The default posture is off; only the path this repository has
   * actually built is on.
   */
  it('enables only the core plan path by default', () => {
    const enabled = Object.entries(DEFAULT_WORKSPACE_CAPABILITIES)
      .filter(([, on]) => on)
      .map(([id]) => id);
    expect(enabled).toEqual(['CAP-core-plan']);
  });

  it('covers every gate the registry declares', () => {
    const registryIds = registryGates()
      .map((gate) => gate.id)
      .sort();
    expect(Object.keys(DEFAULT_WORKSPACE_CAPABILITIES).sort()).toEqual(registryIds);
  });
});

describe('capabilityUnavailableReason', () => {
  it('returns null when enabled', () => {
    expect(capabilityUnavailableReason(DEFAULT_WORKSPACE_CAPABILITIES, 'CAP-core-plan')).toBeNull();
  });

  it('gives a user-readable reason for every disabled gate', () => {
    for (const id of Object.keys(DEFAULT_WORKSPACE_CAPABILITIES) as CapabilityId[]) {
      if (!isCapabilityEnabled(DEFAULT_WORKSPACE_CAPABILITIES, id)) {
        const reason = capabilityUnavailableReason(DEFAULT_WORKSPACE_CAPABILITIES, id);
        expect(reason).toBeTruthy();
        // Registry status strings are notes to implementers, not sentences for
        // an architect to read in the UI.
        expect(reason).not.toContain('gated-until');
        expect(reason).not.toContain('repo-evidence');
      }
    }
  });
});

describe('surface gating', () => {
  it('maps surfaces to gates from the registry', () => {
    expect(capabilitiesForSurface('WS-02')).toEqual(['CAP-core-plan']);
    expect(capabilitiesForSurface('WS-20')).toEqual(['CAP-ai']);
  });

  it('treats an ungated surface as available', () => {
    expect(capabilitiesForSurface('WS-01')).toEqual([]);
    expect(isSurfaceAvailable(DEFAULT_WORKSPACE_CAPABILITIES, 'WS-01')).toBe(true);
  });

  it('blocks a gated surface and says why', () => {
    expect(isSurfaceAvailable(DEFAULT_WORKSPACE_CAPABILITIES, 'WS-13')).toBe(false);
    expect(surfaceUnavailableReason(DEFAULT_WORKSPACE_CAPABILITIES, 'WS-13')).toBe(
      'Sharing, issues and comments are not available yet',
    );
  });

  it('requires every gate on a multi-gated surface', () => {
    const partly = { ...DEFAULT_WORKSPACE_CAPABILITIES, 'CAP-ai': true };
    // WS-20 is AI-only, so enabling AI is enough for it...
    expect(isSurfaceAvailable(partly, 'WS-20')).toBe(true);
    // ...but the collaboration surfaces stay shut.
    expect(isSurfaceAvailable(partly, 'WS-09')).toBe(false);
  });

  it('has no reason to give for an available surface', () => {
    expect(surfaceUnavailableReason(DEFAULT_WORKSPACE_CAPABILITIES, 'WS-02')).toBeNull();
  });
});
