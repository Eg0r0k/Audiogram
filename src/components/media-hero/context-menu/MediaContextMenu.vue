<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-60">
      <component
        :is="contextComponent"
        v-bind="contextProps"
      />
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { ContextMenu, ContextMenuTrigger, ContextMenuContent } from "@/components/ui/context-menu";
import type { MediaContext } from "./types";
import { computed, type Component } from "vue";
import { useMediaContext } from "@/composables/useMediaContext";
import { provideMenuComponents, contextMenuComponents } from "../useMenuComponents";
import AlbumContext from "@/components/media-hero/context-menu/contexts/AlbumContext.vue";
import ArtistContext from "@/components/media-hero/context-menu/contexts/ArtistContext.vue";

provideMenuComponents(contextMenuComponents);

interface Props {
  context?: MediaContext;
  isPlaylistOwner?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  context: "album",
});

const contexts: Record<MediaContext, Component> = {
  "album": AlbumContext,
  "artist-page": ArtistContext,
  "liked": AlbumContext,
  "playlist": AlbumContext,
};

const actions = useMediaContext();

const contextComponent = computed(() => contexts[props.context]);

const contextProps = computed(() => {
  const base = { actions };
  switch (props.context) {
    case "playlist":
      return { ...base, isOwner: props.isPlaylistOwner };
    default:
      return base;
  }
});
</script>
