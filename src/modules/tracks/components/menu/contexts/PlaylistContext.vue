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

  <DownloadItem @download="actions.download" />

  <LyricsItem
    :has-lyrics="!!track.lyricsPath"
    @attach="actions.attachLyrics"
  />

  <AddToPlaylistSub
    :playlists="playlists"
    :is-loading="isLoading"
    @add="actions.addToPlaylist"
    @create="handleCreatePlaylist"
  />

  <component :is="Separator" />

  <NavigationItems
    :artist-ids="track.artistIds"
    :album-name="track.albumName"
    @go-to-artist="actions.goToArtist"
    @go-to-album="actions.goToAlbum"
  />

  <template v-if="isOwner">
    <component :is="Separator" />
    <component
      :is="Item"
      variant="destructive"
      @click="actions.removeFromPlaylist"
    >
      <IconTrash class="size-5.5" />
      {{ $t('track.contextMenu.removeFromPlaylist') }}
    </component>
  </template>
</template>

<script setup lang="ts">
import PlayItems from "../items/PlayItems.vue";
import LikeItem from "../items/LikeItem.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import NavigationItems from "../items/NavigationItems.vue";
import LyricsItem from "../items/LyricsItem.vue";
import DownloadItem from "../items/DownloadItem.vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { usePlaylistMenu } from "../composables/usePlaylistMenu";
import type { ContextActions } from "../type";
import type { Track } from "@/modules/player/types";
import type { PlaylistId } from "@/types/ids";
import IconTrash from "~icons/tabler/trash";

defineProps<{
  track: Track;
  actions: ContextActions;
  playlistId?: PlaylistId;
  isOwner?: boolean;
}>();

const { Separator, Item } = useTrackMenuComponents();
const { playlists, isLoading, handleCreatePlaylist } = usePlaylistMenu();
</script>
