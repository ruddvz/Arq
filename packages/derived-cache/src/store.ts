import type { DerivedOutputMeta } from './types';
export interface DerivedCacheRecord<T> {
  readonly key: string;
  readonly meta: DerivedOutputMeta;
  readonly value: T;
}
export interface DerivedCacheStore {
  get<T>(key: string): Promise<DerivedCacheRecord<T> | null>;
  put<T>(record: DerivedCacheRecord<T>): Promise<void>;
  delete(key: string): Promise<void>;
  clearNamespace(): Promise<void>;
}
export class MemoryDerivedCacheStore implements DerivedCacheStore {
  readonly #records = new Map<string, DerivedCacheRecord<unknown>>();
  async get<T>(key: string): Promise<DerivedCacheRecord<T> | null> {
    return (this.#records.get(key) as DerivedCacheRecord<T> | undefined) ?? null;
  }
  async put<T>(record: DerivedCacheRecord<T>): Promise<void> {
    this.#records.set(record.key, record);
  }
  async delete(key: string): Promise<void> {
    this.#records.delete(key);
  }
  async clearNamespace(): Promise<void> {
    this.#records.clear();
  }
}
