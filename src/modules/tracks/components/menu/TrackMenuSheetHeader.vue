<template>
  <div class="px-4 pt-2 pb-3">
    <div class="flex items-center gap-3">
      <NuxtImage
        :src="coverUrl"
        :alt="track.title"
        :width="48"
        :height="48"
        fallback-src="/img/fallback.svg"
        class="size-12 shrink-0 rounded object-cover"
      />
      <div class="min-w-0 flex-1">
        <DrawerTitle class="truncate">
          {{ track.title }}
        </DrawerTitle>
        <DrawerDescription class="truncate">
          {{ track.artist }}
        </DrawerDescription>
      </div>
    </div>

    <template v-if="libTrack && actions">
      <div class="mt-4 grid grid-cols-3 gap-3">
        <label
          v-for="tile in tiles"
          :key="tile.key"
          :for="`${idPrefix}-${tile.key}`"
          class="flex min-w-0 flex-col items-center gap-2"
        >
          <Button
            :id="`${idPrefix}-${tile.key}`"
            variant="soft"
            color="neutral"
            class="h-16 w-full rounded-control-xl icon-size-6"
            :aria-pressed="tile.pressed"
            :aria-disabled="tile.disabled || undefined"
            @click="tile.run?.()"
          >
            <component
              :is="tile.icon"
              :class="tile.iconClass"
            />
          </Button>
          <span class="line-clamp-2 text-center text-label-md text-foreground">
            {{ $t(tile.label) }}
          </span>
        </label>
      </div>
      <Separator class="mt-4" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useId, type Component } from "vue";
import { Button } from "@/components/ui/button";
import { DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useDownloadsStore } from "@/modules/downloads/store/downloads.store";
import { isLibraryTrack, type PlayerTrack, type Track } from "@/modules/player/types";
import { useTrackRowCover } from "@/modules/tracks/composables/useTrackRowCover";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { trackHasLyrics } from "@/modules/tracks/lib/trackPredicates";
import IconCloudOff from "~icons/tabler/cloud-off";
import IconDownload from "~icons/tabler/download";
import IconFileMusic from "~icons/tabler/file-music";
import IconLike from "~icons/tabler/heart";
import IconLikedFilled from "~icons/tabler/heart-filled";
import type { ContextActions } from "./type";

const props = defineProps<{
  track: PlayerTrack;
  actions?: ContextActions;
  caps?: TrackMenuCaps | null;
}>();

const coverUrl = useTrackRowCover(() => props.track as Track);

const downloadsStore = useDownloadsStore();

const libTrack = computed(() => (isLibraryTrack(props.track) ? props.track : null));
const activeJob = computed(() => (libTrack.value ? downloadsStore.byTrackId[libTrack.value.id] : undefined));

// One slot for "get the file": the offline copy of a remote track, "Save as"
// for a local one. It stays in the row when neither works, so the row keeps
// three tiles.
const fileAction = computed(() => {
  const { caps, actions } = props;
  if (caps && caps.source !== "local") {
    if (activeJob.value) return { kind: "cancel", label: "track.contextMenu.cancelDownload", run: actions?.cancelOfflineDownload };
    if (caps.hasLocalCopy) return { kind: "remove", label: "track.contextMenu.removeDownload", run: actions?.removeDownload };
    return { kind: "download", label: "track.contextMenu.download", run: caps.canDownload ? actions?.downloadOffline : undefined };
  }
  return { kind: "export", label: "track.contextMenu.exportFile", run: (caps?.canExportFile ?? true) ? actions?.exportFile : undefined };
});

interface Tile {
  key: string;
  label: string;
  icon: Component;
  iconClass?: string;
  pressed?: boolean;
  disabled?: boolean;
  run?: () => void;
}

const idPrefix = useId();

const FILE_ICONS: Record<string, Component> = {
  cancel: Spinner,
  remove: IconCloudOff,
  download: IconDownload,
  export: IconDownload,
};

const tiles = computed<Tile[]>(() => {
  const track = libTrack.value;
  const { actions } = props;
  if (!track || !actions) return [];
  const file = fileAction.value;
  return [
    {
      key: "like",
      label: "player.like",
      icon: track.isLiked ? IconLikedFilled : IconLike,
      iconClass: track.isLiked ? "text-primary" : undefined,
      pressed: track.isLiked,
      run: actions.toggleLike,
    },
    {
      key: "file",
      label: file.label,
      icon: FILE_ICONS[file.kind],
      disabled: !file.run,
      run: file.run,
    },
    {
      key: "lyrics",
      label: trackHasLyrics(track) ? "track.contextMenu.replaceLyrics" : "track.contextMenu.addLyrics",
      icon: IconFileMusic,
      run: actions.attachLyrics,
    },
  ];
});
</script>
