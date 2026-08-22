// Zeus 5 gate ledger: behaviour tests.
//
// The ledger's whole claim is that "verified" stops being a memory, so every
// way it could quietly say green while something is red is pinned here. Each
// test was run against a deliberately un-fixed copy of the module and seen to
// fail before it was kept.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  allRadii,
  canSkip,
  emptyLedger,
  gateConfig,
  loadLedger,
  loopBounds,
  nextRound,
  recordGate,
  requiredSlot,
  reviewRequired,
  reviewRequiringRadii,
  repositoryRoot,
  saveLedger,
  shipReadiness,
  startTask,
  workspaceSignature,
} from './zeus-gate-ledger.mjs';

const config = gateConfig();
const bounds = loopBounds();
const SIG = 'signature-of-this-tree';
const OTHER = 'signature-after-an-edit';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'zeus-gates-'));
  path = join(dir, 'current.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const open = (over: Record<string, unknown> = {}) => ({
  ...startTask(emptyLedger(), {
    task: 'a task',
    risk: 'low',
    tier: 'fast',
    blastRadius: 'local',
    bounds,
  }),
  ...over,
});

describe('the workspace signature describes the repository, not the shell', () => {
  it('is identical whichever directory the ledger is run from', () => {
    // zeus-fingerprint.mjs hashes `git ls-files --others` relative to the root it
    // is given, so a cwd-rooted signature differed between the repository root
    // and packages/. Every gate recorded from one directory then read as stale
    // from the other, and a ledger that goes stale for no reason stops being run.
    //
    // The chdir is the whole test. Comparing two calls made from the repository
    // root passes against the cwd-rooted version too, because there cwd IS the
    // root: that version of this test pinned nothing and was caught by running
    // it against the un-fixed module.
    const root = repositoryRoot();
    const fromRoot = workspaceSignature();
    const previous = process.cwd();
    try {
      process.chdir(join(root, 'packages'));
      expect(process.cwd()).not.toBe(root);
      expect(workspaceSignature()).toBe(fromRoot);
    } finally {
      process.chdir(previous);
    }
  });
});

const withGates = (ledger: Record<string, unknown>, rows: Record<string, unknown>[]) => ({
  ...ledger,
  gates: rows.map((r) => ({
    outcome: 'pass',
    evidence: 'real command output',
    round: 1,
    signature: SIG,
    recordedAt: '2026-08-22T00:00:00.000Z',
    ...r,
  })),
});

/** Every configured repository gate, recorded passing at the current tree. */
const floor = (signature = SIG) =>
  config.repositoryGates.map((gate: string) => ({ gate, signature }));

describe('configuration is read off disk, not hardcoded', () => {
  it('takes loop bounds from the tier repair budgets', () => {
    expect(Object.keys(bounds).sort()).toEqual(['deep', 'fast', 'standard']);
    for (const n of Object.values(bounds)) expect(Number.isInteger(n) && n >= 1).toBe(true);
  });

  it('takes the unconditional gate set from config', () => {
    expect(config.repositoryGates.length).toBeGreaterThan(0);
  });

  it('takes the review-requiring blast radii from blast-radius.json', () => {
    const radii = reviewRequiringRadii();
    expect(radii?.has('production')).toBe(true);
    expect(radii?.has('local')).toBe(false);
  });

  it('normalises gate spellings onto the configured slots', () => {
    expect(requiredSlot('tsc', config.repositoryGates)).toBe('typecheck');
    expect(requiredSlot('  VITEST ', config.repositoryGates)).toBe('test');
    expect(requiredSlot('prettier', config.repositoryGates)).toBe('format:check');
    expect(requiredSlot('something-else', config.repositoryGates)).toBeNull();
  });
});

describe('opening a task', () => {
  it('refuses a risk or tier outside Zeus vocabulary', () => {
    expect(() =>
      startTask(emptyLedger(), {
        task: 't',
        risk: 'medium',
        tier: 'fast',
        blastRadius: 'local',
        bounds,
      }),
    ).toThrow(/risk must be one of/);
    expect(() =>
      startTask(emptyLedger(), {
        task: 't',
        risk: 'moderate',
        tier: 'quick',
        blastRadius: 'local',
        bounds,
      }),
    ).toThrow(/tier must be one of/);
    expect(() => startTask(emptyLedger(), { task: '', risk: 'low', tier: 'fast', bounds })).toThrow(
      /start requires/,
    );
  });

  it('refuses a ledger with no blast radius, because that waives review', () => {
    // `start --risk moderate --tier standard` with no radius produced a ledger
    // that required no reviewer at all: an unrecorded axis read as a benign one.
    expect(() =>
      startTask(emptyLedger(), { task: 't', risk: 'moderate', tier: 'standard', bounds }),
    ).toThrow(/blast radius must be one of/);
    expect(() =>
      startTask(emptyLedger(), {
        task: 't',
        risk: 'moderate',
        tier: 'standard',
        blastRadius: 'invented',
        bounds,
      }),
    ).toThrow(/blast radius must be one of/);
  });

  it('accepts every blast radius the repository actually defines', () => {
    for (const id of allRadii()) {
      expect(
        startTask(emptyLedger(), {
          task: 't',
          risk: 'low',
          tier: 'fast',
          blastRadius: id,
          bounds,
        }).blastRadius,
      ).toBe(id);
    }
  });

  it('binds the round bound to the tier', () => {
    const fast = startTask(emptyLedger(), {
      task: 't',
      risk: 'low',
      tier: 'fast',
      blastRadius: 'local',
      bounds,
    });
    const deep = startTask(emptyLedger(), {
      task: 't',
      risk: 'high',
      tier: 'deep',
      blastRadius: 'persistent',
      bounds,
    });
    expect(fast.bound).toBe(bounds.fast);
    expect(deep.bound).toBe(bounds.deep);
    expect(deep.round).toBe(1);
  });
});

describe('recording a gate', () => {
  it('refuses when no task is open', () => {
    expect(() =>
      recordGate(emptyLedger(), { gate: 'lint', outcome: 'pass', evidence: 'x', signature: SIG }),
    ).toThrow(/no task open/);
  });

  it('refuses a passing gate with no evidence', () => {
    expect(() =>
      recordGate(open(), { gate: 'lint', outcome: 'pass', evidence: '', signature: SIG }),
    ).toThrow(/passing gate requires --evidence/);
  });

  it('accepts a failing gate with no evidence, because honest recording must work', () => {
    const { entry } = recordGate(open(), { gate: 'lint', outcome: 'fail', signature: SIG });
    expect(entry.outcome).toBe('fail');
  });

  it('refuses an outcome outside pass and fail', () => {
    expect(() =>
      recordGate(open(), { gate: 'lint', outcome: 'ok', evidence: 'x', signature: SIG }),
    ).toThrow(/outcome must be/);
  });

  it('keeps one row per gate so history lives in the round, not in duplicates', () => {
    const first = recordGate(open(), { gate: 'lint', outcome: 'fail', signature: SIG });
    const second = recordGate(first.ledger, {
      gate: 'lint',
      outcome: 'pass',
      evidence: 'clean',
      signature: SIG,
    });
    expect(second.ledger.gates).toHaveLength(1);
    expect(second.ledger.gates[0].outcome).toBe('pass');
  });
});

describe('a result belongs to the tree it was taken at', () => {
  it('reports a gate stale once the workspace changes', () => {
    const ledger = withGates(open(), [{ gate: 'lint' }]);
    expect(canSkip(ledger, 'lint', SIG).skippable).toBe(true);
    const stale = canSkip(ledger, 'lint', OTHER);
    expect(stale.skippable).toBe(false);
    expect(stale.reason).toMatch(/stale/);
  });

  it('never lets a failed gate be skipped, even at the identical signature', () => {
    const ledger = withGates(open(), [{ gate: 'lint', outcome: 'fail' }]);
    const result = canSkip(ledger, 'lint', SIG);
    expect(result.skippable).toBe(false);
    expect(result.reason).toMatch(/do not re-declare it/);
  });

  it('never lets a gate that has not run be skipped', () => {
    expect(canSkip(open(), 'lint', SIG).skippable).toBe(false);
  });

  it('treats an outcome that is neither pass nor fail as not skippable', () => {
    // A hand-edited "PASS" must not satisfy a `!== 'fail'` reading.
    const ledger = withGates(open(), [{ gate: 'lint', outcome: 'PASS' }]);
    expect(canSkip(ledger, 'lint', SIG).skippable).toBe(false);
  });
});

describe('round bounds', () => {
  it('refuses to pass the tier repair budget', () => {
    let ledger = open({ tier: 'fast' });
    for (let i = 1; i < bounds.fast; i += 1) ledger = nextRound(ledger, bounds);
    expect(() => nextRound(ledger, bounds)).toThrow(/exceeds the fast-tier repair budget/);
  });

  it('re-derives a null bound from the tier instead of running unbounded', () => {
    const ledger = nextRound(open({ tier: 'standard', bound: null }), bounds);
    expect(ledger.bound).toBe(bounds.standard);
  });

  it('falls to the strictest bound, not to unbounded, on an unrecognised tier', () => {
    // `bounds` is built from JSON and carries Object.prototype, so indexing it
    // with an unvalidated tier reached inherited members: tier "constructor"
    // yielded a function, `next > <function>` is NaN-false so nothing ever
    // bounded, and JSON.stringify then dropped the key entirely.
    const ledger = open({ tier: 'constructor', bound: null });
    const strictest = Math.min(...Object.values(bounds));
    expect(nextRound(ledger, bounds).bound).toBe(strictest);
    let walked = nextRound(ledger, bounds);
    for (let i = walked.round; i < strictest; i += 1) walked = nextRound(walked, bounds);
    expect(() => nextRound(walked, bounds)).toThrow(/unrecognised tier/);
  });

  it('refuses to advance a round with no task open', () => {
    expect(() => nextRound(emptyLedger(), bounds)).toThrow(/no task open/);
  });
});

describe('ship readiness', () => {
  const deps = {
    config,
    radii: reviewRequiringRadii(),
    reviewers: new Set(['arq-file-integrity-reviewer', 'arq-geometry-reviewer']),
    match: { matched: false, required: [], reason: 'not computed in this test', modules: [] },
  };

  it('refuses when no task is open', () => {
    expect(shipReadiness(emptyLedger(), SIG, deps).problems).toContain(
      'no task open - nothing was gated',
    );
  });

  it('refuses when nothing was gated at all', () => {
    expect(shipReadiness(open(), SIG, deps).problems.join(' ')).toContain('no gate has run');
  });

  it('is green when every configured gate passed at this tree and review is not required', () => {
    const ledger = withGates(open(), floor());
    expect(shipReadiness(ledger, SIG, deps)).toEqual({ ready: true, problems: [] });
  });

  it('refuses when only some of the configured gates were recorded', () => {
    const ledger = withGates(open(), [{ gate: 'lint' }]);
    const { ready, problems } = shipReadiness(ledger, SIG, deps);
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('never recorded as passing at this workspace');
  });

  it('refuses when a recorded gate went stale, and says both things', () => {
    // Both problems matter: the stale-signature rule alone would also fire on a
    // ledger whose floor was complete, so asserting only "not ready" would pin
    // nothing about the floor.
    const ledger = withGates(open(), floor(OTHER));
    const { problems } = shipReadiness(ledger, SIG, deps);
    expect(problems.join(' ')).toContain('passed against an older workspace');
    expect(problems.join(' ')).toContain('never recorded as passing at this workspace');
  });

  it('refuses an outcome that is not exactly "pass"', () => {
    // `=== 'fail'` in one place and `=== 'pass'` in others let a hand-edited
    // "PASS" satisfy every check by failing the fail check.
    const ledger = withGates(open(), [...floor(), { gate: 'extra', outcome: 'PASS' }]);
    const { ready, problems } = shipReadiness(ledger, SIG, deps);
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('extra is not passing');
  });

  it('will not let a recorded review stand in for the unconditional gates', () => {
    // record --gate review:<agent> --outcome pass, then ship, was two commands
    // to green at the highest risk tier.
    const ledger = withGates(open({ risk: 'high' }), [{ gate: 'review:arq-geometry-reviewer' }]);
    const { ready, problems } = shipReadiness(ledger, SIG, deps);
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('never recorded as passing at this workspace');
  });
});

describe('the review gate', () => {
  const base = {
    config,
    radii: reviewRequiringRadii(),
    reviewers: new Set(['arq-file-integrity-reviewer', 'arq-geometry-reviewer']),
  };
  const unmatched = {
    ...base,
    match: { matched: false, required: [], reason: 'no base ref', modules: [] },
  };
  const matched = {
    ...base,
    match: {
      matched: true,
      required: ['arq-file-integrity-reviewer'],
      reason: 'changed paths route to arqfs',
      modules: ['arqfs'],
    },
  };

  it('is required at high risk even when the blast radius is local', () => {
    expect(reviewRequired({ risk: 'high', blastRadius: 'local' }, base)).toBe(true);
  });

  it('is required by blast radius even at low risk', () => {
    expect(reviewRequired({ risk: 'low', blastRadius: 'production' }, base)).toBe(true);
    expect(reviewRequired({ risk: 'low', blastRadius: 'local' }, base)).toBe(false);
  });

  it('fails closed when the blast radius table cannot be read', () => {
    // An unreadable rule must not become a waiver.
    expect(reviewRequired({ risk: 'low', blastRadius: 'local' }, { ...base, radii: null })).toBe(
      true,
    );
  });

  it('fails closed when the ledger carries no blast radius at all', () => {
    // start refuses to create one, but the ledger is plain hand-editable JSON,
    // and "the axis is absent" is not evidence that the axis is safe.
    expect(reviewRequired({ risk: 'moderate', blastRadius: null }, base)).toBe(true);
    expect(reviewRequired({ risk: 'low' }, base)).toBe(true);
  });

  it('refuses when review is required and none was recorded', () => {
    const ledger = withGates(open({ risk: 'high' }), floor());
    const { ready, problems } = shipReadiness(ledger, SIG, unmatched);
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('requires independent review and none was recorded');
  });

  it('refuses a reviewer name that no dispatchable agent could ever have run', () => {
    const ledger = withGates(open({ risk: 'high' }), [
      ...floor(),
      { gate: 'review:me-the-author' },
    ]);
    const { ready, problems } = shipReadiness(ledger, SIG, unmatched);
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('names no dispatchable agent');
  });

  it('accepts a passing review by a dispatchable agent when no match can be computed', () => {
    const ledger = withGates(open({ risk: 'high' }), [
      ...floor(),
      { gate: 'review:arq-geometry-reviewer' },
    ]);
    expect(shipReadiness(ledger, SIG, unmatched)).toEqual({ ready: true, problems: [] });
  });

  it('refuses a real agent that the changed paths do not call for', () => {
    // The match check: any dispatchable agent used to satisfy the gate, so a
    // reviewer with no bearing on the diff cleared it.
    const ledger = withGates(open({ risk: 'high' }), [
      ...floor(),
      { gate: 'review:arq-geometry-reviewer' },
    ]);
    const { ready, problems } = shipReadiness(ledger, SIG, matched);
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('not one the changed paths call for');
    expect(problems.join(' ')).toContain('arq-file-integrity-reviewer');
  });

  it('accepts the reviewer the changed paths do call for', () => {
    const ledger = withGates(open({ risk: 'high' }), [
      ...floor(),
      { gate: 'review:arq-file-integrity-reviewer' },
    ]);
    expect(shipReadiness(ledger, SIG, matched)).toEqual({ ready: true, problems: [] });
  });

  it('refuses a review of an older workspace', () => {
    const ledger = withGates(open({ risk: 'high' }), [
      ...floor(),
      { gate: 'review:arq-geometry-reviewer', signature: OTHER },
    ]);
    const { problems } = shipReadiness(ledger, SIG, unmatched);
    expect(problems.join(' ')).toContain('reviewed an older workspace');
  });

  it('does not let one typo bury a genuine review that passed', () => {
    // Gates dedupe by name, so a bad row cannot be removed; reporting every
    // unrecognised reviewer unconditionally bricked the ledger for good, and
    // the only escape discarded the genuine review too.
    const ledger = withGates(open({ risk: 'high' }), [
      ...floor(),
      { gate: 'review:arq-geometry-reviewr' },
      { gate: 'review:arq-geometry-reviewer' },
    ]);
    expect(shipReadiness(ledger, SIG, unmatched)).toEqual({ ready: true, problems: [] });
  });

  it('reports a manifest reviewer that is not dispatchable', () => {
    const ledger = withGates(open({ risk: 'high' }), [
      ...floor(),
      { gate: 'review:arq-geometry-reviewer' },
    ]);
    const { ready, problems } = shipReadiness(ledger, SIG, {
      ...unmatched,
      match: { ...unmatched.match, unknownReviewers: ['arq-ghost-reviewer'] },
    });
    expect(ready).toBe(false);
    expect(problems.join(' ')).toContain('not dispatchable: arq-ghost-reviewer');
  });
});

describe('persistence', () => {
  it('returns an empty ledger for a missing or blank file', () => {
    expect(loadLedger(join(dir, 'absent.json')).gates).toEqual([]);
    writeFileSync(path, '  \n');
    expect(loadLedger(path).gates).toEqual([]);
  });

  it('refuses a file that is not a ledger rather than starting fresh', () => {
    writeFileSync(path, JSON.stringify({ version: 1 }));
    expect(() => loadLedger(path)).toThrow(/not a Zeus gate ledger/);
  });

  it('writes through a temporary file and leaves none behind', () => {
    saveLedger(withGates(open(), floor()), path);
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
    expect(JSON.parse(readFileSync(path, 'utf8')).gates).toHaveLength(
      config.repositoryGates.length,
    );
  });
});
