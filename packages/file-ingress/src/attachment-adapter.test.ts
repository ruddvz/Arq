import { describe, expect, it } from 'vitest';
import { AttachmentAdapter } from './attachment-adapter';
import { DEFAULT_IMPORT_POLICY } from './policy';
import type { ImportAdapterContext } from './types';

const BYTES = new TextEncoder().encode('unrecognisable binary content');

function context(overrides: Partial<ImportAdapterContext> = {}): ImportAdapterContext {
  return {
    bytes: BYTES,
    source: { name: 'mystery.bin', byteLength: BYTES.byteLength },
    sourceSha256: '',
    policy: DEFAULT_IMPORT_POLICY,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('AttachmentAdapter', () => {
  it('refuses to run when the policy disables attachment fallback', async () => {
    const adapter = new AttachmentAdapter();
    await expect(
      adapter.convert(
        context({ policy: { ...DEFAULT_IMPORT_POLICY, allowAttachmentFallback: false } }),
      ),
    ).rejects.toThrow(/Attachment fallback is disabled/);
  });

  it('preserves the source bytes as a resource and reports attached fidelity', async () => {
    const adapter = new AttachmentAdapter();
    const result = await adapter.convert(context());

    expect(result.report.fidelity).toBe('attached');
    expect(result.stagedElements).toEqual([]);
    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.role).toBe('source-import');
  });

  it('omits the resource when the policy disables source preservation', async () => {
    const adapter = new AttachmentAdapter();
    const result = await adapter.convert(
      context({ policy: { ...DEFAULT_IMPORT_POLICY, preserveOriginalSource: false } }),
    );

    expect(result.resources).toEqual([]);
  });

  it('rejects when already cancelled', async () => {
    const adapter = new AttachmentAdapter();
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.convert(context({ signal: controller.signal }))).rejects.toThrow();
  });
});
