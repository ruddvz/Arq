import { describe, expect, it } from 'vitest';
import { levelId, projectId } from './ids';
import { createProjectV0, withLevelAdded, withLevelRemoved } from './project';

describe('createProjectV0', () => {
  it('starts at revision 0, unarchived, with no levels', () => {
    const project = createProjectV0({ id: projectId('p1'), name: 'My House', units: 'metric' });
    expect(project).toEqual({
      schemaVersion: 0,
      id: 'p1',
      name: 'My House',
      units: 'metric',
      revision: 0,
      archived: false,
      levelIds: [],
    });
  });
});

describe('withLevelAdded', () => {
  it('appends a level and bumps the revision', () => {
    const project = createProjectV0({ id: projectId('p1'), name: 'My House', units: 'metric' });
    const updated = withLevelAdded(project, levelId('l1'));
    expect(updated.levelIds).toEqual(['l1']);
    expect(updated.revision).toBe(1);
  });

  it('is a no-op when the level is already present', () => {
    const project = createProjectV0({ id: projectId('p1'), name: 'My House', units: 'metric' });
    const once = withLevelAdded(project, levelId('l1'));
    const twice = withLevelAdded(once, levelId('l1'));
    expect(twice).toEqual(once);
  });

  it('does not mutate the original project', () => {
    const project = createProjectV0({ id: projectId('p1'), name: 'My House', units: 'metric' });
    withLevelAdded(project, levelId('l1'));
    expect(project.levelIds).toEqual([]);
    expect(project.revision).toBe(0);
  });
});

describe('withLevelRemoved', () => {
  it('removes a level and bumps the revision', () => {
    const project = withLevelAdded(
      createProjectV0({ id: projectId('p1'), name: 'My House', units: 'metric' }),
      levelId('l1'),
    );
    const updated = withLevelRemoved(project, levelId('l1'));
    expect(updated.levelIds).toEqual([]);
    expect(updated.revision).toBe(2);
  });

  it('is a no-op when the level is not present', () => {
    const project = createProjectV0({ id: projectId('p1'), name: 'My House', units: 'metric' });
    expect(withLevelRemoved(project, levelId('missing'))).toEqual(project);
  });
});
