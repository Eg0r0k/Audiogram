import { trackRepository } from "@/db/repositories";
import type { TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";

export const getLocalCopy = async (remoteId: TrackId): Promise<TrackEntity | null> =>
  (await trackRepository.findBySourceRef(remoteId)) ?? null;
