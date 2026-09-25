// Minimal browser-like globals so the store (localStorage persistence) runs under Node.
class MemoryStorage {
  private data = new Map<string, string>();
  quotaBytes = Infinity;
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    const size = [...this.data.entries()].reduce((n, [key, val]) => (key === k ? n : n + val.length), 0) + v.length;
    if (size > this.quotaBytes) {
      const err = new Error('quota') as Error & { name: string; code: number };
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }
    this.data.set(k, String(v));
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
  clear() {
    this.data.clear();
  }
}

const storage = new MemoryStorage();
const g = globalThis as unknown as Record<string, unknown>;
g.localStorage = storage;
g.window = Object.assign(globalThis, { localStorage: storage, innerWidth: 1280, addEventListener: () => {}, removeEventListener: () => {} });
export { storage };
