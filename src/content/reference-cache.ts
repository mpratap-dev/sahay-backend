const DEFAULT_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ReferenceCache<T> {
  private entry: CacheEntry<T> | null = null;

  constructor(private readonly ttlMs = DEFAULT_TTL_MS) {}

  get(): T | null {
    if (!this.entry || Date.now() >= this.entry.expiresAt) {
      return null;
    }
    return this.entry.value;
  }

  set(value: T): void {
    this.entry = {
      value,
      expiresAt: Date.now() + this.ttlMs,
    };
  }

  clear(): void {
    this.entry = null;
  }
}
