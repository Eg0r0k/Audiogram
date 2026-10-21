<template>
  <ShowLyricsItem @show="actions.showLyrics" />

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

    <PlayItems
      @play-next="actions.playNext"
      @add-to-queue="actions.addToQueue"
    />

    <OfflineItem
      :caps="caps"
      @download="actions.downloadOffline"
      @cancel-download="actions.cancelOfflineDownload"
      @remove-download="actions.removeDownload"
    />
  </template>

  <template v-else-if="importPath">
    <component :is="Separator" />

    <PlayItems
      @play-next="actions.playNext"
      @add-to-queue="actions.addToQueue"
    />

    <component
      :is="Item"
      @click="importCurrent"
    >
      <IconFileImport class="size-5.5" />
      {{ $t("common.import.toLibrary") }}
    </component>
  </template>
</template>

<script setup lang="ts">
import AddToPlaylistSub from "../items/AddToPlaylistSub.vue";
import LikeItem from "../items/LikeItem.vue";
import MoreSub from "../items/MoreSub.vue";
import PlayItems from "../items/PlayItems.vue";
import ShowLyricsItem from "../items/ShowLyricsItem.vue";
import OfflineItem from "../items/OfflineItem.vue";
import TrackInfoSection from "../items/TrackInfoSection.vue";
import { computed } from "vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { trackHasLyrics } from "@/modules/tracks/lib/trackPredicates";
import { useEphemeralImport } from "@/modules/tracks/composables/useEphemeralImport";
import type { ContextActions } from "../type";
import type { TrackMenuCaps } from "@/modules/tracks/composables/useTrackMenuCaps";
import { isLibraryTrack, type PlayerTrack } from "@/modules/player/types";
import IconFileImport from "~icons/tabler/file-import";

const props = defineProps<{
  track: PlayerTrack;
  actions: ContextActions;
  caps?: TrackMenuCaps | null;
}>();

// Three shapes of a current track: a library row (catalog rows included), a
// playing stream that names a catalog track in its URL, an "Open with" file.
const libTrack = computed(() => (isLibraryTrack(props.track) ? props.track : null));

const { importPath, importCurrent } = useEphemeralImport(() => props.track);

const { Separator, Item } = useTrackMenuComponents();
</script>
