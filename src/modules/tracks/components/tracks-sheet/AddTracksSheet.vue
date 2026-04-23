<template>
  <Sheet
    :open="open"
    @update:open="handleOpenChange"
  >
    <SheetContent
      side="right"
      class="flex h-full w-full flex-col gap-0 overflow-hidden border-none bg-card p-0 sm:max-w-sm"
    >
      <div class="border-b bg-card px-4 py-3">
        <div class="flex items-center gap-3">
          <InputGroup class="dark:bg-background! bg-muted! h-11 flex-1 rounded-full">
            <InputGroupAddon tabindex="-1">
              <IconSearch class="ml-1 size-4.5 text-muted-foreground" />
            </InputGroupAddon>

            <InputGroupInput
              v-model="searchInput"
              class="pl-3! text-[15px]"
              :placeholder="t('search.placeholder')"
              @keydown.stop
            />

            <InputGroupAddon
              v-if="searchInput.trim()"
              tabindex="-1"
              align="inline-end"
            >
              <Button
                class="rounded-full"
                variant="ghost-primary"
                size="icon-sm"
                @click="searchInput = ''"
              >
                <IconX class="size-5" />
              </Button>
            </InputGroupAddon>
          </InputGroup>

          <div
            class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
            :class="selectedCount > 0 ? 'bg-primary/10 text-primary' : ''"
          >
            {{ selectedCount }}
          </div>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-hidden">
        <VirtualScrollable
          :items="tracks"
          :get-item-key="getTrackKey"
          :item-height="64"
          :load-more-offset="160"
          :loading="isInitialLoading"
          class="h-full"
          @load-more="handleLoadMore"
        >
          <template #default="{ item }">
            <div class="px-4">
              <TrackSelectRow
                :track="item"
                :is-selected="isTrackSelected(item.id)"
                @toggle-select="toggleTrackSelect"
              />
            </div>
          </template>

          <template #loader>
            <IconLoader2 class="size-5 animate-spin text-muted-foreground" />
          </template>

          <template #empty>
            <div class="px-4 py-8 text-center text-sm text-muted-foreground">
              {{ emptyLabel }}
            </div>
          </template>
        </VirtualScrollable>
      </div>

      <div
        v-if="isFetchingNextPage"
        class=" px-4 py-3"
      >
        <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <IconLoader2 class="size-4 animate-spin" />
          {{ t("common.loading") }}
        </div>
      </div>

      <SheetFooter class="border-t bg-card px-4 py-3">
        <div class="flex items-center gap-3">
          <Button
            variant="ghost"
            size="lg"
            class="flex-1"
            @click="closeSheet"
          >
            {{ t("common.cancel") }}
          </Button>

          <Button
            size="lg"
            class="flex-1"
            :disabled="selectedCount === 0 || isConfirming"
            @click="handleConfirm"
          >
            <IconLoader2
              v-if="isConfirming"
              class="size-5 animate-spin"
            />
            {{ confirmLabel }}
          </Button>
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>

<script setup lang="ts">
import { refDebounced } from "@vueuse/core";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/vue-query";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@/components/ui/sheet";
import { rebuildSearchIndex } from "@/modules/search/composables/useSearch";
import type { Track } from "@/modules/player/types";
import TrackSelectRow from "../TrackSelectRow.vue";
import { addTracksToPlaylistAndSync } from "@/queries/playlist.queries";
import { queryKeys } from "@/queries/query-keys";
import {
  addTracksToAlbumAndSync,
  addTracksToArtistAndSync,
  favoriteTracksAndSync,
  getTracksPaginated,
} from "@/queries/track.queries";
import { AlbumId, ArtistId, PlaylistId } from "@/types/ids";
import IconLoader2 from "~icons/tabler/loader-2";
import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";

interface Props {
  entityType: "playlist" | "album" | "artist" | "favorite";
  entityId: string | number;
  open: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "confirmed": [];
}>();

const { t } = useI18n();
const queryClient = useQueryClient();

const searchInput = ref("");
const debouncedSearchQuery = refDebounced(searchInput, 200);
const selectedTrackMap = ref(new Map<string, Track>());

const normalizedEntityId = computed(() => String(props.entityId));
const normalizedSearchQuery = computed(() => debouncedSearchQuery.value.trim());
const hasEntityId = computed(() => props.entityType === "favorite" || normalizedEntityId.value.length > 0);

const {
  data: infiniteData,
  fetchNextPage,
  hasNextPage,
  isLoading,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: computed(() => queryKeys.tracks.allPaginated(normalizedSearchQuery.value)),
  queryFn: ({ pageParam = 0 }) => getTracksPaginated(pageParam, normalizedSearchQuery.value),
  initialPageParam: 0,
  getNextPageParam: lastPage => lastPage.nextOffset,
  enabled: computed(() => props.open && hasEntityId.value),
});

const tracks = computed(() =>
  infiniteData.value?.pages.flatMap(page => page.tracks) ?? [],
);

const selectedTracks = computed(() => Array.from(selectedTrackMap.value.values()));
const selectedCount = computed(() => selectedTrackMap.value.size);
const isInitialLoading = computed(() => isLoading.value && tracks.value.length === 0);
const emptyLabel = computed(() =>
  normalizedSearchQuery.value.length > 0
    ? t("search.noResults.title", { query: normalizedSearchQuery.value })
    : t("common.empty"),
);
const title = computed(() => {
  switch (props.entityType) {
    case "playlist":
      return t("sheet.addToPlaylist");
    case "album":
      return t("sheet.addToAlbum");
    case "artist":
      return t("sheet.addToArtist");
    case "favorite":
      return t("sheet.addToFavorites");
    default:
      return t("sheet.addTracks");
  }
});

const confirmLabel = computed(() => title.value);

const { mutateAsync: confirmSelection, isPending: isConfirming } = useMutation({
  mutationFn: async () => {
    const tracksToAdd = selectedTracks.value;

    if (tracksToAdd.length === 0) {
      return;
    }

    switch (props.entityType) {
      case "playlist":
        await addTracksToPlaylistAndSync(
          queryClient,
          PlaylistId(normalizedEntityId.value),
          tracksToAdd,
        );
        break;

      case "album":
        await addTracksToAlbumAndSync(
          queryClient,
          AlbumId(normalizedEntityId.value),
          tracksToAdd,
        );
        await rebuildSearchIndex();
        break;

      case "artist":
        await addTracksToArtistAndSync(
          queryClient,
          ArtistId(normalizedEntityId.value),
          tracksToAdd,
        );
        await rebuildSearchIndex();
        break;

      case "favorite":
        await favoriteTracksAndSync(queryClient, tracksToAdd);
        await rebuildSearchIndex();
        break;
    }
  },
});

function getTrackKey(index: number) {
  return tracks.value[index]?.id ?? index;
}

function handleLoadMore() {
  if (!props.open || !hasNextPage.value || isFetchingNextPage.value) {
    return;
  }

  fetchNextPage();
}

function isTrackSelected(trackId: string) {
  return selectedTrackMap.value.has(trackId);
}

function toggleTrackSelect(track: Track) {
  const next = new Map(selectedTrackMap.value);

  if (next.has(track.id)) {
    next.delete(track.id);
  }
  else {
    next.set(track.id, track);
  }

  selectedTrackMap.value = next;
}

async function handleConfirm() {
  if (selectedCount.value === 0) {
    return;
  }

  try {
    await confirmSelection();
    toast.success(t("sheet.addSuccess"));
    emit("confirmed");
    closeSheet();
  }
  catch {
    toast.error(t("sheet.addFailed"));
  }
}

function resetState() {
  selectedTrackMap.value = new Map();
  searchInput.value = "";
}

function closeSheet() {
  resetState();
  emit("update:open", false);
}

function handleOpenChange(value: boolean) {
  if (!value) {
    resetState();
  }

  emit("update:open", value);
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    resetState();
  }
});
</script>
