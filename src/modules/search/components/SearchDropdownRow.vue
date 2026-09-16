<script setup lang="ts">
import { computed } from "vue";
import type { SearchResultItem } from "@/modules/search/types";
import type { Track } from "@/modules/player/types";
import type { LibraryItem } from "@/modules/library/types";
import type { RouteLocationRaw } from "vue-router";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import LibrarySidebarItem from "@/components/layout/sidebar/library-item/LibrarySidebarItem.vue";
import { routeLocation, type ViewIntent } from "@/app/router/route-locations";
import { sourceKindOf } from "@/modules/sources/lib/display";

const props = defineProps<{
  item: SearchResultItem;
  track?: Track;
  /** Route override for entities living outside the local library (YT). */
  to?: RouteLocationRaw;
}>();
const emit = defineEmits<{ click: [] }>();

// A source's search answers with its catalog rows: no Dexie row behind them,
// and their links ask for the source's view of the entity.
const isCatalog = computed(() => sourceKindOf(props.item.entityId) !== "local");
const intent = computed<ViewIntent | undefined>(() => (isCatalog.value ? { catalog: true } : undefined));

const routeForItem = (item: SearchResultItem): RouteLocationRaw => {
  switch (item.type) {
    case "artist": return routeLocation.artist(item.entityId, intent.value);
    case "album": return routeLocation.album(item.entityId, intent.value);
    case "playlist": return routeLocation.playlist(item.entityId, intent.value);
    default: return routeLocation.home();
  }
};

const libraryItem = computed<LibraryItem>(() => ({
  id: props.item.entityId,
  type: props.item.type as "artist" | "album" | "playlist",
  title: props.item.title,
  subtitle: props.item.artist,
  image: props.item.coverPath,
  isPinned: false,
  isCatalog: isCatalog.value,
  addedAt: 0,
  rounded: props.item.type === "artist",
  to: props.to ?? routeForItem(props.item),
}));
</script>

<template>
  <TrackRow
    v-if="item.type === 'track' && track"
    :track="track"
    :cover-url="item.coverPath"
    hide-index
    menu-target="search"
    @play="emit('click')"
  />

  <LibrarySidebarItem
    v-else-if="item.type !== 'track'"
    :item="libraryItem"
  />
</template>
