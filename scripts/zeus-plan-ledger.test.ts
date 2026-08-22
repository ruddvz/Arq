// Zeus 5 plan ledger: the refusal to call a plan done while an item is unproven.
//
// Every test here pins a way "implemented" could be claimed without being true.
// Each was run against a deliberately un-fixed copy of the module first.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  addItem,
  blockItem,
  closeReadiness,
  completeItem,
  emptyPlan,
  knownRoles,
  loadPlan,
  nextItem,
  openPlan,
  planConfig,
  savePlan,
  startItem,
} from './zeus-plan-ledger.mjs';

const config = planConfig();
const SIG = 'signature-of-this-tree';
const OTHER = 'signature-after-an-edit';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'zeus-plan-'));
  path = join(dir, 'current.json');
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const opened = () => openPlan(emptyPlan(), { task: 'a real request' });
const withItem = (plan: ReturnType<typeof opened>, over: Record<string, unknown> = {}) =>
  addItem(plan, {
    title: 'do the thing',
    owner: 'ui-visual',
    acceptance: 'pnpm test passes',
    ...over,
  });

describe('opening a plan', () => {
  it('refuses a plan with no statement of what was asked for', () => {
    expect(() => openPlan(emptyPlan(), { task: '' })).toThrow(/open requires --task/);
  });

  it('refuses items before a plan is open', () => {
    expect(() => withItem(emptyPlan())).toThrow(/no plan open/);
  });
});

describe('items must be answerable', () => {
  it('refuses an item with no acceptance, which could never be closed honestly', () => {
    expect(() => withItem(opened(), { acceptance: '' })).toThrow(/requires --acceptance/);
  });

  it('refuses an owner that is not a role on disk', () => {
    expect(() => withItem(opened(), { owner: 'whoever' })).toThrow(/role in .zeus\/role-registry/);
    expect(() => withItem(opened(), { owner: undefined })).toThrow(/role in .zeus\/role-registry/);
  });

  it('accepts every role the registry actually defines', () => {
    for (const role of knownRoles()) {
      expect(withItem(opened(), { owner: role }).item.owner).toBe(role);
    }
  });

  it('refuses a dependency on an item that does not exist', () => {
    expect(() => withItem(opened(), { dependsOn: ['nope'] })).toThrow(/unknown item/);
  });

  it('refuses a duplicate id rather than overwriting an item', () => {
    const { plan } = withItem(opened(), { id: 'fixed' });
    expect(() => withItem(plan, { id: 'fixed' })).toThrow(/already exists/);
  });

  it('refuses to grow past the configured cap', () => {
    let plan = opened();
    for (let i = 0; i < config.maxItems; i += 1) plan = withItem(plan, { title: `item ${i}` }).plan;
    expect(() => withItem(plan)).toThrow(/plan is full/);
  });
});

describe('the loop', () => {
  it('offers the first workable item and respects dependencies', () => {
    let plan = withItem(opened(), { id: 'a', title: 'first' }).plan;
    plan = withItem(plan, { id: 'b', title: 'second', dependsOn: ['a'] }).plan;
    // The dependent item is moved to the FRONT of the array. Left in dependency
    // order this test passes with the dependency filter removed, because the
    // independent item happens to come first anyway: it pinned nothing until an
    // un-fixed run showed it green. Item order is not guaranteed to match
    // dependency order, and the store is plain JSON that a human may reorder.
    plan.items.reverse();
    expect(nextItem(plan)?.id).toBe('a');

    plan = startItem(plan, 'a');
    plan = completeItem(plan, { id: 'a', command: 'pnpm test', exitCode: 0, signature: SIG });
    expect(nextItem(plan)?.id).toBe('b');
  });

  it('refuses to start an item whose dependency is not done', () => {
    let plan = withItem(opened(), { id: 'a' }).plan;
    plan = withItem(plan, { id: 'b', dependsOn: ['a'] }).plan;
    expect(() => startItem(plan, 'b')).toThrow(/depends on a, which are not done/);
  });

  it('returns the active item so a resumed session picks up where it left off', () => {
    let plan = withItem(opened(), { id: 'a' }).plan;
    plan = withItem(plan, { id: 'b' }).plan;
    plan = startItem(plan, 'b');
    expect(nextItem(plan)?.id).toBe('b');
  });

  it('offers nothing when every remaining item is blocked', () => {
    let plan = withItem(opened(), { id: 'a' }).plan;
    plan = blockItem(plan, { id: 'a', reason: 'waiting on a decision' });
    expect(nextItem(plan)).toBeNull();
  });

  it('does not offer an item that waits on a blocked dependency', () => {
    let plan = withItem(opened(), { id: 'a' }).plan;
    plan = withItem(plan, { id: 'b', dependsOn: ['a'] }).plan;
    plan = blockItem(plan, { id: 'a', reason: 'blocked' });
    expect(nextItem(plan)).toBeNull();
  });
});

describe('an item is done only when something proved it', () => {
  it('refuses done with no command', () => {
    const { plan } = withItem(opened(), { id: 'a' });
    expect(() => completeItem(plan, { id: 'a', exitCode: 0 })).toThrow(/requires --command/);
  });

  it('refuses done with a non-integer exit code', () => {
    const { plan } = withItem(opened(), { id: 'a' });
    expect(() => completeItem(plan, { id: 'a', command: 'pnpm test' })).toThrow(/integer --exit/);
    expect(() =>
      completeItem(plan, { id: 'a', command: 'pnpm test', exitCode: Number('x') }),
    ).toThrow(/integer --exit/);
  });

  it('refuses done when the command failed', () => {
    // The most tempting lie in the whole system: run it, watch it fail, mark it
    // done anyway because the next thing is more interesting.
    const { plan } = withItem(opened(), { id: 'a' });
    expect(() => completeItem(plan, { id: 'a', command: 'pnpm test', exitCode: 1 })).toThrow(
      /exited 1, so it did not prove the item/,
    );
  });

  it('refuses to re-open a done item by starting it again', () => {
    let plan = withItem(opened(), { id: 'a' }).plan;
    plan = completeItem(plan, { id: 'a', command: 'pnpm test', exitCode: 0, signature: SIG });
    expect(() => startItem(plan, 'a')).toThrow(/already done/);
  });

  it('refuses to block an item without a reason', () => {
    const { plan } = withItem(opened(), { id: 'a' });
    expect(() => blockItem(plan, { id: 'a' })).toThrow(/requires --reason/);
  });

  it('refuses to touch an item that does not exist', () => {
    expect(() => startItem(opened(), 'ghost')).toThrow(/no item "ghost"/);
  });
});

describe('closing', () => {
  const complete = () => {
    const plan = withItem(opened(), { id: 'a' }).plan;
    return completeItem(plan, { id: 'a', command: 'pnpm test', exitCode: 0, signature: SIG });
  };

  it('refuses a plan that was never opened', () => {
    expect(closeReadiness(emptyPlan(), SIG).problems).toContain(
      'no plan open - nothing was planned',
    );
  });

  it('refuses an empty plan, because "implemented" would describe nothing', () => {
    expect(closeReadiness(opened(), SIG).problems.join(' ')).toContain('no items');
  });

  it('names every unfinished item rather than reporting a count', () => {
    let plan = withItem(opened(), { id: 'a', title: 'first thing' }).plan;
    plan = withItem(plan, { id: 'b', title: 'second thing' }).plan;
    plan = blockItem(plan, { id: 'b', reason: 'needs a decision' });
    const { ready, problems } = closeReadiness(plan, SIG);
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('first thing');
    expect(problems.join(' ')).toContain('second thing');
    expect(problems.join(' ')).toContain('needs a decision');
  });

  it('is green only when every item is done with evidence', () => {
    expect(closeReadiness(complete(), SIG)).toEqual({ ready: true, problems: [] });
  });

  it('refuses a done item that carries no command, even hand-written', () => {
    // The store is plain JSON. "state": "done" typed by hand is a claim.
    const plan = opened();
    plan.items = [{ id: 'a', title: 'hand edited', state: 'done', owner: 'ui-visual' }];
    expect(closeReadiness(plan, SIG).problems.join(' ')).toContain('a claim, not a result');
  });

  it('reports a done item proven against an older workspace', () => {
    expect(closeReadiness(complete(), OTHER).problems.join(' ')).toContain(
      'proven against an older workspace',
    );
  });
});

describe('persistence', () => {
  it('returns an empty plan for a missing or blank file', () => {
    expect(loadPlan(join(dir, 'absent.json')).items).toEqual([]);
    writeFileSync(path, '  \n');
    expect(loadPlan(path).items).toEqual([]);
  });

  it('refuses a file that is not a plan rather than starting fresh', () => {
    writeFileSync(path, JSON.stringify({ version: 1 }));
    expect(() => loadPlan(path)).toThrow(/not a Zeus plan ledger/);
  });

  it('names the item and field when one is malformed', () => {
    writeFileSync(
      path,
      JSON.stringify({ version: 1, task: 't', items: [{ id: 'a', title: 'x' }] }),
    );
    expect(() => loadPlan(path)).toThrow(/item 0 \("a"\) is missing state/);
  });

  it('refuses an unknown item state', () => {
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        task: 't',
        items: [{ id: 'a', title: 'x', state: 'finished' }],
      }),
    );
    expect(() => loadPlan(path)).toThrow(/unknown state "finished"/);
  });

  it('writes through a temporary file and leaves none behind', () => {
    savePlan(withItem(opened()).plan, path);
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    expect(JSON.parse(readFileSync(path, 'utf8')).items).toHaveLength(1);
  });
});
