<template>
  <TooltipProvider
    :delay-duration="300"
    disable-hoverable-content
  >
    <div class="flex h-full min-w-0 items-center gap-2 pt-2 bg-card">
      <Button
        variant="ghost"
        color="muted"
        size="icon-lg"
        class="shrink-0 rounded-full"
        :aria-label="t('library.selection.exit')"
        :disabled="busy"
        @click="emit('exit')"
      >
        <IconX class="size-6" />
      </Button>

      <h2
        class="shrink-0 font-bold tabular-nums"
        :class="compact ? 'text-xl' : 'text-2xl'"
        :aria-label="t('library.selection.count', count)"
      >
        {{ count }}
      </h2>

      <Button
        variant="ghost"
        color="muted"
        size="sm"
        class="shrink-0"
        :disabled="busy || selectingAll"
        @click="toggleSelectAll"
      >
        <Spinner
          v-if="selectingAll"
          class="size-4"
        />
        {{ t(allSelected ? 'library.selection.deselectAll' : 'library.selection.selectAll') }}
      </Button>

      <div
        ref="actionsRef"
        class="flex min-w-0 flex-1 items-center justify-end gap-0.5 overflow-hidden"
      >
        <Tooltip
          v-for="action in inlineActions"
          :key="action.key"
        >
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              color="muted"
              size="icon-lg"
              class="shrink-0 rounded-full"
              :class="{ 'text-destructive hover:text-destructive': action.destructive }"
              :aria-label="action.label"
              :disabled="actionsDisabled"
              @click="action.run"
            >
              <component
                :is="action.icon"
                class="size-5"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {{ action.label }}
          </TooltipContent>
        </Tooltip>

        <ResponsiveMenu v-if="overflowActions.length > 0 || playlists.length > 0">
          <ResponsiveMenuTrigger>
            <Button
              variant="ghost"
              color="muted"
              size="icon-lg"
              class="shrink-0 rounded-full"
              :aria-label="t('library.selection.more')"
              :disabled="actionsDisabled"
            >
              <IconDots class="size-5" />
            </Button>
          </ResponsiveMenuTrigger>
          <ResponsiveMenuContent
            align="end"
            class="min-w-52"
          >
            <ResponsiveMenuItem
              v-for="action in overflowActions"
              :key="action.key"
              :color="action.destructive ? 'destructive' : undefined"
              @select="action.run"
            >
              <component
                :is="action.icon"
                class="size-4"
              />
              {{ action.label }}
            </ResponsiveMenuItem>

            <template v-if="playlists.length > 0">
              <ResponsiveMenuSeparator v-if="overflowActions.length > 0" />
              <ResponsiveMenuLabel>{{ t('track.contextMenu.addToPlaylist') }}</ResponsiveMenuLabel>
              <ResponsiveMenuItem
                v-for="playlist in playlists"
                :key="playlist.id"
                @select="emit('addToPlaylist', playlist.id)"
              >
                <IconPlaylist class="size-4" />
                <span class="truncate">{{ playlist.name }}</span>
              </ResponsiveMenuItem>
            </template>
          </ResponsiveMenuContent>
        </ResponsiveMenu>
      </div>
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import type { Component } from "vue";
import { useElementSize } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuLabel,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger,
} from "@/components/ui/responsive-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import IconDots from "~icons/tabler/dots";
import IconHeart from "~icons/tabler/heart";
import IconHeartFilled from "~icons/tabler/heart-filled";
import IconListNumbers from "~icons/tabler/list-numbers";
import IconPlay from "~icons/audiogram/play-rounded";
import IconPlayerTrackNext from "~icons/tabler/player-track-next";
import IconPlaylist from "~icons/tabler/playlist";
import IconPlaylistAdd from "~icons/tabler/playlist-add";
import IconTrash from "~icons/tabler/trash";
import IconX from "~icons/tabler/x";
import type { PlaylistId } from "@/types/ids";
import { usePlaylistMenu } from "./menu/composables/usePlaylistMenu";

const props = defineProps<{
  count: number;
  allSelected: boolean;
  allLiked: boolean;
  busy: boolean;
  selectingAll: boolean;
  /** Phone header: the count title is a size smaller. */
  compact?: boolean;
}>();

const emit = defineEmits<{
  exit: [];
  selectAll: [];
  deselectAll: [];
  play: [];
  playNext: [];
  addToQueue: [];
  toggleLike: [];
  createPlaylist: [];
  addToPlaylist: [playlistId: PlaylistId];
  delete: [];
}>();

// An icon-lg button plus the gap between buttons.
const ACTION_PX = 42;

const { t } = useI18n();
const actionsRef = useTemplateRef<HTMLElement>("actionsRef");
// The actions area takes whatever the title and select-all leave over, so its
// width alone decides how many buttons fit next to the more button.
const { width } = useElementSize(actionsRef);
const actionsDisabled = computed(() => props.busy || props.count === 0);

const toggleSelectAll = () => {
  if (props.allSelected) emit("deselectAll");
  else emit("selectAll");
};

const likeLabel = computed(() =>
  t(props.allLiked ? "track.contextMenu.removeFromFavorites" : "track.contextMenu.addToFavorites"),
);

interface BarAction {
  key: string;
  label: string;
  icon: Component;
  run: () => void;
  destructive?: boolean;
}

// Same icon vocabulary as the track context menu, all tabler outline so the
// glyphs share one optical size.
const actions = computed<BarAction[]>(() => [
  { key: "play", label: t("track.contextMenu.play"), icon: IconPlay, run: () => emit("play") },
  { key: "playNext", label: t("track.contextMenu.playNext"), icon: IconPlayerTrackNext, run: () => emit("playNext") },
  { key: "queue", label: t("track.contextMenu.addToQueue"), icon: IconListNumbers, run: () => emit("addToQueue") },
  { key: "like", label: likeLabel.value, icon: props.allLiked ? IconHeartFilled : IconHeart, run: () => emit("toggleLike") },
  { key: "createPlaylist", label: t("track.contextMenu.createPlaylist"), icon: IconPlaylistAdd, run: () => emit("createPlaylist") },
  { key: "delete", label: t("common.delete"), icon: IconTrash, run: () => emit("delete"), destructive: true },
]);

const fitCount = computed(() => {
  if (width.value <= 0) return actions.value.length;
  const slots = Math.floor(width.value / ACTION_PX);
  // Everything fits only if no more button is needed for overflow.
  return slots >= actions.value.length ? actions.value.length : Math.max(0, slots - 1);
});

const inlineActions = computed(() => actions.value.slice(0, fitCount.value));
const overflowActions = computed(() => actions.value.slice(fitCount.value));

const { playlists } = usePlaylistMenu();
</script>
