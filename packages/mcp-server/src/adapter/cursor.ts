/**
 * Cursors bound to the query that produced them.
 *
 * The reviewed 2.0 package encoded `{ offset }` in base64url and decoded it
 * with a range check. Nothing tied the cursor to a query, so a cursor taken
 * from one call could be replayed into a different one - a different
 * project, a different filter, a different revision - and the server would
 * happily page into it. And because the offset was not tied to a snapshot,
 * a page taken after the underlying collection changed would silently skip
 * or repeat items, which for a model reading a project model is worse than
 * an error: it produces a confident, incomplete answer.
 *
 * A cursor here carries a fingerprint of the query shape and the snapshot
 * revision it was issued against. Presenting it anywhere else is refused,
 * with instructions to start the query again.
 *
 * The fingerprint is not a signature. It stops accidental reuse and
 * cross-query paging, not a caller who deliberately forges one - and a
 * forged cursor buys nothing, because every page is still fetched under the
 * caller's own grant and re-checked against it.
 */

import type { JsonValue } from '../schema/json-value';
import { ArqMcpError } from '../domain/errors';
import { shortDigest } from '../util/hash';

export interface CursorBinding {
  readonly tool: string;
  readonly scopeKey: JsonValue;
}

interface CursorPayload {
  readonly offset: number;
  readonly fingerprint: string;
}

export function encodeCursor(offset: number, binding: CursorBinding): string {
  const payload: CursorPayload = { offset, fingerprint: fingerprintOf(binding) };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined, binding: CursorBinding): number {
  if (cursor === undefined) {
    return 0;
  }

  let payload: CursorPayload;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !Number.isInteger((decoded as { offset?: unknown }).offset) ||
      typeof (decoded as { fingerprint?: unknown }).fingerprint !== 'string'
    ) {
      throw new TypeError('malformed cursor payload');
    }
    payload = decoded as CursorPayload;
  } catch {
    throw cursorInvalid('That cursor could not be read.');
  }

  if (payload.offset < 0) {
    throw cursorInvalid('That cursor names a position before the start of the results.');
  }
  if (payload.fingerprint !== fingerprintOf(binding)) {
    throw cursorInvalid(
      'That cursor came from a different query, project or revision than the one it was presented to.',
    );
  }
  return payload.offset;
}

function fingerprintOf(binding: CursorBinding): string {
  return shortDigest({ tool: binding.tool, scope: binding.scopeKey }, 20);
}

function cursorInvalid(detail: string): ArqMcpError {
  return new ArqMcpError({
    code: 'ARQ_CURSOR_INVALID',
    state: 'invalid_cursor',
    message: `${detail} Nothing was read or changed.`,
    retry: 'never',
    nextAction:
      'Start the query again without a cursor, then follow the nextCursor value that result returns.',
  });
}
