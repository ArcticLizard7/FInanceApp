// ============================================================
// Storage Service
// Wraps localStorage for all persistence.
// To migrate to a REST API or Supabase:
//   1. Replace get/set calls below with fetch() or SDK calls
//   2. Types remain identical — only the transport changes
// ============================================================

const PREFIX = 'ff_'; // FinanceFlow namespace

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error('StorageService.set failed', e);
    }
  },

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  },

  clear(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },
};
