import type { ImportAdapter } from './types';

export class AdapterRegistry {
  private readonly adapters = new Map<string, ImportAdapter>();

  register(adapter: ImportAdapter): void {
    if (this.adapters.has(adapter.id)) throw new Error(`Adapter already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ImportAdapter | undefined {
    return this.adapters.get(id);
  }

  resolve(formatId: string): ImportAdapter | undefined {
    return [...this.adapters.values()].find((adapter) => adapter.formatIds.includes(formatId));
  }

  list(): readonly ImportAdapter[] {
    return [...this.adapters.values()];
  }
}
