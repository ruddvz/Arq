#!/usr/bin/env node
// Zeus 5 continual harness: durable, reviewable, supplemental operating state.
//
// Ported in spirit from PrimeIntellect-ai/prime-agent's continual harness
// (MIT, inspected at f8f0222). None of prime-agent's runtime is adopted: it is a
// standalone Python/IPython CLI agent with its own daemon, TUI and RLM runtime,
// and Zeus is a repository-resident operating system driven by Claude Code.
// Adopting the runtime would be a category error. What transfers is the state
// model, and the rule that the base system prompt stays immutable under it.
//
// The problem it fixes, measured on this repository before it was written:
//   `.zeus/eval-log.jsonl` is appended to by scripts/zeus-eval-record.mjs and
//   read only by scripts/zeus-eval-stats.mjs, which prints aggregate counts.
//   `grep -rln 'eval-log'` returns exactly those two files. The schema carries
//   no lesson field at all, and the log is empty. So nothing Zeus learns has
//   ever reached a later turn: the learning loop is write-only.
//
// Design rules, each load-bearing:
//   1. Base doctrine is immutable. This store NEVER edits CLAUDE.md, AGENTS.md,
//      .zeus/FAST-KERNEL.md, .zeus/ZEUS.md or .zeus/INVARIANTS.md. It is
//      supplemental state only.
//   2. No entry without evidence. `.zeus/EVIDENCE-STATES.md` says confidence is
//      not evidence, so an entry that cannot cite a file, command, commit or
//      test is folklore, and folklore that reaches every turn is worse than
//      nothing.
//   3. Every mutation is a recorded refinement carrying a before snapshot, so
//      any change to how Zeus behaves is one command from being undone.
//   4. The injected block is bounded by `.zeus/config.json` harness
//      promptCharBudget. Unbounded learned state silently recreates the context
//      cost the kernel exists to control.
//   5. Entries are agent-proposed and human-committed. A bad lesson must not be
//      able to change behaviour silently.

import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

/** Budgets live in .zeus/config.json so this file and the doctrine cannot drift. */
export function harnessConfig(root = packageRoot) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(root, '.zeus', 'config.json'), 'utf8'));
  } catch (error) {
    throw new Error(`cannot read .zeus/config.json - ${error.message}`);
  }
  const h = raw.harness;
  if (!h || typeof h !== 'object') {
    throw new Error('.zeus/config.json has no "harness" block (store, budgets)');
  }
  const numbers = [
    'promptCharBudget',
    'maxActiveEntries',
    'maxTitleChars',
    'maxContentChars',
    'maxEvidenceChars',
    'rollbackWindow',
  ];
  for (const key of numbers) {
    if (!Number.isInteger(h[key]) || h[key] < 1) {
      throw new Error(`.zeus/config.json harness.${key} is not a positive integer`);
    }
  }
  if (typeof h.store !== 'string' || !h.store.trim()) {
    throw new Error('.zeus/config.json harness.store is not a path');
  }
  return h;
}

/**
 * ZEUS_HARNESS_STORE lets a test point at a fixture instead of the real store.
 * A set-but-empty value must behave as unset: an exported-but-blank variable
 * would otherwise redirect every write to the repository root.
 */
export function storePath(root = packageRoot) {
  const override = (process.env.ZEUS_HARNESS_STORE ?? '').trim();
  return override || join(root, harnessConfig(root).store);
}

const KINDS = new Set(['prompt', 'memory', 'skill', 'subagent']);
const STATUSES = new Set(['active', 'retired']);

/** Scalar fields every stored entry must carry for `format` and `list` to work. */
const REQUIRED_ENTRY_FIELDS = ['id', 'kind', 'title', 'content', 'status', 'updatedAt'];

/**
 * Sensitive VALUES, not vocabulary. "fix the token refresh path" is a fine
 * lesson; a real token is not. Kept deliberately consistent with
 * scripts/zeus-eval-record.mjs so the two Zeus stores cannot disagree about
 * what is unsafe to persist, and extended with the shapes a CAD repository
 * actually leaks.
 *
 * Deliberately NOT included: a bare ten-digit number. The reference
 * implementation treated one as a phone number, which is right for a clinic
 * booking product and wrong here, where ten digits is far more likely to be a
 * millimetre coordinate, a file offset or a timestamp.
 */
const SENSITIVE = [
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/,
  /\beyJ[A-Za-z0-9_-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:otp|password|passphrase|secret|token|api[_-]?key)\s*[:=]\s*\S+/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b[0-9a-f]{32,}\b/i,
];

/**
 * A git object id cited as evidence: `commit <sha>`, `sha <sha>`, `revision <sha>`.
 * Deliberately narrow, so only a labelled citation is exempt and a bare 40-char
 * hex blob in free text is still treated as possible key material. Without this
 * the evidence rule and its own guard contradict each other: the rule asks for
 * "a file, command, commit or test" and the long-hex pattern then rejects the
 * commit it asked for.
 */
const GIT_OBJECT_CITATION = /\b(commit|sha|revision)\s+[0-9a-f]{7,40}\b/gi;

const EM_DASH = String.fromCharCode(0x2014);

const now = () => new Date().toISOString();

/** Module ids, read off disk: an entry may be filed against a real Zeus module. */
export function knownLanes(root = packageRoot) {
  const lanes = new Set(['general']);
  try {
    const manifest = JSON.parse(readFileSync(join(root, '.zeus', 'module-manifest.json'), 'utf8'));
    for (const m of manifest.modules ?? []) lanes.add(m.id);
  } catch {
    // A missing manifest is reported by zeus-validate, which owns manifest
    // integrity. Here it only means lanes cannot be checked, so `general`
    // stands alone rather than this throwing inside every entry validation.
  }
  return lanes;
}

/** @returns {object} */
export function emptyState() {
  return { version: 1, project: 'Arq', entries: [], refinements: [] };
}

export function loadState(path = storePath()) {
  if (!existsSync(path)) return emptyState();
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return emptyState();
  const parsed = JSON.parse(raw);
  // A corrupt store must fail loudly. Silently substituting an empty state
  // would erase learned behaviour and read as "Zeus simply had no lessons".
  if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.refinements)) {
    throw new Error(`${path}: not a Zeus harness store (missing entries/refinements)`);
  }
  // Shape, not just container. The store is tracked, hand-editable and
  // merge-conflict-prone, and `format` sorts on `updatedAt`: one entry missing
  // it throws a bare TypeError deep inside formatting, which a hook that
  // discards stderr then swallows, losing every lesson with no signal anywhere.
  // Fail here, naming the entry, where the message can still reach a human.
  parsed.entries.forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`${path}: entry ${i} is not an object`);
    }
    const missing = REQUIRED_ENTRY_FIELDS.filter((f) => typeof entry[f] !== 'string' || !entry[f]);
    if (missing.length) {
      throw new Error(
        `${path}: entry ${i} ("${entry.id ?? 'no id'}") is missing ${missing.join(', ')}`,
      );
    }
  });
  return parsed;
}

export function saveState(state, path = storePath()) {
  mkdirSync(dirname(path), { recursive: true });
  // Write-then-rename. An in-place write interrupted mid-flight truncates a
  // tracked JSON file, which is exactly the corrupt-store case above. Rename is
  // atomic on one filesystem, so a reader sees the old store or the new one and
  // never a half-written one.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
  return state;
}

export function slug(raw, fallback = 'entry') {
  const s = String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (s || fallback).slice(0, 60);
}

/**
 * Returns an array of human-readable problems; empty means valid.
 * @returns {string[]}
 */
export function validateEntry(entry, state, options = {}) {
  const cfg = options.config ?? harnessConfig();
  const lanes = options.lanes ?? knownLanes();
  const errors = [];
  if (!KINDS.has(entry.kind)) errors.push(`kind must be one of ${[...KINDS].join('|')}`);
  if (!entry.title || entry.title.length > cfg.maxTitleChars) {
    errors.push(`title required, <=${cfg.maxTitleChars} chars`);
  }
  if (!entry.content || entry.content.length > cfg.maxContentChars) {
    errors.push(`content required, <=${cfg.maxContentChars} chars`);
  }
  if (!entry.evidence) errors.push('evidence required - cite a file, command, commit or test');
  if (entry.evidence && entry.evidence.length > cfg.maxEvidenceChars) {
    errors.push(`evidence <=${cfg.maxEvidenceChars} chars`);
  }
  if (entry.status && !STATUSES.has(entry.status)) {
    errors.push(`status must be ${[...STATUSES].join('|')}`);
  }
  if (entry.lane && !lanes.has(entry.lane)) {
    errors.push(
      `lane "${entry.lane}" is not "general" or a module id in .zeus/module-manifest.json`,
    );
  }

  const blob = JSON.stringify(entry).replace(GIT_OBJECT_CITATION, '$1 <sha>');
  if (SENSITIVE.some((p) => p.test(blob))) {
    errors.push('entry appears to contain a secret, key or contact value');
  }
  // The store lives under `.zeus/`, where scripts/zeus-validate.mjs fails any
  // U+2014, and the block is injected into the turn as Zeus prose. Rejecting at
  // write time gives a clear message here instead of an unexplained validation
  // failure in an unrelated run later.
  if (blob.includes(EM_DASH)) {
    errors.push('entry contains a U+2014 em dash, which Zeus assets do not use');
  }

  // A subagent spec that does not say when to invoke it is a note, not a
  // reusable delegation. Same for a skill with no call surface.
  if (
    entry.kind === 'subagent' &&
    !/when|invoke|use (this|it)|route|dispatch/i.test(entry.content)
  ) {
    errors.push('subagent entries must state when to invoke the delegation');
  }
  if (entry.kind === 'skill' && !entry.reference) {
    errors.push('skill entries require a reference (command, script path or skill name)');
  }

  if (state) {
    const active = state.entries.filter((e) => e.status === 'active').length;
    if (active >= cfg.maxActiveEntries) {
      errors.push(
        `store is full (${cfg.maxActiveEntries} active entries) - retire something first`,
      );
    }
  }
  return errors;
}

/**
 * Applies one refinement (a batch of create/update/retire edits) and records a
 * before snapshot so the whole batch can be rolled back.
 */
export function applyRefinement(state, { trigger, rationale = '', expectedOutcome = '', edits }) {
  if (!trigger) throw new Error('refinement requires a trigger');
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new Error('refinement requires at least one edit');
  }
  const options = { config: harnessConfig(), lanes: knownLanes() };
  const before = JSON.parse(JSON.stringify(state.entries));
  const applied = [];

  // All or nothing. Mutating `state.entries` per edit means a throw on edit 3 of
  // 5 leaves edits 1 and 2 applied with no refinement event recording them: a
  // partial write that rollback cannot reach, in a store committed to the
  // repository. `working` absorbs every edit and is swapped in only once the
  // whole batch validates.
  const working = JSON.parse(JSON.stringify(state.entries));
  const draft = { ...state, entries: working };

  for (const edit of edits) {
    const action = edit.action ?? 'create';
    if (action === 'create') {
      const entry = {
        id: edit.id || `${edit.kind}-${slug(edit.title)}`,
        kind: edit.kind,
        title: edit.title,
        content: edit.content,
        evidence: edit.evidence,
        lane: edit.lane || 'general',
        reference: edit.reference,
        status: 'active',
        source: edit.source || 'agent',
        createdAt: now(),
        updatedAt: now(),
        version: 1,
      };
      const errors = validateEntry(entry, draft, options);
      if (errors.length) throw new Error(`create "${edit.title}": ${errors.join('; ')}`);
      if (working.some((e) => e.id === entry.id)) {
        throw new Error(`create "${entry.id}": id already exists - use --action update`);
      }
      working.push(entry);
      applied.push(`create ${entry.kind}:${entry.id}`);
    } else if (action === 'update') {
      const target = working.find((e) => e.id === edit.id);
      if (!target) throw new Error(`update "${edit.id}": no such entry`);
      const next = {
        ...target,
        title: edit.title ?? target.title,
        content: edit.content ?? target.content,
        evidence: edit.evidence ?? target.evidence,
        lane: edit.lane ?? target.lane,
        reference: edit.reference ?? target.reference,
        updatedAt: now(),
        version: target.version + 1,
      };
      const errors = validateEntry(next, null, options);
      if (errors.length) throw new Error(`update "${edit.id}": ${errors.join('; ')}`);
      Object.assign(target, next);
      applied.push(`update ${target.kind}:${target.id} to v${target.version}`);
    } else if (action === 'retire') {
      const target = working.find((e) => e.id === edit.id);
      if (!target) throw new Error(`retire "${edit.id}": no such entry`);
      target.status = 'retired';
      target.updatedAt = now();
      applied.push(`retire ${target.kind}:${target.id}`);
    } else {
      throw new Error(`unknown action "${action}" (create|update|retire)`);
    }
  }

  // Batch validated end to end: commit it.
  state.entries = working;

  const event = {
    id: `ref-${state.refinements.length + 1}-${slug(trigger, 'refinement')}`,
    trigger,
    rationale,
    expectedOutcome,
    changes: applied,
    createdAt: now(),
    snapshotBefore: before,
  };
  state.refinements.push(event);
  pruneSnapshots(state);
  return { state, event };
}

/**
 * Keeps a full before-snapshot only for the most recent `rollbackWindow`
 * refinements, and drops the snapshot (never the event) from older ones.
 *
 * Measured on a store filled to its own 40-entry cap: 40 seed refinements
 * produced an 811 KB file, and 40 ordinary edits took it to 2,385 KB. That is
 * 100x the 24 KB it actually injects, in a file that is committed, reviewed and
 * merge-conflict-prone, because every refinement stored a complete copy of every
 * entry. Snapshot growth is quadratic in a store designed to be edited often.
 *
 * The deep history is not lost: this file is tracked, so git holds every prior
 * version. The in-store window covers the case the window is for, undoing a
 * refinement you have just made and can still see.
 */
export function pruneSnapshots(state, window = harnessConfig().rollbackWindow) {
  const cut = state.refinements.length - window;
  for (let i = 0; i < cut; i += 1) {
    const event = state.refinements[i];
    if (event.snapshotBefore === undefined) continue;
    delete event.snapshotBefore;
    // Recorded, not implied. `rollback` refuses these by name rather than
    // failing on an absent field, so the reason reaches a human.
    event.snapshotDropped = true;
  }
  return state;
}

/**
 * Applies a `/zeus-refine` proposal. Kept separate from applyRefinement so the
 * wire format is validated and reported on before anything touches the store.
 */
export function applyProposal(state, proposal, { dryRun = false } = {}) {
  if (!proposal || typeof proposal !== 'object') throw new Error('proposal must be a JSON object');
  const { summary, rationale, expectedOutcome, edits } = proposal;
  if (!summary) throw new Error('proposal requires a "summary"');
  if (!rationale)
    throw new Error('proposal requires a "rationale" justified by trajectory evidence');
  if (!expectedOutcome) {
    throw new Error(
      'proposal requires an "expectedOutcome" saying what should improve and how to validate it',
    );
  }
  if (!Array.isArray(edits) || edits.length === 0) {
    throw new Error('proposal requires a non-empty "edits" array');
  }
  // A dry run must not be able to leave a partial write behind, so it validates
  // against a deep copy and discards it.
  const target = dryRun ? JSON.parse(JSON.stringify(state)) : state;
  const { event } = applyRefinement(target, {
    trigger: summary,
    rationale,
    expectedOutcome,
    edits,
  });
  return { event: dryRun ? null : event, changes: event.changes };
}

export function rollback(state, refinementId) {
  const index = state.refinements.findIndex((r) => r.id === refinementId);
  if (index === -1) throw new Error(`no refinement "${refinementId}"`);
  if (state.refinements[index].snapshotDropped) {
    throw new Error(
      `"${refinementId}" is older than the ${harnessConfig().rollbackWindow}-refinement rollback window, ` +
        'so its before-snapshot was dropped to keep the tracked store small. ' +
        'This file is committed, so recover that state from git history instead.',
    );
  }
  // Snapshot BEFORE restoring. Taking it afterwards records the post-rollback
  // entries, which makes the rollback itself irreversible: rolling back an
  // accidental rollback would restore the state it had just produced and the
  // discarded entries would be gone for good. A rollback is a refinement like
  // any other, so it has to be as reversible as the one it undoes.
  const snapshotBefore = JSON.parse(JSON.stringify(state.entries));
  state.entries = JSON.parse(JSON.stringify(state.refinements[index].snapshotBefore));
  state.refinements.push({
    id: `ref-${state.refinements.length + 1}-rollback`,
    trigger: `rollback of ${refinementId}`,
    rationale: 'reverted to the snapshot recorded before that refinement',
    expectedOutcome: '',
    changes: [`rollback ${refinementId}`],
    createdAt: now(),
    snapshotBefore,
  });
  pruneSnapshots(state);
  return state;
}

/**
 * The compact block injected into the turn. Ordered so behavioural addendums and
 * durable memories, which change what Zeus does, win the budget over reusable
 * skills and delegation specs, which only change how it routes.
 */
export function formatForPrompt(state, { budget = null } = {}) {
  const cap = budget ?? harnessConfig().promptCharBudget;
  const order = ['prompt', 'memory', 'subagent', 'skill'];
  // Interleaved by kind, not sorted by it. A strict kind sort puts every
  // `prompt` entry ahead of every `memory`, `subagent` and `skill`; with a
  // budget that fits a handful of entries and a store already holding several
  // prompts, the other three kinds are unreachable until a prompt is retired -
  // three quarters of the feature silently off while config advertises 40
  // slots. Round robin keeps prompt first in each pass without starving.
  const byKind = new Map(order.map((k) => [k, []]));
  for (const e of state.entries) {
    if (e.status !== 'active') continue;
    (byKind.get(e.kind) ?? byKind.get('prompt')).push(e);
  }
  for (const list of byKind.values()) {
    list.sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')));
  }
  const active = [];
  for (let i = 0; active.length < state.entries.length; i += 1) {
    let took = false;
    for (const kind of order) {
      const entry = byKind.get(kind)[i];
      if (entry) {
        active.push(entry);
        took = true;
      }
    }
    if (!took) break;
  }

  if (active.length === 0) return '';

  // The budget bounds the WHOLE block, not just the entry lines: a cap that
  // excluded its own header and footer would let the thing it is supposed to
  // limit overrun by exactly the amount nobody was counting.
  const header = 'Zeus learned state (supplemental; .zeus/ doctrine still wins on conflict):';
  const footerFor = (n) =>
    `\n(${n} more learned ${n === 1 ? 'entry' : 'entries'} not shown - run: pnpm zeus:harness list)`;
  // Reserved against the worst-case footer, so adding it can never push the
  // assembled block back over the cap.
  const reserve = footerFor(active.length).length;

  const lines = [];
  let used = header.length;
  let shown = 0;
  for (const entry of active) {
    const line = `\n- [${entry.kind}] ${entry.title}: ${entry.content}`;
    const willOmit = shown + 1 < active.length;
    if (used + line.length + (willOmit ? reserve : 0) > cap) break;
    lines.push(line);
    used += line.length;
    shown += 1;
  }

  // A budget too small for even one entry must still say so rather than
  // returning a bare header that reads as "nothing has been learned", but not by
  // breaking the cap it exists to enforce. Fall back to the shortest honest
  // notice, and to silence only when even that does not fit: at that point there
  // is no room to say anything truthfully.
  const omitted = active.length - shown;
  if (shown === 0) {
    const full = `${header}${footerFor(omitted).trimEnd()}`;
    if (full.length <= cap) return full;
    const terse = `Zeus learned state: ${omitted} ${omitted === 1 ? 'entry' : 'entries'} not shown (pnpm zeus:harness list)`;
    return terse.length <= cap ? terse : '';
  }

  // Never let truncation masquerade as "these are all the lessons".
  return `${header}${lines.join('')}${omitted > 0 ? footerFor(omitted) : ''}`;
}

/* --------------------------------- CLI ---------------------------------- */

function arg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

const USAGE = `Zeus continual harness - supplemental learned state.

Usage:
  pnpm zeus:harness list
  pnpm zeus:harness format
  pnpm zeus:harness history
  pnpm zeus:harness add --kind memory --title "..." --content "..." --evidence "..." [--lane arqfs]
  pnpm zeus:harness update --id <id> [--content "..."] [--evidence "..."]
  pnpm zeus:harness retire --id <id>
  pnpm zeus:harness apply --file <proposal.json> [--dry-run]
  pnpm zeus:harness rollback --id <refinement-id>

apply takes a /zeus-refine proposal:
  { "summary", "rationale", "expectedOutcome", "edits": [ { "action", "kind", ... } ] }
Always dry-run first: it validates every edit against a copy and leaves the
store untouched.

Kinds: prompt (behaviour addendum) | memory (durable fact) | skill (reusable
procedure, needs --reference) | subagent (delegation spec, must say when to
invoke). Lane is "general" or a module id from .zeus/module-manifest.json.

Every entry requires evidence. The store never edits CLAUDE.md, AGENTS.md or
anything under .zeus/ doctrine: base doctrine stays immutable and this state is
supplemental.`;

export function main(argv) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') {
    console.error(USAGE);
    return command ? 0 : 1;
  }
  const state = loadState();

  switch (command) {
    case 'format': {
      const out = formatForPrompt(state);
      if (out) process.stdout.write(`${out}\n`);
      return 0;
    }
    case 'list': {
      if (state.entries.length === 0) {
        console.log('No harness entries yet. Record one with: pnpm zeus:harness add ...');
        return 0;
      }
      for (const e of state.entries) {
        const mark = e.status === 'active' ? ' ' : 'x';
        console.log(`[${mark}] ${e.kind.padEnd(8)} ${e.id}  v${e.version}  (${e.lane})`);
        console.log(`      ${e.title}`);
        console.log(`      evidence: ${e.evidence}`);
      }
      const active = state.entries.filter((e) => e.status === 'active').length;
      console.log(`\n${active} active, ${state.refinements.length} refinements.`);
      return 0;
    }
    case 'history': {
      for (const r of state.refinements) {
        console.log(`${r.createdAt.slice(0, 10)}  ${r.id}`);
        console.log(`   trigger: ${r.trigger}`);
        for (const c of r.changes) console.log(`   - ${c}`);
      }
      return 0;
    }
    case 'add':
    case 'update':
    case 'retire': {
      const edit = {
        action: command === 'add' ? 'create' : command,
        id: arg(args, 'id'),
        kind: arg(args, 'kind'),
        title: arg(args, 'title'),
        content: arg(args, 'content'),
        evidence: arg(args, 'evidence'),
        lane: arg(args, 'lane'),
        reference: arg(args, 'reference'),
      };
      const { event } = applyRefinement(state, {
        trigger: arg(args, 'trigger', `${command} via cli`),
        rationale: arg(args, 'rationale', ''),
        edits: [edit],
      });
      saveState(state);
      console.log(`${event.id}: ${event.changes.join(', ')}`);
      return 0;
    }
    case 'apply': {
      // The proposal arrives as a file so a human can read the exact edits
      // before they land, and so a malformed proposal fails validation rather
      // than half-applying.
      const file = arg(args, 'file') || args.find((a) => !a.startsWith('--'));
      if (!file) throw new Error('apply needs --file <proposal.json>');
      if (!existsSync(file)) throw new Error(`no such proposal file: ${file}`);
      let proposal;
      try {
        proposal = JSON.parse(readFileSync(file, 'utf8'));
      } catch (e) {
        throw new Error(`${file}: not valid JSON - ${e.message}`);
      }
      const dryRun = args.includes('--dry-run');
      const { event, changes } = applyProposal(state, proposal, { dryRun });
      if (dryRun) {
        console.log(`dry run - ${changes.length} edit(s) would apply, store untouched:`);
        for (const c of changes) console.log(`  ${c}`);
        return 0;
      }
      saveState(state);
      console.log(`${event.id}: ${changes.join(', ')}`);
      console.log(`expected outcome: ${event.expectedOutcome}`);
      console.log(`rollback with: pnpm zeus:harness rollback --id ${event.id}`);
      return 0;
    }
    case 'rollback': {
      const id = arg(args, 'id') || args[0];
      if (!id) throw new Error('rollback needs --id <refinement-id>');
      saveState(rollback(state, id));
      console.log(`Rolled back ${id}.`);
      return 0;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

// pathToFileURL, not a `file://${argv[1]}` template: the template silently
// no-ops on any path containing a space, so the CLI would do nothing at all
// from a checkout under "My Repos".
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(2);
  }
}
