#!/usr/bin/env node
/**
 * ADR-0027: drive the built MCP server as a real process over real stdio.
 *
 * The package's own tests exercise the protocol in-process, which proves the
 * dispatch logic and nothing about whether the thing can actually be
 * launched and talked to. This does the other half: it spawns
 * `packages/mcp-server/dist/arq-mcp-stdio.mjs` with `node`, speaks
 * line-delimited JSON-RPC to it, and asserts the boundary properties that
 * matter from outside - the ones a client would rely on.
 *
 * The two checks worth naming, because they cannot be made in-process:
 *
 *   Withdrawal takes effect on the next call. The grant file is deleted
 *   mid-session and the very next tool call must report that nothing is
 *   shared, without a reconnection.
 *
 *   Standard output carries protocol and nothing else. A stray `console.log`
 *   anywhere in the bundle would corrupt the stream, and only a real process
 *   can prove it does not happen.
 *
 * Usage: node scripts/run-mcp-protocol-capability-check.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const serverPath = path.join(repoRoot, 'packages/mcp-server/dist/arq-mcp-stdio.mjs');

if (!existsSync(serverPath)) {
  console.error(
    `The server bundle is missing at ${serverPath}.\nRun: pnpm --filter @arq/mcp-server build`,
  );
  process.exit(1);
}

const failures = [];
const observations = [];

function check(name, condition, detail) {
  observations.push({ name, passed: Boolean(condition), detail: detail ?? null });
  if (!condition) {
    failures.push(`${name}${detail === undefined ? '' : `: ${detail}`}`);
  }
}

/** One server process, driven by line-delimited JSON-RPC over its stdin and stdout. */
function createClient(env) {
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  let stderrText = '';
  const pending = new Map();
  const unexpectedStdout = [];
  const parseErrors = [];
  let nextId = 0;

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');
      if (line.length === 0) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        // Anything on standard output that is not JSON-RPC is corruption.
        unexpectedStdout.push(line);
        continue;
      }
      if (message.id === null && message.error !== undefined) {
        // A parse error has no request to attribute itself to, so JSON-RPC
        // requires a null id. That is protocol, not pollution.
        parseErrors.push(message);
        continue;
      }
      const resolve = pending.get(message.id);
      if (resolve === undefined) {
        unexpectedStdout.push(line);
        continue;
      }
      pending.delete(message.id);
      resolve(message);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderrText += chunk;
  });

  return {
    request(method, params) {
      nextId += 1;
      const id = nextId;
      const payload = { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) };
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`timed out waiting for a response to ${method}`));
        }, 15_000);
        pending.set(id, (message) => {
          clearTimeout(timer);
          resolve(message);
        });
        child.stdin.write(`${JSON.stringify(payload)}\n`);
      });
    },
    notify(method, params) {
      child.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', method, ...(params === undefined ? {} : { params }) })}\n`,
      );
    },
    writeRaw(text) {
      child.stdin.write(text);
    },
    get stderr() {
      return stderrText;
    },
    get unexpectedStdout() {
      return unexpectedStdout;
    },
    get parseErrors() {
      return parseErrors;
    },
    close() {
      child.stdin.end();
      child.kill();
    },
  };
}

function toolResult(response) {
  return response?.result ?? {};
}

function structured(response) {
  return toolResult(response).structuredContent ?? {};
}

async function main() {
  const workDir = mkdtempSync(path.join(tmpdir(), 'arq-mcp-check-'));
  const grantFile = path.join(workDir, 'grant.json');

  const client = createClient({
    ARQ_MCP_GRANT_FILE: grantFile,
    ARQ_MCP_SEED_PROJECT: 'Capability check project',
  });

  try {
    // 1. Handshake.
    const initialize = await client.request('initialize', {
      protocolVersion: '2026-07-28',
      clientInfo: { name: 'arq-capability-check', version: '1.0.0' },
      capabilities: {},
    });
    client.notify('notifications/initialized');
    check(
      'initialize negotiates the requested protocol version',
      initialize.result?.protocolVersion === '2026-07-28',
      initialize.result?.protocolVersion,
    );
    check(
      'initialize returns instructions that name the canonical-mutation field',
      String(initialize.result?.instructions ?? '').includes('canonicalMutation'),
    );

    // 2. Nothing is shared until the operator shares something.
    const beforeGrant = await client.request('tools/call', {
      name: 'arq_list_projects',
      arguments: {},
    });
    check(
      'with no grant file, every tool reports that nothing is shared',
      structured(beforeGrant).code === 'ARQ_NO_GRANT',
      structured(beforeGrant).code,
    );
    check(
      'a refusal still states that canonical state did not change',
      structured(beforeGrant).canonicalMutation === 'none',
    );

    // 3. The operator shares one project.
    writeFileSync(
      grantFile,
      JSON.stringify({
        grantId: 'grant-capability-check',
        subjectId: 'subject-capability-check',
        tenantId: 'tenant-capability-check',
        preset: 'propose',
        scopes: ['arq.capabilities.read'],
        projectIds: ['project-local'],
        issuedAtEpochMs: Date.now(),
        lifetimeMs: 3_600_000,
      }),
      'utf8',
    );

    const tools = await client.request('tools/list');
    const toolNames = (tools.result?.tools ?? []).map((tool) => tool.name);
    check('tools/list returns the full surface', toolNames.length === 24, String(toolNames.length));
    check(
      'no tool commits, approves, opens a path or runs a query language',
      !toolNames.some((name) => /commit|approve|sql|path|exec|shell/u.test(name)),
      toolNames.join(','),
    );

    const capabilities = await client.request('tools/call', {
      name: 'arq_get_capabilities',
      arguments: {},
    });
    const capabilityData = structured(capabilities).data ?? {};
    check(
      'approval is reported as Arq-side only',
      capabilityData.approvalModel === 'arq_side_only',
      capabilityData.approvalModel,
    );
    check(
      'the absent capabilities are named rather than merely missing',
      Array.isArray(capabilityData.absentCapabilities) &&
        capabilityData.absentCapabilities.includes('canonical.commit') &&
        capabilityData.absentCapabilities.includes('filesystem.path_open'),
      JSON.stringify(capabilityData.absentCapabilities),
    );

    // 4. Read the seeded project and propose a wall against its exact revision.
    const snapshot = await client.request('tools/call', {
      name: 'arq_get_project_snapshot',
      arguments: { projectId: 'project-local' },
    });
    const revision = structured(snapshot).data?.summary?.revision;
    check('the seeded project reports a revision', typeof revision === 'string', revision);
    check(
      'the snapshot says plainly that this is not a project file',
      JSON.stringify(structured(snapshot).data?.warnings ?? []).includes('not a .arq file'),
    );

    const staged = await client.request('tools/call', {
      name: 'arq_stage_changeset',
      arguments: {
        requestId: 'capability-check-1',
        changeSet: {
          format: 'arq.changeset',
          schemaVersion: '1.0.0',
          changeSetId: 'capability-check-cs-1',
          projectId: 'project-local',
          baseRevision: revision,
          intent: 'Draw the north wall.',
          constraints: [],
          operations: [
            {
              operationId: 'op-1',
              operationType: 'architecture.wall.create',
              operationVersion: '1.0.0',
              arguments: {
                wallId: 'wall-north',
                levelId: 'level-0',
                wallTypeId: 'wall-type-generic-100',
                from: { xMm: 0, yMm: 0 },
                to: { xMm: 5000, yMm: 0 },
              },
              preconditions: [{ kind: 'project.revision_equals', revision }],
            },
          ],
        },
      },
    });
    check(
      'a valid change set stages for review',
      structured(staged).state === 'ready_for_review',
      `${structured(staged).state} ${structured(staged).message ?? ''}`,
    );
    check(
      'staging changes nothing',
      structured(staged).canonicalMutation === 'none',
      structured(staged).canonicalMutation,
    );

    const proposalId = structured(staged).data?.proposalId;
    const queued = await client.request('tools/call', {
      name: 'arq_request_changeset_review',
      arguments: {
        requestId: 'capability-check-2',
        projectId: 'project-local',
        proposalId,
      },
    });
    check(
      'requesting review queues it for the operator and changes nothing',
      structured(queued).state === 'awaiting_user_approval' &&
        structured(queued).canonicalMutation === 'none',
      structured(queued).state,
    );

    // 5. Geometry is refused by the real validation rules, not by this server.
    const degenerate = await client.request('tools/call', {
      name: 'arq_stage_changeset',
      arguments: {
        requestId: 'capability-check-3',
        changeSet: {
          format: 'arq.changeset',
          schemaVersion: '1.0.0',
          changeSetId: 'capability-check-cs-2',
          projectId: 'project-local',
          baseRevision: revision,
          intent: 'Draw a wall of no length.',
          constraints: [],
          operations: [
            {
              operationId: 'op-1',
              operationType: 'architecture.wall.create',
              operationVersion: '1.0.0',
              arguments: {
                wallId: 'wall-degenerate',
                levelId: 'level-0',
                wallTypeId: 'wall-type-generic-100',
                from: { xMm: 0, yMm: 0 },
                to: { xMm: 0, yMm: 0 },
              },
              preconditions: [],
            },
          ],
        },
      },
    });
    const degenerateCodes = (structured(degenerate).data?.validation?.errors ?? []).map(
      (issue) => issue.code,
    );
    check(
      'a degenerate wall is refused by the repository’s own validation rule',
      degenerateCodes.includes('WALL_TOO_SHORT'),
      degenerateCodes.join(','),
    );

    // 6. A request for something Arq cannot build names the profile and the blockers.
    const program = await client.request('tools/call', {
      name: 'arq_save_design_program',
      arguments: {
        requestId: 'capability-check-4',
        designProgram: {
          format: 'arq.design-program',
          schemaVersion: '1.0.0',
          designProgramId: 'capability-check-vtol',
          designDomain: 'vehicle.concept',
          executionIntent: 'requires_registered_operations',
          title: 'Original vertical take-off concept',
          objective: 'A crewed four-rotor craft with a rear cargo ramp.',
          constraints: [],
          assumptions: [],
          requirements: [],
          components: [
            {
              id: 'airframe',
              title: 'Airframe',
              role: 'Primary structure.',
              requestedCapabilities: ['vehicle.concept.fuselage.create'],
              requirementIds: [],
              interfaceComponentIds: [],
              notes: [],
            },
          ],
          tasks: [
            {
              id: 't1',
              title: 'Agree the airframe envelope',
              outcome: 'The envelope has agreed dimensions.',
              dependsOn: [],
              componentIds: ['airframe'],
              acceptanceCriteria: ['A reviewer can read the overall dimensions.'],
              requestedCapabilities: [],
              priority: 'high',
            },
          ],
          references: [],
          questions: ['How many crew?'],
        },
      },
    });
    check('a design program for any domain is accepted', structured(program).ok === true);

    const coverage = await client.request('tools/call', {
      name: 'arq_assess_design_program_coverage',
      arguments: { designProgramId: 'capability-check-vtol', projectId: 'project-local' },
    });
    const row = (structured(coverage).data?.coverage ?? [])[0] ?? {};
    check(
      'an unbuildable domain is blocked rather than substituted',
      structured(coverage).state === 'blocked_by_capability',
      structured(coverage).state,
    );
    check(
      'the refusal names the profile that would own the work',
      row.owningProfileId === 'vehicle.concept',
      row.owningProfileId,
    );
    check(
      'the refusal names concrete blockers',
      Array.isArray(row.blockers) && row.blockers.length >= 3,
      String(row.blockers?.length),
    );
    check(
      'the next action tells the caller not to substitute a different operation',
      String(structured(coverage).nextAction ?? '').includes('Do not substitute'),
    );

    // 7. Withdrawal takes effect on the next call, with no reconnection.
    rmSync(grantFile);
    const afterRevocation = await client.request('tools/call', {
      name: 'arq_list_projects',
      arguments: {},
    });
    check(
      'deleting the grant file withdraws access on the very next call',
      structured(afterRevocation).code === 'ARQ_NO_GRANT',
      structured(afterRevocation).code,
    );

    // 8. Framing: a malformed line is answered, not dropped.
    client.writeRaw('{not json\n');
    const afterGarbage = await client.request('ping');
    check(
      'the connection survives a malformed line and keeps answering',
      afterGarbage.result !== undefined,
      JSON.stringify(afterGarbage),
    );
    check(
      'a malformed line is answered with a parse error rather than dropped',
      client.parseErrors.some((message) => message.error?.code === -32700),
      JSON.stringify(client.parseErrors),
    );

    // 9. Standard output carried protocol and nothing else.
    check(
      'standard output was never polluted by a stray log line',
      client.unexpectedStdout.length === 0,
      client.unexpectedStdout.slice(0, 3).join(' | '),
    );
    check(
      'diagnostics went to standard error',
      client.stderr.includes('[arq-mcp]'),
      client.stderr.slice(0, 200),
    );
  } finally {
    client.close();
    rmSync(workDir, { recursive: true, force: true });
  }

  const resultsDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const outputPath = path.join(resultsDir, `mcp-protocol-capability-${stamp}.json`);
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        check: 'mcp-protocol-capability',
        adr: 'ADR-0027',
        serverBundle: path.relative(repoRoot, serverPath),
        node: process.version,
        ranAt: new Date().toISOString(),
        passed: failures.length === 0,
        observations,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`MCP protocol capability check: ${observations.length} observations`);
  for (const observation of observations) {
    console.log(`  ${observation.passed ? 'PASS' : 'FAIL'}  ${observation.name}`);
  }
  console.log(`Evidence written to ${path.relative(repoRoot, outputPath)}`);

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
