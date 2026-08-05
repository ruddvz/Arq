/**
 * Guards the seam between the checked-in Package 3.0/4.0 registries and the
 * TypeScript that reads them. Every failure here means the JSON and the code
 * have drifted - which is exactly the failure the registries exist to prevent,
 * so it must break the build rather than degrade at runtime.
 */

import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_GATES,
  KEYBOARD_COMMANDS,
  LAYOUT_SLOTS,
  PANEL_CONTRACTS,
  TAB_KIND_CONTRACTS,
  TOOL_CONTRACTS,
  TOOL_GROUPS,
  WORKSPACE_INVARIANTS,
  WORKSPACE_STATE_MACHINES,
  capabilityGate,
  layoutSlots,
  panelContract,
  tabKindContract,
  toolContract,
  toolsInGroup,
} from './registry';
import { PANEL_IDS, registryPanelId } from './panel-layout-state';

describe('registry counts match the package', () => {
  it('ships the documented tab kinds, tools, panels and gates', () => {
    expect(TAB_KIND_CONTRACTS).toHaveLength(12);
    expect(TOOL_CONTRACTS).toHaveLength(54);
    expect(TOOL_GROUPS).toHaveLength(8);
    expect(PANEL_CONTRACTS).toHaveLength(6);
    expect(CAPABILITY_GATES).toHaveLength(7);
    expect(KEYBOARD_COMMANDS).toHaveLength(10);
    expect(Object.keys(LAYOUT_SLOTS)).toHaveLength(8);
  });
});

describe('registry ids are unique', () => {
  it('has no duplicate tool, panel, gate, command or tab id', () => {
    const unique = (ids: readonly string[]): number => new Set(ids).size;
    expect(unique(TOOL_CONTRACTS.map((t) => t.id))).toBe(TOOL_CONTRACTS.length);
    expect(unique(PANEL_CONTRACTS.map((p) => p.id))).toBe(PANEL_CONTRACTS.length);
    expect(unique(CAPABILITY_GATES.map((g) => g.id))).toBe(CAPABILITY_GATES.length);
    expect(unique(KEYBOARD_COMMANDS.map((c) => c.id))).toBe(KEYBOARD_COMMANDS.length);
    expect(unique(TAB_KIND_CONTRACTS.map((t) => t.kind))).toBe(TAB_KIND_CONTRACTS.length);
  });
});

describe('registry cross-references resolve', () => {
  it('assigns every tool to a declared group', () => {
    const groups = new Set<string>(TOOL_GROUPS);
    for (const tool of TOOL_CONTRACTS) {
      expect(groups.has(tool.group), `${tool.id} has unknown group ${tool.group}`).toBe(true);
    }
    expect(TOOL_GROUPS.flatMap((group) => toolsInGroup(group))).toHaveLength(TOOL_CONTRACTS.length);
  });

  it('gives every tool a non-empty icon, activation, cancel, touch and keyboard contract', () => {
    for (const tool of TOOL_CONTRACTS) {
      expect(tool.icon.length, `${tool.id} has no icon`).toBeGreaterThan(0);
      expect(tool.activation.length).toBeGreaterThan(0);
      expect(tool.cancel.length).toBeGreaterThan(0);
      expect(tool.touch.length).toBeGreaterThan(0);
      expect(tool.keyboard.length).toBeGreaterThan(0);
    }
  });

  it('uses only the two documented tool statuses', () => {
    for (const tool of TOOL_CONTRACTS) {
      expect(['existing-or-partial', 'design-specified-capability-gated']).toContain(tool.status);
    }
  });

  it('resolves every PanelId this package exposes to a registry panel', () => {
    for (const id of PANEL_IDS) {
      expect(panelContract(registryPanelId(id)), `no registry panel for ${id}`).not.toBeNull();
    }
    expect(PANEL_IDS).toHaveLength(PANEL_CONTRACTS.length);
  });

  it('gives every docked panel a sane width range', () => {
    for (const panel of PANEL_CONTRACTS) {
      const { defaultWidth, min, max } = panel.desktop;
      expect(defaultWidth).toBeGreaterThan(0);
      if (min !== undefined && max !== undefined) {
        expect(min).toBeLessThanOrEqual(defaultWidth);
        expect(max).toBeGreaterThanOrEqual(defaultWidth);
      }
    }
  });
});

describe('layout slots', () => {
  it('gives every desktop layout a top bar, tab strip and canvas floor', () => {
    for (const id of ['desktop1536', 'wide1920', 'compact1366', 'desktop1024']) {
      const slots = layoutSlots(id);
      expect(slots, `missing layout ${id}`).not.toBeNull();
      expect(slots?.topBar).toBeGreaterThan(0);
      expect(slots?.tabStrip).toBeGreaterThan(0);
    }
    // Only the layouts that dock both panels declare a canvas floor; the 1024
    // set floats the inspector outright and the touch layouts use drawers.
    expect(layoutSlots('desktop1536')?.canvasMinWidth).toBe(620);
    expect(layoutSlots('wide1920')?.canvasMinWidth).toBe(900);
    expect(layoutSlots('desktop1024')?.rightPanel).toBe('overlay');
  });
});

describe('lookup helpers', () => {
  it('return null rather than throwing on unknown ids', () => {
    expect(toolContract('nope')).toBeNull();
    expect(panelContract('nope')).toBeNull();
    expect(capabilityGate('nope')).toBeNull();
    expect(layoutSlots('nope')).toBeNull();
  });

  it('round-trip every declared id', () => {
    for (const tool of TOOL_CONTRACTS) {
      expect(toolContract(tool.id)?.id).toBe(tool.id);
    }
    for (const contract of TAB_KIND_CONTRACTS) {
      expect(tabKindContract(contract.kind)?.kind).toBe(contract.kind);
    }
  });
});

describe('state machines and invariants', () => {
  it('carries the workspace state machines the package defines', () => {
    for (const machine of ['workspace-open', 'tab', 'tool', 'panel', 'save', 'sync', 'selection']) {
      expect(WORKSPACE_STATE_MACHINES[machine]?.length ?? 0).toBeGreaterThan(0);
    }
  });

  /**
   * These four sentences are the reason several modules in this package are
   * shaped the way they are. If the registry ever stops carrying them, the
   * design rationale in those files has lost its source.
   *
   * Pinned by content, not by count. The registry is a list of design
   * invariants and it is meant to grow as the design does - a new state machine
   * that needs a rule should be able to add one - so an exact-length assertion
   * would be enforcing something this test never set out to say, and would make
   * every future invariant look like a regression.
   */
  it('still carries the four founding workspace invariants', () => {
    const text = WORKSPACE_INVARIANTS.join(' ');

    expect(text).toContain('Local save and remote sync are separate');
    expect(text).toContain('never deletes model data');
    expect(text).toContain('never becomes canonical until transaction commit');
    expect(text).toContain('never overwrite newer document revision');
  });

  it('states a rule for every state machine that needs one', () => {
    // The machines added for view visibility, section clipping and import units
    // each carry a rule about what their states must never be taken to mean.
    const text = WORKSPACE_INVARIANTS.join(' ');

    expect(text).toContain('never imply the project contains less');
    expect(text).toContain('never resolves to a default');
  });
});
