<template>
  <PlayItems
    @play="actions.play"
    @play-next="actions.playNext"
    @add-to-queue="actions.addToQueue"
  />

  <component :is="Separator" />

  <component
    :is="Item"
    variant="destructive"
    @click="actions.removeFromQueue?.()"
  >
    <IconTrash class="size-5.5" />
    {{ $t('track.contextMenu.removeFromQueue') }}
  </component>

  <component :is="Separator" />

  <LikeItem
    :is-liked="track.isLiked"
    @toggle="actions.toggleLike"
  />

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
    :artist-name="track.artist"
    :album-name="track.albumName"
    @go-to-artist="actions.goToArtist"
    @go-to-album="actions.goToAlbum"
  />
</template>

<script setup lang="ts">
import PlayItems from "../items/PlayItems.vue";
import LikeItem from "../items/LikeItem.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import NavigationItems from "../items/NavigationItems.vue";
import LyricsItem from "../items/LyricsItem.vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { usePlaylistMenu } from "../composables/usePlaylistMenu";
import type { ContextActions } from "../type";
import type { Track } from "@/modules/player/types";
import IconTrash from "~icons/tabler/trash";

defineProps<{
  track: Track;
  actions: ContextActions;
  queueIndex: number;
  queueLength: number;
}>();

const { Separator, Item } = useTrackMenuComponents();
const { playlists, isLoading, handleCreatePlaylist } = usePlaylistMenu();
</script>
