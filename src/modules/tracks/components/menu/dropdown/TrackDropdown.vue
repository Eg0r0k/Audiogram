<template>
  <Teleport to="body">
    <ResponsiveMenu v-model:open="localOpen">
      <ResponsiveMenuTrigger>
        <div
          class="pointer-events-none fixed"
          :style="anchorStyle"
        />
      </ResponsiveMenuTrigger>

      <ResponsiveMenuContent
        class="w-65"
        side="left"
        align="start"
      >
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
    </ResponsiveMenu>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuTrigger,
} from "@/components/ui/responsive-menu";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useTrackMenuAutoClose } from "../composables/useTrackMenuAutoClose";
import { useTrackMenuContent } from "../composables/useTrackMenuContent";
import { provideTrackMenuComponents, responsiveTrackComponents } from "../useTrackMenuComponents";
import type { TrackContext } from "../type";
import type { PlaylistId, AlbumId } from "@/types/ids";
import TrackMenuSheetHeader from "../TrackMenuSheetHeader.vue";

provideTrackMenuComponents(responsiveTrackComponents);

interface Props {
  context?: TrackContext;
  isPlaylistOwner?: boolean;
  playlistId?: PlaylistId;
  albumId?: AlbumId;
  onNavigate?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  context: "default",
  playlistId: undefined,
  albumId: undefined,
  isPlaylistOwner: false,
  onNavigate: undefined,
});

const {
  isDropdownOpen,
  activeDropdownTarget,
  dropdownAnchor,
} = useTrackMenu();

const localOpen = computed({
  get: () => isDropdownOpen.value && activeDropdownTarget.value === props.context,
  set: (value: boolean) => {
    if (value) return;
    if (activeDropdownTarget.value !== props.context) return;
    isDropdownOpen.value = false;
  },
});

useTrackMenuAutoClose(localOpen, {
  context: () => props.context,
  playlistId: () => props.playlistId,
});

const anchorStyle = computed(() => ({
  left: `${dropdownAnchor.value.x}px`,
  top: `${dropdownAnchor.value.y}px`,
  width: `${dropdownAnchor.value.width}px`,
  height: `${dropdownAnchor.value.height}px`,
}));

const { activeTrack, contextComponent, contextProps } = useTrackMenuContent({
  context: () => props.context,
  playlistId: () => props.playlistId,
  isPlaylistOwner: () => props.isPlaylistOwner,
  onNavigate: () => props.onNavigate?.(),
});
</script>
