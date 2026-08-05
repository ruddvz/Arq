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
