/**
 * CRDT transport may make operations converge, but Arq owns semantic validity.
 * Every replica deterministically rebuilds its canonical model from the same
 * sorted operation set and validates host, relation, constraint, and geometry
 * invariants while doing so.
 */

export interface OperationStamp {
  readonly operationId: string;
  readonly authorId: string;
  readonly lamport: number;
}

export type SemanticOperation =
  | (OperationStamp & {
      readonly kind: 'move-element';
      readonly elementId: string;
      readonly delta: { readonly x: number; readonly y: number; readonly z: number };
    })
  | (OperationStamp & {
      readonly kind: 'set-parameter';
      readonly elementId: string;
      readonly parameter: string;
      readonly value: unknown;
    })
  | (OperationStamp & {
      readonly kind: 'attach-host';
      readonly childId: string;
      readonly hostId: string;
      readonly localPlacement: Readonly<Record<string, unknown>>;
    })
  | (OperationStamp & {
      readonly kind: 'delete-element';
      readonly elementId: string;
    });

export interface SemanticDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly operationId?: string;
  readonly targetIds?: readonly string[];
}

export interface RebuildResult<Model> {
  readonly model: Model;
  readonly acceptedOperationIds: readonly string[];
  readonly diagnostics: readonly SemanticDiagnostic[];
}

export interface SemanticOperationResolver<Model> {
  rebuild(baseModel: Model, orderedOperations: readonly SemanticOperation[]): RebuildResult<Model>;
}

export class SemanticOperationLog {
  private readonly operations = new Map<string, SemanticOperation>();

  public add(operation: SemanticOperation): boolean {
    validateStamp(operation);
    if (this.operations.has(operation.operationId)) {
      return false;
    }
    this.operations.set(operation.operationId, operation);
    return true;
  }

  public merge(operations: Iterable<SemanticOperation>): boolean {
    let changed = false;
    for (const operation of operations) {
      changed = this.add(operation) || changed;
    }
    return changed;
  }

  public ordered(): readonly SemanticOperation[] {
    return [...this.operations.values()].sort(compareOperations);
  }

  public rebuild<Model>(
    baseModel: Model,
    resolver: SemanticOperationResolver<Model>,
  ): RebuildResult<Model> {
    return resolver.rebuild(baseModel, this.ordered());
  }
}

export function compareOperations(left: SemanticOperation, right: SemanticOperation): number {
  if (left.lamport !== right.lamport) {
    return left.lamport - right.lamport;
  }
  const authorOrder = left.authorId.localeCompare(right.authorId);
  if (authorOrder !== 0) {
    return authorOrder;
  }
  return left.operationId.localeCompare(right.operationId);
}

function validateStamp(operation: OperationStamp): void {
  if (
    !operation.operationId ||
    !operation.authorId ||
    !Number.isSafeInteger(operation.lamport) ||
    operation.lamport < 0
  ) {
    throw new Error('Semantic operation has an invalid causal stamp.');
  }
}
