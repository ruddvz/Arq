import type { SemanticChange, SemanticDiff } from './semantic-diff';

/**
 * V3-167: what a reviewer is shown alongside a proposal, and what it is allowed
 * to be.
 *
 * A semantic diff answers what changes. It does not answer "where", and for a
 * spatial change that is most of the question - "Wall 3 moves 200mm north" is
 * true and useless if the reviewer cannot find Wall 3. So a proposal carries
 * preview references, and the constraint is what a preview reference may
 * consist of.
 *
 * **It is never an image the model produced.** A rendered before-and-after
 * supplied by whatever generated the proposal is not evidence of what the
 * proposal does; it is evidence of what the generator says it does, which is
 * the claim under review. An image that disagrees with the operations is
 * indistinguishable from one that agrees, and the reviewer has no way to tell.
 * So a preview reference names element ids, a camera and a view, and Arq draws
 * it from its own model - which means the picture is derived from the same
 * state the operations will be applied to, and cannot disagree with it.
 *
 * **It is a pointer, not a payload.** References carry ids and view parameters,
 * so a proposal stays small, stays inspectable, and cannot smuggle content past
 * the checks that read it.
 */

export type PreviewKind =
  /** Frame the affected elements in the current view. */
  | 'highlight'
  /** Show the same framing before and after, for a change that moves something. */
  | 'before-after'
  /** A section or elevation cut where a plan cannot show the change. */
  | 'section';

export interface PreviewReference {
  readonly kind: PreviewKind;
  /** What to highlight and frame. Ids only. */
  readonly elementIds: readonly string[];
  /**
   * The view to draw it in. An id into the project's own views, so a preview
   * cannot invent a viewpoint that does not exist.
   */
  readonly viewId: string;
  /** Why this preview is worth looking at, in the user's terms. */
  readonly caption: string;
}

export const PREVIEW_REFUSAL_CODES = {
  noElements: 'ARQ_PREVIEW_NO_ELEMENTS',
  elementNotInDiff: 'ARQ_PREVIEW_ELEMENT_NOT_IN_DIFF',
  unknownView: 'ARQ_PREVIEW_UNKNOWN_VIEW',
  emptyCaption: 'ARQ_PREVIEW_EMPTY_CAPTION',
  embeddedContent: 'ARQ_PREVIEW_EMBEDDED_CONTENT',
} as const;

export type PreviewRefusalCode = (typeof PREVIEW_REFUSAL_CODES)[keyof typeof PREVIEW_REFUSAL_CODES];

export interface PreviewRefusal {
  readonly code: PreviewRefusalCode;
  readonly detail: string;
}

/**
 * Checks a preview reference against the diff it claims to illustrate.
 *
 * The element check is the one that matters. A preview highlighting elements
 * the diff does not touch points a reviewer at the wrong part of the building,
 * and a reviewer who looks where they are told and sees nothing wrong approves
 * a change they never examined. Every highlighted element must be one the
 * proposal actually changes.
 */
export function validatePreviewReference(
  preview: PreviewReference,
  diff: SemanticDiff,
  knownViewIds: ReadonlySet<string>,
): PreviewRefusal | null {
  if (preview.elementIds.length === 0) {
    return { code: PREVIEW_REFUSAL_CODES.noElements, detail: 'a preview must frame something' };
  }
  if (preview.caption.trim().length === 0) {
    return {
      code: PREVIEW_REFUSAL_CODES.emptyCaption,
      detail: 'a preview must say why it is worth looking at',
    };
  }
  if (!knownViewIds.has(preview.viewId)) {
    // A viewpoint the project does not have is one nobody can check the
    // preview against.
    return {
      code: PREVIEW_REFUSAL_CODES.unknownView,
      detail: `${preview.viewId} is not a view in this project`,
    };
  }

  const changed = new Set(diff.changes.map((change) => change.elementId));
  const stray = preview.elementIds.filter((id) => !changed.has(id));
  if (stray.length > 0) {
    return {
      code: PREVIEW_REFUSAL_CODES.elementNotInDiff,
      detail: `${stray.join(', ')} would be highlighted but is not changed by this proposal`,
    };
  }

  return null;
}

/**
 * Whether a preview reference carries anything but references.
 *
 * The structural half, checked the same way the extension boundary is: a
 * reference that survives a JSON round trip unchanged and holds only strings
 * cannot be carrying an image, a blob or a data URI. A generator that wants to
 * show its own picture has nowhere to put it.
 */
export function previewCarriesOnlyReferences(preview: PreviewReference): boolean {
  const values: unknown[] = [preview.kind, preview.viewId, preview.caption, ...preview.elementIds];
  if (!values.every((value) => typeof value === 'string')) {
    return false;
  }
  const extraKeys = Object.keys(preview).filter(
    (key) => !['kind', 'elementIds', 'viewId', 'caption'].includes(key),
  );
  return extraKeys.length === 0;
}

/**
 * Builds the previews a diff warrants, from the diff itself.
 *
 * Derived rather than supplied, which is the whole point: a preview generated
 * from the diff cannot disagree with it. A caller may still accept a
 * proposer-supplied reference, but it goes through `validatePreviewReference`
 * first and can only ever point at elements the proposal changes.
 *
 * Requested changes get a before-after, because a reviewer is judging those.
 * Derived changes get a highlight: they are consequences, and framing them as
 * a decision to inspect makes a proposal look twice as large as it is.
 */
export function previewsForDiff(diff: SemanticDiff, viewId: string): readonly PreviewReference[] {
  const requested = diff.changes.filter((change) => change.origin === 'requested');
  const derived = diff.changes.filter((change) => change.origin === 'derived');

  const previews: PreviewReference[] = [];

  if (requested.length > 0) {
    previews.push({
      kind: 'before-after',
      elementIds: requested.map((change) => change.elementId),
      viewId,
      caption: captionFor(requested, 'What this proposal changes'),
    });
  }
  if (derived.length > 0) {
    previews.push({
      kind: 'highlight',
      elementIds: derived.map((change) => change.elementId),
      viewId,
      caption: captionFor(derived, 'What follows from it'),
    });
  }

  return previews;
}

function captionFor(changes: readonly SemanticChange[], lead: string): string {
  const categories = [...new Set(changes.map((change) => change.category))].sort();
  const noun = changes.length === 1 ? 'element' : 'elements';
  return `${lead}: ${changes.length} ${noun} (${categories.join(', ')})`;
}
