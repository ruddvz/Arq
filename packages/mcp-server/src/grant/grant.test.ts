import { describe, expect, it } from 'vitest';
import { createControlledClock } from '../runtime/clock';
import { isArqMcpError } from '../domain/errors';
import {
  MAX_GRANT_LIFETIME_MS,
  createGrant,
  describeGrant,
  grantCoversProject,
  grantState,
  requireProjectAccess,
  requireScope,
  revokeGrant,
} from './grant';
import { ARQ_MCP_SCOPES, GRANT_PRESETS, TOOL_SCOPES, isArqMcpScope, toolScope } from './scopes';

const base = {
  grantId: 'grant-1',
  subjectId: 'subject-1',
  tenantId: 'tenant-1',
  clientName: 'claude-code',
  clientVersion: '1.0.0',
  issuedAtEpochMs: 1_000,
  lifetimeMs: 60_000,
};

function grantFor(scopes: readonly string[], projectIds: readonly string[] = ['project-a']) {
  return createGrant({
    ...base,
    scopes: scopes.filter(isArqMcpScope),
    projectIds,
  });
}

describe('grant construction', () => {
  it('normalises scopes and projects so equal permissions have equal shape', () => {
    const grant = grantFor(
      ['arq.projects.read', 'arq.capabilities.read', 'arq.projects.read'],
      ['project-b', 'project-a', 'project-b'],
    );
    expect(grant.scopes).toEqual(['arq.capabilities.read', 'arq.projects.read']);
    expect(grant.projectIds).toEqual(['project-a', 'project-b']);
  });

  it('refuses an unbounded or over-long lifetime', () => {
    expect(() => createGrant({ ...base, lifetimeMs: 0, scopes: [], projectIds: [] })).toThrow(
      RangeError,
    );
    expect(() =>
      createGrant({ ...base, lifetimeMs: MAX_GRANT_LIFETIME_MS + 1, scopes: [], projectIds: [] }),
    ).toThrow(RangeError);
  });

  it('refuses a scope that is not in the vocabulary', () => {
    expect(() =>
      createGrant({
        ...base,
        scopes: ['arq.everything' as never],
        projectIds: [],
      }),
    ).toThrow(RangeError);
  });

  it('allows a grant that covers no project', () => {
    const grant = grantFor(['arq.capabilities.read'], []);
    expect(grant.projectIds).toEqual([]);
    expect(grantCoversProject(grant, 'project-a')).toBe(false);
  });
});

describe('grant lifetime', () => {
  it('dies at the instant it names, not after it', () => {
    const clock = createControlledClock(1_000);
    const grant = grantFor(['arq.projects.read']);
    expect(grantState(grant, clock.now)).toBe('active');
    clock.set(grant.expiresAtEpochMs - 1);
    expect(grantState(grant, clock.now)).toBe('active');
    clock.advance(1);
    expect(grantState(grant, clock.now)).toBe('expired');
  });

  it('reports revocation ahead of expiry', () => {
    const clock = createControlledClock(1_000);
    const revoked = revokeGrant(grantFor(['arq.projects.read']));
    clock.set(revoked.expiresAtEpochMs + 1000);
    expect(grantState(revoked, clock.now)).toBe('revoked');
  });
});

describe('scope enforcement', () => {
  it('lets a granted scope through and refuses an ungranted one', () => {
    const clock = createControlledClock(1_000);
    const grant = grantFor(['arq.projects.read']);
    expect(() => requireScope(grant, 'arq.projects.read', clock.now)).not.toThrow();
    try {
      requireScope(grant, 'arq.changes.stage', clock.now);
      expect.unreachable('an ungranted scope must be refused');
    } catch (error) {
      expect(isArqMcpError(error)).toBe(true);
      if (isArqMcpError(error)) {
        expect(error.code).toBe('ARQ_SCOPE_MISSING');
        expect(error.retry).toBe('after_grant_renewal');
      }
    }
  });

  it('checks liveness before scope, so an expired grant is not reported as a scope problem', () => {
    const clock = createControlledClock(1_000);
    const grant = grantFor(['arq.projects.read']);
    clock.set(grant.expiresAtEpochMs);
    try {
      requireScope(grant, 'arq.changes.stage', clock.now);
      expect.unreachable('an expired grant must be refused');
    } catch (error) {
      if (isArqMcpError(error)) {
        expect(error.code).toBe('ARQ_GRANT_EXPIRED');
      }
    }
  });
});

describe('project isolation', () => {
  it('gives the same answer for an ungranted project and one that does not exist', () => {
    const clock = createControlledClock(1_000);
    const grant = grantFor(['arq.projects.read'], ['project-a']);
    const errors: string[] = [];
    for (const projectId of ['project-b', 'project-does-not-exist', 'project-é']) {
      try {
        requireProjectAccess(grant, projectId, clock.now);
        expect.unreachable('an ungranted project must be refused');
      } catch (error) {
        if (isArqMcpError(error)) {
          errors.push(`${error.code}|${error.state}|${error.message}`);
        }
      }
    }
    expect(new Set(errors).size).toBe(1);
    expect(errors[0]).toContain('ARQ_PROJECT_NOT_AVAILABLE');
  });
});

describe('operator-facing description', () => {
  it('names the client and the count, never the grant, subject or tenant', () => {
    const clock = createControlledClock(1_000);
    const grant = grantFor(['arq.projects.read'], ['project-a', 'project-b']);
    const text = describeGrant(grant, clock.now);
    expect(text).toContain('2 projects');
    expect(text).toContain('claude-code');
    expect(text).not.toContain(grant.grantId);
    expect(text).not.toContain(grant.subjectId);
    expect(text).not.toContain(grant.tenantId);
  });

  it('states withdrawal and expiry plainly', () => {
    const clock = createControlledClock(1_000);
    expect(describeGrant(revokeGrant(grantFor([])), clock.now)).toContain('withdrawn');
    const grant = grantFor([]);
    clock.set(grant.expiresAtEpochMs);
    expect(describeGrant(grant, clock.now)).toContain('expired');
  });
});

describe('the tool-to-scope map', () => {
  it('guards every tool', () => {
    for (const [tool, scope] of Object.entries(TOOL_SCOPES)) {
      expect(isArqMcpScope(scope)).toBe(true);
      expect(toolScope(tool as keyof typeof TOOL_SCOPES)).toBe(scope);
    }
  });

  it('never asks a read tool for a write scope', () => {
    const writeScopes = new Set([
      'arq.plans.write',
      'arq.changes.stage',
      'arq.changes.review_request',
      'arq.project.draft_create',
      'arq.project.open_request',
      'arq.publish.request',
      'arq.undo.request',
    ]);
    for (const [tool, scope] of Object.entries(TOOL_SCOPES)) {
      const reads = tool.startsWith('arq_get') || tool.startsWith('arq_list');
      if (reads) {
        expect(writeScopes.has(scope)).toBe(false);
      }
    }
  });

  it('has presets that are strictly nested', () => {
    const readOnly = new Set<string>(GRANT_PRESETS.read_only);
    const plan = new Set<string>(GRANT_PRESETS.plan);
    const propose = new Set<string>(GRANT_PRESETS.propose);
    for (const scope of readOnly) {
      expect(plan.has(scope)).toBe(true);
    }
    for (const scope of plan) {
      expect(propose.has(scope)).toBe(true);
    }
  });

  it('grants no scope that no tool uses', () => {
    const used = new Set<string>(Object.values(TOOL_SCOPES));
    for (const scope of ARQ_MCP_SCOPES) {
      expect(used.has(scope)).toBe(true);
    }
  });

  it('exposes no tool that commits, approves, opens a path or runs a query language', () => {
    const names = Object.keys(TOOL_SCOPES).join(' ');
    for (const forbidden of ['commit', 'approve', 'path', 'sql', 'execute', 'eval']) {
      expect(names).not.toContain(forbidden);
    }
  });
});
