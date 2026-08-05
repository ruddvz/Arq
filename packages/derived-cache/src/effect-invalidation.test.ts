import { describe, expect, it } from 'vitest';
import { createInvalidationPlan } from './invalidation';
import {
  DEFAULT_EFFECT_TABLE,
  effectsAnyOutput,
  invalidationsFromEffects,
  type ElementEffect,
} from './effect-invalidation';

function wallEffect(changedProperties: readonly string[]): ElementEffect {
  return {
    elementId: 'wall-1',
    category: 'Wall',
    kind: 'modified',
    changedProperties,
    levelId: 'level-0',
  };
}

function outputKinds(effects: readonly ElementEffect[], projectId = 'project-1') {
  return invalidationsFromEffects(effects, { projectId })
    .targets.map((target) => target.outputKind)
    .sort();
}

describe('invalidationsFromEffects', () => {
  it('invalidates nothing for a property no output reads', () => {
    // Renaming a wall must not re-mesh a building.
    const result = invalidationsFromEffects([wallEffect(['description'])], {
      projectId: 'project-1',
    });

    expect(result.targets).toEqual([]);
  });

  it('invalidates exactly the outputs a geometry change feeds', () => {
    expect(outputKinds([wallEffect(['start'])])).toEqual([
      'plan-projection-tile',
      'room-boundary',
      'wall-display-mesh',
    ]);
  });

  it('leaves room boundaries alone for a change that cannot move one', () => {
    // A wall's material cannot move a room boundary, and re-tracing for it
    // would undo the bound this exists to create.
    expect(outputKinds([wallEffect(['materialId'])])).toEqual([
      'plan-projection-tile',
      'wall-display-mesh',
    ]);
  });

  it('invalidates only the search index for a name change', () => {
    expect(outputKinds([wallEffect(['name'])])).toEqual(['search-index']);
  });

  it('invalidates every consuming output on a creation, whatever properties are listed', () => {
    const created: ElementEffect = {
      elementId: 'wall-2',
      category: 'Wall',
      kind: 'created',
      changedProperties: [],
      levelId: 'level-0',
    };

    expect(outputKinds([created])).toEqual([
      'plan-projection-tile',
      'room-boundary',
      'search-index',
      'wall-display-mesh',
    ]);
  });

  it('invalidates every consuming output on a deletion, where an empty property list would say nothing changed', () => {
    const deleted: ElementEffect = {
      elementId: 'wall-2',
      category: 'Wall',
      kind: 'deleted',
      changedProperties: [],
      levelId: 'level-0',
    };

    expect(outputKinds([deleted])).toHaveLength(4);
  });

  it('scopes an element output to the element and a level output to the level', () => {
    const result = invalidationsFromEffects([wallEffect(['start'])], { projectId: 'project-1' });
    const byKind = new Map(result.targets.map((target) => [target.outputKind, target.scopeId]));

    expect(byKind.get('wall-display-mesh')).toBe('wall-1');
    expect(byKind.get('room-boundary')).toBe('level-0');
  });

  it('scopes a project output to the project id', () => {
    const result = invalidationsFromEffects([wallEffect(['name'])], { projectId: 'project-1' });

    expect(result.targets[0]?.scopeId).toBe('project-1');
  });

  it('skips a level-scoped output rather than inventing a scope for an element with no level', () => {
    // An invalidation aimed at the wrong scope clears a cache entry that was
    // fine and leaves the one that was not.
    const noLevel: ElementEffect = {
      elementId: 'wall-1',
      category: 'Wall',
      kind: 'modified',
      changedProperties: ['start'],
    };

    expect(outputKinds([noLevel])).toEqual(['wall-display-mesh']);
  });

  it('skips a project-scoped output when no project id was supplied', () => {
    const result = invalidationsFromEffects([wallEffect(['name'])]);

    expect(result.targets).toEqual([]);
  });

  it('reports a category the table has no row for, rather than silently producing nothing', () => {
    const unknown: ElementEffect = {
      elementId: 'slab-1',
      category: 'Slab',
      kind: 'modified',
      changedProperties: ['thickness'],
      levelId: 'level-0',
    };

    const result = invalidationsFromEffects([unknown], { projectId: 'project-1' });

    expect(result.targets).toEqual([]);
    expect(result.unmappedCategories).toEqual(['Slab']);
  });

  it('names the properties that caused each target', () => {
    const result = invalidationsFromEffects([wallEffect(['start', 'materialId'])], {
      projectId: 'project-1',
    });
    const boundary = result.targets.find((target) => target.outputKind === 'room-boundary');

    // Only the properties that output actually reads, not every property that
    // moved - a reason listing materialId next to room-boundary would be wrong.
    expect(boundary?.reason).toBe('Wall start changed');
  });

  it('takes priority from the caller, which is the only place that knows what is on screen', () => {
    const result = invalidationsFromEffects([wallEffect(['start'])], {
      projectId: 'project-1',
      priorityFor: (kind) => (kind === 'wall-display-mesh' ? 'InteractiveCritical' : 'ActiveView'),
    });
    const mesh = result.targets.find((target) => target.outputKind === 'wall-display-mesh');

    expect(mesh?.priority).toBe('InteractiveCritical');
  });

  it('feeds createInvalidationPlan, which dedupes across a multi-element edit', () => {
    const effects: readonly ElementEffect[] = [
      wallEffect(['start']),
      { ...wallEffect(['end']), elementId: 'wall-2' },
    ];

    const result = invalidationsFromEffects(effects, { projectId: 'project-1' });
    const plan = createInvalidationPlan(result.targets);

    // Two walls on one level: two meshes, one boundary retrace, one tile.
    expect(plan.filter((target) => target.outputKind === 'room-boundary')).toHaveLength(1);
    expect(plan.filter((target) => target.outputKind === 'wall-display-mesh')).toHaveLength(2);
  });

  it('is empty for no effects', () => {
    expect(invalidationsFromEffects([])).toEqual({ targets: [], unmappedCategories: [] });
  });
});

describe('effectsAnyOutput', () => {
  it('is false for a property nothing derives from', () => {
    expect(effectsAnyOutput('Wall', ['description'])).toBe(false);
  });

  it('is true for a geometry property', () => {
    expect(effectsAnyOutput('Wall', ['start'])).toBe(true);
  });

  it('is true for an unknown category, since nothing here can rule it out', () => {
    expect(effectsAnyOutput('Slab', ['thickness'])).toBe(true);
  });

  it('has no wildcard rows in the default table', () => {
    // A '*' row re-derives an output for every property change, which is the
    // failure this module removes wearing the table's own clothes. The
    // mechanism stays for a caller with a genuine whole-element output; the
    // default table does not use it.
    const wildcards = Object.entries(DEFAULT_EFFECT_TABLE).flatMap(([category, consumptions]) =>
      consumptions
        .filter((consumption) => consumption.properties.includes('*'))
        .map((consumption) => `${category}/${consumption.outputKind}`),
    );

    expect(wildcards).toEqual([]);
  });

  it('reads the table it is given', () => {
    expect(effectsAnyOutput('Wall', ['start'], DEFAULT_EFFECT_TABLE)).toBe(true);
    expect(effectsAnyOutput('Wall', ['start'], { Wall: [] })).toBe(false);
  });
});
