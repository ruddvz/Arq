import { describe, expect, it, vi } from 'vitest';
import { toolContract } from './registry';
import { toolRailEntriesForMode } from './tool-state';
import {
  PRODUCT_COMMANDS,
  commandForShortcut,
  dispatchProductCommand,
  hasRepositoryBacking,
  productCommand,
  productEntriesForSurface,
  resolveProductCommand,
  unwiredKeyboardCommandIds,
  validateCommandDescriptors,
  type ProductCommandContext,
} from './product-command-authority';

const DESIGN_CONTEXT: ProductCommandContext = {
  mode: 'design',
  readOnly: false,
  facts: {
    canUndo: true,
    canRedo: true,
    canCloseActiveTab: true,
    canSaveCopy: true,
    canExportSheetPdf: true,
    canPublish: true,
  },
};

describe('canonical product command catalog', () => {
  it('is structurally valid and has one descriptor per id', () => {
    expect(validateCommandDescriptors(PRODUCT_COMMANDS)).toEqual([]);
    expect(new Set(PRODUCT_COMMANDS.map((command) => command.id)).size).toBe(
      PRODUCT_COMMANDS.length,
    );
  });

  it('fails duplicate canonical ids deterministically', () => {
    const select = productCommand('select');
    expect(select).not.toBeNull();
    if (select === null) throw new Error('select descriptor missing');
    expect(validateCommandDescriptors([select, select])).toContainEqual({
      id: 'select',
      message: 'duplicate canonical id',
    });
  });

  it('rejects library-only descriptors that claim a product surface', () => {
    const select = productCommand('select');
    expect(select).not.toBeNull();
    if (select === null) throw new Error('select descriptor missing');
    expect(
      validateCommandDescriptors([
        {
          ...select,
          id: 'library-fixture',
          reachability: 'library-only',
          disabledReason: 'Library fixture has no product consumer',
          executionTarget: null,
          analyticsEventId: null,
        },
      ]),
    ).toContainEqual({
      id: 'library-fixture',
      message: 'library-only command cannot claim a product surface',
    });
  });

  it('proves one reachable view-only command', () => {
    const fit = resolveProductCommand('fit', DESIGN_CONTEXT);
    expect(fit?.available).toBe(true);
    expect(fit?.state).toBe('available');
    expect(fit?.descriptor.effect).toBe('view-only');
    expect(fit?.descriptor.executionTarget).toEqual({ kind: 'tool', id: 'fit' });
  });

  it('proves one reachable mutating command and its semantic operation', () => {
    const wall = resolveProductCommand('wall', DESIGN_CONTEXT);
    expect(wall?.available).toBe(true);
    expect(wall?.descriptor.effect).toBe('project-mutating');
    expect(wall?.descriptor.semanticOperationId).toBe('add-walls');
    expect(wall?.descriptor.persistence).toBe('journal-on-commit');
  });

  it('carries cheap icon, context, analytics and evidence metadata', () => {
    const wall = productCommand('wall');
    expect(wall?.iconId).toBe(toolContract('wall')?.icon);
    expect(wall?.requiredContext).toEqual(expect.arrayContaining(['workspace.mode', 'workspace.readOnly']));
    expect(wall?.analyticsEventId).toBe('workspace.command.wall');
    expect(wall?.evidenceOwner).toContain('#420');
    expect(productCommand('export-dxf')?.analyticsEventId).toBeNull();
  });

  it('represents intentional unavailability with a real reason', () => {
    const dxf = resolveProductCommand('export-dxf', DESIGN_CONTEXT);
    expect(dxf?.available).toBe(false);
    expect(dxf?.state).toBe('unreachable');
    expect(dxf?.descriptor.reachability).toBe('disabled-intentionally');
    expect(dxf?.disabledReason).toBe('DXF export is not implemented in the current product');
  });

  it('represents registered-but-unwired commands without pretending they execute', () => {
    for (const id of [
      'door',
      'window',
      'room-boundary',
      'window-select',
      'crossing-select',
      'selection-filter',
      'zoom',
      'focus-selection',
    ]) {
      const command = resolveProductCommand(id, DESIGN_CONTEXT);
      expect(command?.available, id).toBe(false);
      expect(command?.state, id).toBe('unreachable');
      expect(command?.descriptor.reachability, id).toBe('registered-but-not-wired');
      expect(command?.descriptor.executionTarget, id).toBeNull();
      expect(command?.disabledReason, id).toBeTruthy();
    }
  });

  it('does not infer product availability from repository backing', () => {
    for (const id of ['door', 'window', 'room-boundary']) {
      expect(hasRepositoryBacking(id), id).toBe(true);
      const command = resolveProductCommand(id, DESIGN_CONTEXT);
      expect(command?.available, id).toBe(false);
      expect(command?.descriptor.reachability, id).toBe('registered-but-not-wired');
    }
  });

  it('distinguishes direct zoom gestures from an armed Zoom tool', () => {
    const zoom = productCommand('zoom');
    expect(zoom?.libraryBacking).toBe(true);
    expect(zoom?.reachability).toBe('registered-but-not-wired');
    expect(zoom?.disabledReason).toContain('Wheel and pinch zoom are live view gestures');
  });

  it('distinguishes hidden, disabled, read-only and in-progress runtime states', () => {
    const hiddenWall = resolveProductCommand('wall', { ...DESIGN_CONTEXT, mode: 'present' });
    expect(hiddenWall).toMatchObject({ state: 'hidden', visible: false, available: false });

    const disabledClose = resolveProductCommand('close-tab', {
      ...DESIGN_CONTEXT,
      facts: { ...DESIGN_CONTEXT.facts, canCloseActiveTab: false },
    });
    expect(disabledClose).toMatchObject({ state: 'disabled', visible: true, available: false });

    const readOnlyWall = resolveProductCommand('wall', { ...DESIGN_CONTEXT, readOnly: true });
    expect(readOnlyWall).toMatchObject({ state: 'read-only', visible: true, available: false });

    const exporting = resolveProductCommand('export-sheet-pdf', {
      ...DESIGN_CONTEXT,
      inProgressCommandIds: new Set(['export-sheet-pdf']),
    });
    expect(exporting).toMatchObject({
      state: 'in-progress',
      visible: true,
      available: false,
      inProgress: true,
    });
    expect(exporting?.disabledReason).toBe('Export sheet as PDF is already in progress');
  });

  it('blocks read-only-incompatible commands while retaining view controls', () => {
    const readOnlyContext: ProductCommandContext = { ...DESIGN_CONTEXT, readOnly: true };
    expect(resolveProductCommand('wall', readOnlyContext)?.available).toBe(false);
    expect(resolveProductCommand('wall', readOnlyContext)?.state).toBe('read-only');
    expect(resolveProductCommand('wall', readOnlyContext)?.disabledReason).toBe(
      'Wall is unavailable in read-only mode',
    );
    expect(resolveProductCommand('save-a-copy', readOnlyContext)?.available).toBe(false);
    expect(resolveProductCommand('save-a-copy', readOnlyContext)?.descriptor.persistence).toBe(
      'project-persistence',
    );
    expect(resolveProductCommand('fit', readOnlyContext)?.available).toBe(true);
  });

  it('takes active state from the runtime context named by the descriptor', () => {
    const context: ProductCommandContext = {
      ...DESIGN_CONTEXT,
      activeCommandIds: new Set(['wall']),
    };
    expect(resolveProductCommand('wall', context)?.active).toBe(true);
    expect(resolveProductCommand('select', context)?.active).toBe(false);
    expect(productCommand('wall')?.activeStateSource).toBe('workspace.tool-state.activeToolId');
  });

  it('keeps the live Escape lifecycle command inside the same authority', () => {
    const escape = resolveProductCommand('escape', DESIGN_CONTEXT);
    expect(escape?.available).toBe(true);
    expect(escape?.descriptor.shortcuts?.windows).toBe('Esc');
    expect(escape?.descriptor.executionTarget).toEqual({
      kind: 'view-action',
      id: 'cancel-current-tool',
    });
  });
});

describe('surface resolution', () => {
  it('resolves command palette from canonical metadata with honest disabled states', () => {
    const entries = productEntriesForSurface('command-palette', DESIGN_CONTEXT, 'windows');
    const wall = entries.find((entry) => entry.id === 'wall');
    const door = entries.find((entry) => entry.id === 'door');
    const dxf = entries.find((entry) => entry.id === 'export-dxf');

    expect(wall).toMatchObject({ label: 'Wall', available: true, shortcutLabel: 'W' });
    expect(door).toMatchObject({ available: false, reachability: 'registered-but-not-wired' });
    expect(dxf).toMatchObject({ available: false, reachability: 'disabled-intentionally' });
    expect(dxf?.disabledReason).toBeTruthy();
  });

  it('filters hidden-by-context commands in the canonical surface resolver', () => {
    const entries = productEntriesForSurface(
      'command-palette',
      { ...DESIGN_CONTEXT, mode: 'present' },
      'windows',
    );
    expect(entries.some((entry) => entry.id === 'wall')).toBe(false);
    expect(entries.some((entry) => entry.id === 'fit')).toBe(true);
  });

  it('keeps palette and tool rail id/label/availability aligned for shared tools', () => {
    const palette = productEntriesForSurface('command-palette', DESIGN_CONTEXT, 'windows');
    const rail = toolRailEntriesForMode('design');

    for (const paletteEntry of palette) {
      const railEntry = rail.find((entry) => entry.tool.id === paletteEntry.id);
      if (railEntry === undefined) continue;
      expect(paletteEntry.label, paletteEntry.id).toBe(railEntry.tool.name);
      expect(paletteEntry.available, paletteEntry.id).toBe(railEntry.available);
      expect(paletteEntry.disabledReason, paletteEntry.id).toBe(railEntry.disabledReason);
    }
  });

  it('takes tool labels and icons from the existing tool registry rather than a second table', () => {
    for (const id of ['select', 'wall', 'door', 'room-boundary', 'fit']) {
      expect(productCommand(id)?.label).toBe(toolContract(id)?.name);
      expect(productCommand(id)?.iconId).toBe(toolContract(id)?.icon);
    }
  });

  it('provides a context-derived close-tab disabled reason', () => {
    const context: ProductCommandContext = {
      ...DESIGN_CONTEXT,
      facts: {
        canUndo: true,
        canRedo: true,
        canCloseActiveTab: false,
        canSaveCopy: true,
        canExportSheetPdf: true,
        canPublish: true,
      },
    };
    expect(resolveProductCommand('close-tab', context)?.disabledReason).toBe(
      'The active view cannot be closed',
    );
    expect(resolveProductCommand('close-tab', context)?.state).toBe('disabled');
  });

  it('models existing file actions from their live host handlers', () => {
    for (const id of ['open', 'save-a-copy', 'export-sheet-pdf', 'publish']) {
      expect(resolveProductCommand(id, DESIGN_CONTEXT)?.available, id).toBe(true);
      expect(productCommand(id)?.executionTarget?.kind, id).toBe('host-action');
    }
  });

  it('does not expose demo-only Share or Account as real top-bar capabilities', () => {
    const entries = productEntriesForSurface('top-bar', DESIGN_CONTEXT, 'windows');
    for (const id of ['share', 'account']) {
      const entry = entries.find((candidate) => candidate.id === id);
      expect(entry?.available, id).toBe(false);
      expect(entry?.reachability, id).toBe('registered-but-not-wired');
      expect(entry?.disabledReason, id).toContain('demo action');
    }
  });
});

describe('keyboard lookup and dispatch', () => {
  it('looks up and invokes a reachable keyboard tool through the canonical dispatcher', () => {
    const resolved = commandForShortcut('W', 'windows', DESIGN_CONTEXT);
    expect(resolved?.descriptor.id).toBe('wall');
    expect(resolved?.available).toBe(true);

    const activateTool = vi.fn();
    expect(dispatchProductCommand('wall', DESIGN_CONTEXT, { activateTool })).toEqual({
      status: 'executed',
    });
    expect(activateTool).toHaveBeenCalledTimes(1);
    expect(activateTool).toHaveBeenCalledWith('wall');
  });

  it('refuses execution when a reachable command has no host adapter', () => {
    expect(dispatchProductCommand('fit', DESIGN_CONTEXT, {})).toEqual({
      status: 'missing-adapter',
      target: { kind: 'tool', id: 'fit' },
    });
  });

  it('blocks a shortcut lookup target when context forbids execution', () => {
    const readOnlyContext: ProductCommandContext = { ...DESIGN_CONTEXT, readOnly: true };
    const resolved = commandForShortcut('W', 'windows', readOnlyContext);
    expect(resolved?.descriptor.id).toBe('wall');
    expect(resolved?.available).toBe(false);
    expect(resolved?.state).toBe('read-only');
  });

  it('does not advertise registered-only Save or Focus Selection as live shortcuts', () => {
    expect(unwiredKeyboardCommandIds()).toEqual(expect.arrayContaining(['save', 'focus-selection']));
    expect(commandForShortcut('Ctrl+S', 'windows', DESIGN_CONTEXT)?.available ?? false).toBe(false);
  });

  it('matches redo to the live Windows shortcut only', () => {
    expect(commandForShortcut('Ctrl+Shift+Z', 'windows', DESIGN_CONTEXT)?.descriptor.id).toBe('redo');
    expect(commandForShortcut('Ctrl+Y', 'windows', DESIGN_CONTEXT)).toBeNull();
  });

  it('keeps labels and shortcut identity stable across keyboard and palette', () => {
    const wallKeyboard = commandForShortcut('W', 'windows', DESIGN_CONTEXT);
    const wallPalette = productEntriesForSurface('command-palette', DESIGN_CONTEXT, 'windows').find(
      (entry) => entry.id === 'wall',
    );
    expect(wallKeyboard?.descriptor.id).toBe(wallPalette?.id);
    expect(wallKeyboard?.descriptor.label).toBe(wallPalette?.label);
    expect(wallKeyboard?.descriptor.shortcuts?.windows).toBe(wallPalette?.shortcutLabel);
  });
});
