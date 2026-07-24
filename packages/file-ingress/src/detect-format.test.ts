import { describe, expect, it } from 'vitest';
import { detectFormat } from './detect-format';

function sqliteHeader(applicationId: number): Uint8Array {
  const bytes = new Uint8Array(100);
  bytes.set(new TextEncoder().encode('SQLite format 3\0'));
  bytes[16] = 0x10;
  bytes[17] = 0x00;
  bytes[60] = 0;
  bytes[61] = 0;
  bytes[62] = 0;
  bytes[63] = 2;
  bytes[68] = (applicationId >>> 24) & 0xff;
  bytes[69] = (applicationId >>> 16) & 0xff;
  bytes[70] = (applicationId >>> 8) & 0xff;
  bytes[71] = applicationId & 0xff;
  return bytes;
}

describe('detectFormat', () => {
  it('identifies native Arq by bytes even when the extension is wrong', () => {
    const bytes = sqliteHeader(0x41525131);
    expect(
      detectFormat(bytes, { name: 'project.sqlite', byteLength: bytes.length })[0],
    ).toMatchObject({
      formatId: 'arq-native',
      extensionMismatch: true,
    });
  });

  it('does not treat another SQLite application as Arq', () => {
    const bytes = sqliteHeader(0x12345678);
    expect(
      detectFormat(bytes, { name: 'project.arq', byteLength: bytes.length })[0]?.formatId,
    ).toBe('sqlite-other');
  });

  it('detects PDF by signature', () => {
    const bytes = new TextEncoder().encode('%PDF-1.7');
    expect(detectFormat(bytes, { name: 'x.bin', byteLength: bytes.length })[0]?.formatId).toBe(
      'pdf',
    );
  });
});
