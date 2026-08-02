import { describe, expect, it } from 'vitest';
import { checkReferenceUri, referenceUriValue } from './reference-uri';

/**
 * Every rejected case below passes the reviewed 2.0 package's
 * `/^(https:\/\/|arq:\/\/)/` prefix test. That is the point of the suite:
 * these are the URIs a prefix check lets through.
 */
describe('reference URIs the 2.0 prefix check accepted', () => {
  const rejected: readonly [string, string][] = [
    ['https://user:token@example.com/a', 'credentials'],
    ['https://127.0.0.1/admin', 'loopback address'],
    ['https://169.254.169.254/latest/meta-data', 'instance metadata address'],
    ['https://10.0.0.5/internal', 'private address'],
    ['https://2130706433/x', 'integer-encoded address'],
    ['https://[::1]/x', 'IPv6 loopback'],
    ['https://localhost/x', 'loopback name'],
    ['https://arq.localhost/x', 'loopback suffix'],
    ['https://build.internal/x', 'reserved suffix'],
    ['https://printer.local/x', 'mDNS suffix'],
    ['https://example.com:8080/x', 'non-default port'],
    ['https:///etc/passwd', 'empty host'],
    ['https://single/x', 'unqualified host'],
    ['https://exa mple.com/x', 'whitespace'],
  ];

  for (const [uri, why] of rejected) {
    it(`rejects ${why}: ${uri}`, () => {
      expect(checkReferenceUri(uri).ok).toBe(false);
    });
  }

  it('rejects a non-ASCII homograph host before it becomes punycode', () => {
    // U+0430 CYRILLIC SMALL LETTER A, not U+0061.
    const result = checkReferenceUri('https://\u0430pple.com/x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('ASCII');
    }
  });
});

describe('accepted https references', () => {
  it('accepts a public host, with or without the default port', () => {
    expect(checkReferenceUri('https://example.org/a/b?c=d#e').ok).toBe(true);
    expect(checkReferenceUri('https://sub.example.org:443/a').ok).toBe(true);
  });

  it('lower-cases the host it reports', () => {
    const result = checkReferenceUri('https://EXAMPLE.ORG/a');
    expect(result.ok).toBe(true);
    if (result.ok && result.scheme === 'https') {
      expect(result.host).toBe('example.org');
    }
  });
});

describe('arq references', () => {
  it('accepts a known kind with a single opaque identifier', () => {
    const result = checkReferenceUri('arq://element/wall-42');
    expect(result.ok).toBe(true);
    if (result.ok && result.scheme === 'arq') {
      expect(result.kind).toBe('element');
      expect(result.opaqueId).toBe('wall-42');
      expect(result.normalised).toBe('arq://element/wall-42');
    }
  });

  it('rejects an unknown kind, a nested path, a query and a fragment', () => {
    expect(checkReferenceUri('arq://filesystem/etc').ok).toBe(false);
    expect(checkReferenceUri('arq://element/a/b').ok).toBe(false);
    expect(checkReferenceUri('arq://element/a?x=1').ok).toBe(false);
    expect(checkReferenceUri('arq://element/a#x').ok).toBe(false);
  });

  it('rejects a missing identifier', () => {
    expect(checkReferenceUri('arq://element').ok).toBe(false);
    expect(checkReferenceUri('arq://element/').ok).toBe(false);
  });
});

describe('other schemes', () => {
  for (const uri of [
    'file:///etc/passwd',
    'http://example.com/x',
    'data:text/plain;base64,AAAA',
    'javascript:alert(1)',
    'ftp://example.com/x',
    '/etc/passwd',
    'C:\\projects\\house.arq',
  ]) {
    it(`rejects ${uri}`, () => {
      expect(checkReferenceUri(uri).ok).toBe(false);
    });
  }
});

describe('bounds', () => {
  it('rejects an empty or oversized URI', () => {
    expect(checkReferenceUri('').ok).toBe(false);
    expect(checkReferenceUri(`https://example.org/${'a'.repeat(3000)}`).ok).toBe(false);
  });
});

describe('validator form', () => {
  const validator = referenceUriValue();

  it('rejects a non-string without throwing', () => {
    expect(validator.validate(7).ok).toBe(false);
  });

  it('carries the real rule in the description rather than implying the pattern is the rule', () => {
    expect(String(validator.jsonSchema.description)).toContain('public DNS host');
    expect(validator.jsonSchema.pattern).toBe('^(https|arq)://');
  });

  it('reports the parse reason as the issue message', () => {
    const result = validator.validate('https://localhost/x');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('unroutable');
    }
  });
});
