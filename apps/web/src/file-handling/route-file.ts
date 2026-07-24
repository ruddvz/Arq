import { detectFormat, inspectNativeArqHeader } from '@arq/file-ingress';

/**
 * The one decision every file a user opens in the browser needs made once,
 * up front: is this a real Arq project (open it directly, no import step),
 * a SQLite file that is not an Arq project (reject - never silently treat a
 * stranger's database as ours), or something else entirely (hand off to
 * @arq/file-ingress's adapter pipeline). Reads only the first 1MB of the
 * file, matching @arq/file-ingress's own `detectFormat` bound, since a format
 * signature never needs more than that to identify.
 */
export type BrowserFileRoute =
  | { readonly kind: 'open-native-arq'; readonly header: ReturnType<typeof inspectNativeArqHeader> }
  | { readonly kind: 'import'; readonly formatId: string; readonly extensionMismatch: boolean }
  | { readonly kind: 'reject'; readonly code: string; readonly detail: string };

export function routeBrowserFile(
  bytes: Uint8Array,
  name: string,
  mediaTypeHint?: string,
): BrowserFileRoute {
  const candidate = detectFormat(bytes.subarray(0, Math.min(bytes.length, 1024 * 1024)), {
    name,
    byteLength: bytes.byteLength,
    ...(mediaTypeHint ? { mediaTypeHint } : {}),
  })[0];

  if (!candidate) {
    return {
      kind: 'reject',
      code: 'NO_FORMAT_CANDIDATE',
      detail: 'No file format candidate was produced.',
    };
  }
  if (candidate.formatId === 'arq-native') {
    const header = inspectNativeArqHeader(bytes);
    return header.status === 'valid-arq-header'
      ? { kind: 'open-native-arq', header }
      : { kind: 'reject', code: header.code, detail: header.detail };
  }
  if (candidate.formatId === 'sqlite-other') {
    return {
      kind: 'reject',
      code: 'NOT_ARQ_SQLITE',
      detail: 'This is a SQLite database, but its application ID does not identify an Arq project.',
    };
  }
  return {
    kind: 'import',
    formatId: candidate.formatId,
    extensionMismatch: candidate.extensionMismatch,
  };
}
