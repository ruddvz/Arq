import { describe, expect, it } from 'vitest';
import type { Extent3 } from './origin-rebase';
import {
  SECTION_BOX_FACES,
  classifyAgainstSectionBox,
  crossedFaces,
  describeSectionBoxEffect,
  isDrawnUnderSectionBox,
  moveSectionBoxFace,
  sectionBoxAffectsQuantities,
  sectionBoxFromExtent,
  type SectionBox,
} from './section-box';

const BOX: SectionBox = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 10_000, y: 10_000, z: 3000 },
  enabled: true,
};

function extent(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): Extent3 {
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

describe('classifyAgainstSectionBox', () => {
  it('reports an element entirely inside', () => {
    expect(classifyAgainstSectionBox(extent(1000, 1000, 0, 2000, 2000, 2400), BOX)).toBe('inside');
  });

  it('reports an element entirely outside', () => {
    expect(classifyAgainstSectionBox(extent(20_000, 0, 0, 21_000, 1000, 1000), BOX)).toBe(
      'outside',
    );
  });

  it('reports an element crossing a face as straddling, not hidden', () => {
    // The reason to cut a section is to see inside the wall on the boundary.
    expect(classifyAgainstSectionBox(extent(9000, 1000, 0, 12_000, 2000, 2400), BOX)).toBe(
      'straddling',
    );
  });

  it('treats an element touching a face as inside rather than straddling', () => {
    expect(classifyAgainstSectionBox(extent(0, 0, 0, 10_000, 10_000, 3000), BOX)).toBe('inside');
  });

  it('classifies everything as inside when the box is off', () => {
    // A turned-off section box is not a section, and reporting a cut face for
    // one would hatch an unsectioned model.
    const off: SectionBox = { ...BOX, enabled: false };

    expect(classifyAgainstSectionBox(extent(90_000, 0, 0, 91_000, 1, 1), off)).toBe('inside');
  });
});

describe('isDrawnUnderSectionBox', () => {
  it('draws anything not wholly outside', () => {
    expect(isDrawnUnderSectionBox(extent(1000, 1000, 0, 2000, 2000, 100), BOX)).toBe(true);
    expect(isDrawnUnderSectionBox(extent(9000, 1000, 0, 12_000, 2000, 100), BOX)).toBe(true);
    expect(isDrawnUnderSectionBox(extent(20_000, 0, 0, 21_000, 1, 1), BOX)).toBe(false);
  });
});

describe('sectionBoxAffectsQuantities', () => {
  it('is unconditionally false: a clipped model is not a smaller model', () => {
    // A quantity that agreed with the clipped view would under-order every
    // time someone left a section box on.
    expect(sectionBoxAffectsQuantities()).toBe(false);
    expect(sectionBoxAffectsQuantities.length).toBe(0);
  });
});

describe('crossedFaces', () => {
  it('names the face an element crosses, so the renderer can draw the cut', () => {
    expect(crossedFaces(extent(9000, 1000, 0, 12_000, 2000, 2400), BOX)).toEqual(['maxX']);
  });

  it('names both faces at a corner', () => {
    // A caller that handled only the first would leave one side open.
    expect(crossedFaces(extent(9000, 9000, 0, 12_000, 12_000, 2400), BOX)).toEqual([
      'maxX',
      'maxY',
    ]);
  });

  it('names a face crossed on the low side', () => {
    expect(crossedFaces(extent(-1000, 1000, 0, 2000, 2000, 2400), BOX)).toEqual(['minX']);
  });

  it('is empty for an element wholly inside', () => {
    expect(crossedFaces(extent(1000, 1000, 0, 2000, 2000, 100), BOX)).toEqual([]);
  });

  it('is empty when the box is off', () => {
    expect(
      crossedFaces(extent(9000, 1000, 0, 12_000, 2000, 2400), { ...BOX, enabled: false }),
    ).toEqual([]);
  });
});

describe('moveSectionBoxFace', () => {
  it('moves a face', () => {
    const moved = moveSectionBoxFace(BOX, 'maxX', 5000);

    expect(moved?.max.x).toBe(5000);
    expect(moved?.min.x).toBe(0);
  });

  it('refuses to push a face past its opposite', () => {
    // An inverted box has no inside, so the whole model vanishes - which reads
    // as a crash, from a drag the user cannot undo the meaning of.
    expect(moveSectionBoxFace(BOX, 'maxX', -1)).toBeNull();
    expect(moveSectionBoxFace(BOX, 'minX', 10_001)).toBeNull();
  });

  it('refuses a zero-thickness box, which is equally blank', () => {
    expect(moveSectionBoxFace(BOX, 'maxZ', 0)).toBeNull();
  });

  it('refuses a non-finite value', () => {
    expect(moveSectionBoxFace(BOX, 'maxX', Number.NaN)).toBeNull();
    expect(moveSectionBoxFace(BOX, 'maxX', Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('does not mutate the box it was given', () => {
    moveSectionBoxFace(BOX, 'maxX', 5000);

    expect(BOX.max.x).toBe(10_000);
  });

  it('keeps the enabled state', () => {
    expect(moveSectionBoxFace({ ...BOX, enabled: false }, 'maxX', 5000)?.enabled).toBe(false);
  });

  it('handles every face', () => {
    const results = SECTION_BOX_FACES.map((face) =>
      moveSectionBoxFace(BOX, face, face.startsWith('min') ? -100 : 20_000),
    );

    expect(results.every((box) => box !== null)).toBe(true);
  });
});

describe('sectionBoxFromExtent', () => {
  it('builds a box around the whole model, disabled by default', () => {
    const box = sectionBoxFromExtent(extent(0, 0, 0, 100, 200, 300));

    expect(box.enabled).toBe(false);
    expect(box.max).toEqual({ x: 100, y: 200, z: 300 });
  });

  it('copies the extent rather than aliasing it', () => {
    const source = extent(0, 0, 0, 100, 200, 300);
    const box = sectionBoxFromExtent(source);

    expect(box.min).not.toBe(source.min);
  });
});

describe('describeSectionBoxEffect', () => {
  it('says nothing when the box is off', () => {
    expect(describeSectionBoxEffect({ ...BOX, enabled: false }, 40)).toBeNull();
  });

  it('says nothing when nothing is outside it', () => {
    expect(describeSectionBoxEffect(BOX, 0)).toBeNull();
  });

  it('states plainly that nothing was removed', () => {
    // A section box is easy to leave on and forget, and geometry disappearing
    // is alarming.
    const sentence = describeSectionBoxEffect(BOX, 40);

    expect(sentence).toContain('40 elements are outside it');
    expect(sentence).toContain('Nothing has been removed from the project.');
  });

  it('uses the singular for one element', () => {
    expect(describeSectionBoxEffect(BOX, 1)).toContain('1 element is');
  });
});
