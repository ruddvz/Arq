import { describe, expect, it } from 'vitest';
import { worldPoint } from './coordinate-system';
import { classifyLengthChange, projectEndpointOntoBoundary } from './wall-trim-extend';

describe('projectEndpointOntoBoundary + classifyLengthChange: trim (ARQ-099)', () => {
  it('shortens a wall whose end overshoots a boundary it should stop at', () => {
    const wall = { start: worldPoint(0, 0), end: worldPoint(20, 0) };
    const boundary = { start: worldPoint(10, -5), end: worldPoint(10, 5) };
    const newPoint = projectEndpointOntoBoundary(wall, 'end', boundary, 1e-9)!;
    expect(newPoint.x).toBeCloseTo(10, 9);
    expect(classifyLengthChange(wall, 'end', newPoint)).toBe('trimmed');
  });
});

describe('projectEndpointOntoBoundary + classifyLengthChange: extend (ARQ-100)', () => {
  it('lengthens a wall whose end falls short of a boundary it should reach', () => {
    const wall = { start: worldPoint(0, 0), end: worldPoint(5, 0) };
    const boundary = { start: worldPoint(20, -5), end: worldPoint(20, 5) };
    const newPoint = projectEndpointOntoBoundary(wall, 'end', boundary, 1e-9)!;
    expect(newPoint.x).toBeCloseTo(20, 9);
    expect(classifyLengthChange(wall, 'end', newPoint)).toBe('extended');
  });
});

describe('projectEndpointOntoBoundary', () => {
  it('moves the start endpoint when asked, leaving the end fixed', () => {
    const wall = { start: worldPoint(0, 0), end: worldPoint(20, 0) };
    const boundary = { start: worldPoint(5, -5), end: worldPoint(5, 5) };
    const newPoint = projectEndpointOntoBoundary(wall, 'start', boundary, 1e-9)!;
    expect(newPoint.x).toBeCloseTo(5, 9);
  });

  it('returns unchanged when the boundary passes through the current endpoint exactly', () => {
    const wall = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    const boundary = { start: worldPoint(10, -5), end: worldPoint(10, 5) };
    const newPoint = projectEndpointOntoBoundary(wall, 'end', boundary, 1e-9)!;
    expect(classifyLengthChange(wall, 'end', newPoint)).toBe('unchanged');
  });

  it('returns null for a boundary parallel to the wall (no defined projection)', () => {
    const wall = { start: worldPoint(0, 0), end: worldPoint(20, 0) };
    const boundary = { start: worldPoint(0, 5), end: worldPoint(20, 5) };
    expect(projectEndpointOntoBoundary(wall, 'end', boundary, 1e-9)).toBeNull();
  });

  it('returns null when the result would collapse the wall to a single point (adversarial: near-zero-length result)', () => {
    const wall = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
    // a boundary passing through the wall's own start point.
    const boundary = { start: worldPoint(0, -5), end: worldPoint(0, 5) };
    expect(projectEndpointOntoBoundary(wall, 'end', boundary, 1e-9)).toBeNull();
  });

  it('returns null for a degenerate wall (adversarial: zero-length segments)', () => {
    const degenerateWall = { start: worldPoint(5, 5), end: worldPoint(5, 5) };
    const boundary = { start: worldPoint(0, -5), end: worldPoint(0, 5) };
    expect(projectEndpointOntoBoundary(degenerateWall, 'end', boundary, 1e-9)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const wall = { start: worldPoint(offset, offset), end: worldPoint(offset + 20, offset) };
    const boundary = {
      start: worldPoint(offset + 10, offset - 5),
      end: worldPoint(offset + 10, offset + 5),
    };
    const newPoint = projectEndpointOntoBoundary(wall, 'end', boundary, 1e-6)!;
    expect(newPoint.x).toBeCloseTo(offset + 10, 3);
  });
});
