import { BaseMetadata } from "@/workers/types";

export const normalizeMetadata = (file: File, raw: BaseMetadata) => {
  const artists = (raw.artists?.length ?? 0) > 0
    ? raw.artists
    : [extractArtistFromPath(file) || "Unknown Artist"];
  const title = sanitizeString(raw.title) || "Unknown Title";
  const album = sanitizeString(raw.album) || "Unknown Album";

  return {
    ...raw,
    title,
    artists,
    album,
  };
};
const extractArtistFromPath = (file: File): string | null => {
  const path = file.webkitRelativePath;
  if (!path) return null;
  const parts = path.split("/");
  return parts.length >= 2 ? parts[0] : null;
};

export const sanitizeString = (str: unknown): string | null => {
  if (typeof str !== "string") return null;
  const trimmed = str.trim();
  return trimmed && trimmed !== "Unknown" ? trimmed : null;
};
