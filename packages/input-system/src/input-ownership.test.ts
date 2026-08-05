import { describe, expect, it } from 'vitest';
import { createKeyboardShortcutRegistry } from './keyboard-gesture';
import {
  CANVAS_OWNER,
  createInputOwnershipTracker,
  routeKeySample,
  textEntryOwnsInput,
} from './input-ownership';

function registryWithBaseline() {
  const registry = createKeyboardShortcutRegistry();
  registry.register('w', 'wall');
  registry.register('d', 'door');
  registry.register('ctrl+z', 'undo');
  return registry;
}

describe('routeKeySample', () => {
  it('sends keys to commands while the canvas owns input', () => {
    const routing = routeKeySample(CANVAS_OWNER, { key: 'w' }, registryWithBaseline());

    expect(routing).toEqual({ target: 'command', intent: { type: 'shortcut', commandId: 'wall' } });
  });

  it('does not fire a tool shortcut while a text entry owns input', () => {
    // AC3-081: typing a room name must not activate the wall tool behind it.
    const routing = routeKeySample(
      { kind: 'text-entry', fieldId: 'room-name', role: 'document-text' },
      { key: 'w' },
      registryWithBaseline(),
    );

    expect(routing).toEqual({ target: 'text-entry', fieldId: 'room-name' });
  });

  it('keeps Escape and Enter with a document text field rather than the command layer', () => {
    const owner = { kind: 'text-entry', fieldId: 'sheet-title', role: 'document-text' } as const;
    const registry = registryWithBaseline();

    expect(routeKeySample(owner, { key: 'Escape' }, registry).target).toBe('text-entry');
    expect(routeKeySample(owner, { key: 'Enter' }, registry).target).toBe('text-entry');
  });

  it('keeps Ctrl+Z with the field, because a text field has its own undo', () => {
    const routing = routeKeySample(
      { kind: 'text-entry', fieldId: 'room-name', role: 'document-text' },
      { key: 'z', ctrlKey: true },
      registryWithBaseline(),
    );

    expect(routing).toEqual({ target: 'text-entry', fieldId: 'room-name' });
  });

  it("routes a command field's Enter to the owning command's commit", () => {
    // The numeric overlay's Enter places the point; its text is an argument to
    // a running command, not project data.
    const routing = routeKeySample(
      { kind: 'text-entry', fieldId: 'overlay-distance', role: 'command-field' },
      { key: 'Enter' },
      registryWithBaseline(),
    );

    expect(routing).toEqual({ target: 'command', intent: { type: 'commit' } });
  });

  it("keeps a command field's Escape with the field, which clears before it defocuses", () => {
    const routing = routeKeySample(
      { kind: 'text-entry', fieldId: 'overlay-distance', role: 'command-field' },
      { key: 'Escape' },
      registryWithBaseline(),
    );

    expect(routing).toEqual({ target: 'text-entry', fieldId: 'overlay-distance' });
  });

  it('has no built-in punch-through list', () => {
    const owner = { kind: 'text-entry', fieldId: 'note', role: 'document-text' } as const;
    const registry = registryWithBaseline();
    const samples = [
      { key: 'w' },
      { key: 'd' },
      { key: 'Escape' },
      { key: 'Enter' },
      { key: 'Tab' },
      { key: ' ' },
      { key: 'z', ctrlKey: true },
      { key: 'z', metaKey: true },
    ];

    expect(
      samples.every((sample) => routeKeySample(owner, sample, registry).target === 'text-entry'),
    ).toBe(true);
  });

  it('lets a caller name a combo that reaches commands anyway', () => {
    const routing = routeKeySample(
      { kind: 'text-entry', fieldId: 'note', role: 'document-text' },
      { key: 'p', ctrlKey: true, shiftKey: true },
      registryWithBaseline(),
      { alwaysReachesCommands: new Set(['ctrl+shift+p']) },
    );

    expect(routing.target).toBe('command');
  });
});

describe('createInputOwnershipTracker', () => {
  it('starts on the canvas', () => {
    const tracker = createInputOwnershipTracker();

    expect(tracker.owner()).toEqual(CANVAS_OWNER);
    expect(textEntryOwnsInput(tracker.owner())).toBe(false);
  });

  it('routes through the current owner', () => {
    const tracker = createInputOwnershipTracker();
    const registry = registryWithBaseline();

    expect(tracker.route({ key: 'w' }, registry).target).toBe('command');
    tracker.focusTextEntry('room-name', 'document-text');
    expect(tracker.route({ key: 'w' }, registry).target).toBe('text-entry');
    tracker.blurTextEntry('room-name');
    expect(tracker.route({ key: 'w' }, registry).target).toBe('command');
  });

  it('ignores a stale blur from a field that no longer owns input', () => {
    const tracker = createInputOwnershipTracker();
    const registry = registryWithBaseline();

    // Real DOM order when tabbing between fields: the new field focuses first,
    // then the old one blurs. Honouring that blur would drop the user out of
    // text entry mid-word.
    tracker.focusTextEntry('room-name', 'document-text');
    tracker.focusTextEntry('room-number', 'document-text');
    tracker.blurTextEntry('room-name');

    expect(tracker.owner()).toEqual({
      kind: 'text-entry',
      fieldId: 'room-number',
      role: 'document-text',
    });
    expect(tracker.route({ key: 'd' }, registry).target).toBe('text-entry');
  });

  it('releases to the canvas when a field disappears with its dialog', () => {
    const tracker = createInputOwnershipTracker();

    tracker.focusTextEntry('dialog-field', 'document-text');
    tracker.releaseToCanvas();

    expect(tracker.owner()).toEqual(CANVAS_OWNER);
  });
});
