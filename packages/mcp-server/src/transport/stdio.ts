/**
 * Line-delimited JSON-RPC over standard input and output.
 *
 * The framing rules are small and all of them matter:
 *
 * One message per line, and standard output carries nothing else. A stray
 * `console.log` anywhere in this process corrupts the stream, which is why
 * every diagnostic in this package writes to standard error.
 *
 * Lines are bounded. An unbounded line reader will happily buffer a
 * gigabyte from a misbehaving or hostile peer before it notices; the reader
 * refuses past a ceiling and answers with a parse error.
 *
 * A message that cannot be parsed still gets an answer where one is owed.
 * Silently dropping a malformed request leaves a client waiting for a
 * response that will never come, which reads as a hang rather than as the
 * client bug it is.
 */

import type { ArqMcpServer } from '../mcp/server';
import { JSON_RPC_ERRORS, failure, parseMessage, type JsonRpcResponse } from '../mcp/protocol';

/** One megabyte per message. Larger than any legitimate change set, smaller than a denial-of-service. */
export const MAX_MESSAGE_BYTES = 1_048_576;

export interface LineReaderOptions {
  readonly maxBytes?: number;
}

export interface LineReader {
  /** Feeds a chunk and returns the complete lines it produced. Throws once a single line exceeds the ceiling. */
  push(chunk: string): readonly string[];
}

export class MessageTooLargeError extends Error {
  constructor(limit: number) {
    super(`a single JSON-RPC message exceeded ${limit} bytes`);
    this.name = 'MessageTooLargeError';
  }
}

export function createLineReader(options: LineReaderOptions = {}): LineReader {
  const maxBytes = options.maxBytes ?? MAX_MESSAGE_BYTES;
  let buffer = '';

  return {
    push(chunk) {
      buffer += chunk;
      const lines: string[] = [];
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/u, '');
        buffer = buffer.slice(newline + 1);
        if (line.trim().length > 0) {
          lines.push(line);
        }
        newline = buffer.indexOf('\n');
      }
      // The ceiling is checked against what is still unterminated, so a
      // peer that never sends a newline is cut off rather than buffered.
      if (buffer.length > maxBytes) {
        buffer = '';
        throw new MessageTooLargeError(maxBytes);
      }
      return lines;
    },
  };
}

/** Turns one line into a response, or `undefined` for a notification. Pure, so the framing can be tested without a process. */
export function handleLine(server: ArqMcpServer, line: string): JsonRpcResponse | undefined {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(line);
  } catch {
    return failure(null, JSON_RPC_ERRORS.parse, 'That line was not valid JSON.');
  }

  const message = parseMessage(parsedJson);
  if (message.kind === 'invalid') {
    return failure(message.id, JSON_RPC_ERRORS.invalidRequest, message.reason);
  }
  if (message.kind === 'notification') {
    server.handle(message.request);
    return undefined;
  }

  try {
    return server.handle(message.request);
  } catch (error) {
    // A fault inside dispatch must not take the connection down, and must
    // not describe itself: the detail goes to standard error.
    process.stderr.write(
      `[arq-mcp] dispatch fault: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    return failure(
      message.request.id,
      JSON_RPC_ERRORS.internal,
      'The server could not handle that request.',
    );
  }
}

export interface StdioTransportOptions {
  readonly server: ArqMcpServer;
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly maxBytes?: number;
}

export interface StdioTransport {
  close(): void;
}

export function serveStdio(options: StdioTransportOptions): StdioTransport {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const reader = createLineReader({
    ...(options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes }),
  });

  const write = (response: JsonRpcResponse): void => {
    output.write(`${JSON.stringify(response)}\n`);
  };

  const onData = (chunk: Buffer | string): void => {
    let lines: readonly string[];
    try {
      lines = reader.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
    } catch (error) {
      if (error instanceof MessageTooLargeError) {
        write(failure(null, JSON_RPC_ERRORS.parse, 'That message was too large to read.'));
        return;
      }
      throw error;
    }
    for (const line of lines) {
      const response = handleLine(options.server, line);
      if (response !== undefined) {
        write(response);
      }
    }
  };

  input.setEncoding?.('utf8');
  input.on('data', onData);

  return {
    close() {
      input.off('data', onData);
    },
  };
}
