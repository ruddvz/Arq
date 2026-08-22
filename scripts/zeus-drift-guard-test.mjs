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

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

/** Only what the guards read. Copying node_modules would cost minutes per case. */
// `.github/workflows` is copied because the reachability guard reads CI steps:
// without it the fixture reports scripts as orphans that the real repository
// runs on every pull request, and the baseline case fails for a reason that
// exists only in the fixture.
const COPY = ['.zeus', '.claude', 'scripts', '.github/workflows', 'CLAUDE.md', 'package.json'];
const SKIP = /(^|\/)(cache|runs|backups|node_modules)(\/|$)/;

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'zeus-drift-'));
  for (const rel of COPY) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
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

// Source fragments from the renderer. Written as template literals with escaped
// `\${` so they carry the real text without eslint reading them as a template
// string someone forgot to backtick.
/**
 * The probe filename is assembled at runtime and never written out whole, in
 * this comment included.
 *
 * The reachability guard treats a filename mentioned by any reachable script as
 * reached, and that is correct: a script a test runs IS in use. This file is
 * reachable, so writing the probe's name here in one piece would make the probe
 * look reached and the case would pass while proving nothing. The first attempt
 * at this comment did exactly that, and the case went green against a guard that
 * had not fired.
 */
const PROBE = `zeus-${'orphan'}-probe.mjs`;

const READING_LINE = `\`**Zeus reads this as** \${i.as}.\`,`;
const CLASSIFICATION_LINE = `    \`**Mode / risk / tier / stop:** \${c.mode} / \${c.risk} / \${c.tier} / \${c.deliveryStop}\`,`;

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
    name: 'the contract stops carrying its reading of the request',
    break: (dir) =>
      edit(dir, 'scripts/lib/zeus-engine.mjs', (s) =>
        s.replace('    interpretation: r.interpretation,\n', ''),
      ),
    expect: /carries no usable interpretation|no longer shows how Zeus read the request/,
  },
  {
    name: 'the contract stops rendering its reading',
    break: (dir) => edit(dir, 'scripts/lib/zeus-engine.mjs', (s) => s.replace(READING_LINE, "'',")),
    expect: /no longer shows how Zeus read the request/,
  },
  {
    name: 'the reading is rendered after the classification instead of before it',
    break: (dir) =>
      edit(dir, 'scripts/lib/zeus-engine.mjs', (s) =>
        // Move the reading block below the classification line, which is what a
        // well-meant tidy-up of the renderer would do.
        s
          .replace(CLASSIFICATION_LINE, `${CLASSIFICATION_LINE}\n    ${READING_LINE}`)
          .replace(`      ? [\n          ${READING_LINE}`, '      ? ['),
      ),
    expect: /shows its classification before its reading/,
  },
  {
    name: 'the kernel loses the show-the-reading rule',
    break: (dir) =>
      edit(dir, '.zeus/FAST-KERNEL.md', (s) =>
        s.replace('Show the reading before the work', 'Report the outcome'),
      ),
    expect: /no longer states: show the reading before the work/,
  },
  {
    name: 'the kernel loses the show-delegated-prompts rule',
    break: (dir) =>
      edit(dir, '.zeus/FAST-KERNEL.md', (s) =>
        s.replace('Show every delegated prompt in full', 'Delegate as needed'),
      ),
    expect: /no longer states: show every delegated prompt in full/,
  },
  {
    name: 'the show-the-reading rule survives being rewrapped across lines',
    break: (dir) =>
      edit(dir, '.zeus/FAST-KERNEL.md', (s) =>
        s.replace('Show the reading before the work', 'Show the reading\nbefore the work'),
      ),
    expectExit: 0,
    expect: /drift guards passed/,
  },
  {
    name: 'a Zeus script is added that nothing can run',
    // Dead code in an operating system reads as capability the system does not
    // have. Measured before this guard: 7 of 39 Zeus scripts were unreachable,
    // including the whole delivery pipeline in zeus-run-state.mjs.
    break: (dir) => writeFileSync(join(dir, 'scripts', PROBE), '#!/usr/bin/env node\n'),
    expect: new RegExp(`${PROBE.replace('.', '\\.')} can be run by nothing`),
  },
  {
    name: 'a Zeus library reached only by an importer is not called an orphan',
    // Reachability is transitive. A guard that demanded a CLI verb per file
    // would force every shared module into the command surface, which is how a
    // guard gets deleted rather than obeyed.
    break: (dir) => {
      writeFileSync(join(dir, 'scripts', PROBE), 'export const probe = 1;\n');
      edit(dir, 'scripts/zeus-drift-guard.mjs', (s) => `${s}\n// imports ${PROBE}\n`);
    },
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
