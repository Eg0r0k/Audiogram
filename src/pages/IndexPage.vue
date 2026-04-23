<template>
  <div class="flex min-h-0 flex-1 flex-col bg-background">
    <LibrarySidebar
      v-if="isMobileLayout"
      class="h-full bg-card"
    />

    <template v-else>
      <div class="border-b px-4 py-4 sm:px-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <InputGroup class="bg-muted!  min-w-0 flex-1 rounded-full sm:w-[320px]">
              <InputGroupAddon tabindex="-1">
                <IconSearch class="ml-1 size-4.5 text-muted-foreground" />
              </InputGroupAddon>

              <InputGroupInput
                v-model="searchQuery"
                class="pl-3! text-[15px]"
                placeholder="Search tracks, artists, albums"
                @keydown.stop
              />

              <InputGroupAddon
                v-if="searchQuery.trim()"
                tabindex="-1"
                align="inline-end"
              >
                <Button
                  class="rounded-full"
                  variant="ghost-primary"
                  size="icon-sm"
                  @click="searchQuery = ''"
                >
                  <IconX class="size-5" />
                </Button>
              </InputGroupAddon>
            </InputGroup>

            <!-- <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  variant="outline"
                  class="justify-between gap-2 rounded-full"
                >
                  <span>{{ currentSortLabel }}</span>
                  <IconChevronDown class="size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                class="w-56"
              >
                <DropdownMenuItem @click="sortKey = 'date_added_desc'">
                  Date added: new first
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'date_added_asc'">
                  Date added: old first
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'title_asc'">
                  Title: A to Z
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'title_desc'">
                  Title: Z to A
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'artist_asc'">
                  Artist: A to Z
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'album_asc'">
                  Album: A to Z
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'album_desc'">
                  Album: Z to A
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'duration_asc'">
                  Duration: short first
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'duration_desc'">
                  Duration: long first
                </DropdownMenuItem>
                <DropdownMenuItem @click="sortKey = 'plays_desc'">
                  Most played
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu> -->
          </div>
        </div>
      </div>

      <div
        v-if="isLoading"
        class="flex flex-1 flex-col px-4 pt-4 sm:px-6"
      >
        <TrackRowLoading :rows="5" />
      </div>

      <div
        v-else-if="isError"
        class="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center"
      >
        <div>
          <h2 class="text-2xl font-bold">
            Failed to load tracks
          </h2>
          <p class="text-muted-foreground">
            {{ errorMessage }}
          </p>
        </div>

        <Button @click="refetch">
          Retry
        </Button>
      </div>

      <TrackContextMenu
        v-else
        context="default"
      >
        <div class="relative flex min-h-0 flex-1 flex-col">
          <div class="border-b px-4 sm:px-6">
            <div class="flex h-12 items-center gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <div class="hidden w-10 shrink-0 md:block">
                #
              </div>
              <button
                class="flex min-w-0 flex-[3_1_0%] items-center gap-2 text-left"
                @click="toggleTitleSort"
              >
                <span class="truncate">Title</span>
                <span v-if="sortKey === 'title_asc'">▲</span>
                <span v-else-if="sortKey === 'title_desc'">▼</span>
              </button>
              <button
                class="hidden min-w-0 flex-[2_1_0%] truncate text-left md:block"
                @click="toggleAlbumSort"
              >
                Album
                <span v-if="sortKey === 'album_asc'">▲</span>
                <span v-else-if="sortKey === 'album_desc'">▼</span>
              </button>
              <button
                class="hidden min-w-0 flex-[1.5_1_0%] items-center gap-2 text-left md:flex"
                @click="toggleDateSort"
              >
                <span class="truncate">Date added</span>
                <span v-if="sortKey === 'date_added_asc'">▲</span>
                <span v-else-if="sortKey === 'date_added_desc'">▼</span>
              </button>
              <button
                class="flex w-[60px] shrink-0 justify-end"
                :aria-label="'Sort by duration'"
                @click="toggleDurationSort"
              >
                <IconClock class="size-4" />
                <span
                  v-if="sortKey === 'duration_asc'"
                  class="ml-1"
                >▲</span>
                <span
                  v-else-if="sortKey === 'duration_desc'"
                  class="ml-1"
                >▼</span>
              </button>
            </div>
          </div>

          <VirtualScrollable
            :items="tracks"
            :get-item-key="getTrackKey"
            :item-height="56"
            :padding-top="8"
            :padding-bottom="8"
            class="flex-1"
          >
            <template #default="{ item, index }">
              <div class="px-4">
                <TrackExpanded
                  :track="item"
                  :index="index + 1"
                  :is-active="currentTrackId === item.id"
                  @play="handlePlayTrack(index)"
                  @contextmenu="handleContextMenu(item, index)"
                />
              </div>
            </template>

            <template #empty>
              <div class="px-4 py-12 text-center text-sm text-muted-foreground sm:px-6">
                {{ emptyLabel }}
              </div>
            </template>
          </VirtualScrollable>
        </div>
      </TrackContextMenu>

      <TrackDropdown context="default" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import LibrarySidebar from "@/components/layout/sidebar/LibrarySidebar.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import TrackExpanded from "@/entities/track/ui/TrackExpanded.vue";
import { formatTotalDuration } from "@/lib/format/time";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import TrackRowLoading from "@/modules/tracks/components/TrackRowLoading.vue";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useIndexTracksPage } from "@/modules/tracks/composables/useIndexTracksPage";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import type { TrackSortKey } from "@/modules/tracks/types";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { Track } from "@/modules/player/types";
import IconChevronDown from "~icons/tabler/chevron-down";
import IconClock from "~icons/tabler/clock-hour-4";
import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";

const sortKey = ref<TrackSortKey | null>(null);
const searchQuery = ref("");
const { t } = useI18n();
const { isMobileLayout } = useDeviceLayout();

const {
  resolvedSortKey,
  normalizedSearchQuery,
  tracks,
  total,
  totalDuration,
  isLoading,
  isError,
  error,
  refetch,
} = useIndexTracksPage(sortKey, searchQuery);

const queueStore = useQueueStore();
const playerStore = usePlayerStore();
const { openMenu } = useTrackMenu();

const currentTrackId = computed(() => playerStore.currentTrack?.id ?? null);

const emptyLabel = computed(() =>
  normalizedSearchQuery.value
    ? `No tracks found for "${normalizedSearchQuery.value}".`
    : "Your library is empty.",
);

const errorMessage = computed(() =>
  error.value instanceof Error ? error.value.message : "Unknown error",
);

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function toggleTitleSort() {
  if (sortKey.value !== "title_asc" && sortKey.value !== "title_desc") {
    sortKey.value = "title_asc";
    return;
  }

  sortKey.value = sortKey.value === "title_asc" ? "title_desc" : null;
}

function toggleDateSort() {
  if (sortKey.value !== "date_added_asc" && sortKey.value !== "date_added_desc") {
    sortKey.value = "date_added_asc";
    return;
  }

  sortKey.value = sortKey.value === "date_added_asc" ? "date_added_desc" : null;
}

function toggleDurationSort() {
  if (sortKey.value !== "duration_asc" && sortKey.value !== "duration_desc") {
    sortKey.value = "duration_asc";
    return;
  }

  sortKey.value = sortKey.value === "duration_asc" ? "duration_desc" : null;
}

function toggleAlbumSort() {
  if (sortKey.value !== "album_asc" && sortKey.value !== "album_desc") {
    sortKey.value = "album_asc";
    return;
  }

  sortKey.value = sortKey.value === "album_asc" ? "album_desc" : null;
}

function handleContextMenu(track: Track, index: number) {
  openMenu(track, index, { target: "default" });
}

async function handlePlayTrack(index: number) {
  const track = tracks.value[index];
  if (!track) {
    return;
  }

  if (currentTrackId.value === track.id) {
    playerStore.togglePlay();
    return;
  }

  await queueStore.setQueue(
    tracks.value,
    index,
    normalizedSearchQuery.value ? { type: "search" } : { type: "manual" },
  );
}
</script>
