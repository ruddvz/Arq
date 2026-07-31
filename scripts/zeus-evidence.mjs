#!/usr/bin/env node
// Zeus 5: typed evidence ledger.
//
// Zeus 4 reported a run-level status (green / partial / blocked / failed) but had
// no place to record what each individual claim actually rests on. A run could
// therefore be reported green while several of its claims were inferred. The
// ledger makes each claim carry its own state and its own command evidence.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from './lib/zeus-engine.mjs';

const a = process.argv.slice(2);
const sub = a[0];
const val = (n, d = null) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : d;
};

const root = val('root', process.cwd());
const file = val('file', join(root, '.zeus', 'evidence-ledger.json'));

const STATES = config.evidenceStates;
const GREEN = config.greenEvidenceStates;
const NEEDS_COMMAND = new Set(['verified', 'failed']);
const NEEDS_REASON = new Set(['blocked', 'assumed', 'inferred', 'not-inspected']);

const usage = () => {
  console.error(
    [
      'Usage:',
      '  zeus evidence init --task "..." [--stop local-green]',
      '  zeus evidence add --claim "..." --state <state> [--command "..."] [--exit 0] [--reason "..."] [--sources a,b]',
      '  zeus evidence conflict --claim "..." --sources a,b [--owner name] [--registry-id ID]',
      '  zeus evidence report [--format json]',
      '',
      `States: ${STATES.join(' | ')}`,
      `Only ${GREEN.join(', ')} counts as Green.`,
    ].join('\n'),
  );
  process.exit(2);
};

const load = () => {
  if (!existsSync(file)) {
    console.error(`No ledger at ${file}. Run: zeus evidence init --task "..."`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
};

const save = (ledger) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n');
};

const grade = (ledger) => {
  const counts = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const e of ledger.entries) counts[e.state] = (counts[e.state] ?? 0) + 1;
  let status;
  if (counts.failed > 0) status = 'failed';
  else if (counts.blocked > 0) status = 'blocked';
  else if (!ledger.entries.length) status = 'blocked';
  else if (ledger.entries.every((e) => GREEN.includes(e.state))) status = 'green';
  else status = 'partial';
  if (ledger.openConflicts?.length && status === 'green') status = 'partial';
  return { status, counts };
};

if (sub === 'init') {
  const task = val('task');
  if (!task) usage();
  save({
    version: '5.0.0',
    task,
    startedAt: new Date().toISOString(),
    deliveryStop: val('stop', 'local-green'),
    entries: [],
    openConflicts: [],
  });
  console.log(`Ledger started at ${file}`);
} else if (sub === 'add') {
  const ledger = load();
  const claim = val('claim');
  const state = val('state');
  if (!claim || !STATES.includes(state)) usage();
  const entry = { claim, state };
  const command = val('command');
  const exit = val('exit');
  const reason = val('reason');
  const sources = val('sources');
  const output = val('output');
  if (command) entry.command = command;
  if (exit !== null) {
    // `--exit` with no value, or a non-numeric one, must not become NaN and pass for
    // a real exit code.
    if (!Number.isInteger(Number(exit))) {
      console.error(`--exit expects an integer, got "${exit}".`);
      process.exit(2);
    }
    entry.exitCode = Number(exit);
  }
  if (reason) entry.reason = reason;
  if (sources) entry.sources = sources.split(',').filter(Boolean);
  if (output) entry.output = output.slice(-4000);
  if (a.includes('--cached')) entry.cached = true;

  if (NEEDS_COMMAND.has(state) && (!entry.command || entry.exitCode === undefined)) {
    console.error(
      `State "${state}" requires --command and --exit. A claim without a command is at most "inferred".`,
    );
    process.exit(2);
  }
  if (NEEDS_REASON.has(state) && !entry.reason) {
    console.error(`State "${state}" requires --reason.`);
    process.exit(2);
  }
  if (entry.cached && state === 'verified' && !config.cache.criticalEvidenceCache) {
    entry.state = 'partially-verified';
    entry.reason = 'cached result downgraded: critical evidence is never cached';
  }
  ledger.entries.push(entry);
  save(ledger);
  console.log(`Recorded ${entry.state}: ${claim}`);
} else if (sub === 'conflict') {
  const ledger = load();
  const claim = val('claim');
  const sources = (val('sources') ?? '').split(',').filter(Boolean);
  if (!claim || sources.length < 2) usage();
  ledger.openConflicts = ledger.openConflicts ?? [];
  const conflict = { claim, sources };
  if (val('owner')) conflict.owner = val('owner');
  if (val('registry-id')) conflict.registryId = val('registry-id');
  ledger.openConflicts.push(conflict);
  save(ledger);
  console.log(`Recorded conflict: ${claim}`);
} else if (sub === 'report') {
  const ledger = load();
  const { status, counts } = grade(ledger);
  ledger.status = status;
  ledger.completedAt = new Date().toISOString();
  save(ledger);
  if (val('format') === 'json') {
    console.log(JSON.stringify({ status, counts, ledger }, null, 2));
  } else {
    console.log(`Status: ${status}`);
    for (const [state, n] of Object.entries(counts)) if (n) console.log(`  ${state}: ${n}`);
    for (const c of ledger.openConflicts ?? [])
      console.log(`  open conflict: ${c.claim} (${c.sources.join(' vs ')})`);
  }
  process.exit(status === 'green' ? 0 : 1);
} else {
  usage();
}
