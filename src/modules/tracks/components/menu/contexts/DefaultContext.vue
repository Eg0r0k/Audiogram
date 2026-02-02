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
</template>

<script setup lang="ts">
import PlayItems from "../items/PlayItems.vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { PlaylistId } from "@/types/ids";
import { ContextActions } from "../type";
import NavigationItems from "../items/NavigationItems.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import LikeItem from "../items/LikeItem.vue";
import type { Track } from "@/modules/player/types";

const { Separator } = useTrackMenuComponents();

defineProps<{
  track: Track;
  actions: ContextActions;
}>();

// TODO delete this later

const playlists: { id: PlaylistId; name: string }[] = [
  { id: PlaylistId("1"), name: "Избранное" },
  { id: PlaylistId("2"), name: "Для тренировок" },
  { id: PlaylistId("3"), name: "Вечерний плейлист" },
];

const handleCreatePlaylist = () => {
  console.log("Create playlist");
};
</script>
