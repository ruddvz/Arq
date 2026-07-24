import { describe, expect, it } from 'vitest';
import type { ImportAdapterContext, ImportPolicy } from '@arq/file-ingress';
import { DEFAULT_IMPORT_POLICY } from '@arq/file-ingress';
import { DxfIngressAdapter } from './dxf-ingress-adapter';

function dxfLines(codesAndValues: readonly (string | number)[]): string {
  return codesAndValues.join('\n') + '\n';
}

const SAMPLE_DXF = dxfLines([
  0,
  'SECTION',
  2,
  'HEADER',
  9,
  '$INSUNITS',
  70,
  4,
  0,
  'ENDSEC',
  0,
  'SECTION',
  2,
  'ENTITIES',
  0,
  'LINE',
  8,
  'WALLS',
  10,
  '0.0',
  20,
  '0.0',
  11,
  '10.0',
  21,
  '0.0',
  0,
  'CIRCLE',
  8,
  'FIXTURES',
  10,
  '5.0',
  20,
  '5.0',
  40,
  '2.0',
  0,
  'ENDSEC',
  0,
  'EOF',
]);

function context(
  overrides: Partial<ImportAdapterContext> = {},
  policy: ImportPolicy = DEFAULT_IMPORT_POLICY,
): ImportAdapterContext {
  const bytes = new TextEncoder().encode(SAMPLE_DXF);
  return {
    bytes,
    source: { name: 'plan.dxf', byteLength: bytes.byteLength },
    sourceSha256: 'test-source-sha',
    policy,
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('DxfIngressAdapter', () => {
  it('stages one element per parsed entity, at structured fidelity', async () => {
    const adapter = new DxfIngressAdapter();
    const result = await adapter.convert(context());

    expect(result.report.fidelity).toBe('structured');
    expect(result.report.formatId).toBe('dxf');
    expect(result.stagedElements).toHaveLength(2);
    expect(result.stagedElements[0]?.kind).toBe('dxf-line');
    expect(result.stagedElements[1]?.kind).toBe('dxf-circle');
  });

  it('maps every staged element back to its source object id', async () => {
    const adapter = new DxfIngressAdapter();
    const result = await adapter.convert(context());

    expect(result.mappings).toEqual([
      {
        sourceObjectId: 'dxf:entity:0',
        stagedElementId: 'dxf-staged-0',
        mappingKind: 'transformed',
        confidence: 1,
      },
      {
        sourceObjectId: 'dxf:entity:1',
        stagedElementId: 'dxf-staged-1',
        mappingKind: 'transformed',
        confidence: 1,
      },
    ]);
  });

  it('preserves the original bytes as a resource when the policy asks for it', async () => {
    const adapter = new DxfIngressAdapter();
    const result = await adapter.convert(context());

    expect(result.resources).toHaveLength(1);
    expect(result.resources[0]?.role).toBe('source-import');
    expect(result.resources[0]?.sha256).toBe('test-source-sha');
  });

  it('omits the resource entirely when the policy disables source preservation', async () => {
    const adapter = new DxfIngressAdapter();
    const result = await adapter.convert(
      context({}, { ...DEFAULT_IMPORT_POLICY, preserveOriginalSource: false }),
    );

    expect(result.resources).toEqual([]);
  });

  it('rejects DXF content that fails to parse', async () => {
    const adapter = new DxfIngressAdapter();
    const bytes = new TextEncoder().encode('not a dxf file');
    await expect(
      adapter.convert(context({ bytes, source: { name: 'x.dxf', byteLength: bytes.byteLength } })),
    ).rejects.toThrow();
  });

  it('throws when the import is already cancelled', async () => {
    const adapter = new DxfIngressAdapter();
    const controller = new AbortController();
    controller.abort();
    await expect(adapter.convert(context({ signal: controller.signal }))).rejects.toThrow(
      /cancel/i,
    );
  });
});
