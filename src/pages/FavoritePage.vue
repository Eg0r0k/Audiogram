<template>
  <Scrollable class="flex-1">
    <template v-if="isLoading">
      <div class="flex h-full items-center justify-center">
        <IconLoader2 class="size-8 animate-spin text-muted-foreground" />
      </div>
    </template>

    <template v-else-if="isError">
      <div class="flex h-full flex-col items-center justify-center gap-4">
        <div class="text-center">
          <h2 class="text-2xl font-bold">
            {{ $t("errors.title") }}
          </h2>
          <p class="text-muted-foreground">
            {{ $t("errors.loadFailed") }}
          </p>
        </div>

        <Button @click="refetch">
          {{ $t("common.retry") }}
        </Button>
      </div>
    </template>

    <template v-else>
      <MediaHero
        :data="likedData"
        @play="handlePlayAll"
        @shuffle="handleShuffle"
        @add-to-queue="handleAddToQueue"
      />

      <TrackContextMenu context="liked">
        <div
          class="px-4 mt-4"
        >
          <TrackRow
            v-for="(track, index) in tracks"
            :key="track.id"
            :track="track"
            :index="index + 1"
            @play="handlePlayTrack(index)"
          />
        </div>
      </TrackContextMenu>

      <TrackDropdown context="liked" />
    </template>
  </Scrollable>
</template>

<script setup lang="ts">
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import MediaHero from "@/modules/media-hero/components/MediaHero.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import { Button } from "@/components/ui/button";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import IconLoader2 from "~icons/tabler/loader-2";
import { useLikedTracksPage } from "@/modules/favorite/composables/useLikedTracksPage";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";

const queueStore = useQueueStore();

const {
  tracks,
  likedData,
  isLoading,
  isError,
  refetch,
} = useLikedTracksPage();

function handlePlayAll() {
  if (tracks.value.length === 0) return;

  queueStore.setQueue(tracks.value, 0, {
    type: "liked",
  });
}

function handleShuffle() {
  if (tracks.value.length === 0) return;

  const startIndex = Math.floor(Math.random() * tracks.value.length);

  queueStore.setQueue(tracks.value, startIndex, {
    type: "liked",
  });
}

function handlePlayTrack(index: number) {
  if (tracks.value.length === 0) return;

  queueStore.setQueue(tracks.value, index, {
    type: "liked",
  });
}

function handleAddToQueue() {
  if (tracks.value.length === 0) return;
  queueStore.addMultipleToQueue(tracks.value, {
    type: "liked",
  });
}
</script>
