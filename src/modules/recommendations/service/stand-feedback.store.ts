import { BaseDirectory, exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { platformCaps } from "@/lib/environment/platformCaps";
import { getLogger } from "@/lib/logger";
import type { TrackId } from "@/types/ids";

export type FeedbackLabel = 1 | -1;

export interface FeedbackEntry {
  sourceId: TrackId;
  candidateId: TrackId;
  label: FeedbackLabel;
  at: number;
}

interface FeedbackFile {
  version: 1;
  entries: FeedbackEntry[];
}

export const FEEDBACK_FILE = "reco-feedback.json";
export const SNAPSHOT_FILE = "reco-snapshot.json";
const FEEDBACK_LS_KEY = "reco-feedback";
const SNAPSHOT_LS_KEY = "reco-snapshot";

export const pairKey = (sourceId: TrackId, candidateId: TrackId): string => `${sourceId} ${candidateId}`;

const readText = async (file: string, lsKey: string): Promise<string | null> => {
  if (!platformCaps.hasFs) return localStorage.getItem(lsKey);
  if (!await exists(file, { baseDir: BaseDirectory.AppData })) return null;
  return readTextFile(file, { baseDir: BaseDirectory.AppData });
};

const writeText = async (file: string, lsKey: string, text: string): Promise<void> => {
  if (!platformCaps.hasFs) {
    localStorage.setItem(lsKey, text);
    return;
  }
  await writeTextFile(file, text, { baseDir: BaseDirectory.AppData });
};

export const loadFeedback = async (): Promise<Map<string, FeedbackEntry>> => {
  const map = new Map<string, FeedbackEntry>();
  try {
    const text = await readText(FEEDBACK_FILE, FEEDBACK_LS_KEY);
    if (!text) return map;
    const parsed = JSON.parse(text) as Partial<FeedbackFile>;
    for (const e of parsed.entries ?? []) {
      if ((e.label as unknown) !== 1 && (e.label as unknown) !== -1) continue;
      map.set(pairKey(e.sourceId, e.candidateId), e);
    }
  }
  catch (error) {
    getLogger().error(`[RecoStand] Failed to read feedback: ${String(error)}`);
  }
  return map;
};

export const saveFeedback = async (entries: Iterable<FeedbackEntry>): Promise<void> => {
  const file: FeedbackFile = { version: 1, entries: [...entries] };
  await writeText(FEEDBACK_FILE, FEEDBACK_LS_KEY, JSON.stringify(file));
};

export const writeSnapshot = async (snapshot: unknown): Promise<string> => {
  await writeText(SNAPSHOT_FILE, SNAPSHOT_LS_KEY, JSON.stringify(snapshot));
  return SNAPSHOT_FILE;
};
