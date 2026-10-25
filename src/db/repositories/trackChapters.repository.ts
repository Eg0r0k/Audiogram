import { db } from "@/db";
import type { TrackChapterEntity, TrackChapterMark } from "@/db/entities";
import { DbError } from "@/db/errors/db.errors";
import { tableOf, type TableSource } from "@/db/tables";
import type { TrackId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";

export class TrackChaptersRepository extends BaseRepository<TrackChapterEntity, TrackId> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "trackChapters"));
  }

  async setForTrack(trackId: TrackId, chapters: TrackChapterMark[]): Promise<void> {
    return guarded(async () => {
      if (!trackId) {
        throw new DbError("UNKNOWN", "chapters require a library track id");
      }
      if (chapters.length === 0) {
        await this.table.delete(trackId);
        return;
      }
      const clean: TrackChapterMark[] = chapters.map(c => ({
        time: c.time,
        ...(c.title !== undefined ? { title: c.title } : {}),
      }));
      await this.table.put({ trackId, chapters: clean, updatedAt: Date.now() });
    });
  }
}

export const trackChaptersRepository = new TrackChaptersRepository();
