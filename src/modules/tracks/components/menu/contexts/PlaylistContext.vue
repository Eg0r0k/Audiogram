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

  <AddToPlaylistSub
    :playlists="playlists"
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

  <template v-if="isOwner">
    <component :is="Separator" />
    <component
      :is="Item"
      variant="destructive"
      @click="actions.removeFromPlaylist"
    >
      <IconTrash />
      {{ $t('track.contextMenu.removeFromPlaylist') }}
    </component>
  </template>
</template>

<script setup lang="ts">
import PlayItems from "../items/PlayItems.vue";
import LikeItem from "../items/LikeItem.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import NavigationItems from "../items/NavigationItems.vue";
import type { PlaylistId } from "@/types/ids";
import { PlaylistId as createPlaylistId } from "@/types/ids";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { ContextActions } from "../type";
import IconTrash from "~icons/tabler/trash";
import { Track } from "@/modules/player/types";
const { Separator, Item } = useTrackMenuComponents();

defineProps<{
  track: Track;
  actions: ContextActions;
  playlistId?: PlaylistId;
  isOwner?: boolean;
}>();

const playlists: { id: PlaylistId; name: string }[] = [
  { id: createPlaylistId("1"), name: "Избранное" },
  { id: createPlaylistId("2"), name: "Для тренировок" },
  { id: createPlaylistId("3"), name: "Вечерний плейлист" },
];

const handleCreatePlaylist = () => {
  console.log("Create playlist");
};
</script>
