/**
 * `contracts/arqfs.ts` is reference-only material (not a workspace package, not a
 * dependency of anything - see docs/research/incoming/README.md), so its
 * `ArqFormatVersion` shape is reproduced here rather than imported across that
 * boundary. The fields match it exactly; see docs/architecture/ARQ-FILE-FORMAT.md.
 */
export interface ArqFormatVersion {
  readonly major: number;
  readonly minor: number;
  readonly schema: number;
  readonly minReaderMajor: number;
  readonly minWriterMajor: number;
}

/**
 * `0x41525131` is the four ASCII bytes `A` `R` `Q` `1` - see
 * docs/architecture/ARQ-FILE-FORMAT.md. Any file whose `PRAGMA application_id` does
 * not match this is not an Arq file at all, regardless of its schema version.
 */
export const ARQ_APPLICATION_ID = 0x41525131;

/**
 * This reader/writer's own format version - bump `schema` when a new schema
 * migration ships (arqfs-schema-v2.ts's `ARQFS_SCHEMA_VERSION_V2`, ARQ-238-
 * adjacent provenance/import tracking), bump major/minor for a breaking or
 * additive format change. `evaluateOpenCapabilities` (arqfs-open.ts) compares
 * every opened file's own header against this value; a file whose schema is
 * older than this reports `canMigrate: true` rather than nothing to do.
 */
export const ARQFS_CURRENT_FORMAT_VERSION: ArqFormatVersion = {
  major: 1,
  minor: 0,
  schema: 2,
  minReaderMajor: 1,
  minWriterMajor: 1,
};
