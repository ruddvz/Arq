import type {
  ImportAdapter,
  ImportAdapterContext,
  ImportAdapterResult,
  SourceObjectMapping,
  StagedImportElement,
} from '@arq/file-ingress';
import { readIfcModel } from './ifc-viewer';

/**
 * Bridges this package's existing `readIfcModel` (the real web-ifc reader,
 * unchanged) into @arq/file-ingress's `ImportAdapter` contract under the id
 * `formats.ts` has always routed 'ifc' to - before this, any IFC conversion
 * request failed "Adapter unavailable" by construction.
 *
 * Scope is exactly the format matrix's stated IFC role: viewing and
 * inspection. Staged elements are entity summaries (type, name, GlobalId) -
 * not converted native geometry - so fidelity is 'structured' and the report
 * says so. Full IFC authoring/geometry conversion remains explicitly out of
 * scope (docs/interoperability/IFC-PLAN.md).
 *
 * Untrusted-input note (ifc-viewer.ts's own warning): web-ifc parses inside
 * WASM, where a malformed file can burn seconds before rejection and an
 * AbortSignal cannot preempt it mid-parse. The policy's maxSourceBytes is
 * enforced before the WASM boundary, and the real preemption boundary is
 * the import worker this adapter runs in (workers/import-export-worker),
 * which can be terminated - exactly why imports run off the main thread.
 */
export class IfcIngressAdapter implements ImportAdapter {
  readonly id = 'ifc-ingress';
  readonly version = '1.0.0';
  readonly formatIds = ['ifc'] as const;
  readonly maximumFidelity = 'structured' as const;

  async convert(context: ImportAdapterContext): Promise<ImportAdapterResult> {
    if (context.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (context.bytes.byteLength > context.policy.maxSourceBytes) {
      throw new Error('IFC source exceeds import policy size limit.');
    }

    context.onProgress?.({
      stage: 'converting',
      fraction: 0.2,
      message: 'Reading IFC model with web-ifc',
    });
    const result = await readIfcModel(context.bytes);
    if (result.status === 'rejected') throw new Error(result.reason);
    if (result.entities.length > context.policy.maxStagedElements) {
      throw new Error('IFC entity count exceeds staged-element limit.');
    }

    const stagedElements: StagedImportElement[] = [];
    const mappings: SourceObjectMapping[] = [];
    result.entities.forEach((entity, index) => {
      const sourceObjectId = `ifc:express:${entity.expressId}`;
      const id = `ifc-staged-${index}`;
      stagedElements.push({
        id,
        kind: `ifc-${entity.ifcType.toLowerCase()}`,
        sourceObjectId,
        properties: {
          expressId: entity.expressId,
          ifcType: entity.ifcType,
          ...(entity.name !== undefined && { name: entity.name }),
          ...(entity.globalId !== undefined && { globalId: entity.globalId }),
        },
      });
      mappings.push({
        sourceObjectId,
        stagedElementId: id,
        mappingKind: 'attached',
        confidence: 1,
        notes: 'Viewing/inspection summary - no geometry conversion.',
      });
    });

    context.onProgress?.({
      stage: 'validating',
      fraction: 0.8,
      message: 'Preparing IFC import report',
    });
    return {
      stagedElements,
      mappings,
      resources: context.policy.preserveOriginalSource
        ? [
            {
              sha256: context.sourceSha256,
              mediaType: context.source.mediaTypeHint ?? 'application/x-step',
              role: 'source-import',
              bytes: context.bytes,
            },
          ]
        : [],
      report: {
        formatId: 'ifc',
        adapterId: this.id,
        adapterVersion: this.version,
        fidelity: 'structured',
        sourceSha256: context.sourceSha256,
        sourceByteLength: context.bytes.byteLength,
        preservedCount: result.entities.length,
        convertedCount: 0,
        approximatedCount: 0,
        ignoredCount: result.supportReport.unsupportedLineCount,
        issues: [
          {
            severity: 'info',
            code: 'IFC_VIEWING_SCOPE',
            message:
              'IFC support is viewing and inspection: entities are staged as summaries, not converted geometry (see the format support matrix).',
          },
          ...(result.supportReport.unsupportedLineCount > 0
            ? [
                {
                  severity: 'info' as const,
                  code: 'IFC_UNREAD_LINES',
                  message: `${result.supportReport.unsupportedLineCount} IFC lines are of types this reader does not summarise.`,
                },
              ]
            : []),
        ],
        timingsMs: {},
      },
    };
  }
}
