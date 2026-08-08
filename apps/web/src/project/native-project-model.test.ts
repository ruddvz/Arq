import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { decodeNativeProjectModel, encodeNativeProjectModel } from './native-project-model';

function validModel(walls: unknown[] = []): unknown {
  return { projectName: 'Existing project', walls };
}

function wallJson(id: string): unknown {
  return { id, start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } };
}

describe('decodeNativeProjectModel', () => {
  it('decodes a well-formed model', () => {
    const result = decodeNativeProjectModel(validModel([wallJson('w1')]));

    expect(result.status).toBe('decoded');
    if (result.status === 'decoded') {
      expect(result.model.projectName).toBe('Existing project');
      expect(result.model.walls).toHaveLength(1);
      expect(result.model.walls[0]).toMatchObject({
        id: 'w1',
        start: { x: 0, y: 0 },
        end: { x: 3000, y: 0 },
      });
    }
  });

  /**
   * The brand is what stops a screen coordinate being used where a world
   * coordinate belongs. A decoder that widened plain numbers by assertion would
   * put unbranded values into the one place the rest of the app is entitled to
   * assume they are branded - so the reconstruction goes through `worldPoint`,
   * and this pins that the result is structurally what `worldPoint` produces.
   */
  it('reconstructs coordinates through the canonical branded constructor', () => {
    const result = decodeNativeProjectModel(validModel([wallJson('w1')]));

    expect(result.status).toBe('decoded');
    if (result.status === 'decoded') {
      expect(result.model.walls[0]?.start).toEqual(worldPoint(0, 0));
      expect(result.model.walls[0]?.end).toEqual(worldPoint(3000, 0));
    }
  });

  it.each([
    ['not an object', 42],
    ['a missing project name', { walls: [] }],
    ['a non-string project name', { projectName: 7, walls: [] }],
    ['a missing wall list', { projectName: 'p' }],
    ['a non-array wall list', { projectName: 'p', walls: {} }],
  ])('rejects a model with %s', (_label, value) => {
    expect(decodeNativeProjectModel(value)).toMatchObject({ status: 'rejected' });
  });

  it.each([
    ['string coordinates', { id: 'w1', start: { x: '0', y: 0 }, end: { x: 1, y: 0 } }],
    ['a missing end point', { id: 'w1', start: { x: 0, y: 0 } }],
    ['no id', { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
    ['an empty id', { id: '', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } }],
    ['a null point', { id: 'w1', start: null, end: { x: 1, y: 0 } }],
  ])('rejects a wall with %s rather than rendering it at an undefined position', (_label, wall) => {
    expect(decodeNativeProjectModel(validModel([wall]))).toMatchObject({ status: 'rejected' });
  });

  /**
   * `JSON.parse` cannot produce NaN or Infinity directly, but a foreign or
   * hand-edited writer can encode them as strings or nulls, and a coordinate
   * that is not finite poisons every length, bounds and hit test downstream
   * without anything reporting a fault.
   */
  it('rejects a non-finite coordinate', () => {
    const parsed = JSON.parse('{"id":"w1","start":{"x":1e999,"y":0},"end":{"x":1,"y":0}}');

    expect(decodeNativeProjectModel(validModel([parsed]))).toMatchObject({ status: 'rejected' });
  });

  /**
   * Duplicate ids would make `applyOperation`'s per-id idempotence - and
   * therefore undo - depend on list position. Refused rather than de-duplicated:
   * silently dropping one of two walls the user can see is worse than refusing a
   * file that should not exist.
   */
  it('rejects repeated wall ids instead of silently dropping one', () => {
    expect(decodeNativeProjectModel(validModel([wallJson('w1'), wallJson('w1')]))).toMatchObject({
      status: 'rejected',
      reason: expect.stringContaining('w1'),
    });
  });
});

describe('native project model round trip', () => {
  it('survives encode and decode unchanged', () => {
    const model = {
      projectName: 'Round trip',
      walls: [
        { id: 'w1', start: worldPoint(0, 0), end: worldPoint(3000, 0) },
        { id: 'w2', start: worldPoint(3000, 0), end: worldPoint(3000, 2500) },
      ],
    };

    const result = decodeNativeProjectModel(
      JSON.parse(JSON.stringify(encodeNativeProjectModel(model))),
    );

    expect(result.status).toBe('decoded');
    if (result.status === 'decoded') {
      // `document` comes back null: the flat shape carries no reference model,
      // and inventing one would claim the file said more than it did.
      expect(result.model).toEqual({ ...model, document: null });
    }
  });

  it('encodes coordinates as plain JSON numbers, not brand-carrying objects', () => {
    const encoded = encodeNativeProjectModel({
      projectName: 'p',
      walls: [{ id: 'w1', start: worldPoint(1, 2), end: worldPoint(3, 4) }],
    });

    expect(JSON.parse(JSON.stringify(encoded))).toEqual({
      projectName: 'p',
      walls: [{ id: 'w1', start: { x: 1, y: 2 }, end: { x: 3, y: 4 } }],
    });
  });
});

/**
 * ARQ House 17.0 carries a root `projectName` and a full reference model at the
 * same time. Dispatching on `projectName` alone took the flat path and opened
 * the project as bare wall centrelines with `document: null` - every level,
 * room, opening, door and window silently discarded, with nothing shown to say
 * so. These pin the richer read, and pin that a genuinely flat file still takes
 * the flat path.
 */
describe('decodeNativeProjectModel on the ARQ House 17.0 vocabulary', () => {
  function house17(): Record<string, unknown> {
    return {
      projectName: 'House',
      id: 'arq-project-house',
      name: 'House',
      revision: 670,
      units: 'mm',
      levelIds: ['level-ground'],
      levels: [{ id: 'level-ground', name: 'Ground Floor', elevation: 0, storeyHeight: 3200 }],
      wallTypes: [{ id: 'wt-ext-300', name: 'Exterior 300', width: 300 }],
      walls: [
        {
          id: 'w-south',
          typeId: 'wt-ext-300',
          levelId: 'level-ground',
          start: { x: 0, y: 0 },
          end: { x: 10000, y: 0 },
          alignment: 'centre',
          joinStart: 'union-solid',
          joinEnd: 'union-solid',
          semanticRole: 'outer-envelope',
          height: 3000,
          hostedOpeningIds: ['op-1'],
        },
      ],
      openings: [
        {
          id: 'op-1',
          hostWallId: 'w-south',
          kind: 'pocket-door',
          offsetFromWallStart: { value: 500, unit: 'mm' },
          width: { value: 800, unit: 'mm' },
          sillHeight: { value: 0, unit: 'mm' },
          height: { value: 2100, unit: 'mm' },
        },
      ],
      doorTypes: [{ id: 'dt-p', name: 'Pocket', operation: 'pocket', width: 800, height: 2100 }],
      doors: [
        {
          id: 'd-1',
          typeId: 'dt-p',
          openingId: 'op-1',
          levelId: 'level-ground',
          side: 'configured',
          hand: 'start',
          swingDirection: 1,
        },
      ],
      windows: [],
      rooms: [
        {
          id: 'rm-1',
          levelId: 'level-ground',
          seedPoint: { x: 5000, y: 2000 },
          name: 'Living',
          number: 'G01',
          boundaryElementIds: ['w-south'],
          calculatedBoundary: [
            { x: 0, y: 0 },
            { x: 10000, y: 0 },
            { x: 10000, y: 4000 },
          ],
          calculatedArea: 40,
          status: 'coordinated-17.0',
        },
      ],
    };
  }

  it('reads the full reference model rather than only its wall centrelines', () => {
    const result = decodeNativeProjectModel(house17(), { views: [] });

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') return;
    // The regression this exists for: `document` was null, so everything below
    // this line was silently absent from an opened project.
    expect(result.model.document).not.toBeNull();
    expect(result.model.document?.levels).toHaveLength(1);
    expect(result.model.document?.rooms).toHaveLength(1);
    expect(result.model.document?.openings).toHaveLength(1);
    expect(result.model.document?.doors).toHaveLength(1);
    expect(result.model.document?.wallTypes).toHaveLength(1);
  });

  it('keeps the walls the flat path would have drawn', () => {
    const result = decodeNativeProjectModel(house17(), { views: [] });

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') return;
    expect(result.model.walls).toHaveLength(1);
    expect(result.model.projectName).toBe('House');
  });

  it('still takes the flat path for a file this build wrote', () => {
    const flat = {
      projectName: 'Flat',
      walls: [{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } }],
    };

    const result = decodeNativeProjectModel(flat);

    expect(result.status).toBe('decoded');
    if (result.status !== 'decoded') return;
    expect(result.model.document).toBeNull();
    expect(result.model.walls).toHaveLength(1);
  });
});
