#!/usr/bin/env node

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../..');
const COMMANDS = Object.freeze({
  format: [['pnpm', ['format:check']]],
  lint: [['pnpm', ['lint']]],
  typecheck: [['pnpm', ['typecheck']]],
  unit: [['pnpm', ['test']]],
  build: [['pnpm', ['build']]],
  workspace_registry: [['pnpm', ['check:workspace-registries']]],
  dependency_licence: [['pnpm', ['check:dependency-licences']]],
  rust: [
    ['pnpm', ['rust:fmt-check']],
    ['pnpm', ['rust:clippy']],
    ['pnpm', ['rust:test']],
  ],
  // Both wasm evidences build rust/arq-core/pkg first. It is a regenerable
  // artifact that is deliberately not committed, and no workflow built it, so
  // until this step existed both ids failed at "pkg does not exist" for every
  // change that selected them - reporting on the runner rather than the diff.
  // rust:build-wasm provisions its own toolchain and is a no-op once the
  // artifact is current, so naming it here costs nothing on a warm checkout.
  wasm_parity: [
    ['pnpm', ['rust:build-wasm']],
    ['pnpm', ['rust:verify-wasm-parity']],
  ],
  browser_canvas2d: [['pnpm', ['benchmark:canvas2d']]],
  browser_workspace_layout: [['pnpm', ['benchmark:workspace-layout']]],
  browser_arqfs_opfs: [['pnpm', ['benchmark:arqfs-opfs']]],
  browser_file_open: [['pnpm', ['benchmark:file-open']]],
  render_frame: [['pnpm', ['benchmark:render-frame']]],
  worker_core: [
    ['pnpm', ['rust:build-wasm']],
    ['pnpm', ['benchmark:arq-core-worker']],
  ],
  marketing_build: [['pnpm', ['--filter', '@arq/marketing', 'build']]],
  classifier_fixtures: [['node', ['engineering/tools/engineering/run-fixtures.mjs']]],
  policy_validation: [
    ['node', ['engineering/tools/engineering/verify-policy.mjs', '--root', 'engineering']],
  ],
  repository_binding: [
    [
      'node',
      [
        'engineering/tools/engineering/verify-repo-bindings.mjs',
        '--repo-root',
        '.',
        '--package-root',
        'engineering',
        '--strict',
      ],
    ],
  ],
  language_contract: [['pnpm', ['arq:language:verify']]],
  rendered_public_site: [
    ['pnpm', ['arq:language:site:build:verify', '--site-root', 'apps/marketing/dist']],
  ],
  deployed_public_site: [['pnpm', ['arq:language:site:live:verify']]],
  browser_journal_recovery: [['pnpm', ['benchmark:journal-recovery']]],
  browser_model_canvas: [['pnpm', ['benchmark:model-canvas']]],
  editor_dependency_boundaries: [['pnpm', ['check:editor-dependency-boundaries']]],
  browser_wall_hud: [['pnpm', ['benchmark:wall-hud']]],
});

/**
 * Exported so verify-policy can prove every runnable catalog entry has an
 * approved mapping - an 'available' command evidence with no entry here
 * fails at gate runtime with 'No approved command mapping', which is
 * exactly the silent-until-selected gap that once shipped three ids.
 */
export const APPROVED_EVIDENCE_COMMANDS = COMMANDS;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function parseArguments(argv) {
  const options = { root: defaultRoot };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--classification') {
      options.classification = argv[index + 1];
      index += 1;
    } else if (option === '--catalog') {
      options.catalog = argv[index + 1];
      index += 1;
    } else if (option === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (option === '--output') {
      options.output = argv[index + 1];
      index += 1;
    } else if (option === '--help') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + option);
    }
  }
  return options;
}

export function runSelectedEvidence({ classification, catalog, repoRoot = process.cwd() }) {
  const index = new Map((catalog.evidence || []).map((entry) => [entry.id, entry]));
  const jobs = {};
  const executions = [];
  for (const id of [...new Set(classification.required_evidence || [])].sort()) {
    const entry = index.get(id);
    if (!entry) {
      jobs[id] = 'failure';
      executions.push({ evidence: id, result: 'failure', reason: 'No evidence catalog entry.' });
      continue;
    }
    if (
      entry.state !== 'available' &&
      entry.state !== 'available-after-installation' &&
      entry.state !== 'requires-language-system-4.1'
    ) {
      jobs[id] = 'skipped';
      executions.push({ evidence: id, result: 'skipped', reason: entry.state });
      continue;
    }
    const commands = COMMANDS[id];
    if (!commands) {
      jobs[id] = 'failure';
      executions.push({ evidence: id, result: 'failure', reason: 'No approved command mapping.' });
      continue;
    }
    let result = 'success';
    for (const [command, args] of commands) {
      const child = childProcess.spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
      if (child.status !== 0) {
        result = 'failure';
        break;
      }
    }
    jobs[id] = result;
    executions.push({ evidence: id, result });
  }
  return { schema_version: 1, jobs, executions };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Usage: node run-selected-evidence.mjs --classification FILE --catalog FILE [--repo-root REPO] --output FILE\n',
    );
    return;
  }
  if (!options.classification || !options.catalog || !options.output)
    throw new Error('--classification, --catalog, and --output are required.');
  const result = runSelectedEvidence({
    classification: readJson(options.classification),
    catalog: readJson(options.catalog),
    repoRoot: path.resolve(options.repoRoot || process.cwd()),
  });
  writeJson(options.output, result);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (Object.values(result.jobs).includes('failure')) process.exitCode = 1;
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
