#!/usr/bin/env node
/**
 * Self-test for scripts/verify-decision-ids.mjs.
 *
 * A verifier that only ever runs against a healthy tree proves nothing, so this
 * pins the three behaviours that matter:
 *
 *   1. the clean fixture passes;
 *   2. the PR #280 fixture fails, naming the ADR and decision collisions;
 *   3. the base comparison fails on a branch that is internally consistent.
 *
 * (3) is the one that carries weight. Draft PR #280 is internally consistent on
 * its own branch - it removes nothing and duplicates nothing within its own
 * tree - so a tree-only check passes it. Only comparing against the base shows
 * that ADR-0027 and D-024 were taken by work that merged first. This test
 * asserts both halves of that: tree-only passes, base mode fails.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const verifier = path.join(here, 'verify-decision-ids.mjs');
const failures = [];

function run(args) {
  // stderr is captured rather than inherited. The subject under test is
  // *supposed* to print FAIL lines here, and letting them through would make a
  // passing run read like a failing one.
  const options = {
    encoding: 'utf8',
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  try {
    const stdout = execFileSync('node', [verifier, ...args], options);
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

function expect(label, condition, detail) {
  if (condition) console.log(`PASS ${label}`);
  else {
    console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`);
    failures.push(label);
  }
}

const clean = run(['--root', 'quality/fixtures/decision-ids/clean']);
expect('clean fixture passes', clean.code === 0, clean.output.trim());

const collision = run(['--root', 'quality/fixtures/decision-ids/pr280-collision']);
expect('pr280 fixture fails', collision.code === 1);
expect(
  'pr280 fixture names the duplicate ADR id',
  /ADR id 0027 is used by 2 files/.test(collision.output),
  collision.output.trim(),
);
expect(
  'pr280 fixture names the duplicate decision id',
  /Decision id D-024 appears more than once/.test(collision.output),
  collision.output.trim(),
);
expect(
  'pr280 fixture names the unresolvable ADR reference',
  /cites ADR-0404, which has no file/.test(collision.output),
  collision.output.trim(),
);

// The base comparison, on a real git history rather than a fixture directory.
const scratch = mkdtempSync(path.join(tmpdir(), 'arq-decision-ids-'));
try {
  const git = (args) => execFileSync('git', args, { cwd: scratch, encoding: 'utf8' });
  mkdirSync(path.join(scratch, 'docs/adr'), { recursive: true });
  mkdirSync(path.join(scratch, 'docs/product'), { recursive: true });
  git(['init', '-q']);
  git(['config', 'user.email', 'selftest@example.invalid']);
  git(['config', 'user.name', 'selftest']);
  writeFileSync(
    path.join(scratch, 'docs/adr/0027-mcp-boundary-and-domain-profiles.md'),
    '# ADR-0027: MCP boundary\n\n**Status:** Proposed\n',
  );
  writeFileSync(
    path.join(scratch, 'docs/product/DECISION-REGISTER.csv'),
    'id,decision,status,evidence\nD-024,Persistence responsibility split,proposed,ADR-0027\n',
  );
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'base']);
  git(['branch', 'base']);

  // The #280 shape: a different file takes 0027, and D-024 decides something else.
  writeFileSync(
    path.join(scratch, 'docs/adr/0027-desktop-shell-deferral.md'),
    '# ADR-0027: Desktop shell deferral\n\n**Status:** Accepted\n',
  );
  git(['rm', '-q', 'docs/adr/0027-mcp-boundary-and-domain-profiles.md']);
  writeFileSync(
    path.join(scratch, 'docs/product/DECISION-REGISTER.csv'),
    'id,decision,status,evidence\nD-024,Defer a Tauri desktop shell,accepted,ADR-0027\n',
  );
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'head']);

  const treeOnly = run(['--root', scratch]);
  expect(
    'the collision branch passes a tree-only check, which is why it was missed',
    treeOnly.code === 0,
    treeOnly.output.trim(),
  );

  const baseMode = run(['--root', scratch, '--base', 'base']);
  expect('the collision branch fails the base comparison', baseMode.code === 1);
  expect(
    'the base comparison names the reused ADR file id',
    /ADR id 0027 is already .* at base/.test(baseMode.output),
    baseMode.output.trim(),
  );
  expect(
    'the base comparison names the redefined decision',
    /Decision D-024 decides something different from base/.test(baseMode.output),
    baseMode.output.trim(),
  );

  // A legitimate in-place status change must stay allowed, or the check would
  // block ordinary governance and get switched off.
  writeFileSync(
    path.join(scratch, 'docs/product/DECISION-REGISTER.csv'),
    'id,decision,status,evidence\nD-024,Persistence responsibility split,accepted,"ADR-0027; ADR-0028"\n',
  );
  writeFileSync(
    path.join(scratch, 'docs/adr/0027-mcp-boundary-and-domain-profiles.md'),
    '# ADR-0027: MCP boundary\n\n**Status:** Proposed\n',
  );
  rmSync(path.join(scratch, 'docs/adr/0027-desktop-shell-deferral.md'));
  writeFileSync(
    path.join(scratch, 'docs/adr/0028-persistence-responsibility-split.md'),
    '# ADR-0028: Persistence responsibility split\n\n**Status:** Accepted\n',
  );
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'accept in place']);
  const inPlace = run(['--root', scratch, '--base', 'base']);
  expect(
    'moving a decision to accepted in place stays allowed',
    inPlace.code === 0,
    inPlace.output.trim(),
  );

  // Found by this check rejecting a legitimate edit. D-024's decision text
  // began with the word "Proposed", so accepting it meant editing the text as
  // well as the status column. Under an exact-equality rule that read as the
  // id being reused for a different decision. The wording is still the same
  // decision and must stay allowed, or the check blocks the governance it
  // exists to protect.
  writeFileSync(
    path.join(scratch, 'docs/product/DECISION-REGISTER.csv'),
    'id,decision,status,evidence\n' +
      'D-024,"Accepted persistence responsibility split: SQLite in an ARQ-owned OPFS Worker owns the canonical working project",accepted,"ADR-0027; ADR-0028"\n',
  );
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'reword the status qualifier inside the decision text']);
  const reworded = run(['--root', scratch, '--base', 'base']);
  expect(
    'rewording a status qualifier inside the decision text stays allowed',
    reworded.code === 0,
    reworded.output.trim(),
  );
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\n${failures.length} self-test failure(s)`);
  process.exit(1);
}
console.log('\nverify-decision-ids self-test passed');
