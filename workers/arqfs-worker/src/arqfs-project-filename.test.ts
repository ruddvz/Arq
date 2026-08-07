import { describe, expect, it } from 'vitest';
import {
  opfsFilenameForProject,
  arqfsWorkerUrlSearch,
  arqfsSelectedBytesWorkerUrlSearch,
  readProjectIdFromWorkerSearch,
  readProjectIdOrUnknown,
  UNKNOWN_ARQFS_PROJECT_ID,
  readWorkerSourceFromSearch,
} from './arqfs-project-filename';

describe('arqfs project-scoped OPFS filename', () => {
  it('derives distinct filenames for distinct projects', () => {
    expect(opfsFilenameForProject('project-a')).toBe('/arq-projects/project-a.sqlite3');
    expect(opfsFilenameForProject('project-b')).toBe('/arq-projects/project-b.sqlite3');
    expect(opfsFilenameForProject('project-a')).not.toBe(opfsFilenameForProject('project-b'));
  });

  it('rejects a project id that could escape the projects directory', () => {
    for (const projectId of ['', '..', '../escape', 'a/b', 'a\\b']) {
      expect(() => opfsFilenameForProject(projectId)).toThrow();
    }
  });

  /**
   * Round-trips through exactly what a real Worker URL carries: the client encodes
   * a search string, the Worker (via `self.location.search`) reads it back. A
   * project id containing characters that need percent-encoding (the one thing a
   * URL query string cannot carry literally) must still survive the round trip.
   */
  it('round-trips a project id through the Worker URL search string, including characters needing encoding', () => {
    for (const projectId of ['project-1', 'a b', 'a&b=c', 'проект-1', 'a+b']) {
      const search = arqfsWorkerUrlSearch(projectId);
      expect(readProjectIdFromWorkerSearch(search)).toBe(projectId);
    }
  });

  it('rejects a Worker search string with no project id, so misconfiguration fails fast rather than opening an arbitrary file', () => {
    expect(() => readProjectIdFromWorkerSearch('')).toThrow(/requires a project id/);
    expect(() => readProjectIdFromWorkerSearch('?other=1')).toThrow(/requires a project id/);
  });

  it('rejects a project id smuggled through the URL that would otherwise escape the projects directory', () => {
    expect(() => readProjectIdFromWorkerSearch('?project=..%2F..%2Fescape')).toThrow();
  });

  /**
   * Every response the Worker sends carries a project id, including the one
   * it sends when it could not be constructed at all - which is exactly the
   * case where the id is missing or invalid, and where
   * `readProjectIdFromWorkerSearch` would throw a second time and lose the
   * original construction error.
   */
  it('answers with an explicit unknown project id when the URL has no usable one', () => {
    expect(readProjectIdOrUnknown('')).toBe(UNKNOWN_ARQFS_PROJECT_ID);
    expect(readProjectIdOrUnknown('?project=..%2Fescape')).toBe(UNKNOWN_ARQFS_PROJECT_ID);
  });

  it('answers with the real project id when the URL has a usable one', () => {
    expect(readProjectIdOrUnknown('?project=project-a')).toBe('project-a');
  });
});

describe('arqfs Worker source mode', () => {
  it('round-trips the selected-bytes mode through the Worker URL', () => {
    expect(readWorkerSourceFromSearch(arqfsSelectedBytesWorkerUrlSearch())).toBe('selected-bytes');
  });

  it('treats a Worker constructed for a project as the owned-project mode', () => {
    expect(readWorkerSourceFromSearch(arqfsWorkerUrlSearch('project-a'))).toBe('owned-project');
    expect(readWorkerSourceFromSearch('')).toBe('owned-project');
  });

  it('refuses an unrecognised mode rather than defaulting to the writable one', () => {
    // A typo must not silently produce a Worker that owns a project file.
    for (const search of ['?source=selectedbytes', '?source=SELECTED-BYTES', '?source=readonly']) {
      expect(() => readWorkerSourceFromSearch(search)).toThrow();
    }
  });
});
