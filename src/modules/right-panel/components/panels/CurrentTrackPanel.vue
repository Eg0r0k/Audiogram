<template>
  <div class="flex h-full min-h-0 flex-col bg-card">
    <RightPanelHeader :title="$t('player.nowPlaying')">
      <template #trailing>
        <Button
          v-if="currentTrack"
          size="icon"
          class="rounded-full"
          variant="ghost"
          @click.stop="onDotsClick"
        >
          <IconDots class="size-6" />
        </Button>
      </template>
    </RightPanelHeader>
    <Scrollable class="flex-1">
      <div
        class="grid gap-3 py-4 px-5 pt-0"
      >
        <TrackContextMenu context="current-track">
          <div>
            <MorphingDialog
              :transition="{
                type: 'spring',
                bounce: 0.3,
                duration: 0.4,
              }"
            >
              <MorphingDialogTrigger
                :data-track-menu-trigger="currentTrack ? true : undefined"
                class="block w-full select-none  rounded-lg overflow-hidden "
                @contextmenu="onCoverContextMenu"
              >
                <NuxtImage
                  v-slot="{ imgAttrs, isLoaded, src }"
                  :src="coverUrl"
                  fallback-src="/img/fallback.svg"
                  custom
                >
                  <img
                    :key="src"
                    v-bind="imgAttrs"
                    :src="src"
                    alt=""
                    class="aspect-square w-full object-cover transition-[transform,opacity] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100 motion-reduce:transition-opacity motion-reduce:duration-150"
                    :class="isLoaded ? 'scale-100 opacity-100' : 'scale-[1.02] opacity-0 motion-reduce:scale-100'"
                  >
                </NuxtImage>
              </MorphingDialogTrigger>
              <MorphingDialogContainer>
                <MorphingDialogContent
                  class="
            relative
            select-none
            overflow-hidden
            rounded-3xl
            bg-transparent
            shadow-none
          "
                >
                  <NuxtImage
                    v-slot="{ imgAttrs, isLoaded, src }"
                    :src="coverUrl"
                    fallback-src="/img/fallback.svg"
                    class="
              h-auto
              w-full
              max-w-[90vw]
              object-cover
              lg:h-[70vh]
              lg:w-auto
            "
                    custom
                  >
                    <img
                      :key="src"
                      v-bind="imgAttrs"
                      :src="src"
                      alt=""
                      class="aspect-square w-full object-cover transition-[transform,opacity] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100 motion-reduce:transition-opacity motion-reduce:duration-150"
                      :class="isLoaded ? 'scale-100 opacity-100' : 'scale-[1.02] opacity-0 motion-reduce:scale-100'"
                    >
                  </NuxtImage>
                  <MorphingDialogClose />
                </MorphingDialogContent>
              </MorphingDialogContainer>
            </MorphingDialog>
          </div>
        </TrackContextMenu>

        <template v-if="currentTrack">
          <div class="grid gap-3">
            <div class="flex justify-between items-center relative select-none">
              <div class="grid gap-1 flex-1 min-w-0 max-w-fit overflow-hidden mx-2">
                <MarqueeBlock
                  class="group"
                  pause-on-hover
                  gradient
                  gradient-color="var(--card)"
                  gradient-length="20px"
                >
                  <span
                    v-copy="currentTrack?.title"
                    class="text-2xl group-hover:underline font-bold cursor-pointer"
                  >{{ currentTrack?.title }}</span>
                </MarqueeBlock>

                <MarqueeBlock
                  class="group"
                  pause-on-hover
                  gradient
                  gradient-color="var(--card)"
                  gradient-length="20px"
                >
                  <span class="text-muted-foreground group-hover:text-foreground text-xs transition-colors duration-200">
                    <template
                      v-for="(artist, i) in artistsList"
                      :key="artist"
                    >
                      <span
                        role="link"
                        tabindex="0"
                        class="cursor-pointer hover:underline"
                        @click.stop="goToArtist(i)"
                        @keypress.enter.stop="goToArtist(i)"
                      >
                        {{ artist }}
                      </span>

                      <span v-if="i < artistsList.length - 1">, </span>
                    </template>
                  </span>
                </MarqueeBlock>
              </div>
              <Button
                v-if="libraryTrack"
                variant="ghost"
                size="icon"
                class="shrink-0 rounded-full"
                @click="toggleLike"
              >
                <IconHeartFilled
                  v-if="libraryTrack.isLiked"
                  class="size-6 text-primary"
                />
                <IconHeart
                  v-else
                  class="size-6"
                />
              </Button>
              <Button
                v-else-if="importPath"
                variant="ghost"
                size="icon"
                class="shrink-0 rounded-full"
                :disabled="isImportRunning"
                :title="$t('common.import.toLibrary')"
                :aria-label="$t('common.import.toLibrary')"
                @click="importCurrent"
              >
                <IconFileImport class="size-6" />
              </Button>
            </div>

            <div
              class="flex flex-col min-w-0 gap-1 p-2 rounded-sm bg-[color-mix(in_oklch,var(--cover-color)_30%,black)] transition-[background-color] duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              :style="{ '--cover-color': playerColor.hsl }"
            >
              <div class="flex items-center justify-between gap-3 pl-2">
                <div>
                  <p class="text-sm font-medium text-white">
                    {{ $t('player.upNextLabel') }}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  class="rounded-full px-2"
                  @click="rightPanel.openQueue()"
                >
                  {{ $t('queue.showQueue') }}
                </Button>
              </div>

              <TrackContextMenu context="queue">
                <div class="flex flex-col gap-1">
                  <TrackRow
                    v-for="entry in nextQueueItems"
                    :key="entry.item.id"
                    hide-index
                    class="text-white! hover:bg-muted/80!"
                    menu-target="queue"
                    :track="entry.item.track as Track"
                    :menu-index="entry.index"
                    :queue-item-id="entry.item.id"
                    @play="queueStore.jumpTo(entry.index)"
                  />
                </div>
              </TrackContextMenu>
              <TrackDropdown context="queue" />
              <TrackDropdown context="current-track" />
            </div>
          </div>
        </template>

        <Empty
          v-else
        >
          <EmptyHeader>
            <EmptyTitle>{{ $t('player.nothingPlayingTitle') }}</EmptyTitle>
            <EmptyDescription>{{ $t('player.nothingPlayingSub') }}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              @click="goToAllMusic"
            >
              {{ $t('player.browseMusic') }}
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    </Scrollable>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Scrollable } from "@/components/ui/scrollable";
import { Button } from "@/components/ui/button";
import { getLogger } from "@/lib/logger";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { useCurrentTrackCover } from "@/modules/player/composables/useCurrentTrackCover";
import type { Track } from "@/modules/player/types";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";
import { useEphemeralImport } from "@/modules/tracks/composables/useEphemeralImport";
import IconHeart from "~icons/tabler/heart";
import IconHeartFilled from "~icons/tabler/heart-filled";
import IconDots from "~icons/tabler/dots";
import IconFileImport from "~icons/tabler/file-import";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import RightPanelHeader from "../RightPanelHeader.vue";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import { routeLocation } from "@/app/router/route-locations";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useMobilePlayerColor } from "@/modules/player/composables/useMobilePlayerColor";

import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogClose,
} from "@/components/ui/motion/dialog";

// The colour lands ~400 ms after a track change (useMobilePlayerColor delays
// extraction past the cover slide); the block crossfades to it in 900 ms,
// matching the mobile full-player background.
const { color: playerColor } = useMobilePlayerColor();
const queueStore = useQueueStore();
const rightPanel = useRightPanelStore();
const router = useRouter();
const { toggleTrackLike } = useToggleTrackLike();

const { openDropdown, openMenu } = useTrackMenu();

function onDotsClick(event: MouseEvent): void {
  if (!currentTrack.value) return;
  openDropdown(currentTrack.value, 0, event, { target: "current-track" });
}

function onCoverContextMenu(): void {
  if (!currentTrack.value) return;
  openMenu(currentTrack.value, 0, { target: "current-track" });
}

const { track: currentTrack, libraryTrack, coverUrl } = useCurrentTrackCover();

const artistsList = computed(() => {
  const artistValue = currentTrack.value?.artist;
  if (!artistValue) return [];
  return artistValue.split(/,\s*/).map(part => part.trim()).filter(Boolean);
});

const UP_NEXT_LIMIT = 3;

const nextQueueItems = computed(() => {
  if (!queueStore.hasNext) return [];

  const start = queueStore.currentIndex + 1;
  return queueStore.queue
    .slice(start, start + UP_NEXT_LIMIT)
    .map((item, offset) => ({ item, index: start + offset }));
});

async function toggleLike(): Promise<void> {
  if (!libraryTrack.value) return;
  await toggleTrackLike(libraryTrack.value);
}

const { importPath, isRunning: isImportRunning, importCurrent } = useEphemeralImport(currentTrack);

const goToAllMusic = (): void => {
  router.push(routeLocation.allMusic())
    .catch(error => getLogger().error(`[RightPanel] Navigation to all music failed: ${String(error)}`));
};

function goToArtist(index: number): void {
  const artistId = libraryTrack.value?.artistIds[index];
  if (!artistId) return;
  router.push(routeLocation.artist(artistId))
    .catch(error => getLogger().error(`[RightPanel] Navigation to the artist page failed: ${String(error)}`));
}
</script>
