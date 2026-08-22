#!/usr/bin/env node
// Zeus 5 plan ledger: the work items, and the refusal to call a plan done while
// any of them is unproven.
//
// Zeus already answered three questions and not this one:
//   scripts/zeus-evidence.mjs   what does each CLAIM rest on
//   scripts/zeus-gate-ledger.mjs which CHECKS passed, at which tree
//   scripts/zeus-run-state.mjs   where the work is in the DELIVERY pipeline
// None of them holds the list of work the plan actually contains, so "the plan
// is implemented" was a memory in exactly the way "verified" used to be. An
// operator who asks for six things and gets four has no artifact that says so.
//
// Four rules carry the weight:
//   1. An item is done only with a command and its exit code. A done item with
//      no evidence is the claim-without-a-check this repository exists to stop.
//   2. `close` refuses while ANY item is pending, active or blocked, and names
//      them. That refusal is the loop: it is what keeps work going until the
//      plan is finished rather than until the agent feels finished.
//   3. Every item names an owning role that exists in .zeus/role-registry.json,
//      so the org chart reaches the work instead of describing it.
//   4. Evidence carries the workspace fingerprint it was taken at, so an item
//      proven against an older tree is visible as such rather than silently
//      counted.
//
// What it does NOT do, stated plainly: it does not execute anything, and it
// cannot tell a true command result from a typed one. It records a claim about
// an item, not the item. That is the same honest limit the gate ledger carries.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { roleRegistry } from './lib/zeus-engine.mjs';
import { workspaceSignature } from './zeus-gate-ledger.mjs';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

const STATES = new Set(['pending', 'active', 'done', 'blocked']);
/** States that mean the item is not finished. `close` refuses on any of them. */
const UNFINISHED = ['pending', 'active', 'blocked'];

export function planConfig(root = packageRoot) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(root, '.zeus', 'config.json'), 'utf8'));
  } catch (error) {
    throw new Error(`cannot read .zeus/config.json - ${error.message}`);
  }
  const p = raw.plan;
  if (!p || typeof p !== 'object') throw new Error('.zeus/config.json has no "plan" block');
  for (const key of ['maxItems', 'maxTitleChars', 'maxAcceptanceChars']) {
    if (!Number.isInteger(p[key]) || p[key] < 1) {
      throw new Error(`.zeus/config.json plan.${key} is not a positive integer`);
    }
  }
  if (typeof p.store !== 'string' || !p.store.trim()) {
    throw new Error('.zeus/config.json plan.store is not a path');
  }
  return p;
}

export function planPath(root = packageRoot) {
  const override = (process.env.ZEUS_PLAN_LEDGER ?? '').trim();
  return override || join(root, planConfig(root).store);
}

/** Roles read off disk, so an item cannot be assigned to somebody who does not exist. */
export function knownRoles() {
  return new Set((roleRegistry.roles ?? []).map((r) => r.id));
}

const now = () => new Date().toISOString();

export function emptyPlan() {
  return { version: 1, task: null, items: [], createdAt: null };
}

export function loadPlan(path = planPath()) {
  if (!existsSync(path)) return emptyPlan();
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return emptyPlan();
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.items)) throw new Error(`${path}: not a Zeus plan ledger`);
  parsed.items.forEach((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`${path}: item ${i} is not an object`);
    for (const field of ['id', 'title', 'state']) {
      if (typeof item[field] !== 'string' || !item[field]) {
        throw new Error(`${path}: item ${i} ("${item.id ?? 'no id'}") is missing ${field}`);
      }
    }
    if (!STATES.has(item.state)) {
      throw new Error(`${path}: item "${item.id}" has unknown state "${item.state}"`);
    }
  });
  return parsed;
}

export function savePlan(plan, path = planPath()) {
  mkdirSync(dirname(path), { recursive: true });
  // Write-then-rename, for the same reason as the other two stores: an
  // interrupted in-place write truncates the file and loadPlan then refuses it,
  // losing the whole plan.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
  return plan;
}

export function openPlan(plan, { task }) {
  if (!task) throw new Error('open requires --task "<what the operator asked for>"');
  return { ...emptyPlan(), task, createdAt: now() };
}

export function addItem(plan, { id, title, owner, acceptance, dependsOn = [], config, roles }) {
  const cfg = config ?? planConfig();
  const known = roles ?? knownRoles();
  if (!plan.task) throw new Error('no plan open - run: pnpm zeus:plan open --task "..."');
  if (!title) throw new Error('add requires --title');
  if (title.length > cfg.maxTitleChars) throw new Error(`title <=${cfg.maxTitleChars} chars`);
  // Acceptance is mandatory. An item with no statement of what "done" means
  // cannot be closed honestly, and a plan of those is a wish list.
  if (!acceptance) throw new Error('add requires --acceptance (how anyone can tell it is done)');
  if (acceptance.length > cfg.maxAcceptanceChars) {
    throw new Error(`acceptance <=${cfg.maxAcceptanceChars} chars`);
  }
  if (!known.has(owner)) {
    throw new Error(
      `owner must be a role in .zeus/role-registry.json (${[...known].sort().join(', ')})`,
    );
  }
  if (plan.items.length >= cfg.maxItems) {
    throw new Error(`plan is full (${cfg.maxItems} items) - split it rather than growing it`);
  }
  const itemId = id || `i${plan.items.length + 1}`;
  if (plan.items.some((x) => x.id === itemId)) throw new Error(`item "${itemId}" already exists`);
  for (const dep of dependsOn) {
    if (!plan.items.some((x) => x.id === dep))
      throw new Error(`dependsOn names unknown item "${dep}"`);
  }
  const item = {
    id: itemId,
    title,
    owner,
    acceptance,
    dependsOn,
    state: 'pending',
    createdAt: now(),
  };
  return { plan: { ...plan, items: [...plan.items, item] }, item };
}

const find = (plan, id) => {
  const item = plan.items.find((x) => x.id === id);
  if (!item) throw new Error(`no item "${id}"`);
  return item;
};

/**
 * The next item that can actually be worked: pending, with every dependency
 * done. Returns null when nothing is workable, which is a different fact from
 * "the plan is finished" and is reported as such.
 */
export function nextItem(plan) {
  const done = new Set(plan.items.filter((x) => x.state === 'done').map((x) => x.id));
  const active = plan.items.find((x) => x.state === 'active');
  if (active) return active;
  return (
    plan.items.find(
      (x) => x.state === 'pending' && (x.dependsOn ?? []).every((d) => done.has(d)),
    ) ?? null
  );
}

export function startItem(plan, id) {
  const item = find(plan, id);
  if (item.state === 'done') throw new Error(`"${id}" is already done`);
  const done = new Set(plan.items.filter((x) => x.state === 'done').map((x) => x.id));
  const waiting = (item.dependsOn ?? []).filter((d) => !done.has(d));
  if (waiting.length)
    throw new Error(`"${id}" depends on ${waiting.join(', ')}, which are not done`);
  item.state = 'active';
  item.startedAt = now();
  delete item.blockedReason;
  return plan;
}

export function completeItem(plan, { id, command, exitCode, signature }) {
  const item = find(plan, id);
  // The whole point. "done" with no command is exactly the memory this ledger
  // replaces, and an item completed on a non-zero exit is not completed.
  if (!command) throw new Error(`done "${id}" requires --command (what proves it)`);
  if (!Number.isInteger(exitCode)) throw new Error(`done "${id}" requires an integer --exit`);
  if (exitCode !== 0) {
    throw new Error(
      `done "${id}": the command exited ${exitCode}, so it did not prove the item. ` +
        'Record it with `block` and the reason, or fix it and re-run.',
    );
  }
  item.state = 'done';
  item.completedAt = now();
  item.evidence = { command, exitCode, signature, recordedAt: now() };
  delete item.blockedReason;
  return plan;
}

export function blockItem(plan, { id, reason }) {
  const item = find(plan, id);
  if (!reason) throw new Error(`block "${id}" requires --reason`);
  item.state = 'blocked';
  item.blockedReason = reason;
  item.blockedAt = now();
  return plan;
}

/**
 * Whether the plan may be closed. Green requires every item done. Anything else
 * is named rather than rounded away.
 */
export function closeReadiness(plan, signature) {
  const problems = [];
  if (!plan.task) return { ready: false, problems: ['no plan open - nothing was planned'] };
  if (!plan.items.length) {
    problems.push('the plan has no items, so "implemented" would describe nothing');
  }
  for (const state of UNFINISHED) {
    for (const item of plan.items.filter((x) => x.state === state)) {
      problems.push(
        `${item.id} is ${state}: ${item.title}${item.blockedReason ? ` (${item.blockedReason})` : ''}`,
      );
    }
  }
  // A done item proven against a different tree is still reported. It is weaker
  // than not-done, so it is a warning inside the same list rather than a silent pass.
  for (const item of plan.items.filter((x) => x.state === 'done')) {
    if (!item.evidence?.command) {
      problems.push(`${item.id} is done with no recorded command, which is a claim, not a result`);
    } else if (signature && item.evidence.signature && item.evidence.signature !== signature) {
      problems.push(
        `${item.id} was proven against an older workspace - re-run ${item.evidence.command}`,
      );
    }
  }
  return { ready: problems.length === 0, problems };
}

/* --------------------------------- CLI ---------------------------------- */

function arg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

const USAGE = `Zeus plan ledger - the work items, and the refusal to stop while one is unproven.

Usage:
  pnpm zeus:plan open --task "<what was asked for>"
  pnpm zeus:plan add --title "..." --owner <role> --acceptance "..." [--depends i1,i2]
  pnpm zeus:plan next                    the next workable item; exit 1 when there is none
  pnpm zeus:plan start --id <id>
  pnpm zeus:plan done --id <id> --command "<what proves it>" --exit 0
  pnpm zeus:plan block --id <id> --reason "..."
  pnpm zeus:plan status
  pnpm zeus:plan close                   exit 0 only when every item is done
  pnpm zeus:plan clear --yes             discards the plan

An item is done only with a command and a zero exit code. close refuses while
any item is pending, active or blocked, and names each one: that refusal is the
loop. Owners must be roles in .zeus/role-registry.json.

It records a claim about an item, not the item itself.`;

export function main(argv) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') {
    console.error(USAGE);
    return command ? 0 : 1;
  }
  const plan = loadPlan();

  switch (command) {
    case 'open': {
      if (plan.items.length && !args.includes('--yes')) {
        const { problems } = closeReadiness(plan, null);
        console.error(
          `a plan for "${plan.task}" already holds ${plan.items.length} item(s), ` +
            `${plan.items.filter((x) => x.state === 'done').length} done. Opening a new one discards them. ` +
            `Re-run with --yes if that is genuinely a new plan.\n  unfinished:\n  - ${problems.join('\n  - ')}`,
        );
        return 1;
      }
      savePlan(openPlan(plan, { task: arg(args, 'task') }));
      console.log(`plan open: "${arg(args, 'task')}"`);
      return 0;
    }
    case 'add': {
      const { plan: next, item } = addItem(plan, {
        id: arg(args, 'id'),
        title: arg(args, 'title'),
        owner: arg(args, 'owner'),
        acceptance: arg(args, 'acceptance'),
        dependsOn: (arg(args, 'depends', '') || '').split(',').filter(Boolean),
      });
      savePlan(next);
      console.log(`${item.id}  ${item.title}  (${item.owner})`);
      return 0;
    }
    case 'next': {
      const item = nextItem(plan);
      if (!item) {
        const { ready } = closeReadiness(plan, null);
        console.log(
          ready
            ? 'nothing workable: every item is done, so close the plan'
            : 'nothing workable: every remaining item is blocked or waiting on a blocked dependency',
        );
        return 1;
      }
      console.log(JSON.stringify(item, null, 2));
      return 0;
    }
    case 'start': {
      savePlan(startItem(plan, arg(args, 'id')));
      console.log(`started ${arg(args, 'id')}`);
      return 0;
    }
    case 'done': {
      const exit = arg(args, 'exit');
      savePlan(
        completeItem(plan, {
          id: arg(args, 'id'),
          command: arg(args, 'command'),
          exitCode: exit === undefined ? undefined : Number(exit),
          signature: workspaceSignature(),
        }),
      );
      const remaining = plan.items.filter((x) => x.state !== 'done').length;
      console.log(
        `done ${arg(args, 'id')} - ${remaining} item(s) left${remaining ? '' : ', run: pnpm zeus:plan close'}`,
      );
      return 0;
    }
    case 'block': {
      savePlan(blockItem(plan, { id: arg(args, 'id'), reason: arg(args, 'reason') }));
      console.log(`blocked ${arg(args, 'id')} - close will refuse until it is resolved`);
      return 0;
    }
    case 'status': {
      if (!plan.task) {
        console.log('No plan open. Start one: pnpm zeus:plan open --task "..."');
        return 0;
      }
      console.log(`plan: ${plan.task}`);
      const signature = workspaceSignature();
      for (const item of plan.items) {
        const mark = { done: 'done ', active: 'ACTIVE', blocked: 'BLOCK', pending: '.....' }[
          item.state
        ];
        const stale =
          item.state === 'done' &&
          item.evidence?.signature &&
          item.evidence.signature !== signature;
        console.log(
          `  [${mark}] ${item.id.padEnd(4)} ${item.title}  (${item.owner})${stale ? '  STALE' : ''}`,
        );
        if (item.evidence?.command) console.log(`            proved by: ${item.evidence.command}`);
        if (item.blockedReason) console.log(`            blocked: ${item.blockedReason}`);
      }
      const { ready, problems } = closeReadiness(plan, signature);
      console.log(
        ready ? '\nplan: complete' : `\nplan: unfinished\n  - ${problems.join('\n  - ')}`,
      );
      return 0;
    }
    case 'close': {
      const { ready, problems } = closeReadiness(plan, workspaceSignature());
      if (ready) {
        console.log(`plan complete: ${plan.items.length} item(s), each proven by a command.`);
        return 0;
      }
      console.error('plan is NOT complete:');
      for (const p of problems) console.error(`  - ${p}`);
      console.error('\nKeep going, or say plainly what is left. Do not report this as done.');
      return 1;
    }
    case 'clear': {
      if (!args.includes('--yes')) {
        console.error(
          `clear would discard the plan for "${plan.task ?? 'no open plan'}" ` +
            `(${plan.items.length} item(s)). Re-run with --yes. Clearing is not a way to finish a plan.`,
        );
        return 1;
      }
      rmSync(planPath(), { force: true });
      console.log('plan cleared.');
      return 0;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(2);
  }
}
