<template>
  <PlayItems
    @play="actions.play"
    @play-next="actions.playNext"
    @add-to-queue="actions.addToQueue"
  />

  <component :is="Separator" />

  <component
    :is="Item"
    color="destructive"
    @click="actions.removeFromQueue?.()"
  >
    <IconTrash class="size-5.5" />
    {{ $t('track.contextMenu.removeFromQueue') }}
  </component>

  <template v-if="libTrack">
    <component :is="Separator" />

    <LikeItem
      :is-liked="libTrack.isLiked"
      @toggle="actions.toggleLike"
    />

    <AddToPlaylistSub @add="actions.addToPlaylist" />

    <OfflineItem
      :caps="caps"
      @download="actions.downloadOffline"
      @cancel-download="actions.cancelOfflineDownload"
      @remove-download="actions.removeDownload"
    />

    <MoreSub
      :caps="caps"
      :has-lyrics="trackHasLyrics(libTrack)"
      @export="actions.exportFile"
      @attach-lyrics="actions.attachLyrics"
      @add-to-library="actions.addToLibrary"
      @remove-from-library="actions.removeFromLibrary"
      @open-external="actions.openExternal"
    />

    <TrackInfoSection
      :artist-ids="libTrack.artistIds"
      :album-id="libTrack.albumId"
      :caps="caps"
      @go-to-artist="actions.goToArtist"
      @go-to-album="actions.goToAlbum"
      @show-details="actions.showDetails"
    />
  </template>

  <template v-else-if="caps && caps.source !== 'local'">
    <component :is="Separator" />

    <OfflineItem
      :caps="caps"
      @download="actions.downloadOffline"
      @cancel-download="actions.cancelOfflineDownload"
      @remove-download="actions.removeDownload"
    />
  </template>
</template>

<script setup lang="ts">
import PlayItems from "../items/PlayItems.vue";
import LikeItem from "../items/LikeItem.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import MoreSub from "../items/MoreSub.vue";
import OfflineItem from "../items/OfflineItem.vue";
import TrackInfoSection from "../items/TrackInfoSection.vue";
import { computed } from "vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { trackHasLyrics } from "@/modules/tracks/lib/trackPredicates";
import type { ContextActions } from "../type";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { isLibraryTrack, type PlayerTrack } from "@/modules/player/types";
import IconTrash from "~icons/tabler/trash";

const props = defineProps<{
  track: PlayerTrack;
  actions: ContextActions;
  queueIndex: number;
  queueLength: number;
  caps?: TrackMenuCaps | null;
}>();

// A playing stream (older queue entries) keeps only the queue items and the
// offline copy of the catalog track its URL names.
const libTrack = computed(() => (isLibraryTrack(props.track) ? props.track : null));

const { Separator, Item } = useTrackMenuComponents();
</script>
