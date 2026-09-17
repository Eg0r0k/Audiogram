import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { TrackSource } from "@/db/entities";
import type { AlbumId, TrackId } from "@/types/ids";
import { EntityResolver } from "../entity-resolver";
import { persistTracks } from "../import/track-persister";
import type { TrackToSave } from "../types";

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const itemFor = (trackId: string, artist: string): TrackToSave => ({
  trackId: trackId as TrackId,
  fileName: `${trackId}.mp3`,
  storagePath: `tracks/${trackId}.mp3`,
  fingerprint: `fp-${trackId}`,
  source: TrackSource.LOCAL_INTERNAL,
  meta: {
    title: trackId,
    artists: [artist],
    album: "",
    duration: 100,
    format: {},
  },
});

const existingTrack = (id: string) => ({
  id: id as TrackId,
  title: id,
  artistName: "Old",
  albumTitle: "",
  artistIds: [],
  albumId: "" as AlbumId,
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1 as const,
  state: 0,
  storagePath: `tracks/${id}.mp3`,
  duration: 1,
  format: {},
  playCount: 0,
  addedAt: 1,
});

describe("persistTracks", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("aborts the whole batch when a track id already exists (no partial commit)", async () => {
    await db.tracks.add(existingTrack("t1"));
    const items = [itemFor("t1", "Brand New Artist"), itemFor("t2", "Brand New Artist")];
    const resolver = new EntityResolver();
    await resolver.resolve(items.map(item => item.meta));

    await expect(persistTracks(items, resolver)).rejects.toThrow();

    // Nothing from the failed batch may survive: neither the new artist row
    // nor the second (valid) track.
    expect(await db.artists.count()).toBe(0);
    expect(await db.tracks.count()).toBe(1);
    expect((await db.tracks.get("t1" as TrackId))?.artistName).toBe("Old");
  });

  it("promotes a matched shadow artist and album to library members", async () => {
    await db.artists.add({
      id: "ym:artist:5" as never, name: "Artist A", pinned: 0, addedAt: 1, updatedAt: 1,
    });
    await db.albums.add({
      id: "ym:album:9" as never, title: "ДЕФО", artistId: "ym:artist:5" as never, pinned: 0, addedAt: 1, updatedAt: 1,
    });
    const base = itemFor("t1", "Artist A");
    const item: TrackToSave = { ...base, meta: { ...base.meta, album: "ДЕФО" } };
    const resolver = new EntityResolver();
    await resolver.resolve([item.meta]);

    await persistTracks([item], resolver);

    const saved = await db.tracks.get("t1" as TrackId);
    expect(saved?.artistIds).toEqual(["ym:artist:5"]);
    expect(saved?.albumId).toBe("ym:album:9");
    expect((await db.artists.get("ym:artist:5" as never))?.pinned).toBe(1);
    expect((await db.albums.get("ym:album:9" as never))?.pinned).toBe(1);
    expect(await db.artists.count()).toBe(1);
    expect(await db.albums.count()).toBe(1);
  });

  it("leaves unrelated shadow rows untouched", async () => {
    await db.artists.add({
      id: "ym:artist:5" as never, name: "Artist A", pinned: 0, addedAt: 1, updatedAt: 1,
    });
    await db.artists.add({
      id: "ym:artist:7" as never, name: "Someone Else", pinned: 0, addedAt: 1, updatedAt: 1,
    });
    const item = itemFor("t1", "Artist A");
    const resolver = new EntityResolver();
    await resolver.resolve([item.meta]);

    await persistTracks([item], resolver);

    expect((await db.artists.get("ym:artist:7" as never))?.pinned).toBe(0);
  });
});
