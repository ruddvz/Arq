import { describe, expect, it } from 'vitest';
import { createOperationEnvelope } from './operation-envelope';

describe('createOperationEnvelope', () => {
  it('creates a valid envelope from valid input', () => {
    const result = createOperationEnvelope({
      operationId: 'op-1',
      clientId: 'client-a',
      clientSequence: 0,
      baseRevision: 5,
      payload: { kind: 'CreateWall' },
    });
    expect(result).toEqual({
      status: 'created',
      envelope: {
        operationId: 'op-1',
        clientId: 'client-a',
        clientSequence: 0,
        baseRevision: 5,
        payload: { kind: 'CreateWall' },
      },
    });
  });

  it('rejects an empty operationId rather than throwing', () => {
    const result = createOperationEnvelope({
      operationId: '',
      clientId: 'client-a',
      clientSequence: 0,
      baseRevision: 0,
      payload: null,
    });
    expect(result).toEqual({ status: 'rejected', reason: expect.stringContaining('operationId') });
  });

  it('rejects an empty clientId', () => {
    const result = createOperationEnvelope({
      operationId: 'op-1',
      clientId: '  ',
      clientSequence: 0,
      baseRevision: 0,
      payload: null,
    });
    expect(result.status).toBe('rejected');
  });

  it('rejects a negative or non-integer clientSequence', () => {
    expect(
      createOperationEnvelope({
        operationId: 'op-1',
        clientId: 'client-a',
        clientSequence: -1,
        baseRevision: 0,
        payload: null,
      }).status,
    ).toBe('rejected');
    expect(
      createOperationEnvelope({
        operationId: 'op-1',
        clientId: 'client-a',
        clientSequence: 1.5,
        baseRevision: 0,
        payload: null,
      }).status,
    ).toBe('rejected');
  });

  it('rejects a negative or non-integer baseRevision', () => {
    expect(
      createOperationEnvelope({
        operationId: 'op-1',
        clientId: 'client-a',
        clientSequence: 0,
        baseRevision: -1,
        payload: null,
      }).status,
    ).toBe('rejected');
  });

  it('accepts an arbitrary payload shape without inspecting it', () => {
    const result = createOperationEnvelope({
      operationId: 'op-1',
      clientId: 'client-a',
      clientSequence: 0,
      baseRevision: 0,
      payload: { anything: 'goes', nested: { deeply: [1, 2, 3] } },
    });
    expect(result.status).toBe('created');
  });
});
