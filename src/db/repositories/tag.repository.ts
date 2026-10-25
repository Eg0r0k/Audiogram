import { db } from "@/db";
import type { TagEntity } from "@/db/entities";
import { tableOf, type TableMap, type TableSource } from "@/db/tables";
import type { TrackId } from "@/types/ids";
import { TagId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";

export class TagRepository extends BaseRepository<TagEntity, TagId> {
  private readonly tracks: TableMap["tracks"];

  constructor(source: TableSource = db) {
    super(tableOf(source, "tags"));
    this.tracks = tableOf(source, "tracks");
  }

  async findByTrackId(trackId: TrackId): Promise<TagEntity[]> {
    return guarded(async () => {
      const track = await this.tracks.get(trackId);
      if (!track || track.tagIds.length === 0) {
        return [];
      }
      const tags = await this.table.bulkGet(track.tagIds);
      return tags.filter((tag): tag is TagEntity => tag !== undefined);
    });
  }

  async findOrCreate(name: string): Promise<TagEntity> {
    const normalizedName = name.trim().toLowerCase();
    // Lookup and insert in one transaction: `name` is a unique index, so
    // two concurrent calls for a new name would otherwise race into a
    // ConstraintError on the second add().
    return guarded(() => db.transaction("rw", "tags", async () => {
      const existing = await this.table.where("name").equals(normalizedName).first();
      if (existing) return existing;
      const created: TagEntity = { id: TagId(crypto.randomUUID()), name: normalizedName };
      await this.table.add(created);
      return created;
    }));
  }
}

export const tagRepository = new TagRepository();
