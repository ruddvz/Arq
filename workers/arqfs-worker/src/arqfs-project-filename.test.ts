import { describe, expect, it } from 'vitest';
import {
  opfsFilenameForProject,
  arqfsWorkerUrlSearch,
  readProjectIdFromWorkerSearch,
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
});
