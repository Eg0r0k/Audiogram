<template>
  <template v-if="hasItems">
    <component :is="Separator" />

    <NavigationItems
      :artist-ids="artistIds"
      :album-id="albumId"
      @go-to-artist="emit('goToArtist', $event)"
      @go-to-album="emit('goToAlbum')"
    />
    <DetailsItem
      :caps="caps"
      @show="emit('showDetails')"
    />
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AlbumId, ArtistId } from "@/types/ids";
import { canShowDetails, type TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import DetailsItem from "./DetailsItem.vue";
import NavigationItems from "./NavigationItems.vue";

defineOptions({
  inheritAttrs: false,
});

// The separator belongs to the section: a catalog video has no artist, no
// album and no row to detail, and a separator over nothing reads as a gap.
const props = withDefaults(defineProps<{
  artistIds?: ArtistId[];
  albumId?: AlbumId;
  caps?: TrackMenuCaps | null;
}>(), {
  artistIds: () => [],
  albumId: undefined,
  caps: undefined,
});

const emit = defineEmits<{
  goToArtist: [artistId: ArtistId];
  goToAlbum: [];
  showDetails: [];
}>();

const { Separator } = useTrackMenuComponents();

const hasItems = computed(() => props.artistIds.length > 0 || !!props.albumId || canShowDetails(props.caps));
</script>
