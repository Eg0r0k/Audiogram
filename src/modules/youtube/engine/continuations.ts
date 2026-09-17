//
// The provider contract hands the frontend an opaque continuation string;
// youtubei.js pages continue through the parsed object that produced them.
// This registry bridges the two: a page's "fetch the next one" closure is
// kept under a random token. Tokens stay valid for repeated use (an infinite
// query refetches its pages with the same params) until evicted, and die
// with the session — a persisted token from an earlier launch simply misses.
//

const DEFAULT_CAPACITY = 64;

export interface ContinuationRegistry<T> {
  register: (fetchNext: () => Promise<T>) => string;
  resolve: (token: string) => (() => Promise<T>) | undefined;
}

export const createContinuationRegistry = <T>(capacity = DEFAULT_CAPACITY): ContinuationRegistry<T> => {
  const entries = new Map<string, () => Promise<T>>();

  return {
    register: (fetchNext) => {
      const token = crypto.randomUUID();
      entries.set(token, fetchNext);
      while (entries.size > capacity) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
      return token;
    },
    resolve: (token) => {
      const entry = entries.get(token);
      if (!entry) return undefined;
      // Re-insert so a page still in use stays young.
      entries.delete(token);
      entries.set(token, entry);
      return entry;
    },
  };
};
