import { db } from "@/db";
import type { CoverEntity, CoverOwnerType } from "@/db/entities";
import type { AlbumId, ArtistId, PlaylistId } from "@/types/ids";
import { ok, type Result } from "neverthrow";
import { attemptDb } from "@/db/errors/db.errors";

class CoverRepository {
  async findByOwner(
    ownerType: CoverOwnerType,
    ownerId: string,
  ): Promise<Result<CoverEntity | undefined, Error>> {
    return attemptDb(() => db.covers
      .where("[ownerType+ownerId]")
      .equals([ownerType, ownerId])
      .first());
  }

  async findByOwners(
    ownerType: CoverOwnerType,
    ownerIds: readonly string[],
  ): Promise<Result<CoverEntity[], Error>> {
    if (ownerIds.length === 0) return ok([]);
    return attemptDb(() => db.covers
      .where("[ownerType+ownerId]")
      .anyOf(ownerIds.map(id => [ownerType, id]))
      .toArray());
  }

  async getAlbumCover(
    albumId: AlbumId,
  ): Promise<Result<CoverEntity | undefined, Error>> {
    return this.findByOwner("album", albumId);
  }

  async getPlaylistCover(
    playlistId: PlaylistId,
  ): Promise<Result<CoverEntity | undefined, Error>> {
    return this.findByOwner("playlist", playlistId);
  }

  async getArtistCover(
    artistId: ArtistId,
  ): Promise<Result<CoverEntity | undefined, Error>> {
    return this.findByOwner("artist", artistId);
  }

  async upsertOwnerCover(
    ownerType: CoverOwnerType,
    ownerId: string,
    blob: Blob,
  ): Promise<Result<CoverEntity, Error>> {
    // find + write inside one transaction: two concurrent upserts for the
    // same owner would otherwise both miss and the second add() would hit
    // the unique [ownerType+ownerId] key.
    return attemptDb(() => db.transaction("rw", db.covers, async (): Promise<CoverEntity> => {
      const now = Date.now();
      const mimeType = blob.type || "image/jpeg";
      const existing = await db.covers
        .where("[ownerType+ownerId]")
        .equals([ownerType, ownerId])
        .first();

      if (existing) {
        await db.covers.update(existing.id, { blob, mimeType, updatedAt: now });
        return { ...existing, blob, mimeType, updatedAt: now };
      }

      const fresh: CoverEntity = {
        id: crypto.randomUUID(),
        ownerType,
        ownerId,
        blob,
        mimeType,
        addedAt: now,
        updatedAt: now,
      };
      await db.covers.add(fresh);
      return fresh;
    }));
  }

  async upsertAlbumCover(
    albumId: AlbumId,
    blob: Blob,
  ): Promise<Result<CoverEntity, Error>> {
    return this.upsertOwnerCover("album", albumId, blob);
  }

  async upsertPlaylistCover(
    playlistId: PlaylistId,
    blob: Blob,
  ): Promise<Result<CoverEntity, Error>> {
    return this.upsertOwnerCover("playlist", playlistId, blob);
  }

  async upsertArtistCover(
    artistId: ArtistId,
    blob: Blob,
  ): Promise<Result<CoverEntity, Error>> {
    return this.upsertOwnerCover("artist", artistId, blob);
  }

  async createMany(covers: CoverEntity[]): Promise<Result<void, Error>> {
    return attemptDb(async () => {
      await db.covers.bulkAdd(covers);
    });
  }

  async upsertMany(covers: CoverEntity[]): Promise<Result<void, Error>> {
    return attemptDb(async () => {
      await db.covers.bulkPut(covers);
    });
  }

  async deleteByOwner(
    ownerType: CoverOwnerType,
    ownerId: string,
  ): Promise<Result<void, Error>> {
    return attemptDb(async () => {
      const existing = await db.covers
        .where("[ownerType+ownerId]")
        .equals([ownerType, ownerId])
        .first();

      if (existing) {
        await db.covers.delete(existing.id);
      }
    });
  }

  async deleteAlbumCover(albumId: AlbumId): Promise<Result<void, Error>> {
    return this.deleteByOwner("album", albumId);
  }

  async deletePlaylistCover(playlistId: PlaylistId): Promise<Result<void, Error>> {
    return this.deleteByOwner("playlist", playlistId);
  }

  async deleteArtistCover(artistId: ArtistId): Promise<Result<void, Error>> {
    return this.deleteByOwner("artist", artistId);
  }
}

export const coverRepository = new CoverRepository();
