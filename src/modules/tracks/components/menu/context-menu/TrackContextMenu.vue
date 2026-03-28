<template>
  <ContextMenu v-model:open="isContextMenuOpen">
    <div
      ref="guardRef"
      class="contents"
    >
      <ContextMenuTrigger as-child>
        <slot />
      </ContextMenuTrigger>
    </div>

    <ContextMenuContent class="w-65">
      <component
        :is="contextComponent"
        v-if="activeTrack"
        v-bind="contextProps"
      />
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { computed, type Component, toRef, useTemplateRef } from "vue";
import { useEventListener } from "@vueuse/core";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent } from "@/components/ui/context-menu";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { AlbumId, PlaylistId } from "@/types/ids";
import { contextMenuTrackComponents, provideTrackMenuComponents } from "../useTrackMenuComponents";
import { TrackContext } from "../type";
import DefaultContext from "../contexts/DefaultContext.vue";
import QueueContext from "../contexts/QueueContext.vue";
import PlaylistContext from "../contexts/PlaylistContext.vue";
import { useTrackContextActions } from "@/modules/tracks/composables/useTrackContextActions";
import { useQueueStore } from "@/modules/queue/store/queue.store";

provideTrackMenuComponents(contextMenuTrackComponents);

interface Props {
  context?: TrackContext;
  isPlaylistOwner?: boolean;
  playlistId?: PlaylistId;
  queueIndex?: number;
  albumId?: AlbumId;
}

const props = withDefaults(defineProps<Props>(), {
  context: "default",
});

const { activeTrack, activeIndex, activeQueueItemId, isContextMenuOpen } = useTrackMenu();
const queueStore = useQueueStore();

const contexts: Record<TrackContext, Component> = {
  "default": DefaultContext,
  "search": DefaultContext,
  "liked": DefaultContext,
  "artist-page": DefaultContext,
  "queue": QueueContext,
  "playlist": PlaylistContext,
  "album": DefaultContext,
  "history": DefaultContext,
};

const contextComponent = computed(() => contexts[props.context]);

const actions = useTrackContextActions(activeTrack, {
  playlistId: toRef(props, "playlistId"),
  queueIndex: activeIndex,
  queueItemId: activeQueueItemId,
});

const contextProps = computed(() => {
  if (!activeTrack.value) return {};

  const base = {
    track: activeTrack.value,
    actions,
  };

  switch (props.context) {
    case "playlist":
      return {
        ...base,
        playlistId: props.playlistId,
        isOwner: props.isPlaylistOwner,
      };

    case "queue":
      return {
        ...base,
        queueIndex: activeIndex.value ?? -1,
        queueLength: queueStore.size,
      };

    default:
      return base;
  }
});

const guardRef = useTemplateRef<HTMLElement>("guardRef");

useEventListener(guardRef, "contextmenu", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest("[data-track-row]")) {
    e.preventDefault();
    e.stopPropagation();
  }
}, { capture: true });
</script>
