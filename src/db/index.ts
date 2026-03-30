import Dexie, { type Table } from "dexie";
import {
  AlbumEntity,
  ArtistEntity,
  CoverEntity,
  ListenEventEntity,
  PlaylistEntity,
  TagEntity,
  TrackEntity,
} from "./entities";
import { AlbumId, ArtistId, PlaylistId, TagId, TrackId } from "@/types/ids";

export class AppDatabase extends Dexie {
  tracks!: Table<TrackEntity, TrackId>;
  artists!: Table<ArtistEntity, ArtistId>;
  albums!: Table<AlbumEntity, AlbumId>;
  tags!: Table<TagEntity, TagId>;
  playlists!: Table<PlaylistEntity, PlaylistId>;
  listenEvents!: Table<ListenEventEntity, string>;
  covers!: Table<CoverEntity, string>;

  constructor() {
    super("AudiogramDB");

    this.version(1).stores({
      tracks: "&id, title, artistId, albumId, *tagIds, state, likedAt, addedAt, duration, storagePath, fingerprint, [artistId+albumId+trackNo]",
      artists: "&id, name, updatedAt",
      albums: "&id, title, artistId, year, updatedAt, [artistId+year], [title+artistId]",
      tags: "&id, &name",
      playlists: "&id, name, updatedAt, addedAt",
      listenEvents: "&id, trackId, artistId, albumId, startedAt",
      covers: "&id, ownerType, ownerId, [ownerType+ownerId], updatedAt",
    });

    this.tracks = this.table("tracks");
    this.artists = this.table("artists");
    this.albums = this.table("albums");
    this.tags = this.table("tags");
    this.playlists = this.table("playlists");
    this.listenEvents = this.table("listenEvents");
    this.covers = this.table("covers");
  }
}

export const db = new AppDatabase();
