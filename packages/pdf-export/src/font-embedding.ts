/**
 * ARQ-143: implement font embedding tests.
 *
 * Blueprint section 59 ("PDF export")'s "Limitations to design around"
 * names "font embedding must be tested" as its own open item, distinct
 * from ARQ-142's prototype (which deliberately used
 * `StandardFonts.Helvetica`, a base14 font needing no embedding at
 * all - see that module's doc comment). This module is the actual
 * embedding path: pdf-lib delegates TrueType/OpenType parsing to
 * `fontkit` (an optional peer dependency, not bundled), so embedding a
 * real (non-base14) typeface - which the eventual Arq brand typeface
 * will be, once one is chosen; none exists in this repository yet,
 * per docs/research/incoming/blueprint-revisions/... "the actual
 * product logo and identity after name clearance" being explicitly
 * still-pending work - requires `PDFDocument.registerFontkit` before
 * `embedFont` will accept raw font bytes instead of a `StandardFonts`
 * enum member.
 *
 * `embedCustomFont` is a thin, reusable wrapper for that registration
 * step (callers doing real font embedding elsewhere in this package
 * should not have to remember to call `registerFontkit` themselves
 * every time); the tests alongside it are the actual "font embedding
 * tested" evidence this issue asks for - proving embedding, drawing
 * text with the embedded font, saving and reloading a PDF all
 * genuinely round-trip, not just that the call does not throw.
 */

import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';

/** Registers fontkit (idempotent - safe to call more than once on the same document) and embeds `fontBytes` as a real, non-base14 font. */
export async function embedCustomFont(
  document: PDFDocument,
  fontBytes: Uint8Array | ArrayBuffer,
): Promise<PDFFont> {
  document.registerFontkit(fontkit);
  return document.embedFont(fontBytes, { subset: true });
}
