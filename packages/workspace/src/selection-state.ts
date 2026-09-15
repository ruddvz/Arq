import type { WorkspaceSelection } from './workspace-types';

/**
 * Canonical pure transition helpers for workspace/session selection.
 *
 * This module deliberately owns no React state, renderer identity, project
 * objects, hover, focus or marquee gesture state. It only transforms semantic
 * element IDs. Wiring it into the product is a separate integration step once
 * the #401 authority gate and active root owners are reconciled.
 *
 * Ordering is intentional: `secondaryIds` uses JavaScript Set insertion order.
 * When the primary is removed, the earliest surviving secondary is promoted.
 * That rule is part of the contract and is covered by tests below rather than
 * being an accidental dependency on Set iteration.
 */

export function emptySelection(): WorkspaceSelection {
  return { primaryId: null, secondaryIds: new Set<string>() };
}

/** Returns semantic selection membership in primary-first deterministic order. */
export function selectedIds(selection: WorkspaceSelection): readonly string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  if (selection.primaryId !== null) {
    ordered.push(selection.primaryId);
    seen.add(selection.primaryId);
  }

  for (const id of selection.secondaryIds) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  return ordered;
}

function uniqueIds(ids: readonly string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    if (!seen.has(id)) {
      unique.push(id);
      seen.add(id);
    }
  }

  return unique;
}

function fromOrderedIds(ids: readonly string[]): WorkspaceSelection {
  const unique = uniqueIds(ids);
  const [primaryId = null, ...secondaryIds] = unique;
  return { primaryId, secondaryIds: new Set(secondaryIds) };
}

/** Replaces all existing membership. The first unique ID becomes primary. */
export function replaceSelection(ids: readonly string[]): WorkspaceSelection {
  return fromOrderedIds(ids);
}

/**
 * Adds IDs without changing an existing primary. If selection is empty, the
 * first unique added ID becomes primary.
 */
export function extendSelection(
  selection: WorkspaceSelection,
  ids: readonly string[],
): WorkspaceSelection {
  return fromOrderedIds([...selectedIds(selection), ...ids]);
}

/**
 * Toggles one semantic ID. Adding preserves the existing primary; removing the
 * primary promotes the earliest surviving secondary deterministically.
 */
export function toggleSelection(selection: WorkspaceSelection, id: string): WorkspaceSelection {
  const current = selectedIds(selection);
  if (current.includes(id)) {
    return fromOrderedIds(current.filter((selectedId) => selectedId !== id));
  }
  return fromOrderedIds([...current, id]);
}

/**
 * Makes an already-selected ID primary without changing selection membership.
 * An unselected ID is ignored so this operation cannot silently extend state.
 */
export function setPrimarySelection(
  selection: WorkspaceSelection,
  id: string,
): WorkspaceSelection {
  const current = selectedIds(selection);
  if (!current.includes(id)) {
    return selection;
  }
  return fromOrderedIds([id, ...current.filter((selectedId) => selectedId !== id)]);
}

/** Removes IDs and repairs primary membership deterministically when needed. */
export function removeFromSelection(
  selection: WorkspaceSelection,
  ids: readonly string[],
): WorkspaceSelection {
  const removed = new Set(ids);
  return fromOrderedIds(selectedIds(selection).filter((id) => !removed.has(id)));
}

/**
 * Removes semantic IDs that canonical project state no longer considers valid.
 * The caller owns validity knowledge; this package never guesses from ID shape
 * and never reads or mutates canonical project data.
 */
export function reconcileSelection(
  selection: WorkspaceSelection,
  isValid: (id: string) => boolean,
): WorkspaceSelection {
  return fromOrderedIds(selectedIds(selection).filter(isValid));
}

export function isSelected(selection: WorkspaceSelection, id: string): boolean {
  return selection.primaryId === id || selection.secondaryIds.has(id);
}
