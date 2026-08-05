/**
 * V3-125: dispose GPU resources when a project closes.
 *
 * WebGL buffers, textures and framebuffers are not garbage collected the way
 * JavaScript objects are. Dropping the last reference to a geometry frees the
 * wrapper and leaves the driver allocation in place, so a session that opens
 * and closes several projects accumulates GPU memory it can never reclaim,
 * until the context is lost and every open project in the tab goes with it.
 * That is not a slow leak the user tolerates; it is a crash they cannot explain.
 *
 * Disposal is easy to write and hard to get complete, and the incomplete
 * version looks identical from the outside. Three things go wrong:
 *
 * - A resource allocated after the close call. A mesh build running in a worker
 *   returns after its project closed, registers its buffers with a registry
 *   nobody will drain again, and those buffers live until the tab does. So
 *   registration after close is refused and the resource is disposed
 *   immediately - the caller learns, and nothing leaks either way.
 * - A disposer that throws taking the rest of the list with it. One driver
 *   error should not strand every remaining allocation, so each disposer is
 *   isolated and the failures are reported together at the end.
 * - Disposal running twice. Freeing an already-freed handle is undefined at
 *   best, so each entry is removed before its disposer runs and a second call
 *   finds nothing.
 *
 * Ownership is by key rather than global, because closing one project must not
 * touch another's resources, and a shared registry with no owner is how it
 * eventually does.
 */

export interface GpuResourceHandle {
  /** Removes this resource from the registry and disposes it. Safe to call twice. */
  dispose(): void;
  readonly disposed: boolean;
}

export interface DisposalFailure {
  readonly owner: string;
  readonly label: string;
  readonly error: unknown;
}

export interface DisposalReport {
  readonly disposed: number;
  readonly failures: readonly DisposalFailure[];
}

interface Entry {
  readonly label: string;
  readonly dispose: () => void;
}

export function createGpuResourceRegistry() {
  const byOwner = new Map<string, Map<number, Entry>>();
  const closedOwners = new Set<string>();
  let nextId = 1;

  /**
   * Registers a resource under an owner.
   *
   * Registering under a closed owner disposes the resource immediately and
   * returns a handle that reports itself already disposed. The alternative -
   * accepting it, or silently dropping it - leaks a driver allocation that
   * nothing will ever ask about again.
   */
  function register(owner: string, label: string, dispose: () => void): GpuResourceHandle {
    if (closedOwners.has(owner)) {
      // Not caught: a disposer failing here is a real driver error on a path
      // that is already a mistake, and swallowing it would hide both.
      dispose();
      return { dispose: () => {}, disposed: true };
    }

    const id = nextId;
    nextId += 1;

    let entries = byOwner.get(owner);
    if (entries === undefined) {
      entries = new Map<number, Entry>();
      byOwner.set(owner, entries);
    }
    entries.set(id, { label, dispose });

    let disposed = false;
    return {
      dispose(): void {
        if (disposed) {
          return;
        }
        disposed = true;
        // Removed before the disposer runs, so a throwing disposer cannot leave
        // an entry behind for a later drain to free a second time.
        byOwner.get(owner)?.delete(id);
        dispose();
      },
      get disposed(): boolean {
        return disposed;
      },
    };
  }

  /**
   * Disposes everything an owner holds and marks it closed.
   *
   * Newest first: a resource allocated later may depend on an earlier one - a
   * mesh on its geometry, a framebuffer on its texture - and freeing the
   * dependency first is exactly the undefined behaviour this exists to avoid.
   */
  function closeOwner(owner: string): DisposalReport {
    closedOwners.add(owner);
    const entries = byOwner.get(owner);
    byOwner.delete(owner);
    if (entries === undefined) {
      return { disposed: 0, failures: [] };
    }

    const failures: DisposalFailure[] = [];
    let disposed = 0;
    for (const [, entry] of [...entries].reverse()) {
      try {
        entry.dispose();
        disposed += 1;
      } catch (error) {
        // Isolated: one driver error must not strand every remaining
        // allocation behind it.
        failures.push({ owner, label: entry.label, error });
      }
    }

    return { disposed, failures };
  }

  /** How many resources an owner still holds. A closed project reporting anything above zero is a leak. */
  function outstanding(owner: string): number {
    return byOwner.get(owner)?.size ?? 0;
  }

  /** Every owner still holding resources, for a diagnostics panel that has to name them. */
  function owners(): readonly string[] {
    return [...byOwner.keys()].filter((owner) => (byOwner.get(owner)?.size ?? 0) > 0);
  }

  function isClosed(owner: string): boolean {
    return closedOwners.has(owner);
  }

  /**
   * Reopens an owner that was closed.
   *
   * Needed because a project id can be opened again in the same session, and a
   * registry that remembered the close forever would refuse every resource the
   * second open allocates. Throws if the owner still holds anything: reopening
   * over live resources would put two generations under one key with no way to
   * tell them apart.
   */
  function reopenOwner(owner: string): void {
    if (outstanding(owner) > 0) {
      throw new Error(
        `cannot reopen ${owner} while it still holds ${outstanding(owner)} resources`,
      );
    }
    closedOwners.delete(owner);
  }

  return { register, closeOwner, outstanding, owners, isClosed, reopenOwner };
}

export type GpuResourceRegistry = ReturnType<typeof createGpuResourceRegistry>;
