import Dexie, { type Table } from "dexie";
import { AlbumEntity, ArtistEntity, TagEntity, TrackEntity } from "./entities";
import { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";

export class AppDatabase extends Dexie {
  tracks!: Table<TrackEntity, TrackId>;
  artists!: Table<ArtistEntity, ArtistId>;
  albums!: Table<AlbumEntity, AlbumId>;
  tags!: Table<TagEntity, TagId>;

  constructor() {
    super("AudiogramDB");
    this.version(2).stores({
      tracks: "&id, title, artistId, albumId, *tagIds, state, addedAt, [artistId+albumId+trackNo]",
      artists: "&id, name",
      albums: "&id, title, artistId, year, [artistId+year], [title+artistId]",
      tags: "&id, &name",
    });
    this.tracks = this.table("tracks");
    this.artists = this.table("artists");
    this.albums = this.table("albums");
    this.tags = this.table("tags");
  }
}

export const db = new AppDatabase();
