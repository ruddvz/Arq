import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { applySheetExportMetadata } from './export-metadata';

const baseMetadata = {
  projectName: 'Hillside Residence',
  sheetNumber: 'A1.1',
  sheetTitle: 'Level 1 Floor Plan',
  revision: 3,
};

describe('applySheetExportMetadata', () => {
  it('sets the title to the sheet title', async () => {
    const document = await PDFDocument.create();
    applySheetExportMetadata(document, baseMetadata);
    expect(document.getTitle()).toBe('Level 1 Floor Plan');
  });

  it('sets the subject to project name, sheet number and revision', async () => {
    const document = await PDFDocument.create();
    applySheetExportMetadata(document, baseMetadata);
    expect(document.getSubject()).toBe('Hillside Residence - Sheet A1.1 - Rev 3');
  });

  it('sets keywords covering project name, sheet number and revision', async () => {
    const document = await PDFDocument.create();
    applySheetExportMetadata(document, baseMetadata);
    expect(document.getKeywords()).toBe('Hillside Residence A1.1 rev-3');
  });

  it('sets creator and producer to identify Arq as the generating application', async () => {
    const document = await PDFDocument.create();
    applySheetExportMetadata(document, baseMetadata);
    expect(document.getCreator()).toBe('Arq');
    expect(document.getProducer()).toBe('Arq PDF export (pdf-lib)');
  });

  it('uses the given generatedAt for both creation and modification dates', async () => {
    const document = await PDFDocument.create();
    const generatedAt = new Date('2026-01-15T10:00:00.000Z');
    applySheetExportMetadata(document, { ...baseMetadata, generatedAt });
    expect(document.getCreationDate()).toEqual(generatedAt);
    expect(document.getModificationDate()).toEqual(generatedAt);
  });

  it('defaults generatedAt to the current time when omitted', async () => {
    // PDF date fields only carry second-level precision, so allow a
    // one-second window on either side rather than exact millisecond bounds.
    const ONE_SECOND_MS = 1000;
    const before = new Date();
    const document = await PDFDocument.create();
    applySheetExportMetadata(document, baseMetadata);
    const after = new Date();
    const creationDate = document.getCreationDate();
    expect(creationDate).toBeDefined();
    expect((creationDate as Date).getTime()).toBeGreaterThanOrEqual(
      before.getTime() - ONE_SECOND_MS,
    );
    expect((creationDate as Date).getTime()).toBeLessThanOrEqual(after.getTime() + ONE_SECOND_MS);
  });

  it('does not set an author (unknown at this layer, never guessed)', async () => {
    const document = await PDFDocument.create();
    applySheetExportMetadata(document, baseMetadata);
    expect(document.getAuthor()).toBeUndefined();
  });
});
