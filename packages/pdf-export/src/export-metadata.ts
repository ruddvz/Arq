/**
 * ARQ-145: add export metadata.
 *
 * Blueprint section 59 ("PDF export")'s Export pipeline step 5, "add
 * metadata" - beyond ARQ-142's minimal inline `setTitle`/`setSubject`
 * calls (now replaced by this module, the single place sheet export
 * metadata is actually decided), a real exported PDF should carry
 * enough standard PDF document metadata to identify which project,
 * sheet and revision it came from without opening Arq at all -
 * matching how every other CAD/BIM tool's PDF output is traceable on
 * its own.
 *
 * `projectName` and `revision` are caller-supplied rather than read
 * from `Sheet` directly: `Sheet` only stores `projectId` (ARQ-140's own
 * doc comment: "Project metadata is satisfied by referencing projectId
 * rather than duplicating project data"), so a caller exporting a
 * sheet already has the live `ProjectV0` record to read `name` from -
 * this module does not re-fetch or duplicate it.
 *
 * `author` is deliberately left unset (pdf-lib's `setAuthor` is simply
 * never called) rather than defaulted to a guess: this pure function
 * has no notion of which user requested the export, and fabricating
 * "Arq" or an empty string as an author would misrepresent an unknown
 * value as a decided one - the same "don't invent what isn't known"
 * stance text-note.ts (ARQ-139) took for `styleId`.
 *
 * `generatedAt` defaults to `new Date()` only when the caller omits it -
 * reading the wall clock is not project-state access, so this does not
 * conflict with this package's "never modify project state" invariant
 * (pdf-sheet-export.ts, ARQ-142); a caller wanting a fully pure,
 * deterministically-testable call supplies it explicitly instead.
 */

import type { PDFDocument } from 'pdf-lib';

export interface SheetExportMetadata {
  readonly projectName: string;
  readonly sheetNumber: string;
  readonly sheetTitle: string;
  readonly revision: number;
  readonly generatedAt?: Date;
}

/** Applies section 59's "add metadata" step: title, subject (project/sheet/revision), keywords, creator/producer, and creation/modification timestamps. */
export function applySheetExportMetadata(
  document: PDFDocument,
  metadata: SheetExportMetadata,
): void {
  const generatedAt = metadata.generatedAt ?? new Date();
  document.setTitle(metadata.sheetTitle);
  document.setSubject(
    `${metadata.projectName} - Sheet ${metadata.sheetNumber} - Rev ${metadata.revision}`,
  );
  document.setKeywords([metadata.projectName, metadata.sheetNumber, `rev-${metadata.revision}`]);
  document.setCreator('Arq');
  document.setProducer('Arq PDF export (pdf-lib)');
  document.setCreationDate(generatedAt);
  document.setModificationDate(generatedAt);
}
