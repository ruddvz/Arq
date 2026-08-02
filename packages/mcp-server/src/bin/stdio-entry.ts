#!/usr/bin/env node
/**
 * The runnable server.
 *
 * Until this existed, `@arq/mcp-server` was a library with no way to be a
 * server: every client configuration template pointed at a command that did
 * not exist, and the protocol could only be exercised in-process by its own
 * tests. This entry is what a client actually launches, and what
 * `scripts/run-mcp-protocol-capability-check.mjs` drives over real stdio.
 *
 * It reads a grant file rather than carrying any authority of its own. The
 * Arq application writes that file when the operator shares projects; this
 * process reads it on **every** tool call, which is what makes withdrawal
 * immediate - deleting the file revokes access on the next call rather than
 * at the next reconnection. With no file, every tool answers that nothing
 * is shared, which is the correct default and not an error.
 *
 * The host is the in-process semantic host. That is honest rather than
 * convenient: it holds the model in memory, says so in every snapshot
 * warning, and writes no file. A desktop shell would pass its own
 * `ArqProjectHost` here and keep the operator surface to itself.
 */

import { readFileSync } from 'node:fs';
import { createMemoryArqHost } from '../host/memory-project-host';
import { createGrant, type GrantContext } from '../grant/grant';
import { GRANT_PRESETS, isArqMcpScope, type ArqMcpScope } from '../grant/scopes';
import type { ClientIdentity } from '../mcp/protocol';
import { createArqMcpRuntime } from '../runtime/create-runtime';
import { serveStdio } from '../transport/stdio';
import { arrayValue, enumValue, integerValue, objectValue } from '../schema/schema';
import { formatIssues } from '../schema/schema';
import { boundedText, opaqueId, scopeName } from '../schema/identifiers';
import { MAX_GRANT_LIFETIME_MS } from '../grant/grant';

/**
 * The grant file is untrusted input: it is a file on disk that this process
 * did not write, so it goes through the same validation as anything a
 * client sends. A malformed file is reported to standard error and treated
 * as no grant at all - never as a permissive default.
 */
const grantFileSchema = objectValue({
  required: {
    grantId: opaqueId(),
    subjectId: opaqueId(),
    tenantId: opaqueId(),
    scopes: arrayValue(scopeName(), { minItems: 1, maxItems: 64 }),
    projectIds: arrayValue(opaqueId(), { maxItems: 256 }),
    issuedAtEpochMs: integerValue({ minimum: 0 }),
    lifetimeMs: integerValue({ minimum: 1, maximum: MAX_GRANT_LIFETIME_MS }),
  },
  optional: {
    preset: enumValue(['read_only', 'plan', 'propose']),
    note: boundedText(500),
  },
  title: 'Arq grant file',
});

function readGrantFile(path: string, client: ClientIdentity): GrantContext | undefined {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    // Absent is the normal state before the operator shares anything, and
    // it is also how withdrawal is expressed. Neither is worth a diagnostic.
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stderr.write('[arq-mcp] the grant file is not valid JSON; treating it as no grant\n');
    return undefined;
  }

  const checked = grantFileSchema.validate(parsed, '$');
  if (!checked.ok) {
    process.stderr.write(
      `[arq-mcp] the grant file is not a valid grant; treating it as no grant: ${formatIssues(checked.issues)}\n`,
    );
    return undefined;
  }

  const preset = checked.value.preset;
  const declared: readonly string[] =
    preset === undefined ? checked.value.scopes : GRANT_PRESETS[preset];
  const scopes: ArqMcpScope[] = [];
  for (const scope of declared) {
    if (isArqMcpScope(scope)) {
      scopes.push(scope);
    } else {
      // Widening is impossible and narrowing is safe, so an unknown scope
      // is dropped with a diagnostic rather than failing the whole grant.
      process.stderr.write(
        `[arq-mcp] the grant file names an unknown scope "${scope}"; ignoring it\n`,
      );
    }
  }
  if (scopes.length === 0) {
    process.stderr.write(
      '[arq-mcp] the grant file names no usable scope; treating it as no grant\n',
    );
    return undefined;
  }

  try {
    return createGrant({
      grantId: checked.value.grantId,
      subjectId: checked.value.subjectId,
      tenantId: checked.value.tenantId,
      // Identity comes from the handshake, never from the file: the file
      // says what the operator shared, the handshake says who turned up.
      clientName: client.name,
      clientVersion: client.version,
      scopes,
      projectIds: checked.value.projectIds,
      issuedAtEpochMs: checked.value.issuedAtEpochMs,
      lifetimeMs: checked.value.lifetimeMs,
    });
  } catch (error) {
    process.stderr.write(
      `[arq-mcp] the grant file was refused: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return undefined;
  }
}

export interface StdioEntryOptions {
  readonly grantFilePath?: string;
  readonly seedProjectName?: string;
}

export function startStdioServer(options: StdioEntryOptions): { close: () => void } {
  const { host, operator } = createMemoryArqHost();

  if (options.seedProjectName !== undefined) {
    // A project with one level and one wall type, so a connected client has
    // something real to read and propose against. It is in memory and every
    // snapshot says so.
    host.createDraft('project-local', options.seedProjectName);
    operator.apply(
      'project-local',
      'rev-000000',
      [
        {
          operationId: 'seed-level',
          operationType: 'architecture.level.create',
          operationVersion: '1.0.0',
          arguments: { levelId: 'level-0', name: 'Ground floor', elevationMm: 0 },
          preconditions: [],
        },
        {
          operationId: 'seed-wall-type',
          operationType: 'architecture.wall_type.create',
          operationVersion: '1.0.0',
          arguments: {
            wallTypeId: 'wall-type-generic-100',
            name: 'Generic 100',
            thicknessMm: 100,
            defaultHeightMm: 2700,
          },
          preconditions: [],
        },
      ],
      'operator',
    );
  }

  const runtime = createArqMcpRuntime({
    host,
    // Re-read per call. Withdrawal is deleting the file, and it takes effect
    // on the next call rather than at the next reconnection.
    resolveGrant: (client) =>
      options.grantFilePath === undefined
        ? undefined
        : readGrantFile(options.grantFilePath, client),
  });

  const transport = serveStdio({ server: runtime.server });
  return { close: () => transport.close() };
}

function main(): void {
  const grantFilePath = process.env.ARQ_MCP_GRANT_FILE;
  const seedProjectName = process.env.ARQ_MCP_SEED_PROJECT;

  if (grantFilePath === undefined) {
    process.stderr.write(
      '[arq-mcp] no ARQ_MCP_GRANT_FILE is set, so nothing is shared with this connection. Arq writes that file when the operator shares a project.\n',
    );
  }

  const server = startStdioServer({
    ...(grantFilePath === undefined ? {} : { grantFilePath }),
    ...(seedProjectName === undefined ? {} : { seedProjectName }),
  });

  const close = (): void => {
    server.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  process.stderr.write('[arq-mcp] listening on stdio\n');
}

// `import.meta.url` is only the entry point when this file was launched
// directly, which keeps the module importable by tests without starting a
// server that would then fight them for standard input.
const launchedDirectly =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/gu, '/'));
if (launchedDirectly || process.env.ARQ_MCP_FORCE_START === '1') {
  main();
}
