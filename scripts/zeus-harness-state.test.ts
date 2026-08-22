// Zeus 5 continual harness: behaviour tests.
//
// Every test here pins a specific failure the reference implementation shipped
// and four independent reviews found. Each was run against a deliberately
// un-fixed copy of the module and seen to fail before being kept; a test that
// passes either way reports coverage that does not exist.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyProposal,
  applyRefinement,
  emptyState,
  formatForPrompt,
  harnessConfig,
  knownLanes,
  loadState,
  rollback,
  saveState,
  slug,
  storePath,
  validateEntry,
} from './zeus-harness-state.mjs';

let dir: string;
let store: string;

const config = harnessConfig();

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'zeus-harness-'));
  store = join(dir, 'state.json');
  process.env.ZEUS_HARNESS_STORE = store;
});

afterEach(() => {
  delete process.env.ZEUS_HARNESS_STORE;
  rmSync(dir, { recursive: true, force: true });
});

const entry = (over: Record<string, unknown> = {}) => ({
  kind: 'memory',
  title: 'A durable fact',
  content: 'Zeus self-checks do not run in CI.',
  evidence: 'grep -rn zeus .github/workflows/ returns nothing',
  ...over,
});

const seed = (n: number, kind = 'prompt') => {
  const state = emptyState();
  for (let i = 0; i < n; i += 1) {
    applyRefinement(state, {
      trigger: `seed ${kind} ${i}`,
      edits: [
        entry({
          kind,
          title: `${kind} lesson ${i}`,
          content: `Body of ${kind} lesson ${i}, long enough to cost real budget when it is injected.`,
          ...(kind === 'skill' ? { reference: 'pnpm zeus:validate' } : {}),
          ...(kind === 'subagent'
            ? { content: `Invoke this when ${kind} lesson ${i} applies to the diff.` }
            : {}),
        }),
      ],
    });
  }
  return state;
};

describe('store paths and configuration', () => {
  it('treats a set-but-empty ZEUS_HARNESS_STORE as unset', () => {
    process.env.ZEUS_HARNESS_STORE = '   ';
    expect(storePath()).toContain(config.store);
  });

  it('reads its budgets from .zeus/config.json rather than hardcoding them', () => {
    expect(config.promptCharBudget).toBeGreaterThan(0);
    expect(config.maxActiveEntries).toBeGreaterThan(0);
  });

  it('derives lanes from the module manifest on disk, not a pinned list', () => {
    const lanes = knownLanes();
    expect(lanes.has('general')).toBe(true);
    expect(lanes.has('arqfs')).toBe(true);
    expect(lanes.has('not-a-module')).toBe(false);
  });
});

describe('entry validation', () => {
  it('refuses an entry with no evidence', () => {
    const problems = validateEntry(entry({ evidence: '' }) as never, null);
    expect(problems.join(' ')).toContain('evidence required');
  });

  it('refuses a secret value while accepting the vocabulary', () => {
    expect(
      validateEntry(entry({ content: 'ghp_abcdefghijklmnopqrstuvwxyz012345' }) as never, null),
    ).toContain('entry appears to contain a secret, key or contact value');
    expect(validateEntry(entry({ content: 'Fix the token refresh path.' }) as never, null)).toEqual(
      [],
    );
  });

  it('still accepts a labelled git object id as evidence', () => {
    // The evidence rule asks for "a file, command, commit or test" and the
    // long-hex secret pattern then rejected the very thing it asked for.
    const sha = 'a'.repeat(40);
    expect(validateEntry(entry({ evidence: `commit ${sha}` }) as never, null)).toEqual([]);
    // A bare blob of the same shape is still refused: only a labelled citation
    // is exempt.
    expect(validateEntry(entry({ evidence: sha }) as never, null).join(' ')).toContain('secret');
  });

  it('refuses a U+2014 em dash, which Zeus assets do not use', () => {
    const emDash = String.fromCharCode(0x2014);
    expect(validateEntry(entry({ content: `a ${emDash} b` }) as never, null).join(' ')).toContain(
      'em dash',
    );
  });

  it('refuses a lane that is not general or a module id', () => {
    expect(validateEntry(entry({ lane: 'not-a-module' }) as never, null).join(' ')).toContain(
      'is not "general" or a module id',
    );
    expect(validateEntry(entry({ lane: 'arqfs' }) as never, null)).toEqual([]);
  });

  it('refuses a subagent entry that never says when to invoke it', () => {
    expect(
      validateEntry(
        entry({ kind: 'subagent', content: 'A reviewer for geometry.' }) as never,
        null,
      ),
    ).toContain('subagent entries must state when to invoke the delegation');
    expect(
      validateEntry(
        entry({ kind: 'subagent', content: 'Invoke this when geometry changes.' }) as never,
        null,
      ),
    ).toEqual([]);
  });

  it('refuses a skill entry with no call surface', () => {
    expect(validateEntry(entry({ kind: 'skill' }) as never, null)).toContain(
      'skill entries require a reference (command, script path or skill name)',
    );
  });

  it('refuses a new entry once the store is full', () => {
    const state = seed(config.maxActiveEntries, 'memory');
    expect(validateEntry(entry({ title: 'one more' }) as never, state).join(' ')).toContain(
      'store is full',
    );
  });
});

describe('refinements are atomic and reversible', () => {
  it('leaves the store byte-identical when one edit in a batch fails', () => {
    const state = emptyState();
    applyRefinement(state, { trigger: 'first', edits: [entry({ title: 'kept' })] });
    saveState(state, store);
    const before = readFileSync(store, 'utf8');

    expect(() =>
      applyRefinement(state, {
        trigger: 'mixed batch',
        edits: [
          entry({ title: 'would be added' }),
          entry({ title: 'no evidence at all', evidence: '' }),
        ],
      }),
    ).toThrow(/evidence required/);

    // The in-memory state must be untouched, so the file it is saved back to is
    // byte-identical. A per-edit mutation would have left "would be added"
    // applied, with no refinement event recording it and nothing to roll back.
    saveState(state, store);
    expect(readFileSync(store, 'utf8')).toBe(before);
    expect(state.entries.map((e: { title: string }) => e.title)).toEqual(['kept']);
    expect(state.refinements).toHaveLength(1);
  });

  it('rolls back a rollback', () => {
    const state = emptyState();
    const { event: first } = applyRefinement(state, {
      trigger: 'add original',
      edits: [entry({ title: 'original lesson' })],
    });
    applyRefinement(state, { trigger: 'add second', edits: [entry({ title: 'second lesson' })] });
    expect(state.entries).toHaveLength(2);

    rollback(state, first.id);
    expect(state.entries).toHaveLength(0);

    // Undoing the rollback must restore what the rollback discarded. Snapshot
    // taken after restoring records the state the rollback had just produced,
    // and the discarded entries are gone permanently.
    const rollbackEvent = state.refinements[state.refinements.length - 1];
    rollback(state, rollbackEvent.id);
    expect(state.entries.map((e: { title: string }) => e.title)).toEqual([
      'original lesson',
      'second lesson',
    ]);
  });

  it('refuses to roll back an unknown refinement', () => {
    expect(() => rollback(emptyState(), 'ref-99-nope')).toThrow(/no refinement/);
  });

  it('bumps the version on update and hides a retired entry from the prompt', () => {
    const state = emptyState();
    applyRefinement(state, { trigger: 'add', edits: [entry({ title: 'first' })] });
    const id = state.entries[0].id;
    applyRefinement(state, {
      trigger: 'sharpen',
      edits: [{ action: 'update', id, content: 'A sharper statement of the same lesson.' }],
    });
    expect(state.entries[0].version).toBe(2);
    expect(formatForPrompt(state)).toContain('A sharper statement');

    applyRefinement(state, { trigger: 'retire', edits: [{ action: 'retire', id }] });
    expect(state.entries[0].status).toBe('retired');
    expect(formatForPrompt(state)).toBe('');
  });

  it('refuses a duplicate id rather than silently overwriting', () => {
    const state = emptyState();
    applyRefinement(state, { trigger: 'add', edits: [entry({ id: 'fixed-id' })] });
    expect(() =>
      applyRefinement(state, { trigger: 'again', edits: [entry({ id: 'fixed-id' })] }),
    ).toThrow(/id already exists/);
  });

  it('refuses an unknown action', () => {
    expect(() =>
      applyRefinement(emptyState(), { trigger: 't', edits: [{ action: 'delete', id: 'x' }] }),
    ).toThrow(/unknown action/);
  });
});

describe('proposals', () => {
  const proposal = (over: Record<string, unknown> = {}) => ({
    summary: 'record one durable lesson',
    rationale: 'proven by a command in this session',
    expectedOutcome: 'a later turn sees it; validate with pnpm zeus:harness format',
    edits: [entry()],
    ...over,
  });

  it('requires summary, rationale, expectedOutcome and a non-empty edit list', () => {
    for (const field of ['summary', 'rationale', 'expectedOutcome']) {
      expect(() => applyProposal(emptyState(), proposal({ [field]: undefined }))).toThrow(
        new RegExp(field),
      );
    }
    expect(() => applyProposal(emptyState(), proposal({ edits: [] }))).toThrow(/non-empty/);
    expect(() => applyProposal(emptyState(), null)).toThrow(/JSON object/);
  });

  it('leaves the state untouched on a dry run', () => {
    const state = emptyState();
    const { event, changes } = applyProposal(state, proposal(), { dryRun: true });
    expect(event).toBeNull();
    expect(changes).toHaveLength(1);
    expect(state.entries).toHaveLength(0);
    expect(state.refinements).toHaveLength(0);
  });

  it('applies for real when it is not a dry run', () => {
    const state = emptyState();
    const { event } = applyProposal(state, proposal());
    expect(state.entries).toHaveLength(1);
    expect(event?.expectedOutcome).toContain('a later turn sees it');
  });
});

describe('loading a damaged store', () => {
  it('returns an empty state for a missing or blank file', () => {
    expect(loadState(join(dir, 'absent.json')).entries).toEqual([]);
    writeFileSync(store, '   \n');
    expect(loadState(store).entries).toEqual([]);
  });

  it('throws rather than silently substituting an empty state', () => {
    writeFileSync(store, JSON.stringify({ version: 1, project: 'Arq' }));
    expect(() => loadState(store)).toThrow(/not a Zeus harness store/);
  });

  it('names the entry and the field when an entry is malformed', () => {
    // An entry missing updatedAt used to crash formatting with a bare TypeError
    // deep inside a sort, which a hook that discards stderr then swallowed: the
    // symptom was total silent loss of state.
    writeFileSync(
      store,
      JSON.stringify({
        version: 1,
        project: 'Arq',
        refinements: [],
        entries: [{ id: 'broken-one', kind: 'memory', title: 't', content: 'c', status: 'active' }],
      }),
    );
    expect(() => loadState(store)).toThrow(/entry 0 \("broken-one"\) is missing updatedAt/);
  });

  it('writes through a temporary file and leaves none behind', () => {
    const state = emptyState();
    applyRefinement(state, { trigger: 'add', edits: [entry()] });
    saveState(state, store);
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    expect(loadState(store).entries).toHaveLength(1);
  });

  it('creates the store directory when it does not exist', () => {
    const nested = join(dir, 'a', 'b', 'state.json');
    saveState(emptyState(), nested);
    expect(loadState(nested).entries).toEqual([]);
  });
});

describe('the injected block', () => {
  it('never exceeds the budget, at any budget value', () => {
    const state = seed(12, 'prompt');
    for (let budget = 0; budget <= 2000; budget += 1) {
      const block = formatForPrompt(state, { budget });
      expect(block.length).toBeLessThanOrEqual(budget);
    }
  });

  it('says entries are hidden rather than returning a bare header', () => {
    const state = seed(6, 'prompt');
    // Large enough for the short notice, far too small for any entry line.
    const block = formatForPrompt(state, { budget: 140 });
    expect(block).not.toBe('');
    expect(block).toMatch(/not shown/);
  });

  it('discloses truncation instead of reading as the complete set', () => {
    const state = seed(12, 'prompt');
    const block = formatForPrompt(state, { budget: 400 });
    expect(block).toMatch(/more learned entr(y|ies) not shown/);
  });

  it('does not starve the other kinds at a budget that fits only a few entries', () => {
    // Discriminating by construction: seven prompts are added FIRST and one
    // entry of each other kind after, so a strict sort by kind puts all seven
    // prompts ahead of them. The budget below fits roughly four entries, so a
    // kind-sorted order shows prompts only. Verified against an un-fixed copy
    // of the module, where this test fails.
    const state = seed(7, 'prompt');
    for (const kind of ['memory', 'subagent', 'skill']) {
      applyRefinement(state, {
        trigger: `add ${kind}`,
        edits: [
          entry({
            kind,
            title: `${kind} entry`,
            content:
              kind === 'subagent'
                ? 'Invoke this when the diff touches persistence.'
                : `Body of the ${kind} entry.`,
            ...(kind === 'skill' ? { reference: 'pnpm zeus:validate' } : {}),
          }),
        ],
      });
    }
    const block = formatForPrompt(state, { budget: 420 });
    expect(block).toContain('[prompt]');
    expect(block).toContain('[memory]');
    expect(block).toContain('[subagent]');
  });

  it('returns nothing when there is no active state at all', () => {
    expect(formatForPrompt(emptyState())).toBe('');
  });
});

describe('slug', () => {
  it('falls back rather than producing an empty id', () => {
    expect(slug('')).toBe('entry');
    expect(slug('!!!', 'refinement')).toBe('refinement');
    expect(slug('Fix .arq Recovery')).toBe('fix-arq-recovery');
  });
});

describe('the harness never edits base doctrine', () => {
  it('writes only inside its own store path', () => {
    const doctrine = join(dir, 'doctrine');
    mkdirSync(doctrine);
    writeFileSync(join(doctrine, 'FAST-KERNEL.md'), 'original');
    const state = emptyState();
    applyRefinement(state, { trigger: 'add', edits: [entry()] });
    saveState(state, store);
    expect(readFileSync(join(doctrine, 'FAST-KERNEL.md'), 'utf8')).toBe('original');
    expect(readdirSync(dir).sort()).toEqual(['doctrine', 'state.json']);
  });
});
