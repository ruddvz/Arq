import { assertArqfsLifecycleEventIsSafe, type ArqfsLifecycleEvent } from './arqfs-lifecycle-event';

/**
 * ARQFS-018: a bounded, in-memory ring buffer of recent lifecycle events -
 * "bounded" is not incidental, it is the point: an unbounded recorder is
 * itself a resource-exhaustion risk in a long-running session (matches this
 * repository's own "bounded request queues" requirement for the Worker
 * transport, ARQFS-008). Every event is checked against
 * `assertArqfsLifecycleEventIsSafe` on the way in, not trusted from the
 * caller - the recorder is the one place malformed telemetry would actually
 * leak, so it is also the one place that must not silently accept it.
 */
export interface ArqfsLifecycleRecorderOptions {
  readonly maxEvents?: number;
}

const DEFAULT_MAX_EVENTS = 200;

export class ArqfsLifecycleRecorder {
  private readonly events: ArqfsLifecycleEvent[] = [];
  private readonly maxEvents: number;

  constructor(options: ArqfsLifecycleRecorderOptions = {}) {
    const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
    if (!Number.isSafeInteger(maxEvents) || maxEvents < 1) {
      throw new RangeError('maxEvents must be a positive integer');
    }
    this.maxEvents = maxEvents;
  }

  record(event: ArqfsLifecycleEvent): void {
    assertArqfsLifecycleEventIsSafe(event);
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      // Drop oldest first - a support bundle wants the most recent history
      // leading up to whatever the user is reporting, not the session's
      // first events.
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  list(): readonly ArqfsLifecycleEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}
