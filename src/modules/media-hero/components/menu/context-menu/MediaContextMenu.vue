<template>
  <ResponsiveContextMenu>
    <ResponsiveContextMenuTrigger :disabled="disabled">
      <slot />
    </ResponsiveContextMenuTrigger>
    <ResponsiveMenuContent class="w-60 bg-popover/50 backdrop-blur-[50px]">
      <OpenInCatalogItem />
      <component
        :is="contextComponent"
        v-bind="contextProps"
      />
    </ResponsiveMenuContent>
  </ResponsiveContextMenu>
</template>

<script setup lang="ts">
import {
  ResponsiveContextMenu,
  ResponsiveContextMenuTrigger,
  ResponsiveMenuContent,
} from "@/components/ui/responsive-menu";
import { computed, type Component } from "vue";
import { useMediaContext } from "@/modules/media-hero/composables/useMediaContext";
import AlbumContext from "../contexts/AlbumContext.vue";
import OpenInCatalogItem from "../OpenInCatalogItem.vue";
import ArtistContext from "../contexts/ArtistContext.vue";
import PlaylistContext from "../contexts/PlaylistContext.vue";
import LikedContext from "../contexts/LikedContext.vue";

import type { MediaContext } from "../types";
import { provideMenuComponents, responsiveMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";

provideMenuComponents(responsiveMenuComponents);

const props = withDefaults(defineProps<{
  context?: MediaContext;
  isPlaylistOwner?: boolean;
  /** The context would render no items (e.g. a catalog artist): don't open. */
  disabled?: boolean;
}>(), {
  context: "album",
  disabled: false,
});

const contexts: Record<MediaContext, Component> = {
  "album": AlbumContext,
  "artist-page": ArtistContext,
  "liked": LikedContext,
  "playlist": PlaylistContext,
};

const actions = useMediaContext();
const contextComponent = computed(() => contexts[props.context]);

const contextProps = computed(() => {
  const base = { actions };
  if (props.context === "playlist") {
    return { ...base, isOwner: props.isPlaylistOwner };
  }
  return base;
});
</script>
