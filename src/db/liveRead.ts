import Dexie, { liveQuery, type Observable, type Observer, type Subscription } from "dexie";

// Dexie's liveQuery attaches its write listener only after the first result, so a write that commits
// while the first run is in flight is missed; a write seen meanwhile buys one more run.
export const liveRead = <T>(querier: () => Promise<T>): Pick<Observable<T>, "subscribe"> => ({
  subscribe: (
    observerOrNext?: Observer<T> | ((value: T) => void) | null,
    error?: ((cause: unknown) => void) | null,
  ): Subscription => {
    const observer = typeof observerOrNext === "function" ? { next: observerOrNext, error } : observerOrNext;
    let closed = false;
    let listening = true;
    let mutated = false;
    const onMutation = () => {
      mutated = true;
    };
    const stopListening = () => {
      listening = false;
      Dexie.on.storagemutated.unsubscribe(onMutation);
    };
    // An async wrapper is what makes Dexie carry its zone across the querier's awaits.
    const follow = (): Subscription => liveQuery(async () => querier()).subscribe({
      next: (value) => {
        if (listening) {
          stopListening();
          if (mutated) {
            inner.unsubscribe();
            inner = follow();
          }
        }
        observer?.next?.(value);
      },
      error: (cause: unknown) => {
        stopListening();
        observer?.error?.(cause);
      },
    });
    Dexie.on("storagemutated", onMutation);
    let inner = follow();
    return {
      get closed() {
        return closed;
      },
      unsubscribe: () => {
        if (closed) return;
        closed = true;
        stopListening();
        inner.unsubscribe();
      },
    };
  },
});
