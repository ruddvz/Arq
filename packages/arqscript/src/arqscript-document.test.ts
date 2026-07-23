import { describe, expect, it } from 'vitest';
import { createDoorCommand, createLevelCommand, createWallCommand } from './arqscript-command';
import {
  collectAssumptions,
  createArqScriptDocument,
  operationTypesUsed,
} from './arqscript-document';

function exampleDocument() {
  return createArqScriptDocument({
    version: '0.1',
    scriptId: 'script-1',
    commands: [
      createLevelCommand({ name: 'Ground Floor', elevationMm: 0 }),
      createWallCommand({
        id: 'W1',
        from: { xMm: 0, yMm: 0 },
        to: { xMm: 6000, yMm: 0 },
        wallType: 'Exterior 230',
        heightMm: 3000,
      }),
      createDoorCommand({ id: 'D1', hostWallId: 'W1', offsetMm: 1200 }),
    ],
  });
}

describe('createArqScriptDocument', () => {
  it("constructs a document matching section 98's example script structure", () => {
    const document = exampleDocument();
    expect(document.version).toBe('0.1');
    expect(document.scriptId).toBe('script-1');
    expect(document.commands).toHaveLength(3);
  });

  it('rejects an empty version', () => {
    expect(() => createArqScriptDocument({ version: '', scriptId: 's1', commands: [] })).toThrow(
      RangeError,
    );
  });

  it('rejects an empty scriptId', () => {
    expect(() => createArqScriptDocument({ version: '0.1', scriptId: '', commands: [] })).toThrow(
      RangeError,
    );
  });

  it('accepts an empty command list', () => {
    const document = createArqScriptDocument({ version: '0.1', scriptId: 's1', commands: [] });
    expect(document.commands).toEqual([]);
  });
});

describe('operationTypesUsed', () => {
  it("lists every distinct typed-operation name the document's commands will produce", () => {
    expect(operationTypesUsed(exampleDocument())).toEqual([
      'CreateLevel',
      'CreateWall',
      'PlaceDoor',
    ]);
  });

  it('deduplicates repeated operation types', () => {
    const document = createArqScriptDocument({
      version: '0.1',
      scriptId: 's1',
      commands: [
        createLevelCommand({ name: 'L1', elevationMm: 0 }),
        createLevelCommand({ name: 'L2', elevationMm: 3000 }),
      ],
    });
    expect(operationTypesUsed(document)).toEqual(['CreateLevel']);
  });
});

describe('collectAssumptions', () => {
  it("flattens every command's assumptions, labeled by which command made them", () => {
    const document = exampleDocument();
    const assumptions = collectAssumptions(document);
    // The wall command gave explicit wallType/heightMm (no assumptions);
    // the door command omitted widthMm/heightMm (two assumptions).
    expect(assumptions).toHaveLength(2);
    expect(assumptions[0]).toContain('door "D1"');
  });

  it('returns an empty array when no command made an assumption', () => {
    const document = createArqScriptDocument({
      version: '0.1',
      scriptId: 's1',
      commands: [createLevelCommand({ name: 'L1', elevationMm: 0 })],
    });
    expect(collectAssumptions(document)).toEqual([]);
  });
});
