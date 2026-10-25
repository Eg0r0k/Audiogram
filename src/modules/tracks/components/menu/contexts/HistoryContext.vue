<template>
  <PlayItems
    @play="actions.play"
    @play-next="actions.playNext"
    @add-to-queue="actions.addToQueue"
  />

  <component :is="Separator" />

  <LikeItem
    :is-liked="track.isLiked"
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
    :has-lyrics="trackHasLyrics(track)"
    @export="actions.exportFile"
    @attach-lyrics="actions.attachLyrics"
    @add-to-library="actions.addToLibrary"
    @remove-from-library="actions.removeFromLibrary"
    @open-external="actions.openExternal"
  />

  <TrackInfoSection
    :artist-ids="track.artistIds"
    :album-id="track.albumId"
    :caps="caps"
    @go-to-artist="actions.goToArtist"
    @go-to-album="actions.goToAlbum"
    @show-details="actions.showDetails"
  />

  <component :is="Separator" />

  <component
    :is="Item"
    color="destructive"
    @click="actions.removeFromHistory?.()"
  >
    <IconTrash class="size-5.5" />
    {{ $t('track.contextMenu.removeFromHistory') }}
  </component>
</template>

<script setup lang="ts">
import PlayItems from "../items/PlayItems.vue";
import LikeItem from "../items/LikeItem.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import MoreSub from "../items/MoreSub.vue";
import OfflineItem from "../items/OfflineItem.vue";
import TrackInfoSection from "../items/TrackInfoSection.vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { trackHasLyrics } from "@/modules/tracks/lib/trackPredicates";
import type { ContextActions } from "../type";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import type { Track } from "@/types/track";
import IconTrash from "~icons/tabler/trash";

defineProps<{
  track: Track;
  actions: ContextActions;
  caps?: TrackMenuCaps | null;
}>();

const { Separator, Item } = useTrackMenuComponents();
</script>
