/**
 * ARQ-160: exchange: prototype web-ifc viewer.
 *
 * A read-only "viewer" in the sense docs/interoperability/FORMAT-SUPPORT-MATRIX.md
 * gives IFC ("Viewing and inspection", not authoring) - reads a model via
 * `web-ifc` (the MPL-2.0 dependency this package's own description already
 * named: "IFC import/export via web-ifc ... keep isolated per §19";
 * open-source/TECHNOLOGY-MATRIX.csv already records it with treatment
 * "isolate and spike", which is exactly this prototype) and summarizes the
 * entity types this prototype recognizes (ifc-supported-types.ts) into
 * plain data. No geometry is extracted and no mapping into
 * `@arq/bim-core` elements happens here - both are later, separate steps;
 * this issue is a spike, not the full IFC import command.
 *
 * `web-ifc`'s own `OpenModel` throws synchronously on a file missing a
 * valid HEADER/FILE_SCHEMA section (verified directly against the real
 * library, not assumed) - readIfcModel wraps every WASM call so no input
 * can throw past this module, returning a well-formed 'read' or
 * 'rejected' result instead, the same safe-failure shape
 * @arq/project-format's importArchive (ARQ-156) and @arq/dxf-adapter's
 * parseDxf (ARQ-158) already use for their own untrusted-input boundary.
 * A malformed file may still print an "Aborted()" diagnostic to stderr -
 * that comes from the WASM runtime itself on an internal abort path, not
 * from this module, and does not prevent the promise from resolving to a
 * caught, well-formed 'rejected' result.
 *
 * Measured directly against the real library in this repository's sandbox:
 * OpenModel on malformed content can take anywhere from ~1 second to over
 * 20 seconds before it throws (varying by exactly how the content is
 * malformed), even though a well-formed file of the same size opens in
 * milliseconds. This is a real characteristic of web-ifc's own internal
 * error handling on invalid input, not a bug in this module - but it means
 * untrusted IFC content should never be handed to readIfcModel without an
 * outer size/timeout gate in front of it (the same category of protection
 * ARQ-157's archive complexity limits give @arq/project-format). Adding
 * that gate is out of this prototype's own scope; it is recorded here so
 * the risk is not silently lost.
 *
 * readIfcModel is a pure read: it produces a plain result value and
 * mutates no existing project state (the only state it touches -
 * web-ifc's own in-WASM-memory model - is always closed via CloseModel
 * before returning, including on every failure path), so a failure cannot
 * partially mutate a project.
 *
 * `IfcAPI.Init()` instantiates a WASM module and is measured (in this
 * repository's sandboxed container) to take on the order of seconds, not
 * milliseconds - far too slow to redo on every call. A module-level
 * singleton (getIfcApi) pays that cost once per process and every
 * readIfcModel call reuses the same initialized instance; a failed
 * initialization is not cached, so a transient failure does not
 * permanently wedge this module.
 */

import { IfcAPI } from 'web-ifc';
import { SUPPORTED_IFC_TYPES } from './ifc-supported-types';

let cachedApi: Promise<IfcAPI> | undefined;

function getIfcApi(): Promise<IfcAPI> {
  cachedApi ??= (async () => {
    const api = new IfcAPI();
    await api.Init();
    return api;
  })().catch((error: unknown) => {
    cachedApi = undefined;
    throw error;
  });
  return cachedApi;
}

export interface IfcEntitySummary {
  readonly expressId: number;
  readonly ifcType: string;
  readonly name?: string;
  readonly globalId?: string;
}

export interface IfcSupportReport {
  /** Count of entities read, by IFC type name (only types in SUPPORTED_IFC_TYPES appear here). */
  readonly preservedEntityCounts: Readonly<Record<string, number>>;
  /** How many of the model's lines were of a type this prototype does not read - never silently unaccounted for. */
  readonly unsupportedLineCount: number;
}

export type IfcReadResult =
  | {
      readonly status: 'read';
      readonly entities: readonly IfcEntitySummary[];
      readonly supportReport: IfcSupportReport;
    }
  | { readonly status: 'rejected'; readonly reason: string };

function readStringProperty(line: unknown, key: 'Name' | 'GlobalId'): string | undefined {
  if (typeof line !== 'object' || line === null) {
    return undefined;
  }
  const property = (line as Record<string, unknown>)[key];
  if (typeof property !== 'object' || property === null) {
    return undefined;
  }
  const value = (property as Record<string, unknown>).value;
  return typeof value === 'string' ? value : undefined;
}

/** Reads an IFC file (as bytes) into a plain summary of its spatial-structure and building-element entities. Never throws. */
export async function readIfcModel(bytes: Uint8Array): Promise<IfcReadResult> {
  let api: IfcAPI;
  try {
    api = await getIfcApi();
  } catch {
    return { status: 'rejected', reason: 'failed to initialize the web-ifc WASM runtime' };
  }

  let modelID: number;
  try {
    modelID = api.OpenModel(bytes);
  } catch {
    return { status: 'rejected', reason: 'not a readable IFC file' };
  }

  try {
    const totalLineCount = api.GetAllLines(modelID).size();

    const entities: IfcEntitySummary[] = [];
    const preservedEntityCounts: Record<string, number> = {};

    for (const [typeName, typeId] of Object.entries(SUPPORTED_IFC_TYPES)) {
      const idsOfType = api.GetLineIDsWithType(modelID, typeId, true);
      const count = idsOfType.size();
      if (count === 0) {
        continue;
      }
      preservedEntityCounts[typeName] = count;
      for (let i = 0; i < count; i += 1) {
        const expressId = idsOfType.get(i);
        const line: unknown = api.GetLine(modelID, expressId);
        const name = readStringProperty(line, 'Name');
        const globalId = readStringProperty(line, 'GlobalId');
        entities.push({
          expressId,
          ifcType: typeName,
          ...(name !== undefined && { name }),
          ...(globalId !== undefined && { globalId }),
        });
      }
    }

    return {
      status: 'read',
      entities,
      supportReport: {
        preservedEntityCounts,
        unsupportedLineCount: Math.max(0, totalLineCount - entities.length),
      },
    };
  } catch {
    return { status: 'rejected', reason: 'error while reading IFC model content' };
  } finally {
    try {
      api.CloseModel(modelID);
    } catch {
      // Best-effort cleanup only - nothing further to do if closing itself fails.
    }
  }
}
