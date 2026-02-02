import { BaseMetadata } from "@/workers/types";

export interface NormalizedMeta extends BaseMetadata {
  searchKey: string;
}

export const normalizeMetadata = (file: File, raw: BaseMetadata) => {
  const artist = sanitizeString(raw.artist) || extractArtistFromPath(file) || "Unknown Artist";
  const title = sanitizeString(raw.title) || extractTitleFromFilename(file.name);
  const album = sanitizeString(raw.album) || "Unknown Album";

  const searchKey = [title, artist, album].filter(Boolean).join(" ").toLowerCase();

  return {
    ...raw,
    title,
    artist,
    album,
    searchKey,
  };
};

const extractArtistFromPath = (file: File): string | null => {
  const path = file.webkitRelativePath;
  if (!path) return null;
  const parts = path.split("/");
  return parts.length >= 2 ? parts[0] : null;
};

export const extractTitleFromFilename = (filename: string): string => {
  return filename.replace(/\.[^/.]+$/, "");
};

export const sanitizeString = (str: unknown): string | null => {
  if (typeof str !== "string") return null;
  const trimmed = str.trim();
  return trimmed && trimmed !== "Unknown" ? trimmed : null;
};
