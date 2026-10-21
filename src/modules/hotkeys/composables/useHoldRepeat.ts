import { onScopeDispose, watch } from "vue";
import { HOLD_DELAY_MS } from "../constants";

/**
 * A key action that repeats while the key stays down. When `isHeld` turns
 * true, `begin` sets the hold up and returns its step; the step runs at once,
 * again after HOLD_DELAY_MS and then every `repeatMs` until the key is let
 * go or a step returns false (nothing left to do in that direction).
 */
export const useHoldRepeat = (
  isHeld: () => boolean,
  repeatMs: number,
  begin: () => () => boolean,
) => {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = (step: () => boolean, ms: number) => {
    timer = setTimeout(() => {
      timer = null;
      if (isHeld() && step()) schedule(step, repeatMs);
    }, ms);
  };

  watch(isHeld, (held) => {
    stop();
    if (!held) return;
    const step = begin();
    if (step()) schedule(step, HOLD_DELAY_MS);
  });

  onScopeDispose(stop);
};
