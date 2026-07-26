import type { ArqfsDriver } from './arqfs-driver';

/**
 * Persists one `@arq/file-ingress` import attempt's lifecycle (schema v2's
 * `import_session`/`import_issue` tables, arqfs-schema-v2.ts) - queued through
 * committed/cancelled/failed - and its per-object issues, so an import that spans
 * a Worker round-trip (workers/import-export-worker) or gets interrupted mid-way
 * has a durable record to resume, retry, or explain to the user from, rather than
 * only living in memory for the duration of one Worker call.
 */
export type ImportSessionStatus =
  | 'queued'
  | 'detecting'
  | 'converting'
  | 'validating'
  | 'staged'
  | 'committed'
  | 'cancelled'
  | 'failed';

export interface CreateImportSessionInput {
  readonly id: string;
  readonly sourceName: string;
  readonly sourceSha256: string;
  readonly detectedFormat: string;
  readonly adapterId?: string;
  readonly policyJson: string;
  readonly startedAtUnixMs?: number;
}

export interface PersistedImportIssue {
  readonly severity: 'info' | 'warning' | 'error' | 'fatal';
  readonly code: string;
  readonly message: string;
  readonly sourceObjectId?: string;
}

export function createImportSession(driver: ArqfsDriver, input: CreateImportSessionInput): void {
  driver.run(
    `INSERT INTO import_session(
      id, status, started_at_unix_ms, source_name, source_sha256,
      detected_format, adapter_id, policy_json
    ) VALUES (?, 'queued', ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.startedAtUnixMs ?? Date.now(),
      input.sourceName,
      input.sourceSha256,
      input.detectedFormat,
      input.adapterId ?? null,
      input.policyJson,
    ],
  );
}

/**
 * Returns the number of rows actually updated - 0 means no session with that id
 * exists. Deliberately returned rather than swallowed: `UPDATE ... WHERE id = ?`
 * against a missing id is a silent no-op in SQLite, so a caller that treats this
 * as void can report a lifecycle transition ("committed") that never happened.
 * `arqfs-import-commit.ts` checks this and rejects.
 */
export function updateImportSession(
  driver: ArqfsDriver,
  id: string,
  status: ImportSessionStatus,
  options: {
    readonly sourceDocumentId?: string;
    readonly reportJson?: string;
    readonly failureCode?: string;
    readonly failureMessage?: string;
    readonly finishedAtUnixMs?: number;
  } = {},
): number {
  const result = driver.run(
    `UPDATE import_session SET
      status = ?,
      source_document_id = COALESCE(?, source_document_id),
      report_json = COALESCE(?, report_json),
      failure_code = ?,
      failure_message = ?,
      finished_at_unix_ms = ?
     WHERE id = ?`,
    [
      status,
      options.sourceDocumentId ?? null,
      options.reportJson ?? null,
      options.failureCode ?? null,
      options.failureMessage ?? null,
      options.finishedAtUnixMs ??
        (['committed', 'cancelled', 'failed'].includes(status) ? Date.now() : null),
      id,
    ],
  );
  return result.changes;
}

export function replaceImportIssues(
  driver: ArqfsDriver,
  sessionId: string,
  issues: readonly PersistedImportIssue[],
): void {
  driver.transaction(() => {
    driver.run('DELETE FROM import_issue WHERE import_session_id = ?', [sessionId]);
    issues.forEach((issue, index) => {
      driver.run(
        `INSERT INTO import_issue(
          import_session_id, issue_index, severity, code, message, source_object_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, index, issue.severity, issue.code, issue.message, issue.sourceObjectId ?? null],
      );
    });
  });
}
