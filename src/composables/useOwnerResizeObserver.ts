import { onScopeDispose, watch, type Ref } from "vue";
import type { Nullish } from "@/types/utils";

/**
 * ResizeObserver created by the window the element lives in. An element moved
 * into a Document Picture-in-Picture window is never reported to the opener's
 * observer (vueuse's useResizeObserver always uses the global one).
 */
export const useOwnerResizeObserver = (
  target: Readonly<Ref<Nullish<HTMLElement>>>,
  callback: ResizeObserverCallback,
): void => {
  let observer: ResizeObserver | undefined;

  const stop = watch(target, (el) => {
    observer?.disconnect();
    observer = undefined;
    const ownerWindow = el?.ownerDocument.defaultView;
    if (!el || !ownerWindow || !("ResizeObserver" in ownerWindow)) return;
    observer = new ownerWindow.ResizeObserver(callback);
    observer.observe(el);
  }, { immediate: true, flush: "post" });

  onScopeDispose(() => {
    stop();
    observer?.disconnect();
  });
};
