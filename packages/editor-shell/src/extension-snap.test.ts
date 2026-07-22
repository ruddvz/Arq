import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { extensionPoint, findExtensionSnaps } from './extension-snap';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('extensionPoint', () => {
  it('projects the cursor onto the line beyond the segment end', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(extensionPoint(segment, worldPoint(15, 3))).toEqual(worldPoint(15, 0));
  });

  it('returns null when the projection falls within the segment itself', () => {
    const segment = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    expect(extensionPoint(segment, worldPoint(5, 3))).toBeNull();
  });

  it('returns null for a zero-length segment', () => {
    const segment = { start: worldPoint(3, 3), end: worldPoint(3, 3) };
    expect(extensionPoint(segment, worldPoint(5, 5))).toBeNull();
  });
});

describe('findExtensionSnaps', () => {
  it('returns a snap result along the extension when the cursor is near it', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    const results = findExtensionSnaps(candidates, worldPoint(15, 0.5), viewport, 10);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ source: 'extension', point: { x: 15, y: 0 } });
  });

  it('excludes a segment when the cursor projects within its own bounds', () => {
    const candidates = [{ start: worldPoint(0, 0), end: worldPoint(10, 0) }];
    expect(findExtensionSnaps(candidates, worldPoint(5, 0.5), viewport, 10)).toEqual([]);
  });
});
