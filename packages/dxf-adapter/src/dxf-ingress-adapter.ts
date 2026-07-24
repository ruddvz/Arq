import type {
  ImportAdapter,
  ImportAdapterContext,
  ImportAdapterResult,
  StagedImportElement,
  SourceObjectMapping,
} from '@arq/file-ingress';
import { parseDxf } from './dxf-parser';

/**
 * Wraps this package's existing `parseDxf` (the real DXF tokenizer/entity
 * parser, unchanged) in @arq/file-ingress's generic `ImportAdapter` contract,
 * so a DXF file goes through the same detect -> stage -> report pipeline as
 * every other import format rather than a bespoke DXF-only code path. Fidelity
 * is 'structured' (entities are real, typed staged elements per
 * `entity.kind`), never 'exact' - a DXF file has no native building semantics
 * to preserve exactly, only entities to structure.
 */
function stagedId(index: number): string {
  return `dxf-staged-${index}`;
}

export class DxfIngressAdapter implements ImportAdapter {
  readonly id = 'dxf-ingress';
  readonly version = '1.0.0';
  readonly formatIds = ['dxf'] as const;
  readonly maximumFidelity = 'structured' as const;

  async convert(context: ImportAdapterContext): Promise<ImportAdapterResult> {
    if (context.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const text = new TextDecoder('utf-8', { fatal: false }).decode(context.bytes);
    if ([...text].length > context.policy.maxTextCodePoints) {
      throw new Error('DXF text exceeds configured code-point limit.');
    }

    context.onProgress?.({ stage: 'converting', fraction: 0.2, message: 'Parsing DXF entities' });
    const parsed = parseDxf(text);
    if (parsed.status === 'rejected') throw new Error(parsed.reason);
    if (parsed.entities.length > context.policy.maxStagedElements) {
      throw new Error('DXF entity count exceeds staged-element limit.');
    }

    const stagedElements: StagedImportElement[] = [];
    const mappings: SourceObjectMapping[] = [];
    parsed.entities.forEach((entity, index) => {
      const sourceObjectId = `dxf:entity:${index}`;
      const id = stagedId(index);
      stagedElements.push({
        id,
        kind: `dxf-${entity.kind.toLowerCase()}`,
        sourceObjectId,
        properties: { ...entity, units: parsed.units },
      });
      mappings.push({
        sourceObjectId,
        stagedElementId: id,
        mappingKind: 'transformed',
        confidence: 1,
      });
    });

    const unsupportedCount = Object.values(parsed.supportReport.unsupportedEntityCounts).reduce(
      (sum, value) => sum + value,
      0,
    );

    context.onProgress?.({
      stage: 'validating',
      fraction: 0.8,
      message: 'Preparing DXF import report',
    });
    return {
      stagedElements,
      mappings,
      resources: context.policy.preserveOriginalSource
        ? [
            {
              sha256: context.sourceSha256,
              mediaType: context.source.mediaTypeHint ?? 'application/dxf',
              role: 'source-import',
              bytes: context.bytes,
            },
          ]
        : [],
      report: {
        formatId: 'dxf',
        adapterId: this.id,
        adapterVersion: this.version,
        fidelity: 'structured',
        sourceSha256: context.sourceSha256,
        sourceByteLength: context.bytes.byteLength,
        preservedCount: parsed.entities.length,
        convertedCount: parsed.entities.length,
        approximatedCount: 0,
        ignoredCount: unsupportedCount,
        issues:
          unsupportedCount > 0
            ? [
                {
                  severity: 'warning',
                  code: 'DXF_UNSUPPORTED_ENTITIES',
                  message: `${unsupportedCount} unsupported or malformed DXF entities were not converted.`,
                },
              ]
            : [],
        timingsMs: {},
      },
    };
  }
}
