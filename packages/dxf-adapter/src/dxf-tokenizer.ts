/**
 * ARQ-158: exchange: prototype DXF parser.
 *
 * DXF's ASCII form is a flat sequence of (group code, value) pairs, each on
 * its own line - no nesting syntax of its own; structure (sections,
 * entities) is inferred purely from which codes appear where. This is the
 * tokenizing layer: turn raw text into that pair sequence, tolerating a
 * trailing blank line or stray CRLF without throwing. Nothing here knows
 * what a LINE or a HEADER section is yet - that is dxf-parser.ts's job.
 */

export interface DxfGroup {
  readonly code: number;
  readonly value: string;
}

/** Splits DXF ASCII content into (code, value) pairs. Lines that cannot pair into a valid integer code are skipped rather than throwing, so a malformed or truncated file degrades to fewer recognized groups instead of a parse failure. */
export function tokenizeDxf(content: string): readonly DxfGroup[] {
  const lines = content.split(/\r\n|\r|\n/);
  const groups: DxfGroup[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const codeLine = lines[i];
    const valueLine = lines[i + 1];
    if (codeLine === undefined || valueLine === undefined) {
      continue;
    }
    const trimmedCode = codeLine.trim();
    if (trimmedCode.length === 0) {
      continue;
    }
    const code = Number.parseInt(trimmedCode, 10);
    if (!Number.isFinite(code)) {
      continue;
    }
    groups.push({ code, value: valueLine.trim() });
  }
  return groups;
}
