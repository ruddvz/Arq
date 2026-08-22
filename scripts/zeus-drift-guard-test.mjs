#!/usr/bin/env node
// Zeus 5: regression cases for the drift guards.
//
// A guard that has never failed is unproven. Two guards in the reference
// implementation this work is based on were green while the thing they checked
// was broken: one matched a FILENAME and stayed green while the hook called a
// script that did not exist, because an unrelated file-exists test elsewhere
// still mentioned that filename; another required an exact phrase, so rewording
// the sentence made it skip in silence, which is the drift it existed to catch.
//
// Each case below breaks one guard on purpose in a throwaway copy of the Zeus
// assets, and asserts BOTH the non-zero exit and the message. Case "hook
// mentions the harness without running it" is the bystander-string case
// specifically.
//
// Run: node scripts/zeus-drift-guard-test.mjs (also runs in scripts/test-zeus-system.sh)

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

/** Only what the guards read. Copying node_modules would cost minutes per case. */
const COPY = ['.zeus', '.claude', 'scripts', 'CLAUDE.md', 'package.json'];
const SKIP = /(^|\/)(cache|runs|backups|node_modules)(\/|$)/;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'zeus-drift-'));
  for (const rel of COPY) {
    cpSync(join(packageRoot, rel), join(dir, rel), {
      recursive: true,
      filter: (src) => !SKIP.test(src.slice(packageRoot.length)),
    });
  }
  return dir;
}

const edit = (dir, rel, fn) => {
  const path = join(dir, rel);
  writeFileSync(path, fn(readFileSync(path, 'utf8')), 'utf8');
};
const editJson = (dir, rel, fn) => {
  const path = join(dir, rel);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  fn(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const run = (dir) =>
  spawnSync(process.execPath, [join(dir, 'scripts', 'zeus-drift-guard.mjs')], {
    cwd: dir,
    encoding: 'utf8',
  });

const CASES = [
  {
    name: 'baseline: an unmodified copy passes',
    break: () => {},
    expectExit: 0,
    expect: /drift guards passed/,
  },
  {
    name: 'the hook stops running the harness format command',
    break: (dir) =>
      edit(dir, 'scripts/zeus-hook.sh', (s) =>
        s.replace(/node "\$DIR\/zeus-harness-state\.mjs" format/, 'true'),
      ),
    expect: /no longer runs the harness format command/,
  },
  {
    name: 'the hook mentions the harness but never runs it (bystander string)',
    break: (dir) =>
      edit(dir, 'scripts/zeus-hook.sh', (s) =>
        // The filename survives in the file-exists test, so a guard matching the
        // NAME rather than the INVOCATION would stay green here.
        s.replace(
          /node "\$DIR\/zeus-harness-state\.mjs" format/,
          'cat "$DIR/zeus-harness-state.mjs"',
        ),
      ),
    expect: /no longer runs the harness format command/,
  },
  {
    name: 'the harness script is deleted',
    break: (dir) => rmSync(join(dir, 'scripts', 'zeus-harness-state.mjs')),
    expect: /zeus-harness-state\.mjs is missing/,
  },
  {
    name: 'a new slash command is added that the hook does not skip',
    break: (dir) =>
      writeFileSync(
        join(dir, '.claude', 'commands', 'zeus-newthing.md'),
        '---\ndescription: A command with its own procedure\n---\nbody\n',
      ),
    expect: /does not skip \/zeus-newthing/,
  },
  {
    name: 'the kernel loses an evidence state that config still defines',
    break: (dir) => edit(dir, '.zeus/FAST-KERNEL.md', (s) => s.replace(/not-inspected/g, '')),
    expect: /never names the evidence state "not-inspected"/,
  },
  {
    name: 'a blast radius level is added that the kernel never mentions',
    break: (dir) =>
      editJson(dir, '.zeus/blast-radius.json', (b) => {
        b.levels.push({
          id: 'ecosystem',
          rank: 6,
          reaches: 'downstream consumers',
          minimumTier: 'deep',
          requiresReview: true,
        });
      }),
    expect: /never names the blast radius level "ecosystem"/,
  },
  {
    name: 'a tier budget in config drifts from the number the kernel publishes',
    break: (dir) =>
      editJson(dir, '.zeus/config.json', (c) => {
        c.budgets.standard.modules = 6;
      }),
    expect: /does not show the configured standard-tier modules budget of 6/,
  },
  {
    name: 'the kernel drops a safety statement in compression',
    break: (dir) =>
      edit(dir, '.zeus/FAST-KERNEL.md', (s) =>
        s.replace('Unknown, blocked and failed are not Green.', 'Report the outcome.'),
      ),
    expect: /no longer states: unknown and blocked are not green/,
  },
  {
    name: 'the published saving is deleted',
    break: (dir) =>
      edit(dir, '.zeus/FAST-KERNEL.md', (s) =>
        s.replace(/over \d+% smaller than the full/, 'much smaller than the full'),
      ),
    expect: /no longer states the "over N% smaller/,
  },
  {
    name: 'the published saving claims more than is true',
    break: (dir) =>
      edit(dir, '.zeus/FAST-KERNEL.md', (s) =>
        s.replace(/over \d+% smaller than the full/, 'over 99% smaller than the full'),
      ),
    expect: /the split has stopped paying for itself/,
  },
  {
    name: 'the published saving decays into a floor that means nothing',
    break: (dir) =>
      edit(dir, '.zeus/FAST-KERNEL.md', (s) =>
        s.replace(/over \d+% smaller than the full/, 'over 40% smaller than the full'),
      ),
    expect: /the floor has drifted too far below the truth/,
  },
  {
    name: 'CLAUDE.md loses the read-instead-of rule',
    break: (dir) =>
      edit(dir, 'CLAUDE.md', (s) =>
        s.replace(/Do not load\s+the rest of `\.zeus\/` by default\./, 'Read what you need.'),
      ),
    expect: /no longer says the rest of \.zeus\/ is not loaded by default/,
  },
  {
    name: 'the read-instead-of rule survives being rewrapped across lines',
    // The opposite failure: a guard so literal that reflowing a paragraph makes
    // it skip in silence. Rewrapping must NOT fail the guard.
    break: (dir) =>
      edit(dir, 'CLAUDE.md', (s) =>
        s.replace(
          /Do not load\s+the rest of `\.zeus\/` by default\./,
          'Do not load the rest of `.zeus/` by default.',
        ),
      ),
    expectExit: 0,
    expect: /drift guards passed/,
  },
  {
    name: 'a configured repository gate names no package script',
    break: (dir) =>
      editJson(dir, '.zeus/config.json', (c) => {
        c.gates.repositoryGates.push('check:that:does:not:exist');
      }),
    expect: /which is not a package script/,
  },
  {
    name: 'a package script the ledger needs is removed',
    break: (dir) =>
      editJson(dir, 'package.json', (p) => {
        delete p.scripts['zeus:gate'];
      }),
    expect: /has no "zeus:gate" script/,
  },
];

let failed = 0;
for (const c of CASES) {
  const dir = fixture();
  try {
    c.break(dir);
    const r = run(dir);
    const expectExit = c.expectExit ?? 1;
    const output = `${r.stdout}${r.stderr}`;
    if (r.status !== expectExit) {
      failed += 1;
      console.error(`FAIL exit ${r.status}, expected ${expectExit}: ${c.name}`);
      console.error(`     ${output.trim().split('\n').join('\n     ')}`);
    } else if (!c.expect.test(output)) {
      failed += 1;
      console.error(`FAIL message did not match ${c.expect}: ${c.name}`);
      console.error(`     ${output.trim().split('\n').join('\n     ')}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failed) {
  console.error(`\nZeus drift guard test failed: ${failed} of ${CASES.length} cases.`);
  process.exit(1);
}
console.log(`Zeus drift guard test passed (${CASES.length} cases, each guard broken on purpose).`);
