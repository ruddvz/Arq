import type { ImportAdapter, ImportAdapterResult } from './types';

export class UnderlayAdapter implements ImportAdapter {
  readonly id = 'underlay';
  readonly version = '1.0.0';
  readonly formatIds = ['pdf', 'png', 'jpeg', 'webp'] as const;
  readonly maximumFidelity = 'underlay' as const;

  async convert(context: Parameters<ImportAdapter['convert']>[0]): Promise<ImportAdapterResult> {
    if (context.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const sourceObjectId = 'underlay:0';
    return {
      stagedElements: [
        {
          id: 'staged-underlay-0',
          kind: 'underlay',
          sourceObjectId,
          properties: {
            name: context.source.name,
            calibrated: false,
            opacity: 1,
            locked: false,
          },
        },
      ],
      mappings: [
        {
          sourceObjectId,
          stagedElementId: 'staged-underlay-0',
          mappingKind: 'transformed',
          confidence: 1,
        },
      ],
      resources: context.policy.preserveOriginalSource
        ? [
            {
              sha256: context.sourceSha256,
              mediaType: context.source.mediaTypeHint ?? 'application/octet-stream',
              role: 'source-underlay',
              bytes: context.bytes,
            },
          ]
        : [],
      report: {
        formatId:
          this.formatIds.find((id) => context.source.name.toLowerCase().endsWith(`.${id}`)) ??
          'underlay',
        adapterId: this.id,
        adapterVersion: this.version,
        fidelity: 'underlay',
        sourceSha256: context.sourceSha256,
        sourceByteLength: context.bytes.byteLength,
        preservedCount: 1,
        convertedCount: 1,
        approximatedCount: 0,
        ignoredCount: 0,
        issues: [
          {
            severity: 'info',
            code: 'UNDERLAY_UNCALIBRATED',
            message: 'Calibrate the underlay before treating traced dimensions as accurate.',
          },
        ],
        timingsMs: {},
      },
    };
  }
}
