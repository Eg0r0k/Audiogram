import { watch } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { Track } from "@/modules/player/types";
import { useSelection, type SelectionDragOptions, type UseSelectionOptions } from "@/composables/useSelection";

export type TrackSelectionTouchOptions = Pick<SelectionDragOptions, "canStartTouch" | "suppressContextMenu">;

export function useTrackSelection(
  tracks: Ref<Track[]> | ComputedRef<Track[]>,
  containerRef: Ref<HTMLElement | null>,
  options: UseSelectionOptions & TrackSelectionTouchOptions = {},
) {
  const { canStartTouch, suppressContextMenu, ...selectionOptions } = options;
  const selection = useSelection(tracks, selectionOptions);

  watch(
    containerRef,
    (el, _prev, onCleanup) => {
      if (!el) return;

      const cleanup = selection.attachDragListeners(el, {
        rowSelector: "[data-track-id]",
        idDataKey: "trackId",
        indexDataKey: "trackIndex",
        canStartTouch,
        suppressContextMenu,
      });

      onCleanup(cleanup);
    },
    { flush: "post" },
  );

  return {
    ...selection,
    handleTrackSelect: selection.handleSelect,
  };
}
