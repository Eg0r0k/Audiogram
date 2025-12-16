<template>
  <PlayItems
    @play="actions.play"
    @play-next="actions.playNext"
    @add-to-queue="actions.addToQueue"
  />

  <ContextMenuSeparator />

  <LikeItem
    :is-liked="track.isLiked"
    @toggle="actions.toggleLike"
  />

  <AddToPlaylistSub
    :playlists="playlists"
    @add="actions.addToPlaylist"
    @create="handleCreatePlaylist"
  />

  <ContextMenuSeparator />

  <NavigationItems
    :artist-name="track.artist"
    :album-name="track.albumName"
    @go-to-artist="actions.goToArtist"
    @go-to-album="actions.goToAlbum"
  />

  <template v-if="isOwner">
    <ContextMenuSeparator />
    <ContextMenuItem
      variant="destructive"
      @click="actions.removeFromPlaylist"
    >
      <Icon icon="tabler:trash" />
      {{ $t('track.contextMenu.removeFromPlaylist') }}
    </ContextMenuItem>
  </template>
</template>

<script setup lang="ts">
import { ContextMenuSeparator } from "@/components/ui/context-menu";
import PlayItems from "../items/PlayItems.vue";
import { Track } from "@/types/track/track";
import { ContextActions } from "../types";
import LikeItem from "../items/LikeItem.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import NavigationItems from "../items/NavigationItems.vue";
import ContextMenuItem from "@/components/ui/context-menu/ContextMenuItem.vue";
import { Icon } from "@iconify/vue";
import type { PlaylistId } from "@/types/ids";
import { PlaylistId as createPlaylistId } from "@/types/ids";

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
