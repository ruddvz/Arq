import { describe, expect, it } from 'vitest';
import { routeBrowserFile } from './route-file';

function sqliteHeader(applicationId: number): Uint8Array {
  const bytes = new Uint8Array(100);
  bytes.set(new TextEncoder().encode('SQLite format 3\0'));
  bytes[16] = 0x10;
  bytes[17] = 0x00;
  bytes[68] = (applicationId >>> 24) & 0xff;
  bytes[69] = (applicationId >>> 16) & 0xff;
  bytes[70] = (applicationId >>> 8) & 0xff;
  bytes[71] = applicationId & 0xff;
  return bytes;
}

describe('routeBrowserFile', () => {
  it('routes a real Arq file straight to native open', () => {
    const bytes = sqliteHeader(0x41525131);
    const route = routeBrowserFile(bytes, 'project.arq');
    expect(route.kind).toBe('open-native-arq');
  });

  it('routes a real Arq file to native open even with the wrong extension', () => {
    const bytes = sqliteHeader(0x41525131);
    const route = routeBrowserFile(bytes, 'project.sqlite');
    expect(route.kind).toBe('open-native-arq');
  });

  it('rejects a SQLite database that is not an Arq project', () => {
    const bytes = sqliteHeader(0x12345678);
    const route = routeBrowserFile(bytes, 'other.db');
    expect(route).toEqual({
      kind: 'reject',
      code: 'NOT_ARQ_SQLITE',
      detail: 'This is a SQLite database, but its application ID does not identify an Arq project.',
    });
  });

  it('routes a DXF file to the import path', () => {
    const bytes = new TextEncoder().encode(
      '0\r\nSECTION\r\n2\r\nHEADER\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n',
    );
    const route = routeBrowserFile(bytes, 'plan.dxf');
    expect(route).toEqual({ kind: 'import', formatId: 'dxf', extensionMismatch: false });
  });
});
