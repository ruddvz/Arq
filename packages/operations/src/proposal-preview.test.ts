import { describe, expect, it } from 'vitest';
import { diffSnapshots, type ModelSnapshot } from './semantic-diff';
import {
  PREVIEW_REFUSAL_CODES,
  previewCarriesOnlyReferences,
  previewsForDiff,
  validatePreviewReference,
  type PreviewReference,
} from './proposal-preview';

const BEFORE: ModelSnapshot = {
  revision: 12,
  elements: [
    { elementId: 'wall-3', category: 'Wall', label: 'Wall 3', properties: { endY: 0 } },
    { elementId: 'room-2', category: 'Room', label: 'Office', properties: { areaM2: 12.4 } },
    { elementId: 'wall-9', category: 'Wall', label: 'Wall 9', properties: { endY: 0 } },
  ],
};
const AFTER: ModelSnapshot = {
  revision: 13,
  elements: [
    { elementId: 'wall-3', category: 'Wall', label: 'Wall 3', properties: { endY: 200 } },
    { elementId: 'room-2', category: 'Room', label: 'Office', properties: { areaM2: 12.1 } },
    { elementId: 'wall-9', category: 'Wall', label: 'Wall 9', properties: { endY: 0 } },
  ],
};

const DIFF = diffSnapshots(BEFORE, AFTER, { requestedElementIds: new Set(['wall-3']) });
const VIEWS = new Set(['view-plan-0']);

function preview(overrides: Partial<PreviewReference> = {}): PreviewReference {
  return {
    kind: 'highlight',
    elementIds: ['wall-3'],
    viewId: 'view-plan-0',
    caption: 'The wall that moves',
    ...overrides,
  };
}

describe('validatePreviewReference', () => {
  it('accepts a preview framing elements the proposal changes', () => {
    expect(validatePreviewReference(preview(), DIFF, VIEWS)).toBeNull();
  });

  it('refuses a preview pointing at an element the proposal does not touch', () => {
    // A reviewer who looks where they are told and sees nothing wrong approves
    // a change they never examined.
    const refusal = validatePreviewReference(preview({ elementIds: ['wall-9'] }), DIFF, VIEWS);

    expect(refusal?.code).toBe(PREVIEW_REFUSAL_CODES.elementNotInDiff);
    expect(refusal?.detail).toContain('wall-9');
  });

  it('refuses a view the project does not have', () => {
    const refusal = validatePreviewReference(preview({ viewId: 'view-invented' }), DIFF, VIEWS);

    expect(refusal?.code).toBe(PREVIEW_REFUSAL_CODES.unknownView);
  });

  it('refuses a preview that frames nothing', () => {
    expect(validatePreviewReference(preview({ elementIds: [] }), DIFF, VIEWS)?.code).toBe(
      PREVIEW_REFUSAL_CODES.noElements,
    );
  });

  it('refuses a preview with no caption', () => {
    expect(validatePreviewReference(preview({ caption: '  ' }), DIFF, VIEWS)?.code).toBe(
      PREVIEW_REFUSAL_CODES.emptyCaption,
    );
  });

  it('accepts a preview over a derived change, which is still part of the diff', () => {
    expect(validatePreviewReference(preview({ elementIds: ['room-2'] }), DIFF, VIEWS)).toBeNull();
  });
});

describe('previewCarriesOnlyReferences', () => {
  it('accepts a reference made of ids and strings', () => {
    expect(previewCarriesOnlyReferences(preview())).toBe(true);
  });

  it('refuses a reference smuggling an image', () => {
    // A rendered before-and-after supplied by the generator is evidence of what
    // the generator says, which is the claim under review.
    const withImage = {
      ...preview(),
      renderedPng: 'data:image/png;base64,iVBORw0KGgo=',
    } as unknown as PreviewReference;

    expect(previewCarriesOnlyReferences(withImage)).toBe(false);
  });

  it('refuses a reference whose element ids are not strings', () => {
    const withBlob = {
      ...preview(),
      elementIds: [{ bytes: new Uint8Array(4) }],
    } as unknown as PreviewReference;

    expect(previewCarriesOnlyReferences(withBlob)).toBe(false);
  });
});

describe('previewsForDiff', () => {
  it('derives previews from the diff, so they cannot disagree with it', () => {
    const previews = previewsForDiff(DIFF, 'view-plan-0');

    expect(previews.map((entry) => entry.kind)).toEqual(['before-after', 'highlight']);
  });

  it('gives requested changes a before-after, since those are what is being judged', () => {
    const [requested] = previewsForDiff(DIFF, 'view-plan-0');

    expect(requested?.kind).toBe('before-after');
    expect(requested?.elementIds).toEqual(['wall-3']);
  });

  it('gives consequences a highlight, not a decision to inspect', () => {
    // Framing them as decisions makes a proposal look twice as large as it is.
    const derived = previewsForDiff(DIFF, 'view-plan-0')[1];

    expect(derived?.kind).toBe('highlight');
    expect(derived?.elementIds).toEqual(['room-2']);
  });

  it('captions each preview with what it contains', () => {
    const [requested] = previewsForDiff(DIFF, 'view-plan-0');

    expect(requested?.caption).toBe('What this proposal changes: 1 element (Wall)');
  });

  it('produces previews that pass their own validation', () => {
    for (const entry of previewsForDiff(DIFF, 'view-plan-0')) {
      expect(validatePreviewReference(entry, DIFF, VIEWS)).toBeNull();
      expect(previewCarriesOnlyReferences(entry)).toBe(true);
    }
  });

  it('produces nothing for a diff that changes nothing', () => {
    const empty = diffSnapshots(BEFORE, { ...BEFORE, revision: 13 });

    expect(previewsForDiff(empty, 'view-plan-0')).toEqual([]);
  });
});
