/**
 * Which open attempt owns the flow.
 *
 * The file picker and the drop target stay live while an open is in progress,
 * so a second file can be chosen while the first is still staging - and both
 * attempts then drive one reducer. The older attempt's stage callbacks arrive
 * after the newer one has started, walking the flow backwards through states it
 * has already left, and its success callback still adopts a project the user
 * moved on from. Neither is a race the reducer can catch: every one of those
 * events is legal for the state it arrives in, because the reducer has no way to
 * know which attempt sent it.
 *
 * A monotonic counter is enough, and is deliberately not an `AbortSignal`: the
 * work does not need to stop early, it needs to stop being believed. An attempt
 * that has already opened a project still has to finish - so it can close the
 * session it created and release the working copy's write lock, which the next
 * open of the same file needs.
 */
export interface OpenAttemptGuard {
  /**
   * Claims the flow for a new attempt and returns a predicate that answers
   * whether that attempt still owns it. Every later attempt supersedes it.
   */
  begin(): () => boolean;
}

export function createOpenAttemptGuard(): OpenAttemptGuard {
  let current = 0;
  return {
    begin() {
      current += 1;
      const attempt = current;
      return () => current === attempt;
    },
  };
}
