export interface GenerationToken {
  readonly target: string;
  readonly generation: number;
}

export class GenerationGuard {
  readonly #latest = new Map<string, number>();
  begin(target: string): GenerationToken {
    const generation = (this.#latest.get(target) ?? 0) + 1;
    this.#latest.set(target, generation);
    return { target, generation };
  }
  isCurrent(token: GenerationToken): boolean {
    return this.#latest.get(token.target) === token.generation;
  }
  assertCurrent(token: GenerationToken): void {
    if (!this.isCurrent(token)) throw new Error(`stale generation for ${token.target}`);
  }
  cancel(target: string): void {
    this.#latest.set(target, (this.#latest.get(target) ?? 0) + 1);
  }
}
