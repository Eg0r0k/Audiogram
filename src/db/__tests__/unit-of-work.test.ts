import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { TrackSource, TrackState, type ArtistEntity, type TrackEntity } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { trackRepository } from "@/db/repositories";
import type { TableName } from "@/db/tables";
import { AppFailure } from "@/lib/errors";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { unitOfWork } from "../unit-of-work";

const track = (id: string, overrides: Partial<TrackEntity> = {}): TrackEntity => ({
  id: TrackId(id),
  title: id,
  artistName: "A",
  albumTitle: "",
  artistIds: [],
  albumId: AlbumId(""),
  tagIds: [],
  source: TrackSource.LOCAL_INTERNAL,
  pinned: 1,
  state: TrackState.READY,
  storagePath: `tracks/${id}.mp3`,
  duration: 100,
  format: {},
  playCount: 0,
  addedAt: 1,
  ...overrides,
});

const artist = (id: string, overrides: Partial<ArtistEntity> = {}): ArtistEntity => ({
  id: ArtistId(id),
  name: id,
  pinned: 1,
  addedAt: 1,
  updatedAt: 1,
  ...overrides,
});

beforeEach(async () => {
  await db.open();
  await Promise.all(db.tables.map(table => table.clear()));
});

describe("unitOfWork.run", () => {
  it("commits writes made through the bound repositories", async () => {
    await unitOfWork.run(["tracks", "artists"], async (uow) => {
      await uow.tracks.create(track("t1"));
      await uow.artists.create(artist("ar1"));
    });

    expect((await db.tracks.get(TrackId("t1")))?.title).toBe("t1");
    expect((await db.artists.get(ArtistId("ar1")))?.name).toBe("ar1");
  });

  it("rolls back every declared table when the work throws", async () => {
    await db.tracks.add(track("t1"));
    await db.artists.add(artist("ar1"));
    const tracksBefore = await db.tracks.toArray();
    const artistsBefore = await db.artists.toArray();
    const boom = new Error("boom");

    const failure = await unitOfWork.run(["tracks", "artists"], async (uow) => {
      await uow.tracks.update(TrackId("t1"), { title: "changed" });
      await uow.tracks.create(track("t2"));
      await uow.artists.create(artist("ar2"));
      throw boom;
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DbError);
    expect((failure as DbError).code).toBe("UNKNOWN");
    expect((failure as DbError).cause).toBe(boom);
    expect(await db.tracks.toArray()).toEqual(tracksBefore);
    expect(await db.artists.toArray()).toEqual(artistsBefore);
  });

  it("passes an AppFailure thrown by the work through unchanged", async () => {
    const failure = new AppFailure({ domain: "source", kind: "NOT_FOUND", message: "gone" });

    const thrown = await unitOfWork.run(["tracks"], async (uow) => {
      await uow.tracks.create(track("t1"));
      throw failure;
    }).catch((error: unknown) => error);

    expect(thrown).toBe(failure);
    expect(await db.tracks.count()).toBe(0);
  });

  it("exposes exactly the repositories whose tables are in scope", async () => {
    const keysFor = (tables: readonly TableName[]) => unitOfWork.run(tables, uow => Promise.resolve(Object.keys(uow)));

    expect(await keysFor(["tracks"])).toEqual(["tracks"]);
    expect((await keysFor(["tags", "tracks"])).sort()).toEqual(["tags", "tracks"]);
    expect((await keysFor(["listenEvents", "tracks", "tags"])).sort()).toEqual(["stats", "tags", "tracks"]);
  });

  it("joins a repository's internal transaction to the unit of work", async () => {
    let createdInside = 0;

    const failure = await unitOfWork.run(["tags", "tracks"], async (uow) => {
      await uow.tags.findOrCreate("x");
      createdInside = (await uow.tags.findAll()).length;
      throw new Error("abort after the tag");
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DbError);
    expect(createdInside).toBe(1);
    expect(await db.tags.count()).toBe(0);
  });

  it("runs a repository's read snapshot inside the unit of work", async () => {
    const ar1 = ArtistId("ar1");
    const ar2 = ArtistId("ar2");
    await db.tracks.add(track("t1", { artistIds: [ar1] }));

    const counts = await unitOfWork.run(["tracks"], async (uow) => {
      await uow.tracks.create(track("t2", { artistIds: [ar1, ar2] }));
      await uow.tracks.create(track("t3", { artistIds: [ar2], pinned: 0 }));
      return uow.tracks.countByArtistIds([ar1, ar2]);
    });

    expect(counts.get(ar1)).toBe(2);
    expect(counts.get(ar2)).toBe(1);
  });

  it("writes through the transaction, not the global connection", async () => {
    let seenInside: TrackEntity | undefined;

    await unitOfWork.run(["tracks"], async (uow) => {
      // Outside Dexie's zone only an explicit binding reaches the open transaction.
      await Dexie.ignoreTransaction(() => uow.tracks.create(track("t1")));
      seenInside = await uow.tracks.findById(TrackId("t1"));
    });

    expect(seenInside?.id).toBe("t1");
    expect((await trackRepository.findById(TrackId("t1")))?.id).toBe("t1");
  });
});
