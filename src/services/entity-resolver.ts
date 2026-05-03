import { db } from "@/db";
import { AlbumId, ArtistId } from "@/types/ids";
import { BaseMetadata } from "@/workers/types";

type AlbumCacheKey = `${ArtistId}::${string}`;

function albumKey(artistId: ArtistId, albumTitle: string): AlbumCacheKey {
  return `${artistId}::${albumTitle}`;
}

interface AlbumEntry {
  id: AlbumId;
  isNew: boolean;
}

export class EntityResolver {
  private readonly artists = new Map<string, ArtistId>();
  private readonly albums = new Map<AlbumCacheKey, AlbumEntry>();

  async resolve(metas: BaseMetadata[]): Promise<void> {
    await this.resolveArtists(metas);
    await this.resolveAlbums(metas);
  }

  getArtistId(name: string): ArtistId | undefined {
    return this.artists.get(name);
  }

  getAlbumEntry(artistId: ArtistId, albumTitle: string): AlbumEntry | undefined {
    return this.albums.get(albumKey(artistId, albumTitle));
  }

  getArtistIds(meta: BaseMetadata): ArtistId[] {
    return meta.artists
      .filter(a => a?.trim())
      .map(name => this.artists.get(name))
      .filter((id): id is ArtistId => !!id);
  }

  private async resolveArtists(metas: BaseMetadata[]): Promise<void> {
    const uniqueNames = [
      ...new Set(
        metas.flatMap(m => m.artists).filter(a => a?.trim()),
      ),
    ];

    if (uniqueNames.length === 0) return;

    const existing = await db.artists
      .where("name")
      .anyOf(uniqueNames)
      .toArray();
    for (const artist of existing) {
      this.artists.set(artist.name, artist.id);
    }

    for (const name of uniqueNames) {
      if (!this.artists.has(name)) {
        this.artists.set(name, ArtistId(crypto.randomUUID()));
      }
    }
  }

  private async resolveAlbums(metas: BaseMetadata[]): Promise<void> {
    const knownArtistIds = [
      ...new Set(
        metas.flatMap(m => m.artists)
          .map(name => this.artists.get(name))
          .filter((id): id is ArtistId => !!id),
      ),
    ];

    if (knownArtistIds.length === 0) return;

    const existing = await db.albums
      .where("artistId")
      .anyOf(knownArtistIds)
      .toArray();

    for (const album of existing) {
      this.albums.set(
        albumKey(album.artistId, album.title),
        { id: album.id, isNew: false },
      );
    }

    for (const meta of metas) {
      const title = meta.album?.trim();
      if (!title || title === "Unknown Album") continue;

      const firstArtistId = this.artists.get(meta.artists[0]);
      if (!firstArtistId) continue;

      const key = albumKey(firstArtistId, title);
      if (!this.albums.has(key)) {
        this.albums.set(key, { id: AlbumId(crypto.randomUUID()), isNew: true });
      }
    }
  }
}
