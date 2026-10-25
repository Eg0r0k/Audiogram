import { inject, provide, type InjectionKey } from "vue";
import type { PlayerTrack } from "@/types/track";
import type { QueueItemId } from "@/types/ids";
import type { TrackMenuSubject } from "../type";

/**
 * What a row gets from the TrackContextMenu it sits in; the shell's owner
 * gets the same through the shell's template ref.
 */
export interface TrackContextMenuHandle {
  /**
   * Opens the shell's menu for `subject` at `event`, under the shell's own
   * context. The event is taken (default prevented, propagation stopped).
   */
  open: (
    subject: PlayerTrack | TrackMenuSubject,
    index: number,
    event: Event,
    options?: { queueItemId?: QueueItemId | null },
  ) => void;
}

const TrackContextMenuKey: InjectionKey<TrackContextMenuHandle> = Symbol("TrackContextMenu");

/** A row outside any shell has no menu; its right-click stays the browser's. */
const noMenu: TrackContextMenuHandle = { open: () => undefined };

export const provideTrackContextMenu = (handle: TrackContextMenuHandle): void => {
  provide(TrackContextMenuKey, handle);
};

/** The enclosing shell's menu, or an inert one outside any shell. */
export const useTrackContextMenu = (): TrackContextMenuHandle => inject(TrackContextMenuKey, noMenu);
