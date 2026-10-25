import { db } from "@/db";
import type { DownloadJobEntity, DownloadJobStatus } from "@/db/entities";
import { tableOf, type TableSource } from "@/db/tables";
import type { TrackId } from "@/types/ids";
import { BaseRepository, guarded } from "./base.repository";

export class DownloadJobRepository extends BaseRepository<DownloadJobEntity, string> {
  constructor(source: TableSource = db) {
    super(tableOf(source, "downloadJobs"));
  }

  async findByStatus(status: DownloadJobStatus): Promise<DownloadJobEntity[]> {
    return guarded(() => this.table.where("status").equals(status).sortBy("addedAt"));
  }

  /** Queued or running job for a track — the enqueue dedupe check. */
  async findActiveByTrackId(trackId: TrackId): Promise<DownloadJobEntity | undefined> {
    return guarded(() => this.table
      .where("[trackId+status]")
      .anyOf([[trackId, "queued"], [trackId, "running"]])
      .first());
  }

  /** Drops terminal-error rows for a track — a fresh enqueue supersedes them. */
  async deleteErrorsByTrackId(trackId: TrackId): Promise<number> {
    return guarded(() => this.table
      .where("[trackId+status]")
      .equals([trackId, "error"])
      .delete());
  }

  /**
   * Atomically claims a queued job for running. False means another worker
   * (or a stale pump) got there first — the caller must skip the job.
   */
  async claim(id: string): Promise<boolean> {
    return guarded(async () => {
      const modified = await this.table
        .where("id")
        .equals(id)
        .and(job => job.status === "queued")
        .modify({ status: "running" satisfies DownloadJobStatus });
      return modified === 1;
    });
  }

  /** Startup recovery: jobs left running by a dead session queue up again. */
  async requeueRunning(): Promise<number> {
    return guarded(() => this.table
      .where("status")
      .equals("running")
      .modify({ status: "queued" satisfies DownloadJobStatus }));
  }
}

export const downloadJobRepository = new DownloadJobRepository();
