/**
 * Directed derivation graph only.
 *
 * Do not place bidirectional geometric constraints or general semantic
 * relationships in this structure. Those require separate systems.
 */

export type NodeId = string;

export interface DerivedNode<Context> {
  readonly id: NodeId;
  readonly dependencies: readonly NodeId[];
  evaluate(context: Context): void | Promise<void>;
}

export interface EvaluationPlan {
  readonly orderedNodeIds: readonly NodeId[];
  readonly impactedNodeIds: ReadonlySet<NodeId>;
}

export class UnknownDependencyError extends Error {
  public constructor(
    public readonly nodeId: NodeId,
    public readonly dependencyId: NodeId,
  ) {
    super('Node ' + nodeId + ' depends on unknown node ' + dependencyId + '.');
    this.name = 'UnknownDependencyError';
  }
}

export class DependencyCycleError extends Error {
  public constructor(public readonly cycle: readonly NodeId[]) {
    super('Circular derivation dependency: ' + cycle.join(' -> '));
    this.name = 'DependencyCycleError';
  }
}

export class DirectedDependencyGraph<Context> {
  private readonly nodes = new Map<NodeId, DerivedNode<Context>>();

  public addNode(node: DerivedNode<Context>): void {
    if (!node.id) {
      throw new Error('A derivation node requires a non-empty id.');
    }
    if (this.nodes.has(node.id)) {
      throw new Error('Duplicate derivation node id: ' + node.id + '.');
    }
    if (new Set(node.dependencies).size !== node.dependencies.length) {
      throw new Error('Node ' + node.id + ' declares a dependency more than once.');
    }
    if (node.dependencies.includes(node.id)) {
      throw new DependencyCycleError([node.id, node.id]);
    }
    this.nodes.set(node.id, {
      id: node.id,
      dependencies: [...node.dependencies],
      evaluate: node.evaluate,
    });
  }

  public removeNode(nodeId: NodeId): void {
    this.nodes.delete(nodeId);
  }

  public createEvaluationPlan(dirtyNodeIds: Iterable<NodeId>): EvaluationPlan {
    const dirty = new Set(dirtyNodeIds);
    const reverseEdges = this.createReverseEdges();

    for (const nodeId of dirty) {
      this.assertKnownNode(nodeId);
    }

    // A mutation affects each downstream dependant, not just the directly
    // edited node. This is the error in the original supplied graph.
    const impacted = new Set<NodeId>();
    const pending = [...dirty].sort();

    while (pending.length > 0) {
      const current = pending.shift()!;
      if (impacted.has(current)) {
        continue;
      }
      impacted.add(current);

      const dependants = [...(reverseEdges.get(current) ?? [])].sort();
      for (const dependant of dependants) {
        if (!impacted.has(dependant)) {
          pending.push(dependant);
        }
      }
      pending.sort();
    }

    const inDegree = new Map<NodeId, number>();
    for (const nodeId of impacted) {
      const node = this.nodes.get(nodeId)!;
      let degree = 0;
      for (const dependencyId of node.dependencies) {
        this.assertKnownNode(dependencyId);
        if (impacted.has(dependencyId)) {
          degree += 1;
        }
      }
      inDegree.set(nodeId, degree);
    }

    const ready = [...impacted].filter((nodeId) => inDegree.get(nodeId) === 0).sort();
    const orderedNodeIds: NodeId[] = [];

    while (ready.length > 0) {
      const nodeId = ready.shift()!;
      orderedNodeIds.push(nodeId);

      for (const dependant of [...(reverseEdges.get(nodeId) ?? [])].sort()) {
        if (!impacted.has(dependant)) {
          continue;
        }
        const remaining = (inDegree.get(dependant) ?? 0) - 1;
        inDegree.set(dependant, remaining);
        if (remaining === 0) {
          ready.push(dependant);
          ready.sort();
        }
      }
    }

    if (orderedNodeIds.length !== impacted.size) {
      throw new DependencyCycleError(this.findCycle(impacted));
    }

    return {
      orderedNodeIds,
      impactedNodeIds: impacted,
    };
  }

  public async evaluateDirty(
    dirtyNodeIds: Iterable<NodeId>,
    context: Context,
  ): Promise<EvaluationPlan> {
    const plan = this.createEvaluationPlan(dirtyNodeIds);
    for (const nodeId of plan.orderedNodeIds) {
      await this.nodes.get(nodeId)!.evaluate(context);
    }
    return plan;
  }

  private createReverseEdges(): Map<NodeId, Set<NodeId>> {
    const reverseEdges = new Map<NodeId, Set<NodeId>>();
    for (const nodeId of this.nodes.keys()) {
      reverseEdges.set(nodeId, new Set<NodeId>());
    }

    for (const node of this.nodes.values()) {
      for (const dependencyId of node.dependencies) {
        if (!this.nodes.has(dependencyId)) {
          throw new UnknownDependencyError(node.id, dependencyId);
        }
        reverseEdges.get(dependencyId)!.add(node.id);
      }
    }

    return reverseEdges;
  }

  private assertKnownNode(nodeId: NodeId): void {
    if (!this.nodes.has(nodeId)) {
      throw new Error('Unknown derivation node: ' + nodeId + '.');
    }
  }

  private findCycle(impacted: ReadonlySet<NodeId>): readonly NodeId[] {
    type Colour = 'white' | 'grey' | 'black';
    const colours = new Map<NodeId, Colour>();
    const stack: NodeId[] = [];

    for (const nodeId of impacted) {
      colours.set(nodeId, 'white');
    }

    const visit = (nodeId: NodeId): NodeId[] | undefined => {
      colours.set(nodeId, 'grey');
      stack.push(nodeId);

      const node = this.nodes.get(nodeId)!;
      for (const dependencyId of [...node.dependencies].sort()) {
        if (!impacted.has(dependencyId)) {
          continue;
        }
        const colour = colours.get(dependencyId) ?? 'white';
        if (colour === 'grey') {
          const cycleStart = stack.indexOf(dependencyId);
          return [...stack.slice(cycleStart), dependencyId];
        }
        if (colour === 'white') {
          const cycle = visit(dependencyId);
          if (cycle) {
            return cycle;
          }
        }
      }

      stack.pop();
      colours.set(nodeId, 'black');
      return undefined;
    };

    for (const nodeId of [...impacted].sort()) {
      if (colours.get(nodeId) === 'white') {
        const cycle = visit(nodeId);
        if (cycle) {
          return cycle;
        }
      }
    }

    return [];
  }
}
