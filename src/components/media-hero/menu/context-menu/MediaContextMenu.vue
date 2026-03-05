<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-60">
      <component
        :is="contextComponent"
        :actions="actions"
      />
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { ContextMenu, ContextMenuTrigger, ContextMenuContent } from "@/components/ui/context-menu";
import { computed, type Component } from "vue";
import { useMediaContext } from "@/composables/useMediaContext";
import { contextMenuComponents, provideMenuComponents } from "@/components/media-hero/useMenuComponents";
import type { MediaContext } from "../types";
import AlbumContext from "../contexts/AlbumContext.vue";
import ArtistContext from "../contexts/ArtistContext.vue";
import PlaylistContext from "@/modules/tracks/components/menu/contexts/PlaylistContext.vue";

provideMenuComponents(contextMenuComponents);

const props = withDefaults(defineProps<{
  context?: MediaContext;
}>(), {
  context: "album",
});

const contexts: Record<MediaContext, Component> = {
  "album": AlbumContext,
  "artist-page": ArtistContext,
  "liked": AlbumContext,
  "playlist": PlaylistContext,
};

const actions = useMediaContext();

const contextComponent = computed(() => contexts[props.context]);
</script>
