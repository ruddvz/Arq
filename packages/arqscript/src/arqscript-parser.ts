/**
 * ARQ-167: ai: implement ArqScript parser.
 *
 * Turns ArqScript v0 source text into an `ArqScriptDocument`
 * (arqscript-document.ts), the AST arqscript-command.ts already defines
 * (ARQ-166) - the step that issue's own grammar-only scope deliberately
 * left undone. Statement dispatch and property extraction follow
 * docs/ai/ARQSCRIPT-GRAMMAR.ebnf exactly (`statement`'s eleven
 * alternatives); every command's required/optional fields are validated
 * by its own `create*Command` constructor (arqscript-command.ts), which
 * is also where an omitted optional field's default and assumption
 * message live - this parser does not duplicate that logic.
 *
 * `parseArqScript` never throws: every internal `ArqScriptSyntaxError`
 * (bad syntax) or `RangeError` (a syntactically valid statement with
 * semantically invalid data, e.g. an empty wall id) is caught and turned
 * into a well-formed `'rejected'` result carrying a source position,
 * the same safe-failure boundary `@arq/dxf-adapter`'s `parseDxf` and
 * `@arq/project-format`'s `importArchive` already use. AI guardrail "No
 * arbitrary code execution" (docs/ai/AI-GUARDRAILS.md) holds because
 * this parser only ever produces plain AST data - there is no `eval`,
 * `Function`, or dynamic dispatch on source text anywhere in this
 * module or its dependencies.
 */

import { ArqScriptSyntaxError, tokenize, type SourcePosition } from './arqscript-lexer';
import { TokenCursor } from './arqscript-token-cursor';
import {
  optionalLengthMmProperty,
  optionalStringProperty,
  parseLengthMm,
  parsePropertyBlock,
  requireLengthMmProperty,
  requirePointArrayProperty,
  requirePointProperty,
  requireStringProperty,
} from './arqscript-value-parser';
import {
  createDimensionCommand,
  createDoorCommand,
  createLevelCommand,
  createRenameCommand,
  createRoomCommand,
  createSelectByCategoryCommand,
  createSelectByIdCommand,
  createUnitsCommand,
  createUpdateWallCommand,
  createWallCommand,
  createWindowCommand,
  type ArqScriptCommand,
} from './arqscript-command';
import { createArqScriptDocument, type ArqScriptDocument } from './arqscript-document';

export type ArqScriptParseResult =
  | { readonly status: 'parsed'; readonly document: ArqScriptDocument }
  | { readonly status: 'rejected'; readonly reason: string; readonly position: SourcePosition };

function parseSelectStatement(cursor: TokenCursor): ArqScriptCommand {
  const mode = cursor.expectAnyIdent();
  if (mode === 'id') {
    const ids = [cursor.expectString()];
    while (cursor.isPunct(',')) {
      cursor.advance();
      ids.push(cursor.expectString());
    }
    return createSelectByIdCommand(ids);
  }
  if (mode === 'category') {
    return createSelectByCategoryCommand(cursor.expectString());
  }
  throw new ArqScriptSyntaxError(
    'expected "id" or "category" after "select"',
    cursor.peek().position,
  );
}

function parseStatementBody(cursor: TokenCursor, keyword: string): ArqScriptCommand {
  switch (keyword) {
    case 'units': {
      const unit = cursor.expectAnyIdent();
      if (unit !== 'metric' && unit !== 'imperial') {
        throw new RangeError(`units must be "metric" or "imperial", got "${unit}"`);
      }
      return createUnitsCommand(unit);
    }
    case 'level': {
      const name = cursor.expectString();
      cursor.expectIdent('elevation');
      return createLevelCommand({ name, elevationMm: parseLengthMm(cursor) });
    }
    case 'wall': {
      const id = cursor.expectString();
      const props = parsePropertyBlock(cursor);
      const wallType = optionalStringProperty(props, 'type');
      const heightMm = optionalLengthMmProperty(props, 'height');
      return createWallCommand({
        id,
        from: requirePointProperty(props, 'from'),
        to: requirePointProperty(props, 'to'),
        ...(wallType !== undefined && { wallType }),
        ...(heightMm !== undefined && { heightMm }),
      });
    }
    case 'update': {
      cursor.expectIdent('wall');
      const id = cursor.expectString();
      const props = parsePropertyBlock(cursor);
      const wallType = optionalStringProperty(props, 'type');
      const heightMm = optionalLengthMmProperty(props, 'height');
      return createUpdateWallCommand({
        id,
        ...(wallType !== undefined && { wallType }),
        ...(heightMm !== undefined && { heightMm }),
      });
    }
    case 'door': {
      const id = cursor.expectString();
      const props = parsePropertyBlock(cursor);
      const widthMm = optionalLengthMmProperty(props, 'width');
      const heightMm = optionalLengthMmProperty(props, 'height');
      return createDoorCommand({
        id,
        hostWallId: requireStringProperty(props, 'host'),
        ...(widthMm !== undefined && { widthMm }),
        ...(heightMm !== undefined && { heightMm }),
        offsetMm: requireLengthMmProperty(props, 'offset'),
      });
    }
    case 'window': {
      const id = cursor.expectString();
      const props = parsePropertyBlock(cursor);
      const widthMm = optionalLengthMmProperty(props, 'width');
      const heightMm = optionalLengthMmProperty(props, 'height');
      const sillHeightMm = optionalLengthMmProperty(props, 'sill');
      return createWindowCommand({
        id,
        hostWallId: requireStringProperty(props, 'host'),
        ...(widthMm !== undefined && { widthMm }),
        ...(heightMm !== undefined && { heightMm }),
        ...(sillHeightMm !== undefined && { sillHeightMm }),
        offsetMm: requireLengthMmProperty(props, 'offset'),
      });
    }
    case 'room': {
      const id = cursor.expectString();
      const props = parsePropertyBlock(cursor);
      return createRoomCommand({
        id,
        name: requireStringProperty(props, 'name'),
        boundary: requirePointArrayProperty(props, 'boundary'),
      });
    }
    case 'dimension': {
      const id = cursor.expectString();
      const props = parsePropertyBlock(cursor);
      return createDimensionCommand({
        id,
        from: requirePointProperty(props, 'from'),
        to: requirePointProperty(props, 'to'),
      });
    }
    case 'select':
      return parseSelectStatement(cursor);
    case 'rename': {
      const id = cursor.expectString();
      cursor.expectIdent('to');
      return createRenameCommand({ id, newName: cursor.expectString() });
    }
    default:
      throw new ArqScriptSyntaxError(`unknown statement "${keyword}"`, cursor.peek().position);
  }
}

function parseStatement(cursor: TokenCursor): ArqScriptCommand {
  const start = cursor.peek().position;
  const keyword = cursor.expectAnyIdent();
  try {
    return parseStatementBody(cursor, keyword);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new ArqScriptSyntaxError(error.message, start);
    }
    throw error;
  }
}

/** Parses ArqScript v0 source text into an ArqScriptDocument. Never throws - always returns a well-formed 'parsed' or 'rejected' result. `scriptId` is assigned by the caller (the grammar has no such field in source text); see ArqScriptDocument's own doc comment for why it exists. */
export function parseArqScript(source: string, scriptId: string): ArqScriptParseResult {
  try {
    const tokens = tokenize(source);
    const cursor = new TokenCursor(tokens);
    cursor.expectIdent('version');
    const version = cursor.expectString();

    const commands: ArqScriptCommand[] = [];
    while (!cursor.isEof()) {
      commands.push(parseStatement(cursor));
    }

    const document = createArqScriptDocument({ version, scriptId, commands });
    return { status: 'parsed', document };
  } catch (error) {
    if (error instanceof ArqScriptSyntaxError) {
      return { status: 'rejected', reason: error.message, position: error.position };
    }
    if (error instanceof RangeError) {
      return { status: 'rejected', reason: error.message, position: { line: 0, column: 0 } };
    }
    return {
      status: 'rejected',
      reason: 'unexpected error while parsing ArqScript',
      position: { line: 0, column: 0 },
    };
  }
}
