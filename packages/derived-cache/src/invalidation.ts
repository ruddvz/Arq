import type { InvalidationPriority, InvalidationTarget } from './types';
const rank: Record<InvalidationPriority, number> = {
  InteractiveCritical: 0,
  ActiveView: 1,
  VisibleBackground: 2,
  NonVisibleBackground: 3,
  ExportOnly: 4,
  AnalysisDeferred: 5,
};
export function createInvalidationPlan(
  targets: readonly InvalidationTarget[],
): readonly InvalidationTarget[] {
  const byKey = new Map<string, InvalidationTarget>();
  for (const target of targets) {
    const key = `${target.outputKind}::${target.scopeId}`;
    const current = byKey.get(key);
    if (!current || rank[target.priority] < rank[current.priority]) byKey.set(key, target);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      rank[a.priority] - rank[b.priority] ||
      a.scopeId.localeCompare(b.scopeId) ||
      a.outputKind.localeCompare(b.outputKind),
  );
}
