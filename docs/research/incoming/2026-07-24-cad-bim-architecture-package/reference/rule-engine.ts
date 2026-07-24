/**
 * Rules are versioned, jurisdiction-scoped, applicability-aware policy packs.
 * This is an engine contract, not a source of building-code values.
 */

export type RuleSeverity = 'info' | 'warning' | 'error' | 'requires-professional-review';

export interface RuleFinding {
  readonly ruleId: string;
  readonly severity: RuleSeverity;
  readonly message: string;
  readonly targetIds: readonly string[];
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly sourceReference?: string;
}

export interface RuleContext {
  readonly documentRevision: number;
  readonly jurisdiction: string;
  readonly projectFacts: Readonly<Record<string, unknown>>;
}

export interface Rule {
  readonly id: string;
  readonly title: string;
  applies(context: RuleContext): boolean;
  evaluate(context: RuleContext): readonly RuleFinding[];
}

export interface RulePack {
  readonly id: string;
  readonly version: string;
  readonly jurisdiction: string;
  readonly edition: string;
  readonly effectiveFrom?: string;
  readonly authoritativeSourceUrl: string;
  readonly disclaimer: string;
  readonly rules: readonly Rule[];
}

export interface RuleEvaluationReport {
  readonly documentRevision: number;
  readonly packIds: readonly string[];
  readonly findings: readonly RuleFinding[];
}

export class RuleEngine {
  public evaluate(context: RuleContext, packs: readonly RulePack[]): RuleEvaluationReport {
    const matchingPacks = packs.filter((pack) => pack.jurisdiction === context.jurisdiction);
    const findings: RuleFinding[] = [];

    for (const pack of matchingPacks) {
      for (const rule of pack.rules) {
        if (!rule.applies(context)) {
          continue;
        }
        findings.push(...rule.evaluate(context));
      }
    }

    if (matchingPacks.length === 0) {
      findings.push({
        ruleId: 'ARQ-RULE-PACK-MISSING',
        severity: 'requires-professional-review',
        message: 'No approved rule pack matches this project jurisdiction.',
        targetIds: [],
        evidence: { jurisdiction: context.jurisdiction },
      });
    }

    return {
      documentRevision: context.documentRevision,
      packIds: matchingPacks.map((pack) => pack.id + '@' + pack.version),
      findings,
    };
  }
}
