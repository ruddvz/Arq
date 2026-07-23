import { describe, expect, it } from 'vitest';
import { parseDxfEntity } from './dxf-entity-parser';
import type { DxfGroup } from './dxf-tokenizer';

describe('parseDxfEntity', () => {
  it('parses a LINE with an explicit layer', () => {
    const buffer: DxfGroup[] = [
      { code: 8, value: 'WALLS' },
      { code: 10, value: '0.0' },
      { code: 20, value: '0.0' },
      { code: 11, value: '10.5' },
      { code: 21, value: '2.5' },
    ];
    expect(parseDxfEntity('LINE', buffer)).toEqual({
      kind: 'LINE',
      layer: 'WALLS',
      start: { x: 0, y: 0 },
      end: { x: 10.5, y: 2.5 },
    });
  });

  it('defaults to layer "0" when no group-8 layer is present', () => {
    const buffer: DxfGroup[] = [
      { code: 10, value: '0' },
      { code: 20, value: '0' },
      { code: 11, value: '1' },
      { code: 21, value: '1' },
    ];
    expect(parseDxfEntity('LINE', buffer)?.layer).toBe('0');
  });

  it('returns null for a LINE missing a required end point', () => {
    const buffer: DxfGroup[] = [
      { code: 10, value: '0' },
      { code: 20, value: '0' },
    ];
    expect(parseDxfEntity('LINE', buffer)).toBeNull();
  });

  it('parses a CIRCLE', () => {
    const buffer: DxfGroup[] = [
      { code: 8, value: '0' },
      { code: 10, value: '5' },
      { code: 20, value: '5' },
      { code: 40, value: '2.5' },
    ];
    expect(parseDxfEntity('CIRCLE', buffer)).toEqual({
      kind: 'CIRCLE',
      layer: '0',
      center: { x: 5, y: 5 },
      radius: 2.5,
    });
  });

  it('parses an ARC', () => {
    const buffer: DxfGroup[] = [
      { code: 10, value: '0' },
      { code: 20, value: '0' },
      { code: 40, value: '3' },
      { code: 50, value: '0' },
      { code: 51, value: '90' },
    ];
    expect(parseDxfEntity('ARC', buffer)).toEqual({
      kind: 'ARC',
      layer: '0',
      center: { x: 0, y: 0 },
      radius: 3,
      startAngleDegrees: 0,
      endAngleDegrees: 90,
    });
  });

  it('parses an open LWPOLYLINE with three vertices', () => {
    const buffer: DxfGroup[] = [
      { code: 90, value: '3' },
      { code: 70, value: '0' },
      { code: 10, value: '0' },
      { code: 20, value: '0' },
      { code: 10, value: '1' },
      { code: 20, value: '0' },
      { code: 10, value: '1' },
      { code: 20, value: '1' },
    ];
    const result = parseDxfEntity('LWPOLYLINE', buffer);
    expect(result).toEqual({
      kind: 'LWPOLYLINE',
      layer: '0',
      closed: false,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    });
  });

  it('parses a closed LWPOLYLINE (flag bit 0 set)', () => {
    const buffer: DxfGroup[] = [
      { code: 70, value: '1' },
      { code: 10, value: '0' },
      { code: 20, value: '0' },
      { code: 10, value: '1' },
      { code: 20, value: '1' },
    ];
    const result = parseDxfEntity('LWPOLYLINE', buffer);
    expect(result?.kind).toBe('LWPOLYLINE');
    expect(result && result.kind === 'LWPOLYLINE' && result.closed).toBe(true);
  });

  it('returns null for a LWPOLYLINE with no vertices', () => {
    expect(parseDxfEntity('LWPOLYLINE', [{ code: 70, value: '0' }])).toBeNull();
  });

  it('parses a TEXT entity', () => {
    const buffer: DxfGroup[] = [
      { code: 1, value: 'Kitchen' },
      { code: 10, value: '2' },
      { code: 20, value: '3' },
      { code: 40, value: '0.25' },
    ];
    expect(parseDxfEntity('TEXT', buffer)).toEqual({
      kind: 'TEXT',
      layer: '0',
      insertion: { x: 2, y: 3 },
      height: 0.25,
      text: 'Kitchen',
    });
  });

  it('returns null for an unrecognized entity type', () => {
    expect(parseDxfEntity('HATCH', [{ code: 8, value: '0' }])).toBeNull();
  });
});
