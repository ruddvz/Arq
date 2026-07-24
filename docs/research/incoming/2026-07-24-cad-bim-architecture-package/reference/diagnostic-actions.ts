/**
 * Diagnostics are durable semantic facts with a presentation layer. Dismissing
 * a chip suppresses a display instance only. It does not resolve the
 * underlying model issue. A quick fix is a revision-guarded proposal and must
 * pass through the same transaction gateway as any other edit.
 */

export type DiagnosticSeverity = "info" | "warning" | "error";

export interface DiagnosticFix<Proposal> {
  readonly label: string;
  readonly createProposal: () => Proposal;
}

export interface SpatialDiagnostic<Proposal> {
  readonly id: string;
  readonly code: string;
  readonly message: string;
  readonly severity: DiagnosticSeverity;
  readonly sourceRevision: number;
  readonly persistent: boolean;
  readonly fix?: DiagnosticFix<Proposal>;
}

export type DiagnosticFixResult<Proposal> =
  | { readonly kind: "proposal"; readonly proposal: Proposal }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "stale"; readonly reason: string };

export function createDiagnosticFixProposal<Proposal>(
  diagnostic: SpatialDiagnostic<Proposal>,
  currentRevision: number,
): DiagnosticFixResult<Proposal> {
  if (!diagnostic.fix) {
    return { kind: "unavailable", reason: "No quick fix is available for this diagnostic." };
  }
  if (diagnostic.sourceRevision !== currentRevision) {
    return {
      kind: "stale",
      reason: "The model changed after this diagnostic was computed. Re-evaluate before applying a fix.",
    };
  }
  return { kind: "proposal", proposal: diagnostic.fix.createProposal() };
}

export class DiagnosticPresentationState {
  private readonly dismissedIds = new Set<string>();

  public dismiss(id: string): void {
    this.dismissedIds.add(id);
  }

  public restore(id: string): void {
    this.dismissedIds.delete(id);
  }

  public isVisible<Proposal>(diagnostic: SpatialDiagnostic<Proposal>): boolean {
    return !this.dismissedIds.has(diagnostic.id);
  }

  public unresolvedCount<Proposal>(diagnostics: readonly SpatialDiagnostic<Proposal>[]): number {
    return diagnostics.filter((diagnostic) => diagnostic.persistent).length;
  }
}
