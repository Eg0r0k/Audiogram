import { inject, provide, type ComputedRef, type InjectionKey } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface MediaContextActions {
  addToQueue: () => void;
  edit: () => void;
  delete: () => void;
  /** See {@link MediaActions.canManage} — library row vs live catalog entity. */
  canManage?: ComputedRef<boolean>;
  /** An own catalog playlist its source can delete (Yandex). Absent = no. */
  canDeleteAtSource?: ComputedRef<boolean>;
  /** M4: ND album / any playlist — batch offline download. Absent = hidden. */
  canDownloadOffline?: ComputedRef<boolean>;
  downloadOffline?: () => void;
  /** The catalog view behind this library view; absent or null = no menu item. */
  catalogRoute?: ComputedRef<RouteLocationRaw | null>;
}

const MediaContextKey: InjectionKey<MediaContextActions> = Symbol("MediaContext");

export function provideMediaContext(actions: MediaContextActions) {
  provide(MediaContextKey, actions);
}

export function useMediaContext(): MediaContextActions {
  const context = inject(MediaContextKey);
  if (!context) {
    return {
      addToQueue: () => console.warn("addToQueue not implemented"),
      edit: () => console.warn("edit not implemented"),
      delete: () => console.warn("delete not implemented"),
    };
  }
  return context;
}
