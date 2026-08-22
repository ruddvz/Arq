// Zeus 5 reviewer match: which reviewer the CHANGED PATHS actually call for.
//
// This is the check the integration package this work is based on named as its
// largest unclosed gap ("a name check, not a match check"). Everything here is
// driven off .zeus/impact-map.json and .zeus/module-manifest.json on disk, so a
// new module or a renamed reviewer is covered without editing this file.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { requiredReviewers, resolveBase, reviewersForPaths } from './zeus-reviewer-match.mjs';
import { agentRegistry } from './zeus-agent-registry.mjs';

describe('against this repository', () => {
  it('routes a persistence path to the file integrity reviewer', () => {
    const { modules, reviewers } = reviewersForPaths(['packages/arqfs/src/open.ts']);
    expect(modules).toContain('arqfs');
    expect(reviewers).toContain('arq-file-integrity-reviewer');
  });

  it('routes a geometry path to the geometry reviewer', () => {
    expect(reviewersForPaths(['packages/geometry-core/src/wall.ts']).reviewers).toContain(
      'arq-geometry-reviewer',
    );
  });

  it('accumulates every reviewer a mixed diff calls for', () => {
    const { reviewers } = reviewersForPaths([
      'packages/arqfs/src/open.ts',
      'packages/geometry-core/src/wall.ts',
    ]);
    expect(reviewers).toContain('arq-file-integrity-reviewer');
    expect(reviewers).toContain('arq-geometry-reviewer');
  });

  it('names no reviewer for a path that touches no module', () => {
    expect(reviewersForPaths(['docs/some-note.md']).reviewers).toEqual([]);
  });

  it('only ever names an agent that is dispatchable on disk', () => {
    const { dispatchable } = agentRegistry();
    const { reviewers } = reviewersForPaths([
      'packages/arqfs/src/open.ts',
      'packages/geometry-core/src/wall.ts',
      'apps/web/src/main.ts',
    ]);
    for (const r of reviewers) expect(dispatchable.has(r)).toBe(true);
  });

  it('reports "not matched" when no path changed, rather than "no review needed"', () => {
    const result = requiredReviewers({ paths: [] });
    expect(result.matched).toBe(false);
    expect(result.reason).toContain('no changed paths');
  });

  it('reports "not matched" when the paths route to no reviewer', () => {
    const result = requiredReviewers({ paths: ['docs/some-note.md'] });
    expect(result.matched).toBe(false);
    expect(result.required).toEqual([]);
  });

  it('is matched when supplied paths do route to a reviewer', () => {
    // `**/*arqfs*/**` routes to arqfs AND security, so the required set is the
    // union of both modules' reviewers. Asserted as the exact set, not merely
    // "contains", so a module losing a reviewer is visible here.
    const result = requiredReviewers({ paths: ['packages/arqfs/src/open.ts'] });
    expect(result.matched).toBe(true);
    expect(result.modules).toEqual(['arqfs', 'security']);
    expect(result.required).toEqual(['arq-file-integrity-reviewer', 'arq-security-ai-reviewer']);
  });
});

describe('against a fixture repository', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'zeus-match-'));
    mkdirSync(join(root, '.zeus'), { recursive: true });
    mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
    writeFileSync(
      join(root, '.zeus', 'impact-map.json'),
      JSON.stringify({
        patterns: [
          { glob: 'src/store/**', modules: ['storage'], checks: [], risk: 'high' },
          { glob: 'src/paint/**', modules: ['ghosted'], checks: [], risk: 'low' },
        ],
      }),
    );
    writeFileSync(
      join(root, '.zeus', 'module-manifest.json'),
      JSON.stringify({
        modules: [
          { id: 'storage', reviewers: ['real-reviewer'] },
          { id: 'ghosted', reviewers: ['absent-reviewer'] },
        ],
      }),
    );
    writeFileSync(
      join(root, '.claude', 'agents', 'real-reviewer.md'),
      '---\nname: real-reviewer\ndescription: Reviews storage.\n---\nbody\n',
    );
    // No description frontmatter: present on disk but not dispatchable.
    writeFileSync(
      join(root, '.claude', 'agents', 'absent-reviewer.md'),
      '# Notes\n\ntask_description: not an agent\n',
    );
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('names a reviewer the manifest declares and disk can dispatch', () => {
    expect(reviewersForPaths(['src/store/db.ts'], root).reviewers).toEqual(['real-reviewer']);
  });

  it('reports a manifest reviewer that is not dispatchable instead of dropping it', () => {
    // Dropping it would quietly shrink the required set, which is the same
    // fail-open as not matching at all.
    const result = reviewersForPaths(['src/paint/brush.ts'], root);
    expect(result.reviewers).toEqual([]);
    expect(result.unknownReviewers).toEqual(['absent-reviewer']);
  });
});

describe('base resolution', () => {
  it('refuses a base that does not resolve to a commit', () => {
    const { base, reason } = resolveBase(process.cwd(), 'not-a-real-ref-xyz');
    expect(base).toBeNull();
    expect(reason).toContain('does not resolve to a commit');
  });

  it('accepts a base that does resolve', () => {
    expect(resolveBase(process.cwd(), 'HEAD').base).toBe('HEAD');
  });
});
