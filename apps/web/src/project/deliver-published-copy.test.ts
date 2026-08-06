import { describe, expect, it } from 'vitest';
import {
  deliverPublishedCopy,
  publishedCopyFileName,
  type CopyDeliveryEnvironment,
} from './deliver-published-copy';

function recordingEnvironment(overrides: Partial<CopyDeliveryEnvironment> = {}): {
  readonly environment: CopyDeliveryEnvironment;
  readonly created: Blob[];
  readonly revoked: string[];
  readonly downloads: { url: string; fileName: string }[];
} {
  const created: Blob[] = [];
  const revoked: string[] = [];
  const downloads: { url: string; fileName: string }[] = [];
  const environment: CopyDeliveryEnvironment = {
    createObjectUrl: (blob) => {
      created.push(blob);
      return `blob:copy-${created.length}`;
    },
    revokeObjectUrl: (url) => {
      revoked.push(url);
    },
    startDownload: (url, fileName) => {
      downloads.push({ url, fileName });
    },
    ...overrides,
  };
  return { environment, created, revoked, downloads };
}

/** The one blob delivery created, asserted rather than assumed. */
function onlyBlob(created: readonly Blob[]): Blob {
  const [blob] = created;
  if (blob === undefined) throw new Error('delivery created no blob');
  return blob;
}

describe('publishedCopyFileName', () => {
  it('keeps the project name the user chose, spaces included', () => {
    expect(publishedCopyFileName('Riverside House')).toBe('Riverside House.arq');
  });

  it('never produces a name that escapes its folder', () => {
    expect(publishedCopyFileName('../../etc/passwd')).toBe('etc-passwd.arq');
    // Both the drive colon and the separators are substituted, so `C:\` leaves
    // two hyphens. Kept rather than collapsed: two project names that differ
    // only in punctuation must not become the same file name.
    expect(publishedCopyFileName('C:\\Windows\\system32')).toBe('C--Windows-system32.arq');
  });

  it('falls back rather than returning a nameless or hidden file', () => {
    expect(publishedCopyFileName('')).toBe('project.arq');
    expect(publishedCopyFileName('   ')).toBe('project.arq');
    expect(publishedCopyFileName('...')).toBe('project.arq');
    // A leading dot would hide the saved copy from the user who just saved it.
    expect(publishedCopyFileName('.hidden')).toBe('hidden.arq');
  });

  it('does not end in a character Windows drops after the app names the file', () => {
    expect(publishedCopyFileName('Site plan.')).toBe('Site plan.arq');
    expect(publishedCopyFileName('Site plan ')).toBe('Site plan.arq');
  });

  it('bounds the length, and still does not end in a dropped character', () => {
    const name = publishedCopyFileName(`${'a'.repeat(300)} .`);
    expect(name.length).toBeLessThanOrEqual(124);
    expect(name.endsWith('.arq')).toBe(true);
    expect(name).not.toContain(' .arq');
  });

  it('strips control characters rather than passing them to a download header', () => {
    expect(publishedCopyFileName('Plan\u0000\u001fB')).toBe('Plan--B.arq');
  });
});

describe('deliverPublishedCopy', () => {
  it('hands over the whole buffer in one blob under the given name', async () => {
    const { environment, created, downloads } = recordingEnvironment();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);

    const result = deliverPublishedCopy(bytes, 'Riverside.arq', environment);

    expect(result).toEqual({ status: 'delivered' });
    expect(downloads).toEqual([{ url: 'blob:copy-1', fileName: 'Riverside.arq' }]);
    expect(created).toHaveLength(1);
    expect(new Uint8Array(await onlyBlob(created).arrayBuffer())).toEqual(bytes);
  });

  /*
   * The Worker hands bytes back over `postMessage`, so the view can be backed by
   * a buffer the caller reuses. A Blob taken over that buffer would deliver
   * whatever it held later, which is the one way this step could hand over bytes
   * other than the verified ones.
   */
  it('is unaffected by the caller reusing the source buffer afterwards', async () => {
    const { environment, created } = recordingEnvironment();
    const buffer = new ArrayBuffer(4);
    const bytes = new Uint8Array(buffer);
    bytes.set([9, 9, 9, 9]);

    deliverPublishedCopy(bytes, 'Riverside.arq', environment);
    bytes.set([0, 0, 0, 0]);

    expect(new Uint8Array(await onlyBlob(created).arrayBuffer())).toEqual(
      new Uint8Array([9, 9, 9, 9]),
    );
  });

  it('releases the object url after a delivered copy', () => {
    const { environment, revoked } = recordingEnvironment();
    deliverPublishedCopy(new Uint8Array([1]), 'a.arq', environment);
    expect(revoked).toEqual(['blob:copy-1']);
  });

  it('reports a failed download as failed, and still releases the url', () => {
    const { environment, revoked, downloads } = recordingEnvironment({
      startDownload: () => {
        throw new Error('download blocked');
      },
    });

    const result = deliverPublishedCopy(new Uint8Array([1]), 'a.arq', environment);

    expect(result).toEqual({ status: 'failed', detail: 'download blocked' });
    expect(downloads).toEqual([]);
    expect(revoked).toEqual(['blob:copy-1']);
  });

  it('reports a url that could not be created, without revoking one it never got', () => {
    const { environment, revoked } = recordingEnvironment({
      createObjectUrl: () => {
        throw new Error('no object urls here');
      },
    });

    const result = deliverPublishedCopy(new Uint8Array([1]), 'a.arq', environment);

    expect(result).toEqual({ status: 'failed', detail: 'no object urls here' });
    expect(revoked).toEqual([]);
  });
});
