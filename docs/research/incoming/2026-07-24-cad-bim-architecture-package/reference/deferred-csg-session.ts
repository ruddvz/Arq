/**
 * Interaction contract for an expensive derived geometry operation.
 *
 * Dragging owns a cheap visual preview. Pointer release creates one semantic
 * command. Only after that command is committed may a worker bake and publish
 * a derived CSG product. A late result can never replace a newer revision.
 */

export type Revision = number;
export type PreviewSessionId = string;
export type ElementId = string;

export interface PreviewToken {
  readonly sessionId: PreviewSessionId;
  readonly elementId: ElementId;
  readonly baseRevision: Revision;
  readonly inputSignature: string;
}

export interface PreviewUpdate<Input> {
  readonly input: Input;
  readonly inputSignature: string;
  readonly timestampMs: number;
}

export interface SemanticCommitProposal<Input> {
  readonly token: PreviewToken;
  readonly finalInput: Input;
  readonly finalInputSignature: string;
}

export interface CsgBakeJob<Input> {
  readonly kind: 'bake-derived-csg';
  readonly sessionId: PreviewSessionId;
  readonly elementId: ElementId;
  readonly committedRevision: Revision;
  readonly input: Input;
  readonly inputSignature: string;
}

export interface CsgBakeResult<Output> {
  readonly sessionId: PreviewSessionId;
  readonly elementId: ElementId;
  readonly committedRevision: Revision;
  readonly inputSignature: string;
  readonly output: Output;
}

export interface CurrentDerivedState {
  readonly revision: Revision;
  readonly inputSignature: string;
}

type SessionPhase = 'previewing' | 'awaiting-commit' | 'baking' | 'cancelled';

interface SessionState<Input> {
  readonly token: PreviewToken;
  readonly latest: PreviewUpdate<Input>;
  readonly phase: SessionPhase;
  readonly bakeRevision?: Revision;
}

export class DeferredCsgSession<Input> {
  private state: SessionState<Input>;

  public constructor(initial: PreviewToken, input: Input, timestampMs: number) {
    assertTimestamp(timestampMs);
    if (!initial.sessionId || !initial.elementId || !initial.inputSignature) {
      throw new Error('A preview token requires an ID, target, and input signature.');
    }
    if (!Number.isSafeInteger(initial.baseRevision) || initial.baseRevision < 0) {
      throw new Error('Preview base revision must be a non-negative safe integer.');
    }
    this.state = {
      token: initial,
      latest: {
        input,
        inputSignature: initial.inputSignature,
        timestampMs,
      },
      phase: 'previewing',
    };
  }

  public get isActive(): boolean {
    return this.state.phase === 'previewing' || this.state.phase === 'awaiting-commit';
  }

  public update(update: PreviewUpdate<Input>): void {
    if (this.state.phase !== 'previewing') {
      throw new Error('A preview can only be updated while it is actively dragging.');
    }
    assertTimestamp(update.timestampMs);
    if (update.timestampMs < this.state.latest.timestampMs) {
      throw new Error('Out-of-order preview updates are not accepted.');
    }
    if (!update.inputSignature) {
      throw new Error('A preview update requires a deterministic input signature.');
    }
    this.state = { ...this.state, latest: update };
  }

  /**
   * This does not run a Boolean. It emits the one semantic proposal that the
   * authoritative model worker must validate and commit atomically.
   */
  public endInteraction(): SemanticCommitProposal<Input> {
    if (this.state.phase !== 'previewing') {
      throw new Error('The interaction has already ended or was cancelled.');
    }
    this.state = { ...this.state, phase: 'awaiting-commit' };
    return {
      token: this.state.token,
      finalInput: this.state.latest.input,
      finalInputSignature: this.state.latest.inputSignature,
    };
  }

  /**
   * Called only after the semantic command is accepted. Scheduling, priority,
   * debounce policy, and worker ownership belong to the caller, not this
   * state machine.
   */
  public createBakeJob(committedRevision: Revision): CsgBakeJob<Input> {
    if (this.state.phase !== 'awaiting-commit') {
      throw new Error('A bake may only follow a committed semantic command.');
    }
    if (!Number.isSafeInteger(committedRevision) || committedRevision < 0) {
      throw new Error('Committed revision must be a non-negative safe integer.');
    }
    this.state = {
      ...this.state,
      phase: 'baking',
      bakeRevision: committedRevision,
    };
    return {
      kind: 'bake-derived-csg',
      sessionId: this.state.token.sessionId,
      elementId: this.state.token.elementId,
      committedRevision,
      input: this.state.latest.input,
      inputSignature: this.state.latest.inputSignature,
    };
  }

  public cancel(): void {
    this.state = { ...this.state, phase: 'cancelled' };
  }

  public acceptsResult<Output>(
    result: CsgBakeResult<Output>,
    current: CurrentDerivedState,
  ): boolean {
    return (
      this.state.phase === 'baking' &&
      result.sessionId === this.state.token.sessionId &&
      result.elementId === this.state.token.elementId &&
      result.committedRevision === this.state.bakeRevision &&
      result.committedRevision === current.revision &&
      result.inputSignature === this.state.latest.inputSignature &&
      result.inputSignature === current.inputSignature
    );
  }
}

function assertTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new Error('Preview timestamps must be finite non-negative milliseconds.');
  }
}
