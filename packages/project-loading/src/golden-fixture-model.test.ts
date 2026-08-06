import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeArqfsDriver, getArchiveEntry } from '@arq/arqfs';
import { parseNativeProjectModel } from './native-project-model';

/**
 * The reader against the real file, rather than against a fixture written to
 * suit the reader.
 *
 * Every other test in `native-project-model.test.ts` builds a minimal model in
 * TypeScript and breaks one field at a time, which is the right way to pin each
 * rejection. It cannot catch the failure that matters most here: a canonical
 * file this build claims to read, containing shapes nobody hand-wrote into a
 * test. The golden fixture holds 79 walls, 30 hosted openings, 14 doors, 16
 * windows and 34 rooms authored independently of this parser, and the counts
 * below are read from the file rather than asserted from the package's summary.
 *
 * Read-only throughout: the driver opens the fixture and pulls one archive
 * entry. Nothing here writes, and the fixture is the repository's, not a copy.
 */

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq',
);

function parseGoldenModel() {
  const driver = createNodeArqfsDriver(FIXTURE);
  try {
    const bytes = getArchiveEntry(driver, 'model.json');
    if (bytes === null) throw new Error('the golden fixture has no model.json');
    return parseNativeProjectModel(JSON.parse(new TextDecoder().decode(bytes)));
  } finally {
    driver.close();
  }
}

describe.runIf(existsSync(FIXTURE))('the golden fixture', () => {
  it('parses, rather than being refused by the reader that claims to read it', () => {
    const result = parseGoldenModel();
    if (result.status !== 'parsed') {
      throw new Error(`the golden fixture was refused: ${result.reason}`);
    }
    expect(result.model.summary.projectName).toBe('Courtyard House Reference');
    expect(result.model.summary.revision).toBe(191);
  });

  it('yields the hosted openings the file actually contains', () => {
    const result = parseGoldenModel();
    if (result.status !== 'parsed') throw new Error(result.reason);

    expect(result.model.walls).toHaveLength(79);
    expect(result.model.openings).toHaveLength(30);
    expect(result.model.doors).toHaveLength(14);
    expect(result.model.windows).toHaveLength(16);
    expect(result.model.rooms).toHaveLength(34);
    // Every opening is occupied: 14 doors plus 16 windows is exactly 30, so
    // this file has no bare voids. If that ever stops holding, the void-handling
    // path stops being theoretical and needs its own coverage.
    expect(result.model.doors.length + result.model.windows.length).toBe(
      result.model.openings.length,
    );
  });

  it('no longer reports its openings as content this build cannot show', () => {
    const result = parseGoldenModel();
    if (result.status !== 'parsed') throw new Error(result.reason);

    const sections = result.model.unsupported.map((entry) => entry.section);
    expect(sections).not.toContain('openings');
    expect(sections).not.toContain('doors');
    expect(sections).not.toContain('windows');
  });

  it('still reports what it genuinely cannot show, so the warning stays meaningful', () => {
    const result = parseGoldenModel();
    if (result.status !== 'parsed') throw new Error(result.reason);

    // The fixture carries 5 linear dimensions and no plan surface draws them
    // yet. An unsupported list that emptied itself as features landed would
    // eventually report nothing while still hiding something.
    expect(result.model.unsupported.map((entry) => `${entry.section}:${entry.count}`)).toEqual([
      'linearDimensions:5',
    ]);
  });

  it('resolves every opening onto a wall that exists in the same file', () => {
    const result = parseGoldenModel();
    if (result.status !== 'parsed') throw new Error(result.reason);

    const wallIds = new Set(result.model.walls.map((wall) => wall.id as string));
    for (const opening of result.model.openings) {
      expect(wallIds.has(opening.hostWallId as string)).toBe(true);
    }
  });
});
