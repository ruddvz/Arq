import { describe, expect, it } from 'vitest';
import { DEFAULT_IMPORT_POLICY, type ImportPolicy } from '@arq/file-ingress';
import { IfcIngressAdapter } from './ifc-ingress-adapter';

/**
 * A minimal-but-valid IFC file exercising the real web-ifc reader through
 * the adapter - the same tiny model style ifc-viewer.test.ts uses.
 */
const MINIMAL_IFC = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('2vNAB1PVj4wR4bF3Dq2Xar',$,'Adapter test project',$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;
`;

function context(bytes: Uint8Array, policyOverrides: Partial<ImportPolicy> = {}) {
  return {
    bytes,
    source: { name: 'model.ifc', byteLength: bytes.byteLength },
    sourceSha256: 'test-sha',
    policy: { ...DEFAULT_IMPORT_POLICY, ...policyOverrides },
    signal: new AbortController().signal,
  };
}

describe('IfcIngressAdapter', () => {
  it('registers under the id formats.ts routes ifc to', () => {
    const adapter = new IfcIngressAdapter();
    expect(adapter.id).toBe('ifc-ingress');
    expect(adapter.formatIds).toContain('ifc');
  });

  it('stages entity summaries from a real IFC file and reports viewing scope', async () => {
    const adapter = new IfcIngressAdapter();
    const result = await adapter.convert(context(new TextEncoder().encode(MINIMAL_IFC)));
    expect(result.report.fidelity).toBe('structured');
    expect(result.report.issues.some((issue) => issue.code === 'IFC_VIEWING_SCOPE')).toBe(true);
    expect(result.stagedElements.some((element) => element.kind === 'ifc-ifcproject')).toBe(true);
    expect(result.report.convertedCount).toBe(0);
  }, 60000);

  it('rejects unreadable bytes with the reader reason rather than staging junk', async () => {
    const adapter = new IfcIngressAdapter();
    await expect(
      adapter.convert(context(new TextEncoder().encode('not ifc at all'))),
    ).rejects.toThrow();
  }, 60000);

  it('enforces the policy size limit before the WASM boundary', async () => {
    const adapter = new IfcIngressAdapter();
    await expect(
      adapter.convert(context(new TextEncoder().encode(MINIMAL_IFC), { maxSourceBytes: 8 })),
    ).rejects.toThrow(/size limit/);
  });
});
