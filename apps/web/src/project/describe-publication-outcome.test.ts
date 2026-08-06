import { describe, expect, it } from 'vitest';
import type { ArqfsPublicationReceipt, ArqfsPublicationRefusal } from '@arq/arqfs';
import {
  describeDeliveryFailure,
  describePublicationOutcome,
  PUBLICATION_WORK_IS_SAFE_SENTENCE,
} from './describe-publication-outcome';

/**
 * Every refusal `publishProjectFile` can return. Listed here rather than derived
 * from the type, because the point of the list is to fail when the union grows:
 * a new reason has to be added here deliberately, which is the moment someone
 * has to decide what it says to a user.
 */
const ALL_REFUSALS: readonly ArqfsPublicationRefusal[] = [
  'working-copy-missing',
  'working-copy-not-settled',
  'revision-not-current',
  'export-failed',
  'reader-open-failed',
  'reader-rejected',
  'integrity-failed',
  'entry-digest-failed',
  'identity-mismatch',
  'revision-drift',
  'semantic-mismatch',
  'sidecar-present',
];

const RECEIPT: ArqfsPublicationReceipt = {
  projectId: 'project-1',
  revision: 7,
  semanticHash: 'hash',
  semanticHashScheme: 'scheme',
  formatVersion: { major: 1, minor: 0 } as ArqfsPublicationReceipt['formatVersion'],
  entryCount: 4,
  byteLength: 20480,
  targetPath: 'working-published',
  verifiedBy: 'fresh-reader',
};

describe('describePublicationOutcome', () => {
  it('tells the user their work is safe on every refusal, not on a chosen few', () => {
    for (const reason of ALL_REFUSALS) {
      const described = describePublicationOutcome(
        { status: 'refused', reason, detail: `diagnostic for ${reason}` },
        'Riverside.arq',
      );
      expect(described.tone).toBe('error');
      expect(described.detail).toContain(PUBLICATION_WORK_IS_SAFE_SENTENCE);
    }
  });

  it('never describes a refusal as a saved copy', () => {
    for (const reason of ALL_REFUSALS) {
      const described = describePublicationOutcome(
        { status: 'refused', reason, detail: 'diagnostic' },
        'Riverside.arq',
      );
      // The headline is what a user reads first and often all they read. A
      // refusal that leads with anything other than "no copy" is the failure
      // mode this whole module exists to prevent.
      expect(described.headline).toBe('No copy was saved.');
      expect(described.headline).not.toMatch(/saved a copy/i);
    }
  });

  it('carries the underlying diagnostic rather than paraphrasing it away', () => {
    const described = describePublicationOutcome(
      {
        status: 'refused',
        reason: 'semantic-mismatch',
        detail: 'expected semantic hash abc but the published file hashes to def',
      },
      'Riverside.arq',
    );
    expect(described.detail).toContain(
      'expected semantic hash abc but the published file hashes to def',
    );
  });

  it('gives each refusal its own explanation, so none is a generic failure', () => {
    const sentences = ALL_REFUSALS.map(
      (reason) =>
        describePublicationOutcome({ status: 'refused', reason, detail: 'd' }, 'p.arq').detail,
    );
    expect(new Set(sentences).size).toBe(ALL_REFUSALS.length);
  });

  it('reports a published copy as checked by reopening, with the receipt figures', () => {
    const described = describePublicationOutcome(
      { status: 'published', receipt: RECEIPT, bytes: new Uint8Array([1, 2, 3]) },
      'Riverside.arq',
    );
    expect(described.tone).toBe('success');
    expect(described.headline).toBe('Saved a copy as Riverside.arq.');
    expect(described.detail).toContain('revision 7');
    expect(described.detail).toContain('4 entries');
    expect(described.detail).toContain('20480 bytes');
  });

  it('does not claim the project is safe on success, because that is a refusal reassurance', () => {
    const described = describePublicationOutcome(
      { status: 'published', receipt: RECEIPT, bytes: new Uint8Array() },
      'Riverside.arq',
    );
    expect(described.detail).not.toContain(PUBLICATION_WORK_IS_SAFE_SENTENCE);
  });

  it('counts a single entry in the singular', () => {
    const described = describePublicationOutcome(
      {
        status: 'published',
        receipt: { ...RECEIPT, entryCount: 1 },
        bytes: new Uint8Array(),
      },
      'Riverside.arq',
    );
    expect(described.detail).toContain('1 entry,');
  });
});

describe('describeDeliveryFailure', () => {
  it('separates a download failure from a verification failure', () => {
    const described = describeDeliveryFailure('user cancelled');
    expect(described.tone).toBe('error');
    expect(described.headline).toBe('No copy was saved.');
    // The copy passed every check; saying otherwise would report a corruption
    // that did not happen and send the user looking for damage in their project.
    expect(described.detail).toContain('checked');
    expect(described.detail).toContain('user cancelled');
    expect(described.detail).toContain(PUBLICATION_WORK_IS_SAFE_SENTENCE);
  });
});
