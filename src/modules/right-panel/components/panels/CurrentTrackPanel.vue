<template>
  <div class="flex h-full min-h-0 flex-col bg-card">
    <RightPanelHeader :title="$t('player.nowPlaying')">
      <template #trailing>
        <Button
          size="icon-md"
          class="rounded-full"
          :class="!currentTrack && 'invisible'"
          variant="ghost"
          color="muted"
          :disabled="!currentTrack"
          :aria-hidden="!currentTrack || undefined"
          :tabindex="currentTrack ? undefined : -1"
          @click.stop="onDotsClick"
        >
          <IconDots class="size-6" />
        </Button>
      </template>
    </RightPanelHeader>
    <Scrollable class="flex-1">
      <CrossfadeTransition>
        <div
          v-if="queueStore.isRestoring && !currentTrack"
          class="flex flex-col px-5 pt-0.5 pb-4"
        >
          <Skeleton class="aspect-square w-full rounded-lg" />
          <div class="mt-4 grid gap-1">
            <div class="flex h-8 items-center">
              <Skeleton class="h-6 w-[60%]" />
            </div>
            <div class="flex h-4 items-center">
              <Skeleton class="h-3.5 w-[40%]" />
            </div>
          </div>
          <div class="mt-8 flex h-(--control-height-sm) items-center">
            <Skeleton class="h-4 w-16" />
          </div>
          <div class="mt-3 flex flex-col">
            <div
              v-for="row in 3"
              :key="row"
              class="flex h-16 items-center gap-3"
            >
              <Skeleton class="size-10 shrink-0 rounded" />
              <div class="grid flex-1 gap-2">
                <Skeleton class="h-3 w-[60%]" />
                <Skeleton class="h-2.5 w-[36%]" />
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="currentTrack"
          class="flex flex-col px-5 pt-0.5 pb-4"
        >
          <CurrentTrackCover
            :src="panelCoverUrl"
            :track="currentTrack"
          />

          <div class="mt-4 flex justify-between items-center relative select-none">
            <div class="grid gap-1 flex-1 min-w-0 max-w-fit overflow-hidden">
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
              color="muted"
              size="icon-md"
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
              color="muted"
              size="icon-md"
              class="shrink-0 rounded-full"
              :disabled="isImportRunning"
              :title="$t('common.import.toLibrary')"
              :aria-label="$t('common.import.toLibrary')"
              @click="importCurrent"
            >
              <IconFileImport class="size-6" />
            </Button>
          </div>

          <template v-if="upNext.kind !== 'none'">
            <div class="mt-8 flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-foreground">
                {{ $t('player.upNext') }}
              </p>
              <Button
                variant="ghost"
                color="muted"
                size="sm"
                class="-mr-2 rounded-full px-2"
                @click="rightPanel.openQueue()"
              >
                {{ $t('queue.showQueue') }}
              </Button>
            </div>

            <TrackContextMenu context="queue">
              <div class="mt-3 -mx-2.5 flex flex-col">
                <template v-if="upNext.kind === 'tracks'">
                  <TrackRow
                    v-for="entry in upNext.entries"
                    :key="entry.item.id"
                    hide-index
                    menu-target="queue"
                    :track="entry.item.track as Track"
                    :menu-index="entry.index"
                    :queue-item-id="entry.item.id"
                    @play="queueStore.jumpTo(entry.index)"
                  />
                </template>
                <TrackRow
                  v-else-if="upNext.kind === 'repeat-one'"
                  hide-index
                  menu-target="queue"
                  :track="upNext.entry.item.track as Track"
                  :menu-index="upNext.entry.index"
                  :queue-item-id="upNext.entry.item.id"
                  :subtitle="$t('player.repeatsThisTrack')"
                  @play="queueStore.jumpTo(upNext.entry.index)"
                />
                <div
                  v-else-if="upNext.kind === 'autoplay'"
                  class="flex h-16 items-center gap-3 px-2.5"
                >
                  <div class="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
                    <IconSparkles class="size-5 text-muted-foreground" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-base font-medium">
                      {{ $t('player.similarTracks') }}
                    </p>
                    <p class="truncate text-sm text-muted-foreground">
                      {{ $t('player.autoplayAddsSimilar') }}
                    </p>
                  </div>
                </div>
                <div
                  v-else
                  class="flex h-16 items-center gap-3 px-2.5"
                >
                  <div class="flex size-10 shrink-0 items-center justify-center rounded bg-muted">
                    <IconPlaylistX class="size-5 text-muted-foreground" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-base font-medium">
                      {{ $t('player.lastInQueue') }}
                    </p>
                    <p class="truncate text-sm text-muted-foreground">
                      {{ $t('player.playbackStopsAfter') }}
                    </p>
                  </div>
                  <Button
                    v-if="!queueStore.isRadio"
                    variant="solid"
                    color="card"
                    size="sm"
                    class="shrink-0"
                    @click="repeatQueue"
                  >
                    <IconRepeat />
                    {{ $t('player.repeatQueue') }}
                  </Button>
                </div>
              </div>
            </TrackContextMenu>
          </template>

          <LyricsPreviewCard
            class="mt-8"
            :cover-color="playerColor.hex"
          />
          <TrackDropdown context="queue" />
          <TrackDropdown context="current-track" />
        </div>

        <div
          v-else
          class="grid gap-4 px-5 pt-0.5 pb-4"
        >
          <CurrentTrackCover
            :src="panelCoverUrl"
            :track="currentTrack"
          />
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{{ $t('player.nothingPlayingTitle') }}</EmptyTitle>
              <EmptyDescription>{{ $t('player.nothingPlayingSub') }}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="solid"
                color="surface"
                @click="goToAllMusic"
              >
                {{ $t('player.browseMusic') }}
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </CrossfadeTransition>
    </Scrollable>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import CrossfadeTransition from "@/components/transitions/CrossfadeTransition.vue";
import { Scrollable } from "@/components/ui/scrollable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogger } from "@/lib/logger";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { mascotCoverUrl } from "@/modules/covers/lib/placeholder";
import { useCurrentTrackCover } from "@/modules/player/composables/useCurrentTrackCover";
import type { Track } from "@/types/track";
import { resolveUpNext } from "@/modules/queue/lib/up-next";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";
import { useEphemeralImport } from "@/modules/tracks/composables/useEphemeralImport";
import IconHeart from "~icons/tabler/heart";
import IconHeartFilled from "~icons/tabler/heart-filled";
import IconDots from "~icons/tabler/dots";
import IconFileImport from "~icons/tabler/file-import";
import IconPlaylistX from "~icons/tabler/playlist-x";
import IconRepeat from "~icons/tabler/repeat";
import IconSparkles from "~icons/tabler/sparkles";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import RightPanelHeader from "../RightPanelHeader.vue";
import CurrentTrackCover from "./current-track/CurrentTrackCover.vue";
import LyricsPreviewCard from "./current-track/LyricsPreviewCard.vue";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import { routeLocation } from "@/app/router/route-locations";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useMobilePlayerColor } from "@/modules/player/composables/useMobilePlayerColor";
import { formatError } from "@/lib/errors";

// Kept in the panel, which stays mounted: a remounted card must not restart from the grey fallback.
const { color: playerColor } = useMobilePlayerColor();
const queueStore = useQueueStore();
const rightPanel = useRightPanelStore();
const router = useRouter();
const { toggleTrackLike } = useToggleTrackLike();

const { openDropdown } = useTrackMenu();

function onDotsClick(event: MouseEvent): void {
  if (!currentTrack.value) return;
  openDropdown(currentTrack.value, 0, event, { target: "current-track" });
}

const { track: currentTrack, libraryTrack, coverUrl } = useCurrentTrackCover();

// Recomputes only when the track changes, so every stretch of silence gets a new random mascot.
const panelCoverUrl = computed(() => (currentTrack.value ? coverUrl.value : mascotCoverUrl(crypto.randomUUID())));

const artistsList = computed(() => {
  const artistValue = currentTrack.value?.artist;
  if (!artistValue) return [];
  return artistValue.split(/,\s*/).map(part => part.trim()).filter(Boolean);
});

const upNext = computed(() => resolveUpNext(
  queueStore.queue,
  queueStore.currentIndex,
  queueStore.repeatMode,
  queueStore.continuesAfterTail,
));

const repeatQueue = () => {
  queueStore.repeatMode = "all";
};

async function toggleLike(): Promise<void> {
  if (!libraryTrack.value) return;
  await toggleTrackLike(libraryTrack.value);
}

const { importPath, isRunning: isImportRunning, importCurrent } = useEphemeralImport(currentTrack);

const goToAllMusic = (): void => {
  router.push(routeLocation.allMusic())
    .catch(error => getLogger().error(`[RightPanel] Navigation to all music failed: ${formatError(error)}`));
};

function goToArtist(index: number): void {
  const artistId = libraryTrack.value?.artistIds[index];
  if (!artistId) return;
  router.push(routeLocation.artist(artistId))
    .catch(error => getLogger().error(`[RightPanel] Navigation to the artist page failed: ${formatError(error)}`));
}
</script>
