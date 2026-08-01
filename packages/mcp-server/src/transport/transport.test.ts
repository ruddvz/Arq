import { describe, expect, it } from 'vitest';
import { createAuditTrail } from '../audit/audit-trail';
import { createControlledClock, createSequentialIdSource } from '../runtime/clock';
import { createGrant } from '../grant/grant';
import { GRANT_PRESETS } from '../grant/scopes';
import { createMemoryArqHost } from '../host/memory-project-host';
import { createDefaultDomainProfileRegistry } from '../profile/profile-registry';
import { ArqBridge } from '../adapter/bridge-adapter';
import { createToolService } from '../service/tool-service';
import { createArqMcpServer } from '../mcp/server';
import { MessageTooLargeError, createLineReader, handleLine } from './stdio';
import { checkHttpRequest, constantTimeEquals } from './http-guard';

function server() {
  const clock = createControlledClock(0);
  const { host } = createMemoryArqHost();
  const audit = createAuditTrail(clock.now);
  const bridge = new ArqBridge({
    host,
    registry: createDefaultDomainProfileRegistry(),
    clock: clock.now,
    idSource: createSequentialIdSource('id'),
    audit,
    serverMode: 'local_runtime',
  });
  const grant = createGrant({
    grantId: 'grant-1',
    subjectId: 'subject-1',
    tenantId: 'tenant-1',
    clientName: 'test',
    clientVersion: '1.0.0',
    scopes: GRANT_PRESETS.read_only,
    projectIds: [],
    issuedAtEpochMs: 0,
    lifetimeMs: 60_000,
  });
  return createArqMcpServer({
    bridge,
    service: createToolService({
      audit,
      nextTraceId: () => bridge.nextTraceId(),
      reportFault: () => {},
    }),
    resolveGrant: () => grant,
  });
}

describe('line framing', () => {
  it('splits on newlines and tolerates carriage returns and partial chunks', () => {
    const reader = createLineReader();
    expect(reader.push('{"a":1}\n{"b":')).toEqual(['{"a":1}']);
    expect(reader.push('2}\r\n')).toEqual(['{"b":2}']);
  });

  it('ignores blank lines rather than treating them as messages', () => {
    const reader = createLineReader();
    expect(reader.push('\n\n   \n')).toEqual([]);
  });

  it('refuses a message that never terminates rather than buffering it', () => {
    const reader = createLineReader({ maxBytes: 32 });
    expect(() => reader.push('x'.repeat(64))).toThrow(MessageTooLargeError);
  });

  it('does not refuse a long stream made of short messages', () => {
    const reader = createLineReader({ maxBytes: 32 });
    for (let index = 0; index < 100; index += 1) {
      expect(reader.push('{"a":1}\n')).toHaveLength(1);
    }
  });
});

describe('handling one line', () => {
  it('answers malformed JSON with a parse error rather than dropping it', () => {
    const response = handleLine(server(), '{not json');
    expect(response && 'error' in response ? response.error.code : 0).toBe(-32700);
  });

  it('answers a malformed request with an invalid-request error, keeping the id', () => {
    const response = handleLine(
      server(),
      JSON.stringify({ jsonrpc: '1.0', id: 7, method: 'ping' }),
    );
    expect(response && 'error' in response ? response.error.code : 0).toBe(-32600);
    expect(response?.id).toBe(7);
  });

  it('answers nothing to a notification', () => {
    expect(
      handleLine(server(), JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })),
    ).toBeUndefined();
  });

  it('answers a well-formed request', () => {
    const active = server();
    handleLine(active, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }));
    const response = handleLine(active, JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }));
    expect(response && 'result' in response).toBe(true);
  });
});

describe('the loopback HTTP guards', () => {
  const options = { port: 3333, pairingToken: 'pair-abcdef' };
  const good = {
    method: 'POST',
    path: '/mcp',
    host: '127.0.0.1:3333',
    contentType: 'application/json',
    authorization: 'Bearer pair-abcdef',
  };

  it('allows a correctly paired loopback request', () => {
    expect(checkHttpRequest(good, options).allowed).toBe(true);
  });

  it('refuses a rebound host name, including localhost', () => {
    for (const host of ['evil.example:3333', 'localhost:3333', '127.0.0.1:9999']) {
      expect(checkHttpRequest({ ...good, host }, options).allowed).toBe(false);
    }
    const { host: _dropped, ...withoutHost } = good;
    expect(checkHttpRequest(withoutHost, options).allowed).toBe(false);
  });

  it('refuses a cross-site origin and accepts an absent one', () => {
    expect(checkHttpRequest({ ...good, origin: 'https://evil.example' }, options).allowed).toBe(
      false,
    );
    expect(checkHttpRequest({ ...good, origin: 'not a url' }, options).allowed).toBe(false);
    expect(checkHttpRequest({ ...good, origin: 'http://127.0.0.1:3333' }, options).allowed).toBe(
      true,
    );
    expect(checkHttpRequest(good, options).allowed).toBe(true);
  });

  it('refuses a form-style content type, which is what a cross-site form can send', () => {
    const verdict = checkHttpRequest(
      { ...good, contentType: 'application/x-www-form-urlencoded' },
      options,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false ? verdict.status : 0).toBe(415);
  });

  it('refuses every request when the endpoint is not paired', () => {
    const verdict = checkHttpRequest(good, { port: 3333 });
    expect(verdict.allowed).toBe(false);
    expect(verdict.allowed === false ? verdict.status : 0).toBe(401);
  });

  it('refuses a wrong or missing pairing token', () => {
    expect(checkHttpRequest({ ...good, authorization: 'Bearer wrong' }, options).allowed).toBe(
      false,
    );
    const { authorization: _dropped, ...withoutToken } = good;
    expect(checkHttpRequest(withoutToken, options).allowed).toBe(false);
    expect(checkHttpRequest({ ...good, authorization: 'pair-abcdef' }, options).allowed).toBe(
      false,
    );
  });

  it('refuses another path, another method and an oversized body', () => {
    expect(checkHttpRequest({ ...good, path: '/admin' }, options).allowed).toBe(false);
    expect(checkHttpRequest({ ...good, method: 'GET' }, options).allowed).toBe(false);
    expect(checkHttpRequest({ ...good, contentLength: 10_000_000 }, options).allowed).toBe(false);
  });

  it('compares tokens without short-circuiting on length or prefix', () => {
    expect(constantTimeEquals('abc', 'abc')).toBe(true);
    expect(constantTimeEquals('abc', 'abd')).toBe(false);
    expect(constantTimeEquals('abc', 'abcd')).toBe(false);
    expect(constantTimeEquals('', '')).toBe(true);
  });
});
