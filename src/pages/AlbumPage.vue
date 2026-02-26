<template>
  <Scrollable class="flex-1">
    <MediaHero :data="artistData" />

    <TrackContextMenu context="album">
      <div class=" px-4">
        <TrackRow
          v-for="(track, index) in mockTracks"
          :key="track.id"
          :compact="isCompact"
          :track="track"
          :index="index + 1"
        />
      </div>
    </TrackContextMenu>
    <TrackDropdown context="album" />
  </Scrollable>
</template>

<script setup lang="ts">
import MediaHeader from "@/components/media-hero/MediaHeader.vue";
import MediaHero from "@/components/media-hero/MediaHero.vue";
import { AlbumData } from "@/components/media-hero/types";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { useLibraryView } from "@/composables/useLibraryView";
import { Track } from "@/modules/player/types";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";
import TrackDropdown from "@/modules/tracks/components/menu/dropdown/TrackDropdown.vue";
import TrackRow from "@/modules/tracks/components/TrackRow.vue";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";

const handlePlay = () => {
  console.log("Play album");
};

const artistData: AlbumData = {
  type: "album",
  id: AlbumId("album-1"),
  artistName: "Emenem",
  artistId: ArtistId("artist-1"),
  image: "/favorite.jpg",

  title: "The Weeknd",
  trackCount: 50,
  releaseYear: 2020,
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
