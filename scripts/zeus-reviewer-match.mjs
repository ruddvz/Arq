#!/usr/bin/env node
// Zeus 5: which reviewer agents the CHANGED PATHS actually call for.
//
// The integration package this work is based on discloses, as its largest
// unclosed gap, that its review gate is "a name check, not a match check": any
// dispatchable agent satisfied it, including a read-only search agent, because
// nothing computed which reviewer a given diff requires. It names a
// path-glob-to-reviewer map as the fix and says it was not built.
//
// Arq already has that map, in two files `scripts/zeus-validate.mjs` already
// keeps honest:
//   .zeus/impact-map.json      path glob  -> module ids
//   .zeus/module-manifest.json module id  -> reviewer agent names
// So the gate here can require a reviewer the diff actually calls for. Nothing
// new is invented; both files are read off disk, per `.zeus/INVARIANTS.md`.
//
// Fail closed, never open. Every path that cannot be resolved (no base ref, no
// git, no pattern matched) returns `matched: false` with a stated reason, and
// the caller must then demand a real reviewer anyway rather than concluding
// that no review was needed. "Nothing matched" is not "nothing to review".

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { globToRe } from './lib/zeus-engine.mjs';
import { agentRegistry } from './zeus-agent-registry.mjs';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

const git = (root, args) =>
  spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/**
 * The base this branch is measured against: the branch the work will merge INTO,
 * not the branch it was pushed to. Committing work must not empty the
 * changed-path set, because a check that only ever looked at the working tree
 * would require no reviewer at all the moment the author ran `git commit`.
 *
 * The ordering matters and was got wrong once. Preferring `@{upstream}` looks
 * right and is not: on a pushed feature branch the upstream is
 * `origin/<that same branch>`, so `base...HEAD` is EMPTY and every changed path
 * disappears the moment the branch is pushed. That is the same fail-open one
 * step later. A tracking ref that is this branch's own remote copy is therefore
 * refused as a base.
 *
 * @returns {{base: string|null, reason: string}}
 */
export function resolveBase(root = process.cwd(), explicit = null) {
  if (explicit) {
    const ok = git(root, ['rev-parse', '--verify', '--quiet', `${explicit}^{commit}`]);
    if (ok.status === 0) return { base: explicit, reason: 'base given explicitly' };
    return { base: null, reason: `base "${explicit}" does not resolve to a commit` };
  }
  const originHead = git(root, ['symbolic-ref', '--short', '--quiet', 'refs/remotes/origin/HEAD']);
  if (originHead.status === 0 && originHead.stdout.trim()) {
    return { base: originHead.stdout.trim(), reason: 'origin/HEAD, the default branch' };
  }
  const upstream = git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (upstream.status === 0 && upstream.stdout.trim()) {
    const ref = upstream.stdout.trim();
    const own = branch.status === 0 ? branch.stdout.trim() : null;
    if (own && ref.endsWith(`/${own}`)) {
      return {
        base: null,
        reason: `the tracking branch is this branch's own remote copy (${ref}), which measures nothing, and origin/HEAD is not set`,
      };
    }
    return { base: ref, reason: 'tracking branch' };
  }
  return { base: null, reason: 'no usable base: no origin/HEAD and no tracking branch' };
}

/**
 * Working-tree changes plus everything this branch already committed on top of
 * its base. Union, deliberately: either half alone has a hole.
 * @returns {{paths: string[], base: string|null, baseReason: string, complete: boolean}}
 */
export function changedPaths(root = process.cwd(), explicitBase = null) {
  const paths = new Set();
  let complete = true;

  const status = git(root, ['status', '--porcelain']);
  if (status.status === 0) {
    for (const line of (status.stdout ?? '').split('\n')) {
      if (!line.trim()) continue;
      // Porcelain v1: two status columns, a space, then the path. A rename
      // carries "old -> new"; both halves are changed paths.
      const rest = line.slice(3).trim();
      for (const part of rest.split(' -> ')) {
        const p = part.replace(/^"|"$/g, '').trim();
        if (p) paths.add(p);
      }
    }
  } else {
    complete = false;
  }

  const { base, reason } = resolveBase(root, explicitBase);
  if (base) {
    const diff = git(root, ['diff', '--name-only', `${base}...HEAD`]);
    if (diff.status === 0) {
      for (const p of (diff.stdout ?? '').split('\n')) if (p.trim()) paths.add(p.trim());
    } else {
      complete = false;
    }
  } else {
    complete = false;
  }

  return { paths: [...paths].sort(), base, baseReason: reason, complete };
}

/**
 * @param {string[]} paths
 * @returns {{modules: string[], reviewers: string[], unknownReviewers: string[]}}
 */
export function reviewersForPaths(paths, root = packageRoot) {
  const map = JSON.parse(readFileSync(join(root, '.zeus', 'impact-map.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(join(root, '.zeus', 'module-manifest.json'), 'utf8'));
  const modules = new Set();
  for (const f of paths) {
    for (const p of map.patterns ?? []) {
      if (globToRe(p.glob).test(f)) for (const m of p.modules ?? []) modules.add(m);
    }
  }
  const { dispatchable } = agentRegistry(join(root, '.claude', 'agents'));
  const reviewers = new Set();
  const unknownReviewers = new Set();
  for (const id of modules) {
    const module = (manifest.modules ?? []).find((m) => m.id === id);
    for (const r of module?.reviewers ?? []) {
      // A reviewer the manifest names but disk cannot dispatch is reported, never
      // silently dropped: dropping it would quietly shrink the required set,
      // which is the same fail-open as not matching at all.
      if (dispatchable.has(r)) reviewers.add(r);
      else unknownReviewers.add(r);
    }
  }
  return {
    modules: [...modules].sort(),
    reviewers: [...reviewers].sort(),
    unknownReviewers: [...unknownReviewers].sort(),
  };
}

/**
 * The whole question in one call: what does this working tree require?
 * @returns {{required: string[], modules: string[], paths: string[], matched: boolean,
 *            reason: string, base: string|null, unknownReviewers: string[]}}
 */
export function requiredReviewers({ root = process.cwd(), base = null, paths = null } = {}) {
  let list = paths;
  let complete = true;
  let resolvedBase = null;
  let baseReason = 'paths supplied by the caller';
  if (!list) {
    const found = changedPaths(root, base);
    list = found.paths;
    complete = found.complete;
    resolvedBase = found.base;
    baseReason = found.baseReason;
  }
  const { modules, reviewers, unknownReviewers } = reviewersForPaths(list);
  let reason;
  if (!complete) reason = `changed paths are incomplete (${baseReason})`;
  else if (!list.length) reason = 'no changed paths detected';
  else if (!reviewers.length) reason = 'changed paths match no module that names a reviewer';
  else reason = `changed paths route to ${modules.join(', ')}`;
  return {
    required: reviewers,
    modules,
    paths: list,
    // `matched` means "this set is a trustworthy statement of what the diff
    // needs". Anything else must make the caller stricter, not looser.
    matched: complete && list.length > 0 && reviewers.length > 0,
    reason,
    base: resolvedBase,
    unknownReviewers,
  };
}
