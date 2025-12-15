import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import type { Track } from "@/types/track/track";

const generateTracks = (count: number, startIndex = 0): Track[] => {
  const artists = ["The Weeknd", "Daft Punk", "Arctic Monkeys", "Tame Impala", "Radiohead"];
  const albums = ["After Hours", "Random Access Memories", "AM", "Currents", "OK Computer"];
  const covers = [
    "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
    "https://i.scdn.co/image/ab67616d0000b273a048415db06a5b6fa7ec4e1a",
    "https://i.scdn.co/image/ab67616d0000b2734ae1c4c5c45aabe565499163",
    "https://i.scdn.co/image/ab67616d0000b2739e1cfc756886ac782e363d79",
    "https://i.scdn.co/image/ab67616d0000b273c8b444df094279e70d0ed856",
  ];

  return Array.from({ length: count }, (_, i) => {
    const index = startIndex + i;
    const artistIndex = index % artists.length;

    return {
      id: TrackId(`track-${index}`),
      title: `Track ${index + 1} - ${["Blinding Lights", "Starboy", "Save Your Tears", "Die For You", "After Hours"][index % 5]}`,
      artist: artists[artistIndex],
      artistId: ArtistId(`artist-${artistIndex}`),
      albumId: AlbumId(`album-${index % 10}`),
      albumName: albums[artistIndex],
      cover: covers[artistIndex],
      duration: 180 + Math.floor(Math.random() * 120),
      isLiked: Math.random() > 0.7,
    };
  });
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const tracksApi = {
  async getPage(page: number, limit = 50): Promise<{
    tracks: Track[];
    total: number;
    hasMore: boolean;
  }> {
    await delay(500 + Math.random() * 500);

    const total = 10000;
    const startIndex = page * limit;
    const tracks = generateTracks(Math.min(limit, total - startIndex), startIndex);

    return {
      tracks,
      total,
      hasMore: startIndex + limit < total,
    };
  },

  async getCursor(cursor: string | null, limit = 50): Promise<{
    tracks: Track[];
    nextCursor: string | null;
  }> {
    await delay(500 + Math.random() * 500);

    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const total = 5000;
    const tracks = generateTracks(Math.min(limit, total - startIndex), startIndex);
    const nextIndex = startIndex + limit;

    return {
      tracks,
      nextCursor: nextIndex < total ? String(nextIndex) : null,
    };
  },

  async getAll(limit = 100): Promise<Track[]> {
    await delay(300);
    return generateTracks(limit);
  },
};
