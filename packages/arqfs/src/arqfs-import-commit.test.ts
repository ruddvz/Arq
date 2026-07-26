import { describe, expect, it, afterEach } from 'vitest';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { createArqfsSchemaLatest } from './arqfs-schema-v2';
import { createImportSession, type PersistedImportIssue } from './arqfs-import-session';
import { commitStagedImport, cancelStagedImport, failStagedImport } from './arqfs-import-commit';
import { assembleResource } from './arqfs-resource-chunks';
import { listResourceReferences } from './arqfs-resource-reference';
import { readWorkingCopyState, initializeWorkingCopyState } from './arqfs-working-copy';
import type { SourceDocumentRecord, SourceObjectMapRecord } from './arqfs-provenance';
import type { ArqfsDriver } from './arqfs-driver';

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The same digest arqfs-resource-chunks.ts computes, so a fixture's declared fingerprint can be made genuinely true of its own bytes rather than an arbitrary placeholder. */
async function sha256Hex(content: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', content as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

describe('commitStagedImport (schema-v2 review-before-commit)', () => {
  let driver: ArqfsDriver;

  afterEach(() => {
    driver?.close();
  });

  function freshDriver(): ArqfsDriver {
    driver = createNodeArqfsDriver();
    createArqfsSchemaLatest(driver, createArqfsSchemaV1);
    initializeWorkingCopyState(driver, 'project-1');
    return driver;
  }

  function queueSession(d: ArqfsDriver, id: string): void {
    createImportSession(d, {
      id,
      sourceName: 'floor-plan.dxf',
      sourceSha256: '1'.repeat(64),
      detectedFormat: 'dxf',
      adapterId: 'dxf-ingress',
      policyJson: '{"preserveOriginalSource":true}',
    });
  }

  /**
   * When `sourceBytes` is given, the returned record's fingerprint is the real
   * hash/length of exactly those bytes - commitStagedImport rejects a record
   * whose declared fingerprint disagrees with the bytes it is asked to
   * preserve, so a fixture must be self-consistent to be realistic.
   */
  async function sourceDocument(
    id: string,
    sourceBytes?: Uint8Array,
  ): Promise<Omit<SourceDocumentRecord, 'sourceResourceSha256'>> {
    return {
      id,
      originalName: 'floor-plan.dxf',
      mediaType: 'application/dxf',
      detectedFormat: 'dxf',
      sha256: sourceBytes ? await sha256Hex(sourceBytes) : '1'.repeat(64),
      byteLength: sourceBytes ? sourceBytes.byteLength : 42,
      importedAtUnixMs: 1_000,
      adapterId: 'dxf-ingress',
      adapterVersion: '1.0.0',
      fidelity: 'structured',
    };
  }

  const mappings: readonly SourceObjectMapRecord[] = [
    {
      sourceDocumentId: 'doc-1',
      sourceObjectId: 'dxf:entity:0',
      mappingKind: 'transformed',
      confidence: 1,
    },
    { sourceDocumentId: 'doc-1', sourceObjectId: 'dxf:entity:1', mappingKind: 'ignored' },
  ];

  const issues: readonly PersistedImportIssue[] = [
    { severity: 'warning', code: 'UNKNOWN_LAYER', message: 'Layer "X-FURN" has no mapped role.' },
  ];

  it('commits the source document, preserved resource, mappings and issues atomically', async () => {
    const d = freshDriver();
    queueSession(d, 'session-1');

    const result = await commitStagedImport(d, {
      sessionId: 'session-1',
      sourceDocument: await sourceDocument('doc-1', bytes('0 SECTION\n...dxf content...')),
      source: { bytes: bytes('0 SECTION\n...dxf content...'), mediaType: 'application/dxf' },
      mappings,
      issues,
      reportJson: '{"preservedCount":1}',
    });

    expect(result).toEqual({ status: 'committed', sourceDocumentId: 'doc-1', revision: 1 });

    const stored = d.query<{ readonly id: string; readonly source_resource_sha256: string | null }>(
      'SELECT id, source_resource_sha256 FROM source_document WHERE id = ?',
      ['doc-1'],
    )[0];
    expect(stored?.id).toBe('doc-1');
    expect(stored?.source_resource_sha256).not.toBeNull();

    // The preserved source bytes are genuinely retrievable, not just referenced.
    const assembled = await assembleResource(d, stored!.source_resource_sha256!);
    expect(assembled).toEqual({
      status: 'assembled',
      content: bytes('0 SECTION\n...dxf content...'),
    });

    // GC must see this resource as referenced, not orphaned.
    expect(listResourceReferences(d, stored!.source_resource_sha256!)).toEqual([
      {
        resourceSha256: stored!.source_resource_sha256,
        ownerKind: 'source-document',
        ownerId: 'doc-1',
        role: 'source',
      },
    ]);

    const mappingRows = d.query(
      'SELECT source_object_id, mapping_kind, arq_element_id FROM source_object_map WHERE source_document_id = ? ORDER BY source_object_id',
      ['doc-1'],
    );
    expect(mappingRows).toEqual([
      { source_object_id: 'dxf:entity:0', mapping_kind: 'transformed', arq_element_id: null },
      { source_object_id: 'dxf:entity:1', mapping_kind: 'ignored', arq_element_id: null },
    ]);

    const issueRows = d.query(
      'SELECT severity, code FROM import_issue WHERE import_session_id = ?',
      ['session-1'],
    );
    expect(issueRows).toEqual([{ severity: 'warning', code: 'UNKNOWN_LAYER' }]);

    const session = d.query<{
      readonly status: string;
      readonly source_document_id: string | null;
    }>('SELECT status, source_document_id FROM import_session WHERE id = ?', ['session-1'])[0];
    expect(session).toEqual({ status: 'committed', source_document_id: 'doc-1' });

    expect(readWorkingCopyState(d)).toMatchObject({ localCommitState: 'clean', localRevision: 1 });
  });

  it('commits without preserving the source resource when the import policy did not ask for it', async () => {
    const d = freshDriver();
    queueSession(d, 'session-1');

    const result = await commitStagedImport(d, {
      sessionId: 'session-1',
      sourceDocument: await sourceDocument('doc-1'),
      mappings: [],
      issues: [],
      reportJson: '{}',
    });

    expect(result.status).toBe('committed');
    const stored = d.query<{ readonly source_resource_sha256: string | null }>(
      'SELECT source_resource_sha256 FROM source_document WHERE id = ?',
      ['doc-1'],
    )[0];
    expect(stored?.source_resource_sha256).toBeNull();
  });

  /**
   * The core "no partial canonical mutation" guarantee: a commit that fails
   * partway (a duplicate source_document id, discovered only once the insert
   * itself runs) must leave zero rows behind - not the resource, not the
   * mappings, not the issues, not even a partially-updated session.
   */
  it('leaves no partial canonical mutation when the commit fails partway through', async () => {
    const d = freshDriver();
    queueSession(d, 'session-1');
    queueSession(d, 'session-2');

    const first = await commitStagedImport(d, {
      sessionId: 'session-1',
      sourceDocument: await sourceDocument('doc-1', bytes('first import bytes')),
      source: { bytes: bytes('first import bytes'), mediaType: 'application/dxf' },
      mappings,
      issues,
      reportJson: '{}',
    });
    expect(first.status).toBe('committed');

    // Same source_document id again: source_document's PRIMARY KEY collides,
    // so the transaction must fail and roll back completely.
    const second = await commitStagedImport(d, {
      sessionId: 'session-2',
      sourceDocument: await sourceDocument(
        'doc-1',
        bytes('second import bytes, different content'),
      ),
      source: {
        bytes: bytes('second import bytes, different content'),
        mediaType: 'application/dxf',
      },
      mappings: [
        { sourceDocumentId: 'doc-1', sourceObjectId: 'dxf:entity:99', mappingKind: 'exact' },
      ],
      issues: [
        { severity: 'error', code: 'SHOULD_NOT_PERSIST', message: 'must not survive rollback' },
      ],
      reportJson: '{}',
    });

    expect(second.status).toBe('rejected');

    // Only the first import's rows exist. The second's resource, mapping and
    // issue never landed, and session-2 is still 'queued', not 'committed'.
    expect(d.query('SELECT COUNT(*) AS count FROM source_document')[0]).toEqual({ count: 1 });
    expect(
      d.query('SELECT COUNT(*) AS count FROM source_object_map WHERE source_object_id = ?', [
        'dxf:entity:99',
      ])[0],
    ).toEqual({ count: 0 });
    expect(
      d.query('SELECT COUNT(*) AS count FROM import_issue WHERE code = ?', [
        'SHOULD_NOT_PERSIST',
      ])[0],
    ).toEqual({ count: 0 });
    expect(
      d.query<{ readonly status: string }>('SELECT status FROM import_session WHERE id = ?', [
        'session-2',
      ])[0]?.status,
    ).toBe('queued');
    // The second attempt's preserved-source resource bytes must not exist either -
    // proof the resource write itself was rolled back, not merely orphaned.
    const secondResourceRows = d.query(
      "SELECT COUNT(*) AS count FROM resource WHERE canonical_role = 'source-import'",
    );
    expect(secondResourceRows[0]).toEqual({ count: 1 }); // only the first import's resource
  });

  it('rejects when the working copy has an interrupted write pending, without touching anything', async () => {
    const d = freshDriver();
    queueSession(d, 'session-1');
    d.run("UPDATE working_copy_state SET local_commit_state = 'writing' WHERE id = 1");

    const result = await commitStagedImport(d, {
      sessionId: 'session-1',
      sourceDocument: await sourceDocument('doc-1'),
      mappings: [],
      issues: [],
      reportJson: '{}',
    });

    expect(result).toMatchObject({ status: 'rejected' });
    expect(d.query('SELECT COUNT(*) AS count FROM source_document')[0]).toEqual({ count: 0 });
  });

  it('cancels a staged import without writing any resource, mapping or provenance row', () => {
    const d = freshDriver();
    queueSession(d, 'session-1');

    const result = cancelStagedImport(d, 'session-1');

    expect(result).toEqual({ status: 'cancelled' });
    expect(
      d.query<{ readonly status: string }>('SELECT status FROM import_session WHERE id = ?', [
        'session-1',
      ])[0]?.status,
    ).toBe('cancelled');
    expect(d.query('SELECT COUNT(*) AS count FROM source_document')[0]).toEqual({ count: 0 });
  });

  it('records an explicit failure distinct from a cancellation, with a diagnosable code and message', () => {
    const d = freshDriver();
    queueSession(d, 'session-1');

    const result = failStagedImport(d, 'session-1', {
      failureCode: 'ADAPTER_CRASHED',
      failureMessage: 'DXF parser threw while reading entity 42.',
    });

    expect(result).toEqual({ status: 'failed' });
    const session = d.query<{
      readonly status: string;
      readonly failure_code: string;
      readonly failure_message: string;
    }>('SELECT status, failure_code, failure_message FROM import_session WHERE id = ?', [
      'session-1',
    ])[0];
    expect(session).toEqual({
      status: 'failed',
      failure_code: 'ADAPTER_CRASHED',
      failure_message: 'DXF parser threw while reading entity 42.',
    });
  });

  it('refuses to commit against a schema v1 file, since the provenance tables do not exist yet', async () => {
    driver = createNodeArqfsDriver();
    createArqfsSchemaV1(driver);
    initializeWorkingCopyState(driver, 'project-1');

    const result = await commitStagedImport(driver, {
      sessionId: 'session-1',
      sourceDocument: await sourceDocument('doc-1'),
      mappings: [],
      issues: [],
      reportJson: '{}',
    });

    expect(result.status).toBe('rejected');
  });

  it('dedupes the preserved resource when the same source bytes are imported twice under different documents', async () => {
    const d = freshDriver();
    queueSession(d, 'session-1');
    queueSession(d, 'session-2');
    const sameBytes = bytes('identical source content');

    const first = await commitStagedImport(d, {
      sessionId: 'session-1',
      sourceDocument: await sourceDocument('doc-1', sameBytes),
      source: { bytes: sameBytes, mediaType: 'application/dxf' },
      mappings: [],
      issues: [],
      reportJson: '{}',
    });
    const second = await commitStagedImport(d, {
      sessionId: 'session-2',
      sourceDocument: { ...(await sourceDocument('doc-2', sameBytes)), originalName: 'copy.dxf' },
      source: { bytes: sameBytes, mediaType: 'application/dxf' },
      mappings: [],
      issues: [],
      reportJson: '{}',
    });

    expect(first.status).toBe('committed');
    expect(second.status).toBe('committed');
    const docs = d.query<{ readonly source_resource_sha256: string }>(
      'SELECT source_resource_sha256 FROM source_document ORDER BY id',
    );
    expect(docs[0]?.source_resource_sha256).toBe(docs[1]?.source_resource_sha256);
    // One resource row, two references - dedupe did not lose either owner.
    expect(d.query('SELECT COUNT(*) AS count FROM resource')[0]).toEqual({ count: 1 });
    expect(listResourceReferences(d, docs[0]!.source_resource_sha256)).toHaveLength(2);
  });

  /**
   * `UPDATE import_session ... WHERE id = ?` against a missing id is a silent
   * no-op in SQLite. Before this was checked, a commit with a typo'd or stale
   * sessionId wrote the source_document, resource and mappings and returned
   * 'committed' while the session it claimed to commit did not exist. It only
   * failed loudly when `issues` happened to be non-empty (import_issue's FK to
   * import_session), so the clean-import case - the common one - stayed silent.
   */
  it('rejects a commit against a non-existent session and writes nothing', async () => {
    const d = freshDriver();
    // No queueSession call - the session genuinely does not exist.

    const result = await commitStagedImport(d, {
      sessionId: 'session-that-does-not-exist',
      sourceDocument: await sourceDocument('doc-1'),
      mappings: [],
      issues: [],
      reportJson: '{}',
    });

    expect(result).toMatchObject({ status: 'rejected' });
    expect(result.status === 'rejected' && result.reason).toMatch(/does not exist/);
    expect(d.query('SELECT COUNT(*) AS count FROM source_document')[0]).toEqual({ count: 0 });
    expect(readWorkingCopyState(d)).toMatchObject({ localRevision: 0 });
  });

  it('rejects cancel and fail against a non-existent session too', () => {
    const d = freshDriver();

    expect(cancelStagedImport(d, 'nope')).toMatchObject({ status: 'rejected' });
    expect(failStagedImport(d, 'nope', { failureCode: 'X', failureMessage: 'y' })).toMatchObject({
      status: 'rejected',
    });
  });

  /**
   * The caller supplies the source fingerprint and the bytes to preserve as two
   * separate inputs. Persisting both when they disagree would store a
   * provenance record that is false about the very resource it points at -
   * exactly what ARQFS-012's "source fingerprint and resource preservation"
   * exists to make trustworthy.
   */
  it('rejects a sourceDocument whose declared sha256 does not match the preserved bytes', async () => {
    const d = freshDriver();
    queueSession(d, 'session-1');

    const result = await commitStagedImport(d, {
      sessionId: 'session-1',
      sourceDocument: { ...(await sourceDocument('doc-1')), sha256: 'a'.repeat(64) },
      source: { bytes: bytes('the real content'), mediaType: 'application/dxf' },
      mappings: [],
      issues: [],
      reportJson: '{}',
    });

    expect(result).toMatchObject({ status: 'rejected' });
    expect(result.status === 'rejected' && result.reason).toMatch(/fingerprint mismatch/);
    expect(d.query('SELECT COUNT(*) AS count FROM source_document')[0]).toEqual({ count: 0 });
    expect(d.query('SELECT COUNT(*) AS count FROM resource')[0]).toEqual({ count: 0 });
  });

  it('rejects a sourceDocument whose declared byteLength does not match the preserved bytes', async () => {
    const d = freshDriver();
    queueSession(d, 'session-1');
    const realBytes = bytes('the real content');

    const result = await commitStagedImport(d, {
      sessionId: 'session-1',
      sourceDocument: { ...(await sourceDocument('doc-1', realBytes)), byteLength: 999_999 },
      source: { bytes: realBytes, mediaType: 'application/dxf' },
      mappings: [],
      issues: [],
      reportJson: '{}',
    });

    expect(result).toMatchObject({ status: 'rejected' });
    expect(result.status === 'rejected' && result.reason).toMatch(/fingerprint mismatch/);
    expect(d.query('SELECT COUNT(*) AS count FROM source_document')[0]).toEqual({ count: 0 });
  });
});
