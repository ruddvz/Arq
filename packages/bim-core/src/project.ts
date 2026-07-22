/**
 * ARQ-061: define project schema v0.
 *
 * The top-level project container - metadata plus which levels belong to
 * it - matching api/openapi.yaml's ProjectMetadata shape (id, name,
 * units, revision, schemaVersion) plus a levelIds list for hierarchy.
 * Individual entity schemas (Level itself: ARQ-062; the element base
 * schema: ARQ-063; and so on) are deliberately separate, later issues -
 * this is only the container, not the full model.
 *
 * `schemaVersion: 0` is a literal type tag so a future v1 can be added as
 * a discriminated union member (`ProjectV0 | ProjectV1`) without breaking
 * existing code that narrows on `schemaVersion`.
 *
 * `units` here is the user-facing project setting (metric vs imperial
 * project preferences/display, matching openapi.yaml's ProjectMetadata),
 * not the internal storage representation question that ADR-0004 / D-014
 * leaves open - those are different questions even though both are about
 * "units".
 */

import type { LevelId, ProjectId } from './ids';

export type ProjectUnitsPreference = 'metric' | 'imperial';

export interface ProjectV0 {
  readonly schemaVersion: 0;
  readonly id: ProjectId;
  readonly name: string;
  readonly units: ProjectUnitsPreference;
  readonly revision: number;
  readonly archived: boolean;
  readonly levelIds: readonly LevelId[];
}

export interface CreateProjectV0Input {
  readonly id: ProjectId;
  readonly name: string;
  readonly units: ProjectUnitsPreference;
}

/** Constructs a brand-new ProjectV0 at revision 0, unarchived, with no levels yet. */
export function createProjectV0(input: CreateProjectV0Input): ProjectV0 {
  return {
    schemaVersion: 0,
    id: input.id,
    name: input.name,
    units: input.units,
    revision: 0,
    archived: false,
    levelIds: [],
  };
}

export function withLevelAdded(project: ProjectV0, levelId: LevelId): ProjectV0 {
  if (project.levelIds.includes(levelId)) {
    return project;
  }
  return { ...project, levelIds: [...project.levelIds, levelId], revision: project.revision + 1 };
}

export function withLevelRemoved(project: ProjectV0, levelId: LevelId): ProjectV0 {
  if (!project.levelIds.includes(levelId)) {
    return project;
  }
  return {
    ...project,
    levelIds: project.levelIds.filter((id) => id !== levelId),
    revision: project.revision + 1,
  };
}
