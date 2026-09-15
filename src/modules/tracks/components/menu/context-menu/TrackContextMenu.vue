<template>
  <ResponsiveContextMenu v-model:open="localOpen">
    <div
      ref="guardRef"
      class="contents"
    >
      <ResponsiveContextMenuTrigger>
        <slot />
      </ResponsiveContextMenuTrigger>
    </div>

    <ResponsiveMenuContent class="w-65">
      <template #header>
        <TrackMenuSheetHeader
          v-if="activeTrack"
          :track="activeTrack"
        />
      </template>
      <component
        :is="contextComponent"
        v-if="activeTrack"
        v-bind="contextProps"
      />
    </ResponsiveMenuContent>
  </ResponsiveContextMenu>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useEventListener } from "@vueuse/core";
import {
  ResponsiveContextMenu,
  ResponsiveContextMenuTrigger,
  ResponsiveMenuContent,
} from "@/components/ui/responsive-menu";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { AlbumId, PlaylistId } from "@/types/ids";
import { provideTrackMenuComponents, responsiveTrackComponents } from "../useTrackMenuComponents";
import type { TrackContext } from "../type";
import { useTrackMenuAutoClose } from "../composables/useTrackMenuAutoClose";
import { useTrackMenuContent } from "../composables/useTrackMenuContent";
import TrackMenuSheetHeader from "../TrackMenuSheetHeader.vue";

provideTrackMenuComponents(responsiveTrackComponents);

interface Props {
  context?: TrackContext;
  isPlaylistOwner?: boolean;
  playlistId?: PlaylistId;
  albumId?: AlbumId;
}

const props = withDefaults(defineProps<Props>(), {
  context: "default",
  isPlaylistOwner: false,
  playlistId: undefined,
  albumId: undefined,
});

const {
  isContextMenuOpen,
  activeContextMenuTarget,
} = useTrackMenu();

const localOpen = computed({
  get: () => isContextMenuOpen.value && activeContextMenuTarget.value === props.context,
  set: (value: boolean) => {
    if (value) return;
    if (activeContextMenuTarget.value !== props.context) return;
    isContextMenuOpen.value = false;
  },
});

useTrackMenuAutoClose(localOpen, {
  context: () => props.context,
  playlistId: () => props.playlistId,
});

const { activeTrack, contextComponent, contextProps } = useTrackMenuContent({
  context: () => props.context,
  playlistId: () => props.playlistId,
  isPlaylistOwner: () => props.isPlaylistOwner,
});

const guardRef = useTemplateRef<HTMLElement>("guardRef");

// Rows open the menu from their own contextmenu handlers; off the rows
// nothing should open at all.
useEventListener(guardRef, "contextmenu", (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest("[data-media-context]")) {
    return;
  }

  if (!target.closest("[data-track-row], [data-track-menu-trigger]")) {
    e.preventDefault();
    e.stopPropagation();
  }
}, { capture: true });
</script>
