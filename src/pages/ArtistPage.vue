<template>
  <Scrollable class="flex-1">
    <MediaHero :data="artistData" />

    <MediaHeroActions
      :type="artistData.type"
    />
    <!-- <div class="relative ">
      <div
        class="lists "
        :style="{ backgroundColor: color.hsl }"
      />
      <div class="flex p-6 gap-4 items-center justify-between ">
        <div class="flex gap-4 items-center">
          <PlayButton class=" size-14 " />
          <MediaDropdown />
        </div>

        <MediaDisplayDropdown />
      </div>
    </div> -->
    <TrackContextMenu context="album">
      <div class=" px-6">
        <TrackRow
          v-for="(track, index) in mockTracks"
          :key="track.id"
          :compact="isCompact"
          :track="track"
          :index="index + 1"
        />
      </div>
    </TrackContextMenu>
  </Scrollable>
</template>

<script setup lang="ts">
import MediaHero from "@/components/media-hero/MediaHero.vue";
import MediaHeroActions from "@/components/media-hero/MediaHeroActions.vue";
import { type ArtistData } from "@/components/media-hero/types";
import TrackContextMenu from "@/components/track/menu/context-menu/TrackContextMenu.vue";
import TrackRow from "@/components/track/TrackRow.vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { useLibraryView } from "@/composables/useLibraryView";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { Track } from "@/types/track/track";

const artistData: ArtistData = {
  type: "artist",
  image: "/",
  title: "ABOBUS",
  id: ArtistId("artist-1"),
  monthlyListeners: 10_000_000,
  isFollowing: false,
};

const { isCompact } = useLibraryView();

const mockTracks: Track[] = [
  {
    id: TrackId("track-1"),
    title: "Blinding Lights",
    artist: "The Weeknd",
    artistId: ArtistId("artist-1"),
    albumId: AlbumId("album-1"),
    albumName: "After Hours",
    cover: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
    duration: 203,
    isLiked: true,

  },
  {
    id: TrackId("track-2"),
    title: "Starboy",
    artist: "The Weeknd",
    artistId: ArtistId("artist-1"),
    albumId: AlbumId("album-2"),
    albumName: "Starboy",
    cover: "https://i.scdn.co/image/ab67616d0000b273a048415db06a5b6fa7ec4e1a",
    duration: 230,
    isLiked: false,
  },
];

</script>
