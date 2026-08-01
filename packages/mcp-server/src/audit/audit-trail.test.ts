import { describe, expect, it } from 'vitest';
import { createControlledClock } from '../runtime/clock';
import { createGrant } from '../grant/grant';
import { contentDigest } from '../util/hash';
import { createAuditTrail } from './audit-trail';

function grant(grantId: string, tenantId = 'tenant-1') {
  return createGrant({
    grantId,
    subjectId: 'subject-1',
    tenantId,
    clientName: 'claude-code',
    clientVersion: '1.0.0',
    scopes: ['arq.audit.read'],
    projectIds: ['project-a'],
    issuedAtEpochMs: 0,
    lifetimeMs: 60_000,
  });
}

describe('audit trail', () => {
  it('records a fingerprint, never the request content', () => {
    const clock = createControlledClock(1_700_000_000_000);
    const trail = createAuditTrail(clock.now);
    const secretish = { objective: 'Rebuild the east wing for client Nakamura' };

    const event = trail.record({
      traceId: 'trace-1',
      grant: grant('grant-1'),
      tool: 'arq_save_brief',
      projectId: 'project-a',
      outcome: 'ok',
      code: 'ARQ_BRIEF_STORED',
      canonicalMutation: 'none',
      requestFingerprint: contentDigest(secretish),
    });

    expect(JSON.stringify(event)).not.toContain('Nakamura');
    expect(event.requestFingerprint).toBe(contentDigest(secretish));
    expect(event.recordedAt).toBe('2023-11-14T22:13:20.000Z');
  });

  it('never shows one grant the events of another, in the same tenant or across tenants', () => {
    const clock = createControlledClock(0);
    const trail = createAuditTrail(clock.now);
    const mine = grant('grant-mine');
    const theirs = grant('grant-theirs');
    const otherTenant = grant('grant-mine', 'tenant-2');

    for (const holder of [mine, theirs, otherTenant]) {
      trail.record({
        traceId: 'trace',
        grant: holder,
        tool: 'arq_list_projects',
        outcome: 'ok',
        code: 'ARQ_PROJECTS_LISTED',
        canonicalMutation: 'none',
        requestFingerprint: 'sha256:0',
      });
    }

    expect(trail.read(mine, 100)).toHaveLength(1);
    expect(trail.read(mine, 100)[0]?.grantId).toBe('grant-mine');
    expect(trail.read(otherTenant, 100)).toHaveLength(1);
    expect(trail.read(otherTenant, 100)[0]?.tenantId).toBe('tenant-2');
  });

  it('returns newest first and honours the limit', () => {
    const clock = createControlledClock(0);
    const trail = createAuditTrail(clock.now);
    const holder = grant('grant-1');
    for (let index = 0; index < 5; index += 1) {
      clock.advance(1000);
      trail.record({
        traceId: `trace-${index}`,
        grant: holder,
        tool: 'arq_list_projects',
        outcome: 'ok',
        code: 'ARQ_PROJECTS_LISTED',
        canonicalMutation: 'none',
        requestFingerprint: 'sha256:0',
      });
    }
    const page = trail.read(holder, 2);
    expect(page.map((event) => event.traceId)).toEqual(['trace-4', 'trace-3']);
  });

  it('is bounded and reports how many entries it dropped', () => {
    const clock = createControlledClock(0);
    const trail = createAuditTrail(clock.now, 3);
    const holder = grant('grant-1');
    for (let index = 0; index < 10; index += 1) {
      trail.record({
        traceId: `trace-${index}`,
        grant: holder,
        tool: 'arq_list_projects',
        outcome: 'ok',
        code: 'ARQ_PROJECTS_LISTED',
        canonicalMutation: 'none',
        requestFingerprint: 'sha256:0',
      });
    }
    expect(trail.size).toBe(3);
    expect(trail.droppedCount).toBe(7);
    expect(trail.read(holder, 10).map((event) => event.traceId)).toEqual([
      'trace-9',
      'trace-8',
      'trace-7',
    ]);
  });

  it('records denials and errors, not only successes', () => {
    const clock = createControlledClock(0);
    const trail = createAuditTrail(clock.now);
    const holder = grant('grant-1');
    trail.record({
      traceId: 'trace-denied',
      grant: holder,
      tool: 'arq_stage_changeset',
      outcome: 'denied',
      code: 'ARQ_SCOPE_MISSING',
      canonicalMutation: 'none',
      requestFingerprint: 'sha256:0',
    });
    expect(trail.read(holder, 1)[0]?.outcome).toBe('denied');
  });
});
