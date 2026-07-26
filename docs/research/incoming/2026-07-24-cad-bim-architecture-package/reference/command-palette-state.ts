/**
 * Command palette state is deliberately separated from command execution.
 * A palette returns a typed proposal, which the normal transaction gateway
 * validates against the active document revision.
 */

export interface CommandDescriptor<Context, Proposal> {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly aliases?: readonly string[];
  readonly isAvailable?: (context: Context) => boolean;
  readonly createProposal: (context: Context) => Proposal | undefined;
}

export interface RankedCommand<Context, Proposal> {
  readonly command: CommandDescriptor<Context, Proposal>;
  readonly score: number;
}

export function rankCommands<Context, Proposal>(
  commands: readonly CommandDescriptor<Context, Proposal>[],
  query: string,
  context: Context,
): readonly RankedCommand<Context, Proposal>[] {
  const normalizedQuery = normalize(query);
  return commands
    .filter((command) => command.isAvailable?.(context) ?? true)
    .map((command) => ({ command, score: scoreCommand(command, normalizedQuery) }))
    .filter((candidate) => candidate.score !== Number.NEGATIVE_INFINITY)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.command.title.localeCompare(b.command.title) ||
        a.command.id.localeCompare(b.command.id),
    );
}

export class CommandPaletteState<Context, Proposal> {
  private isOpenValue = false;
  private queryValue = '';
  private activeIndexValue = 0;

  public open(): void {
    this.isOpenValue = true;
  }

  public close(): void {
    this.isOpenValue = false;
    this.queryValue = '';
    this.activeIndexValue = 0;
  }

  public get isOpen(): boolean {
    return this.isOpenValue;
  }

  public get query(): string {
    return this.queryValue;
  }

  public setQuery(query: string): void {
    this.queryValue = query;
    this.activeIndexValue = 0;
  }

  public moveActive(
    offset: number,
    commands: readonly CommandDescriptor<Context, Proposal>[],
    context: Context,
  ): void {
    const ranked = rankCommands(commands, this.queryValue, context);
    if (ranked.length === 0) {
      this.activeIndexValue = 0;
      return;
    }
    const next = (this.activeIndexValue + offset) % ranked.length;
    this.activeIndexValue = next < 0 ? next + ranked.length : next;
  }

  public getSnapshot(
    commands: readonly CommandDescriptor<Context, Proposal>[],
    context: Context,
  ): {
    readonly isOpen: boolean;
    readonly query: string;
    readonly activeIndex: number;
    readonly commands: readonly RankedCommand<Context, Proposal>[];
  } {
    const ranked = rankCommands(commands, this.queryValue, context);
    const activeIndex = Math.min(this.activeIndexValue, Math.max(0, ranked.length - 1));
    return { isOpen: this.isOpenValue, query: this.queryValue, activeIndex, commands: ranked };
  }

  public createActiveProposal(
    commands: readonly CommandDescriptor<Context, Proposal>[],
    context: Context,
  ): Proposal | undefined {
    const snapshot = this.getSnapshot(commands, context);
    const active = snapshot.commands[snapshot.activeIndex];
    return active?.command.createProposal(context);
  }
}

function scoreCommand<Context, Proposal>(
  command: CommandDescriptor<Context, Proposal>,
  query: string,
): number {
  if (!query) {
    return 0;
  }

  const title = normalize(command.title);
  const category = normalize(command.category);
  const aliases = command.aliases?.map(normalize) ?? [];
  const terms = [title, category, ...aliases];
  let best = Number.NEGATIVE_INFINITY;

  for (const term of terms) {
    if (term === query) {
      best = Math.max(best, 100);
    } else if (term.startsWith(query)) {
      best = Math.max(best, 80 - (term.length - query.length) * 0.01);
    } else if (term.includes(query)) {
      best = Math.max(best, 60 - term.indexOf(query) * 0.01);
    } else if (isSubsequence(query, term)) {
      best = Math.max(best, 20);
    }
  }

  return best;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isSubsequence(query: string, candidate: string): boolean {
  let queryIndex = 0;
  for (const character of candidate) {
    if (character === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) {
        return true;
      }
    }
  }
  return queryIndex === query.length;
}
