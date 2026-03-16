import Dexie, { type Table } from "dexie";
import { AlbumEntity, ArtistEntity, PlaylistEntity, TagEntity, TrackEntity } from "./entities";
import { AlbumId, ArtistId, PlaylistId, TagId, TrackId } from "@/types/ids";

export class AppDatabase extends Dexie {
  tracks!: Table<TrackEntity, TrackId>;
  artists!: Table<ArtistEntity, ArtistId>;
  albums!: Table<AlbumEntity, AlbumId>;
  tags!: Table<TagEntity, TagId>;
  playlists!: Table<PlaylistEntity, PlaylistId>;

  constructor() {
    super("AudiogramDB");

    this.version(2).stores({
      tracks: "&id, title, artistId, albumId, *tagIds, state, addedAt, [artistId+albumId+trackNo]",
      artists: "&id, name",
      albums: "&id, title, artistId, year, [artistId+year], [title+artistId]",
      tags: "&id, &name",
    });

    this.version(3).stores({
      tracks: "&id, title, artistId, albumId, *tagIds, state, addedAt, [artistId+albumId+trackNo]",
      artists: "&id, name, updatedAt",
      albums: "&id, title, artistId, year, updatedAt, [artistId+year], [title+artistId]",
      tags: "&id, &name",
      playlists: "&id, name, updatedAt, addedAt",
    }).upgrade(async (tx) => {
      const now = Date.now();
      await tx.table("artists").toCollection().modify((artist) => {
        if (!artist.updatedAt) artist.updatedAt = artist.addedAt ?? now;
      });
      await tx.table("albums").toCollection().modify((album) => {
        if (!album.updatedAt) album.updatedAt = album.addedAt ?? now;
      });
    });

    this.version(4).stores({
      tracks: "&id, title, artistId, albumId, *tagIds, state, addedAt, storagePath, [artistId+albumId+trackNo]",
      artists: "&id, name, updatedAt",
      albums: "&id, title, artistId, year, updatedAt, [artistId+year], [title+artistId]",
      tags: "&id, &name",
      playlists: "&id, name, updatedAt, addedAt",
    });

    this.version(5).stores({
      tracks: "&id, title, artistId, albumId, *tagIds, state, addedAt, storagePath, fingerprint, [artistId+albumId+trackNo]",
      artists: "&id, name, updatedAt",
      albums: "&id, title, artistId, year, updatedAt, [artistId+year], [title+artistId]",
      tags: "&id, &name",
      playlists: "&id, name, updatedAt, addedAt",
    });

    this.tracks = this.table("tracks");
    this.artists = this.table("artists");
    this.albums = this.table("albums");
    this.tags = this.table("tags");
    this.playlists = this.table("playlists");
  }
}

export const db = new AppDatabase();
