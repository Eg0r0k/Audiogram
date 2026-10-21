<template>
  <ResponsiveContextMenu
    ref="menu"
    v-model:open="localOpen"
  >
    <slot />

    <ResponsiveMenuContent class="w-65">
      <template #header>
        <TrackMenuSheetHeader
          v-if="activeTrack"
          :track="activeTrack"
          :actions="actions"
          :caps="caps"
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
import {
  ResponsiveContextMenu,
  ResponsiveMenuContent,
} from "@/components/ui/responsive-menu";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { AlbumId, PlaylistId } from "@/types/ids";
import { provideTrackMenuComponents, responsiveTrackComponents } from "../useTrackMenuComponents";
import type { TrackContext } from "../type";
import { useTrackMenuAutoClose } from "../composables/useTrackMenuAutoClose";
import { useTrackMenuContent } from "../composables/useTrackMenuContent";
import { provideTrackContextMenu, type TrackContextMenuHandle } from "./useTrackContextMenu";
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
  openMenu,
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

const { activeTrack, contextComponent, contextProps, actions, caps } = useTrackMenuContent({
  context: () => props.context,
  playlistId: () => props.playlistId,
  isPlaylistOwner: () => props.isPlaylistOwner,
});

const menu = useTemplateRef<InstanceType<typeof ResponsiveContextMenu>>("menu");

// The context is this shell's, not the caller's: a row can only ever open
// the menu of the list it sits in.
const handle: TrackContextMenuHandle = {
  open: (subject, index, event, options) => {
    openMenu(subject, index, { queueItemId: options?.queueItemId, target: props.context });
    menu.value?.show(event);
  },
};
provideTrackContextMenu(handle);
defineExpose(handle);
</script>
