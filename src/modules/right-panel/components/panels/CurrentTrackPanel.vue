<template>
  <div class="flex h-full min-h-0 flex-col bg-card">
    <RightPanelHeader
      title="Сейчас играет"
    />
    <Scrollable class="flex-1">
      <div class="grid gap-4 p-4 pt-0">
        <div class="overflow-hidden min-w-0 rounded-2xl bg-muted ">
          <NuxtImage
            :src="coverUrl"
            fallback-src="/img/fallback.svg"
            class="aspect-square w-full object-cover"
          />
        </div>
        <template v-if="currentTrack">
          <div class="grid gap-3">
            <div class="flex justify-between items-center relative select-none">
              <div class="grid gap-1 flex-1 min-w-0 max-w-fit overflow-hidden mx-2">
                <MarqueeBlock
                  class="group"
                  :duration="20"
                  animate-on-overflow-only
                  pause-on-hover
                  gradient
                  gradient-color="var(--card)"
                  gradient-length="20px"
                >
                  <span class="text-2xl group-hover:underline font-bold">{{ currentTrack?.title }}</span>
                </MarqueeBlock>

                <MarqueeBlock
                  class="group"
                  :duration="6"
                  animate-on-overflow-only
                  pause-on-hover
                  gradient
                  gradient-color="var(--card)"
                  gradient-length="20px"
                >
                  <span class="text-muted-foreground group-hover:text-foreground text-xs transition-colors duration-200">
                    <template
                      v-for="(artist, i) in artistsList"
                      :key="i"
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
            </div>

            <div class="flex flex-col min-w-0 gap-1 pt-4">
              <div class="flex items-center justify-between gap-3 px-2">
                <div>
                  <p class="text-sm font-medium">
                    Далее
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  class="rounded-full"
                  @click="rightPanel.openQueue()"
                >
                  Показать очередь
                </Button>
              </div>
              <TrackContextMenu context="queue">
                <TrackRow
                  v-if="nextQueueItem"
                  hide-index
                  menu-target="queue"
                  :track="nextQueueItem.track as Track"
                  :menu-index="nextQueueIndex"
                  :queue-item-id="nextQueueItem.id"
                  @play="queueStore.jumpTo(nextQueueIndex)"
                />
              </TrackContextMenu>
              <TrackDropdown context="queue" />
            </div>
          </div>
        </template>

        <div
          v-else
          class="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
        >
          Сейчас ничего не играет.
        </div>
      </div>
    </Scrollable>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Scrollable } from "@/components/ui/scrollable";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { isLibraryTrack, type Track } from "@/modules/player/types";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";
import IconHeart from "~icons/tabler/heart";
import IconHeartFilled from "~icons/tabler/heart-filled";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import RightPanelHeader from "../RightPanelHeader.vue";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import { routeLocation } from "@/app/router/route-locations";

const playerStore = usePlayerStore();
const queueStore = useQueueStore();
const rightPanel = useRightPanelStore();
const router = useRouter();
const { toggleTrackLike } = useToggleTrackLike();

const currentTrack = computed(() => playerStore.currentTrack);
const libraryTrack = computed<Track | null>(() => {
  const track = currentTrack.value;
  return track && isLibraryTrack(track) ? track : null;
});

const { url: coverBlobUrl } = useEntityCover("album", () => libraryTrack.value?.albumId ?? null);

const coverUrl = computed(() => {
  const track = currentTrack.value;
  if (!track) return "/img/fallback.svg";
  if (!isLibraryTrack(track)) return track.cover ?? "/img/fallback.svg";
  return coverBlobUrl.value ?? "/img/fallback.svg";
});

const artistsList = computed(() => {
  const artistValue = currentTrack.value?.artist;
  if (!artistValue) return [];
  return artistValue.split(/,\s*/).map(part => part.trim()).filter(Boolean);
});

const nextQueueIndex = computed(() => {
  if (!queueStore.hasNext) return -1;
  return queueStore.currentIndex + 1;
});

const nextQueueItem = computed(() => {
  if (nextQueueIndex.value < 0) return null;
  return queueStore.queue[nextQueueIndex.value] ?? null;
});

async function toggleLike(): Promise<void> {
  if (!libraryTrack.value) return;
  await toggleTrackLike(libraryTrack.value);
}

function goToArtist(index: number): void {
  const artistId = libraryTrack.value?.artistIds?.[index];
  if (!artistId) return;
  router.push(routeLocation.artist(artistId));
}
</script>
