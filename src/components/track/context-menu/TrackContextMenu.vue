<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>

    <ContextMenuContent class="w-60">
      <component

        :is="contextComponent"
        v-if="activeTrack"
        v-bind="contextProps"
      />
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { computed, type Component, toRef } from "vue";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent } from "@/components/ui/context-menu";
import { useTrackMenu } from "@/composables/useTrackMenu";
import { useTrackContextActions } from "@/composables/useTrackContextActions";
import type { TrackContext } from "./types";
import type { AlbumId, PlaylistId } from "@/types/ids";
import DefaultContext from "./contexts/DefaultContext.vue";
import QueueContext from "./contexts/QueueContext.vue";
import PlaylistContext from "./contexts/PlaylistContext.vue";

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

const { activeTrack, activeIndex } = useTrackMenu();

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

const actions = useTrackContextActions(
  // @ts-expect-error: activeTrack can be null, but v-if guards the component render
  activeTrack,
  toRef(props, "context"),
  {
    playlistId: toRef(props, "playlistId"),
    queueIndex: activeIndex,
  },
);

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
    default:
      return base;
  }
});

</script>
