<template>
  <PlayItems
    @play="actions.play"
    @play-next="actions.playNext"
    @add-to-queue="actions.addToQueue"
  />

  <component :is="Separator" />

  <component
    :is="Item"
    :disabled="queueIndex === 0"
    @click="emit('moveUp')"
  >
    <Icon icon="tabler:arrow-up" />

    {{ $t('track.contextMenu.moveUp') }}
  </component>

  <component
    :is="Item"
    :disabled="queueIndex === queueLength - 1"
    @click="emit('moveDown')"
  >
    <Icon icon="tabler:arrow-down" />
    {{ $t('track.contextMenu.moveDown') }}
  </component>

  <component
    :is="Item"
    variant="destructive"
    @click="actions.removeFromQueue?.()"
  >
    <Icon icon="tabler:trash" />
    {{ $t('track.contextMenu.removeFromQueue') }}
  </component>

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
import { Track } from "@/types/track/track";
import LikeItem from "../items/LikeItem.vue";
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import NavigationItems from "../items/NavigationItems.vue";
import { Icon } from "@iconify/vue";
import { PlaylistId as createPlaylistId } from "@/types/ids";
import { PlaylistId } from "@/types/ids";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { ContextActions } from "../type";

const { Separator, Item } = useTrackMenuComponents();

defineProps<{
  track: Track;
  actions: ContextActions;
  queueIndex: number;
  queueLength: number;
}>();

const emit = defineEmits<{
  moveUp: [];
  moveDown: [];
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
