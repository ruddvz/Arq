/**
 * Handing a verified `.arq` copy to the user, and the file name it arrives
 * under.
 *
 * This is the last step of publication and deliberately the *only* step that
 * touches the browser. Everything that decides whether a copy is sound already
 * happened in `publishProjectFile`, which returns bytes only after an
 * independent reader opened them and matched project, revision and semantic
 * hash. So there is nothing here to check and nothing here to partially
 * deliver: either a whole verified buffer reaches the download, or none of it
 * does and the caller reports a refusal.
 *
 * That is what "atomic" means at this seam, and it is why the bytes are handed
 * over as one `Blob` rather than streamed. A stream would let a copy arrive
 * truncated but named as though it were complete, which is exactly the file the
 * verification exists to stop the user from being given.
 */

/** The browser surface delivery needs, injected so this is testable without a DOM. */
export interface CopyDeliveryEnvironment {
  readonly createObjectUrl: (blob: Blob) => string;
  readonly revokeObjectUrl: (url: string) => void;
  /** Starts the download. Anything it throws is reported as a delivery failure, never as a verification one. */
  readonly startDownload: (url: string, fileName: string) => void;
}

export type CopyDeliveryResult =
  { readonly status: 'delivered' } | { readonly status: 'failed'; readonly detail: string };

/**
 * Characters a file system or a `Content-Disposition` header treats as
 * structure rather than as a name, plus the control range. Replaced with a
 * hyphen rather than stripped, so two projects whose names differ only in
 * punctuation do not collapse to the same file name. A space is deliberately
 * not in the class: it is legal in a file name, and substituting it would
 * rename the project the user chose.
 */
const UNSAFE_FILE_NAME = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * A leading dot hides the file on Unix-like systems, and a trailing dot or
 * space is silently dropped by Windows - which would rename the file after the
 * app has already told the user what it is called.
 *
 * Leading hyphens go with the dots. They are not dangerous, but they are what
 * a traversal attempt leaves behind once the separators have been substituted
 * (`../../etc/passwd` becomes `..-..-etc-passwd`), and a saved copy should be
 * named after the project rather than after the shape of a rejected path.
 */
function trimEdges(value: string): string {
  return value
    .trim()
    .replace(/^[.-]+/, '')
    .replace(/[. ]+$/, '');
}

/** Long enough for any real project name, short enough for the strictest file system. */
const MAX_STEM_LENGTH = 120;

/**
 * The name a saved copy arrives under, derived from what the user calls the
 * project. A project name is free text - it can be empty, or entirely
 * punctuation, or longer than a file system accepts - so this never returns
 * something a download would reject, and never returns a name that silently
 * escapes its folder.
 */
export function publishedCopyFileName(displayName: string): string {
  const stem = trimEdges(
    trimEdges(displayName.replace(UNSAFE_FILE_NAME, '-').replace(/\s+/g, ' ')).slice(
      0,
      MAX_STEM_LENGTH,
    ),
  );
  return `${stem === '' ? 'project' : stem}.arq`;
}

/**
 * Delivers verified bytes under `fileName`. Call only with the bytes from a
 * `published` receipt: this reports what the browser did, and has no way to
 * tell a verified buffer from an unverified one.
 */
export function deliverPublishedCopy(
  bytes: Uint8Array,
  fileName: string,
  environment: CopyDeliveryEnvironment,
  /**
   * Defaults to the `.arq` type this was written for. Passed explicitly by the
   * sheet exporter, which hands over a PDF - one delivery seam rather than two,
   * because the hard part here is the atomic hand-over and that is identical
   * whatever the bytes mean.
   */
  mimeType = 'application/vnd.arq.project',
): CopyDeliveryResult {
  // Copied into a fresh buffer: the incoming view may be backed by a shared or
  // transferable ArrayBuffer, and a Blob built over a buffer that is later
  // reused or detached is the one way this step could hand over bytes that are
  // not the ones that were verified.
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  let url: string;
  try {
    url = environment.createObjectUrl(blob);
  } catch (error) {
    return { status: 'failed', detail: messageOf(error) };
  }
  try {
    environment.startDownload(url, fileName);
    return { status: 'delivered' };
  } catch (error) {
    return { status: 'failed', detail: messageOf(error) };
  } finally {
    // Released on every path, including the thrown one. An object URL holds the
    // whole file in memory until it is revoked or the document unloads, and a
    // project file is not small.
    environment.revokeObjectUrl(url);
  }
}

/** The real browser, for the app to pass in. */
export function browserCopyDelivery(documentRef: Document): CopyDeliveryEnvironment {
  return {
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    /*
     * Deferred by a task rather than revoked inline. `deliverPublishedCopy`
     * revokes in a `finally`, which is the right shape for the seam - the URL
     * is released whatever happened - but a synchronous revoke lands in the
     * same task as the anchor click, and a browser that has only queued the
     * download by then cancels it. Deferring keeps the release guaranteed and
     * moves it past the click.
     */
    revokeObjectUrl: (url) => {
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 0);
    },
    startDownload: (url, fileName) => {
      const anchor = documentRef.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      // Kept out of the layout and out of the accessibility tree: it exists for
      // one synchronous click and is never something a user navigates to.
      anchor.style.display = 'none';
      documentRef.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
      }
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
