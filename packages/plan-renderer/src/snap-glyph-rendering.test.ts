import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  snapGlyphPrimitives,
  SNAP_GLYPH_LABEL,
  type SnapGlyphSource,
} from './snap-glyph-rendering';

describe('snapGlyphPrimitives', () => {
  it('builds a square marker centred on the snap point', () => {
    const { marker } = snapGlyphPrimitives(
      { source: 'endpoint', point: worldPoint(10, 20) },
      'glyph-1',
      2,
    );
    expect(marker.kind).toBe('polygon');
    expect(marker.points).toEqual([
      worldPoint(8, 18),
      worldPoint(12, 18),
      worldPoint(12, 22),
      worldPoint(8, 22),
    ]);
  });

  it('labels the marker with the human-readable snap source name', () => {
    const sources: SnapGlyphSource[] = [
      'endpoint',
      'intersection',
      'midpoint',
      'perpendicular',
      'centre',
      'grid',
      'extension',
      'nearest',
    ];
    for (const source of sources) {
      const { label } = snapGlyphPrimitives({ source, point: worldPoint(0, 0) }, 'glyph', 1);
      expect(label.text).toBe(SNAP_GLYPH_LABEL[source]);
      expect(label.kind).toBe('text');
    }
  });

  it('tags both marker and label with the given glyph id', () => {
    const { marker, label } = snapGlyphPrimitives(
      { source: 'midpoint', point: worldPoint(0, 0) },
      'my-glyph-id',
      1,
    );
    expect(marker.elementId).toBe('my-glyph-id');
    expect(label.elementId).toBe('my-glyph-id');
  });

  it('positions the label offset from the marker, not on top of it', () => {
    const { label } = snapGlyphPrimitives({ source: 'centre', point: worldPoint(5, 5) }, 'g', 2);
    expect(label.anchor).not.toEqual(worldPoint(5, 5));
  });

  it('scales the marker size with sizeWorld', () => {
    const small = snapGlyphPrimitives({ source: 'grid', point: worldPoint(0, 0) }, 'g', 1);
    const large = snapGlyphPrimitives({ source: 'grid', point: worldPoint(0, 0) }, 'g', 5);
    const smallWidth = small.marker.points[1]!.x - small.marker.points[0]!.x;
    const largeWidth = large.marker.points[1]!.x - large.marker.points[0]!.x;
    expect(largeWidth).toBeGreaterThan(smallWidth);
  });

  it('rejects a non-positive sizeWorld', () => {
    expect(() =>
      snapGlyphPrimitives({ source: 'endpoint', point: worldPoint(0, 0) }, 'g', 0),
    ).toThrow(RangeError);
    expect(() =>
      snapGlyphPrimitives({ source: 'endpoint', point: worldPoint(0, 0) }, 'g', -1),
    ).toThrow(RangeError);
  });

  it('rejects a non-finite sizeWorld (adversarial: non-finite values)', () => {
    expect(() =>
      snapGlyphPrimitives({ source: 'endpoint', point: worldPoint(0, 0) }, 'g', Number.NaN),
    ).toThrow(RangeError);
  });
});
