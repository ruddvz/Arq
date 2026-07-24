import { sha256Hex } from './hash';
import type { ImportAdapter, ImportAdapterResult } from './types';

export class AttachmentAdapter implements ImportAdapter {
  readonly id = 'attachment';
  readonly version = '1.0.0';
  readonly formatIds = [
    'unknown',
    'arqpack',
    'ifc',
    'dwg',
    'rvt',
    'skp',
    '3dm',
    'glb',
    'gltf',
    'obj',
    'stl',
    'step',
    'iges',
  ] as const;
  readonly maximumFidelity = 'attached' as const;

  async convert(context: Parameters<ImportAdapter['convert']>[0]): Promise<ImportAdapterResult> {
    if (!context.policy.allowAttachmentFallback)
      throw new Error('Attachment fallback is disabled by policy.');
    if (context.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const sha256 = context.sourceSha256 || (await sha256Hex(context.bytes));
    return {
      stagedElements: [],
      mappings: [],
      resources: context.policy.preserveOriginalSource
        ? [
            {
              sha256,
              mediaType: context.source.mediaTypeHint ?? 'application/octet-stream',
              role: 'source-import',
              bytes: context.bytes,
            },
          ]
        : [],
      report: {
        formatId: 'unknown',
        adapterId: this.id,
        adapterVersion: this.version,
        fidelity: 'attached',
        sourceSha256: sha256,
        sourceByteLength: context.bytes.byteLength,
        preservedCount: 1,
        convertedCount: 0,
        approximatedCount: 0,
        ignoredCount: 0,
        issues: [
          {
            severity: 'warning',
            code: 'ATTACHMENT_ONLY',
            message: 'The original file was preserved without editable conversion.',
          },
        ],
        timingsMs: {},
      },
    };
  }
}
