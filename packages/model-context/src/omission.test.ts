import { describe, expect, it } from 'vitest';
import { createOmissionReference } from './omission';

const BASE_INPUT = {
  projectRevision: 3,
  query: 'walls on level 1',
  result: 'summary of 12 walls',
  permissionScope: 'project:read',
  omittedCount: 4,
  summary: '4 walls omitted for length',
};

describe('createOmissionReference', () => {
  it('produces a stable ref derived from the result hash', async () => {
    const first = await createOmissionReference(BASE_INPUT);
    const second = await createOmissionReference(BASE_INPUT);
    expect(first.ref).toBe(second.ref);
    expect(first.ref).toMatch(/^arq-context#[0-9a-f]{12}$/);
  });

  it('hashes the query and result independently, not just concatenated', async () => {
    const reference = await createOmissionReference(BASE_INPUT);
    expect(reference.queryHash).not.toBe(reference.resultHash);
    expect(reference.queryHash).toMatch(/^[0-9a-f]{64}$/);
    expect(reference.resultHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('carries through the caller-supplied fields unchanged', async () => {
    const reference = await createOmissionReference(BASE_INPUT);
    expect(reference.projectRevision).toBe(3);
    expect(reference.permissionScope).toBe('project:read');
    expect(reference.omittedCount).toBe(4);
    expect(reference.summary).toBe('4 walls omitted for length');
  });

  it('produces a different ref for a different result', async () => {
    const a = await createOmissionReference(BASE_INPUT);
    const b = await createOmissionReference({ ...BASE_INPUT, result: 'a different result' });
    expect(a.ref).not.toBe(b.ref);
  });
});
