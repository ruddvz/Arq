/**
 * ARQ-156: fuzz arq archive.
 *
 * Blueprint section 116 ("Controls")'s "fuzzing" control, applied to
 * `importArchive` (archive.ts, ARQ-079) - the one function in this
 * codebase that reads untrusted `.arq` archive bytes, exactly the
 * attack surface section 115's "malicious...archive" threat names.
 * archive.test.ts already covers specific hand-crafted cases (a
 * path-traversal entry, a corrupt manifest, an oversized entry, ...);
 * this module is genuinely generative coverage over that same input
 * space, using `fast-check` (already a workspace dependency throughout
 * this backlog's property tests) rather than a dedicated fuzzing
 * library - a new, heavier dependency this issue's own "do not
 * introduce unreviewed dependencies" non-goal rules out, and not
 * needed: fast-check's arbitraries already generate the malformed
 * paths/bytes/structures a fuzzer would.
 *
 * The one property that actually matters for "safe failure" (section
 * 116): `importArchive` must never throw, for *any* input, no matter
 * how malformed - it always resolves to a well-formed
 * `ArchiveOpenResult` (`'opened'` or `'rejected'`). A thrown exception
 * from untrusted archive content would be the actual vulnerability
 * this control exists to catch, not merely a returned rejection
 * (which is the documented, expected safe-failure path).
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { importArchive, MAX_ENTRY_BYTES } from './archive';

const arbitraryPath = fc.oneof(
  fc.string(),
  fc.constantFrom(
    '../../../etc/passwd',
    '..\\..\\windows\\system32',
    '/etc/passwd',
    'C:\\Windows\\System32',
    '',
    'manifest.json/../../../etc/passwd',
    'a/../../b',
    '\u0000',
    'imports/../../../secret',
  ),
);

const arbitraryBytes = fc.oneof(
  fc.uint8Array({ maxLength: 2048 }),
  fc.string().map((s) => new TextEncoder().encode(s)),
  fc.constant(new TextEncoder().encode('{not valid json')),
  fc.constant(new TextEncoder().encode('null')),
  fc.constant(new Uint8Array(0)),
);

function toEntryMap(pairs: readonly (readonly [string, Uint8Array])[]): Map<string, Uint8Array> {
  return new Map(pairs);
}

describe('importArchive fuzzing (ARQ-156)', () => {
  it('never throws for any combination of arbitrary paths and byte content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(arbitraryPath, arbitraryBytes), { maxLength: 8 }),
        async (pairs) => {
          const entries = toEntryMap(pairs);
          const result = await importArchive(entries);
          expect(result.status === 'opened' || result.status === 'rejected').toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('never throws when manifest.json/model.json are present but hold arbitrary garbage bytes', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryBytes, arbitraryBytes, async (manifestBytes, modelBytes) => {
        const entries = toEntryMap([
          ['manifest.json', manifestBytes],
          ['model.json', modelBytes],
        ]);
        const result = await importArchive(entries);
        expect(result.status === 'opened' || result.status === 'rejected').toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('rejects every generated path-traversal or absolute-path variant, never opening', async () => {
    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      '/etc/passwd',
      'C:\\Windows\\System32',
      'imports/../../../secret',
      'a/../../b',
    ];
    for (const path of maliciousPaths) {
      const entries = toEntryMap([[path, new TextEncoder().encode('x')]]);
      const result = await importArchive(entries);
      expect(result.status).toBe('rejected');
    }
  });

  it('rejects any single entry larger than MAX_ENTRY_BYTES, for arbitrary path names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((path) => !path.includes('..') && !path.startsWith('/')),
        async (path) => {
          const oversized = new Uint8Array(MAX_ENTRY_BYTES + 1);
          const entries = toEntryMap([[path, oversized]]);
          const result = await importArchive(entries);
          expect(result.status).toBe('rejected');
        },
      ),
      { numRuns: 3 },
    );
  });

  it('never throws for an empty archive', async () => {
    const result = await importArchive(new Map());
    expect(result.status).toBe('rejected');
  });
});
