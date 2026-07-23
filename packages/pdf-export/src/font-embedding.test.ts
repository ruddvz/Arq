import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { embedCustomFont } from './font-embedding';

/**
 * A real, freely-licensed (SIL Open Font License 1.1) TrueType font
 * already present in this container's system fonts - used only to
 * prove embedding genuinely works end-to-end, not shipped as a
 * repository asset. Skips gracefully (not a failure) on a machine/CI
 * image without this exact system font installed, rather than being a
 * brittle hard dependency on one container's filesystem layout.
 */
const SYSTEM_FONT_PATH = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf';
const hasSystemFont = existsSync(SYSTEM_FONT_PATH);

describe.skipIf(!hasSystemFont)('embedCustomFont', () => {
  it('embeds a real TrueType font and returns a usable PDFFont', async () => {
    const document = await PDFDocument.create();
    const fontBytes = readFileSync(SYSTEM_FONT_PATH);
    const font = await embedCustomFont(document, fontBytes);
    expect(font).toBeDefined();
    expect(font.name).not.toBe(StandardFonts.Helvetica);
  });

  it('draws text with the embedded font and produces a valid, reloadable PDF', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([200, 200]);
    const fontBytes = readFileSync(SYSTEM_FONT_PATH);
    const font = await embedCustomFont(document, fontBytes);
    page.drawText('Embedded font test', { x: 10, y: 100, size: 12, font });

    const saved = await document.save();
    const reloaded = await PDFDocument.load(saved);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('actually embeds the font program in the saved PDF (a /FontFile resource is present)', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([200, 200]);
    const fontBytes = readFileSync(SYSTEM_FONT_PATH);
    const font = await embedCustomFont(document, fontBytes);
    page.drawText('Embedded font test', { x: 10, y: 100, size: 12, font });

    // useObjectStreams: false keeps every object's dictionary as plain
    // text in the saved bytes, rather than compressed inside a PDF 1.5+
    // object stream - needed so a plain string search below can find it.
    const saved = await document.save({ useObjectStreams: false });
    const savedText = Buffer.from(saved).toString('latin1');
    expect(savedText).toMatch(/\/FontFile/);
  });

  it('registering fontkit twice on the same document does not throw', async () => {
    const document = await PDFDocument.create();
    const fontBytes = readFileSync(SYSTEM_FONT_PATH);
    await embedCustomFont(document, fontBytes);
    await expect(embedCustomFont(document, fontBytes)).resolves.toBeDefined();
  });
});

describe('a StandardFonts-only PDF (contrast case)', () => {
  it('does not contain a /FontFile resource, unlike an embedded custom font', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([200, 200]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    page.drawText('Standard font only', { x: 10, y: 100, size: 12, font });

    const saved = await document.save({ useObjectStreams: false });
    const savedText = Buffer.from(saved).toString('latin1');
    expect(savedText).not.toMatch(/\/FontFile/);
  });
});
