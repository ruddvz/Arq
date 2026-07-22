/**
 * ARQ-139: implement text note.
 *
 * Blueprint section 56 ("Text notes") lists: "plain text; controlled
 * styles; alignment; width; leader later; no rich-text complexity
 * initially; font embedding strategy for PDF; missing glyph fallback;
 * copied text sanitised." This module covers the entity and the one
 * genuinely testable rule among those: "copied text sanitised".
 *
 * "Leader later" is not modelled, the same "later means not yet" stance
 * dimension-reference.ts (ARQ-136) already took for "grid later" - a
 * leader line would need its own anchor-reference concept with nothing
 * yet to attach it to. "Font embedding strategy for PDF" and "missing
 * glyph fallback" are section 59's PDF export pipeline, not this
 * entity's concern, and out of scope per this issue's own "do not
 * expand into later release scope" non-goal.
 *
 * "Controlled styles" is modelled as `styleId: string` rather than a
 * hardcoded enum: the app's own interface typography tokens
 * (design/tokens.json's `type` scale - meta/caption/body/panelTitle/...)
 * are a UI-chrome concept, not a drawing-annotation one, and the
 * blueprint names no specific set of drawing text-note styles to
 * mirror - inventing style names with no design-system backing would
 * misrepresent an undecided catalog as decided. `textNoteHasControlledStyle`
 * is what "controlled" actually means operationally: a note's styleId
 * must be a member of the project's own style catalog (a caller-
 * supplied set - this module does not own or define that catalog),
 * not an arbitrary ad hoc value.
 *
 * "Plain text" and "no rich-text complexity initially": sanitizeNoteText
 * strips HTML/rich-text markup and non-printing control characters
 * (keeping newline and tab, since section 56 lists "width" - a note can
 * wrap - implying multi-line text is expected) and normalises CRLF/CR
 * line endings to LF. createTextNote always sanitises on construction,
 * so "copied text sanitised" holds by construction rather than being an
 * optional caller step.
 */

import type { WorldPoint } from '@arq/geometry-2d';
import type { Length } from './length';
import type { LevelId, TextNoteId } from './ids';

export type TextNoteAlignment = 'left' | 'center' | 'right';

export interface TextNote {
  readonly id: TextNoteId;
  readonly levelId: LevelId;
  readonly position: WorldPoint;
  readonly text: string;
  readonly styleId: string;
  readonly alignment: TextNoteAlignment;
  readonly width: Length;
}

export interface CreateTextNoteInput {
  readonly id: TextNoteId;
  readonly levelId: LevelId;
  readonly position: WorldPoint;
  readonly text: string;
  readonly styleId: string;
  readonly width: Length;
  readonly alignment?: TextNoteAlignment;
}

const HTML_TAG_PATTERN = /<[^>]*>/g;
const TAB_CODE = 9;
const LINE_FEED_CODE = 10;
const LAST_C0_CONTROL_CODE = 31;
const DELETE_CODE = 127;

/** True for C0 control characters and DEL, excluding tab and newline (both kept - a note can be multi-line). Checked by code point rather than a regex character class, to avoid embedding raw control bytes in this source file. */
function isStrippableControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  const isC0Control = code <= LAST_C0_CONTROL_CODE && code !== TAB_CODE && code !== LINE_FEED_CODE;
  return isC0Control || code === DELETE_CODE;
}

/** Section 56's "copied text sanitised": strips HTML/rich-text markup and non-printing control characters, and normalises CRLF/CR line endings to LF. Newline and tab are kept - a note can be multi-line. */
export function sanitizeNoteText(rawText: string): string {
  const withoutTags = rawText.replace(HTML_TAG_PATTERN, '');
  const normalizedNewlines = withoutTags.replace(/\r\n?/g, '\n');
  return Array.from(normalizedNewlines)
    .filter((character) => !isStrippableControlCharacter(character))
    .join('');
}

export function createTextNote(input: CreateTextNoteInput): TextNote {
  return {
    id: input.id,
    levelId: input.levelId,
    position: input.position,
    text: sanitizeNoteText(input.text),
    styleId: input.styleId,
    width: input.width,
    alignment: input.alignment ?? 'left',
  };
}

/** "Controlled styles": true when `note`'s styleId is a member of the project's own style catalog. */
export function textNoteHasControlledStyle(
  note: TextNote,
  allowedStyleIds: ReadonlySet<string>,
): boolean {
  return allowedStyleIds.has(note.styleId);
}
