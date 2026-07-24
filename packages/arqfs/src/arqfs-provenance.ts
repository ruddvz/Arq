import type { ArqfsDriver } from './arqfs-driver';

/**
 * Schema v2's provenance tables (arqfs-schema-v2.ts): a `source_document` records
 * one imported file (its real bytes preserved as a `resource`, per
 * arqfs-resource-chunks.ts, when the import policy asks for that), and
 * `source_object_map` links that source's individual objects (a DXF entity, an
 * IFC element, ...) to the Arq elements they became, at whatever fidelity the
 * conversion actually achieved - never claiming an import was "exact" when it
 * was approximated or merely attached.
 */
export interface SourceDocumentRecord {
  readonly id: string;
  readonly originalName: string;
  readonly mediaType?: string;
  readonly detectedFormat: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly importedAtUnixMs: number;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly fidelity:
    'native' | 'exact' | 'structured' | 'approximated' | 'underlay' | 'attached' | 'rejected';
  readonly sourceResourceSha256?: string;
  readonly sourceUriHint?: string;
}

export interface SourceObjectMapRecord {
  readonly sourceDocumentId: string;
  readonly sourceObjectId: string;
  readonly arqElementId?: string;
  readonly mappingKind: 'exact' | 'transformed' | 'approximated' | 'attached' | 'ignored';
  readonly confidence?: number;
  readonly notes?: string;
}

export function putSourceDocument(driver: ArqfsDriver, record: SourceDocumentRecord): void {
  driver.run(
    `INSERT INTO source_document(
      id, original_name, media_type, detected_format, sha256, byte_length,
      imported_at_unix_ms, adapter_id, adapter_version, fidelity,
      source_resource_sha256, source_uri_hint
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.originalName,
      record.mediaType ?? null,
      record.detectedFormat,
      record.sha256,
      record.byteLength,
      record.importedAtUnixMs,
      record.adapterId,
      record.adapterVersion,
      record.fidelity,
      record.sourceResourceSha256 ?? null,
      record.sourceUriHint ?? null,
    ],
  );
}

export function putSourceObjectMappings(
  driver: ArqfsDriver,
  mappings: readonly SourceObjectMapRecord[],
): void {
  driver.transaction(() => {
    for (const mapping of mappings) {
      driver.run(
        `INSERT INTO source_object_map(
          source_document_id, source_object_id, arq_element_id, mapping_kind, confidence, notes
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          mapping.sourceDocumentId,
          mapping.sourceObjectId,
          mapping.arqElementId ?? null,
          mapping.mappingKind,
          mapping.confidence ?? null,
          mapping.notes ?? null,
        ],
      );
    }
  });
}
