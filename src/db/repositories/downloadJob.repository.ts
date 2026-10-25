import type { Result } from "neverthrow";
import { db } from "@/db";
import type { DownloadJobEntity, DownloadJobStatus } from "@/db/entities";
import type { TrackId } from "@/types/ids";
import { BaseRepository } from "./base.repository";
import { attemptDb } from "@/db/errors/db.errors";

class DownloadJobRepository extends BaseRepository<DownloadJobEntity, string> {
  constructor() {
    super(db.downloadJobs);
  }

  async findByStatus(status: DownloadJobStatus): Promise<Result<DownloadJobEntity[], Error>> {
    return attemptDb(() => db.downloadJobs.where("status").equals(status).sortBy("addedAt"));
  }

  /** Queued or running job for a track — the enqueue dedupe check. */
  async findActiveByTrackId(trackId: TrackId): Promise<Result<DownloadJobEntity | undefined, Error>> {
    return attemptDb(() => db.downloadJobs
      .where("[trackId+status]")
      .anyOf([[trackId, "queued"], [trackId, "running"]])
      .first());
  }

  /** Drops terminal-error rows for a track — a fresh enqueue supersedes them. */
  async deleteErrorsByTrackId(trackId: TrackId): Promise<Result<number, Error>> {
    return attemptDb(() => db.downloadJobs
      .where("[trackId+status]")
      .equals([trackId, "error"])
      .delete());
  }

  /**
   * Atomically claims a queued job for running. False means another worker
   * (or a stale pump) got there first — the caller must skip the job.
   */
  async claim(id: string): Promise<Result<boolean, Error>> {
    return attemptDb(async () => {
      const modified = await db.downloadJobs
        .where("id")
        .equals(id)
        .and(job => job.status === "queued")
        .modify({ status: "running" satisfies DownloadJobStatus });
      return modified === 1;
    });
  }

  /** Startup recovery: jobs left running by a dead session queue up again. */
  async requeueRunning(): Promise<Result<number, Error>> {
    return attemptDb(() => db.downloadJobs
      .where("status")
      .equals("running")
      .modify({ status: "queued" satisfies DownloadJobStatus }));
  }
}

export const downloadJobRepository = new DownloadJobRepository();
