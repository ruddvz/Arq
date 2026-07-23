/**
 * ARQ-166: ai: define ArqScript grammar v0.
 *
 * The top-level grammar node: `version "0.1"` followed by zero or more
 * commands (arqscript-command.ts), matching section 98's example script
 * exactly (a `version` header, then a sequence of level/wall/door/...
 * blocks).
 *
 * `scriptId` makes "grouped undo" visible in the grammar itself (this
 * issue's own acceptance criterion) without this grammar-only issue
 * reaching into @arq/operations' undo-stack.ts to implement grouping -
 * that stack currently pushes one (forward, inverse) pair at a time
 * (packages/operations/src/undo-stack.ts, ARQ-056/057) with no
 * multi-operation batch concept yet. Every command produced by parsing
 * ONE ArqScriptDocument is meant to share this one scriptId as its
 * eventual undo-group key - real undo-stack grouping support is later
 * work, honestly out of a "grammar v0" issue's scope, not implemented
 * here.
 */

import { type ArqScriptCommand } from './arqscript-command';

export interface ArqScriptDocument {
  readonly version: string;
  /** Shared by every command this document contains - the eventual grouped-undo key (see module doc comment). */
  readonly scriptId: string;
  readonly commands: readonly ArqScriptCommand[];
}

export interface CreateArqScriptDocumentInput {
  readonly version: string;
  readonly scriptId: string;
  readonly commands: readonly ArqScriptCommand[];
}

/** Constructs a ScriptDocument; rejects an empty version or scriptId. An empty command list is valid (a script that only declares a version is not itself an error at this grammar layer). */
export function createArqScriptDocument(input: CreateArqScriptDocumentInput): ArqScriptDocument {
  const version = input.version.trim();
  if (version.length === 0) {
    throw new RangeError('ArqScriptDocument version must not be empty');
  }
  const scriptId = input.scriptId.trim();
  if (scriptId.length === 0) {
    throw new RangeError('ArqScriptDocument scriptId must not be empty');
  }
  return { version, scriptId, commands: input.commands };
}

/** Every distinct typed-operation name this document's commands will eventually produce (section 98/ADR-0014: "AI creates previewable typed operations through ArqScript") - real, checkable today even though constructing those operations is later work. */
export function operationTypesUsed(document: ArqScriptDocument): readonly string[] {
  const seen = new Set<string>();
  for (const command of document.commands) {
    seen.add(command.operationType);
  }
  return [...seen].sort();
}

function commandLabel(command: ArqScriptCommand): string {
  return 'id' in command ? `${command.kind} "${command.id}"` : command.kind;
}

/** Every assumption any command in this document recorded (section 97 step 3: "assumptions"), flattened and tagged with which command made it. */
export function collectAssumptions(document: ArqScriptDocument): readonly string[] {
  const assumptions: string[] = [];
  for (const command of document.commands) {
    for (const assumption of command.assumptions) {
      assumptions.push(`${commandLabel(command)}: ${assumption}`);
    }
  }
  return assumptions;
}
