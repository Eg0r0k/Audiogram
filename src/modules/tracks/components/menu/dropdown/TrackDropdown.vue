<template>
  <Teleport to="body">
    <DropdownMenu v-model:open="isDropdownOpen">
      <DropdownMenuTrigger as-child>
        <div
          class="pointer-events-none fixed"
          :style="anchorStyle"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        class="w-65 "
        side="left"
        align="start"
      >
        <component
          :is="contextComponent"
          v-if="activeTrack"
          v-bind="contextProps"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, toRef, type Component } from "vue";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useTrackContextActions } from "@/modules/tracks/composables/useTrackContextActions";
import {
  dropdownMenuTrackComponents,
  provideTrackMenuComponents,
} from "../useTrackMenuComponents";
import type { TrackContext } from "../type";
import type { PlaylistId, AlbumId } from "@/types/ids";
import DefaultContext from "../contexts/DefaultContext.vue";
import LikedContext from "../contexts/LikedContext.vue";
import PlaylistContext from "../contexts/PlaylistContext.vue";
import QueueContext from "../contexts/QueueContext.vue";

provideTrackMenuComponents(dropdownMenuTrackComponents);

interface Props {
  context?: TrackContext;
  isPlaylistOwner?: boolean;
  playlistId?: PlaylistId;
  albumId?: AlbumId;
}

const props = withDefaults(defineProps<Props>(), {
  context: "default",
});

const { activeTrack, activeIndex, isDropdownOpen, dropdownAnchor } = useTrackMenu();

const anchorStyle = computed(() => ({
  left: `${dropdownAnchor.value.x}px`,
  top: `${dropdownAnchor.value.y}px`,
  width: `${dropdownAnchor.value.width}px`,
  height: `${dropdownAnchor.value.height}px`,
}));

const contexts: Record<TrackContext, Component> = {
  "default": DefaultContext,
  "search": DefaultContext,
  "liked": LikedContext,
  "artist-page": DefaultContext,
  "queue": QueueContext,
  "playlist": PlaylistContext,
  "album": DefaultContext,
  "history": DefaultContext,
};

const contextComponent = computed(() => contexts[props.context]);

const actions = useTrackContextActions(
  activeTrack,
  // toRef(props, "context"),
  {
    playlistId: toRef(props, "playlistId"),
    queueIndex: activeIndex,
  },
);

const contextProps = computed(() => {
  if (!activeTrack.value) return {};

  const base = { track: activeTrack.value, actions };

  switch (props.context) {
    case "playlist":
      return { ...base, playlistId: props.playlistId, isOwner: props.isPlaylistOwner };
    default:
      return base;
  }
});
</script>
