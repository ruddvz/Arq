/**
 * Graph checks that name the cycle instead of announcing one.
 *
 * The reviewed 2.0 package reported "The work item dependency graph
 * contains a cycle" against the whole array and stopped at the first one.
 * For a 200-item plan that is an instruction to re-read 200 items. Naming
 * the exact path - `a -> b -> c -> a` - turns the same failure into an
 * edit, which matters most for the caller this boundary actually has: a
 * model that will otherwise regenerate the entire plan rather than fix one
 * edge.
 *
 * Both functions are iterative. A recursive walk over a 500-node component
 * hierarchy supplied by an untrusted caller is a stack-overflow away from
 * taking the process down, and a crash inside a validator is a validator
 * that failed open.
 */

/** Returns the first cycle as the path that closes it, or `undefined` if the graph is acyclic. */
export function findCycle(
  edges: ReadonlyMap<string, readonly string[]>,
): readonly string[] | undefined {
  const permanent = new Set<string>();
  const onPath = new Set<string>();

  for (const root of edges.keys()) {
    if (permanent.has(root)) {
      continue;
    }
    const path: string[] = [];
    // Each frame is a node plus how far through its neighbours we are, so
    // the walk is depth-first without using the call stack.
    const stack: { node: string; next: number }[] = [{ node: root, next: 0 }];
    onPath.add(root);
    path.push(root);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const neighbours = edges.get(frame.node) ?? [];
      if (frame.next >= neighbours.length) {
        permanent.add(frame.node);
        onPath.delete(frame.node);
        path.pop();
        stack.pop();
        continue;
      }
      const neighbour = neighbours[frame.next]!;
      frame.next += 1;
      if (!edges.has(neighbour) || permanent.has(neighbour)) {
        continue;
      }
      if (onPath.has(neighbour)) {
        const start = path.indexOf(neighbour);
        return [...path.slice(start), neighbour];
      }
      onPath.add(neighbour);
      path.push(neighbour);
      stack.push({ node: neighbour, next: 0 });
    }
  }
  return undefined;
}

/** Returns the ancestry cycle a parent chain closes, or `undefined`. Used for component hierarchies, where each node has at most one parent. */
export function findParentCycle(
  parents: ReadonlyMap<string, string | undefined>,
): readonly string[] | undefined {
  const settled = new Set<string>();

  for (const start of parents.keys()) {
    if (settled.has(start)) {
      continue;
    }
    const path: string[] = [];
    const seen = new Set<string>();
    let current: string | undefined = start;
    while (current !== undefined && parents.has(current)) {
      if (seen.has(current)) {
        return [...path.slice(path.indexOf(current)), current];
      }
      if (settled.has(current)) {
        break;
      }
      seen.add(current);
      path.push(current);
      current = parents.get(current);
    }
    for (const node of path) {
      settled.add(node);
    }
  }
  return undefined;
}

export function describeCycle(cycle: readonly string[]): string {
  return cycle.join(' -> ');
}
