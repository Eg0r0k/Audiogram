import { db } from "@/db";
import type { CoverEntity, CoverOwnerType } from "@/db/entities";
import { tableOf, type TableMap, type TableSource } from "@/db/tables";
import type { AlbumId, ArtistId, PlaylistId } from "@/types/ids";
import { guarded } from "./base.repository";

export class CoverRepository {
  private readonly covers: TableMap["covers"];

  constructor(source: TableSource = db) {
    this.covers = tableOf(source, "covers");
  }

  async findByOwner(
    ownerType: CoverOwnerType,
    ownerId: string,
  ): Promise<CoverEntity | undefined> {
    return guarded(() => this.covers
      .where("[ownerType+ownerId]")
      .equals([ownerType, ownerId])
      .first());
  }

  async findByOwners(
    ownerType: CoverOwnerType,
    ownerIds: readonly string[],
  ): Promise<CoverEntity[]> {
    if (ownerIds.length === 0) return [];
    return guarded(() => this.covers
      .where("[ownerType+ownerId]")
      .anyOf(ownerIds.map(id => [ownerType, id]))
      .toArray());
  }

  async getAlbumCover(
    albumId: AlbumId,
  ): Promise<CoverEntity | undefined> {
    return this.findByOwner("album", albumId);
  }

  async getPlaylistCover(
    playlistId: PlaylistId,
  ): Promise<CoverEntity | undefined> {
    return this.findByOwner("playlist", playlistId);
  }

  async getArtistCover(
    artistId: ArtistId,
  ): Promise<CoverEntity | undefined> {
    return this.findByOwner("artist", artistId);
  }

  async upsertOwnerCover(
    ownerType: CoverOwnerType,
    ownerId: string,
    blob: Blob,
  ): Promise<CoverEntity> {
    // find + write inside one transaction: two concurrent upserts for the
    // same owner would otherwise both miss and the second add() would hit
    // the unique [ownerType+ownerId] key.
    return guarded(() => db.transaction("rw", "covers", async (): Promise<CoverEntity> => {
      const now = Date.now();
      const mimeType = blob.type || "image/jpeg";
      const existing = await this.covers
        .where("[ownerType+ownerId]")
        .equals([ownerType, ownerId])
        .first();

      if (existing) {
        await this.covers.update(existing.id, { blob, mimeType, updatedAt: now });
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
      await this.covers.add(fresh);
      return fresh;
    }));
  }

  async upsertAlbumCover(
    albumId: AlbumId,
    blob: Blob,
  ): Promise<CoverEntity> {
    return this.upsertOwnerCover("album", albumId, blob);
  }

  async upsertPlaylistCover(
    playlistId: PlaylistId,
    blob: Blob,
  ): Promise<CoverEntity> {
    return this.upsertOwnerCover("playlist", playlistId, blob);
  }

  async upsertArtistCover(
    artistId: ArtistId,
    blob: Blob,
  ): Promise<CoverEntity> {
    return this.upsertOwnerCover("artist", artistId, blob);
  }

  async createMany(covers: CoverEntity[]): Promise<void> {
    return guarded(async () => {
      await this.covers.bulkAdd(covers);
    });
  }

  async upsertMany(covers: CoverEntity[]): Promise<void> {
    return guarded(async () => {
      await this.covers.bulkPut(covers);
    });
  }

  async deleteByOwner(
    ownerType: CoverOwnerType,
    ownerId: string,
  ): Promise<void> {
    return guarded(async () => {
      const existing = await this.covers
        .where("[ownerType+ownerId]")
        .equals([ownerType, ownerId])
        .first();

      if (existing) {
        await this.covers.delete(existing.id);
      }
    });
  }

  async deleteAlbumCover(albumId: AlbumId): Promise<void> {
    return this.deleteByOwner("album", albumId);
  }

  async deletePlaylistCover(playlistId: PlaylistId): Promise<void> {
    return this.deleteByOwner("playlist", playlistId);
  }

  async deleteArtistCover(artistId: ArtistId): Promise<void> {
    return this.deleteByOwner("artist", artistId);
  }
}

export const coverRepository = new CoverRepository();
