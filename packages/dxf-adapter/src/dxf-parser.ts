/**
 * ARQ-158: exchange: prototype DXF parser.
 *
 * Walks a DXF file's SECTION/ENDSEC structure, reading only the two
 * sections this prototype needs: HEADER (for `$INSUNITS`, ARQ-158's
 * "units" Stage 1 item) and ENTITIES (for the Stage 1 entity list,
 * DXF-PLAN.md). Every other section (TABLES, BLOCKS, OBJECTS, ...) is
 * walked over but not read - this is a linework-exchange prototype, not
 * a full DXF reader.
 *
 * Never throws: parseDxf always returns a well-formed DxfParseResult
 * ('parsed' or 'rejected'), the same safe-failure shape
 * @arq/project-format's importArchive uses for its own untrusted-input
 * boundary (ARQ-156). This function reads a file into a plain result
 * value and touches no existing project state, so failure - by
 * construction - cannot partially mutate a project; there is nothing
 * here for a partial failure to mutate.
 */

import { tokenizeDxf, type DxfGroup } from './dxf-tokenizer';
import { parseDxfEntity } from './dxf-entity-parser';
import type { DxfEntity } from './dxf-entities';
import { resolveDxfUnits, type DxfUnits } from './dxf-units';

export interface DxfSupportReport {
  /** Count of entities preserved into the result, by DXF entity type name. */
  readonly preservedEntityCounts: Readonly<Record<string, number>>;
  /** Count of entities not preserved (unrecognized type, or a recognized type missing required fields), by DXF entity type name. */
  readonly unsupportedEntityCounts: Readonly<Record<string, number>>;
}

export type DxfParseResult =
  | {
      readonly status: 'parsed';
      readonly units: DxfUnits;
      /**
       * Reflects only entities this prototype actually preserved - not a
       * scan of the TABLES section's full layer list (not read by this
       * prototype at all), and not layers referenced only by an
       * unsupported entity. A future non-prototype reader that parses
       * TABLES directly would report the drawing's complete layer set
       * even for empty layers; this is deliberately narrower.
       */
      readonly layers: readonly string[];
      readonly entities: readonly DxfEntity[];
      readonly supportReport: DxfSupportReport;
    }
  | { readonly status: 'rejected'; readonly reason: string };

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function parseDxf(content: string): DxfParseResult {
  try {
    if (content.trim().length === 0) {
      return { status: 'rejected', reason: 'empty DXF content' };
    }
    const groups = tokenizeDxf(content);
    if (groups.length === 0) {
      return { status: 'rejected', reason: 'no recognizable DXF groups found' };
    }

    let currentSection: string | null = null;
    let pendingHeaderVariable: string | null = null;
    let insunitsCode: number | undefined;

    let currentEntityType: string | null = null;
    let currentEntityBuffer: DxfGroup[] = [];

    const entities: DxfEntity[] = [];
    const preservedEntityCounts: Record<string, number> = {};
    const unsupportedEntityCounts: Record<string, number> = {};
    const layers = new Set<string>();

    const flushEntity = (): void => {
      if (currentEntityType === null) {
        return;
      }
      const entity = parseDxfEntity(currentEntityType, currentEntityBuffer);
      if (entity === null) {
        incrementCount(unsupportedEntityCounts, currentEntityType);
      } else {
        incrementCount(preservedEntityCounts, currentEntityType);
        entities.push(entity);
        layers.add(entity.layer);
      }
      currentEntityType = null;
      currentEntityBuffer = [];
    };

    for (const group of groups) {
      if (group.code === 0 && group.value === 'SECTION') {
        currentSection = null;
        continue;
      }
      if (currentSection === null && group.code === 2) {
        currentSection = group.value;
        continue;
      }
      if (group.code === 0 && group.value === 'ENDSEC') {
        flushEntity();
        currentSection = null;
        continue;
      }

      if (currentSection === 'HEADER') {
        if (group.code === 9) {
          pendingHeaderVariable = group.value;
          continue;
        }
        if (pendingHeaderVariable === '$INSUNITS' && group.code === 70) {
          const parsed = Number.parseInt(group.value, 10);
          if (Number.isFinite(parsed)) {
            insunitsCode = parsed;
          }
          pendingHeaderVariable = null;
        }
        continue;
      }

      if (currentSection === 'ENTITIES') {
        if (group.code === 0) {
          flushEntity();
          currentEntityType = group.value;
          currentEntityBuffer = [];
          continue;
        }
        if (currentEntityType !== null) {
          currentEntityBuffer.push(group);
        }
      }
    }
    flushEntity();

    return {
      status: 'parsed',
      units: resolveDxfUnits(insunitsCode),
      layers: [...layers].sort(),
      entities,
      supportReport: { preservedEntityCounts, unsupportedEntityCounts },
    };
  } catch {
    return { status: 'rejected', reason: 'unexpected error while parsing DXF content' };
  }
}
