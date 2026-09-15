import { formatBytes } from "@/lib/format/memory";

/**
 * Subtitle for a running download. `total` is null when the server sent no
 * Content-Length; nothing is shown until the first byte lands.
 */
export const formatDownloadProgress = (downloaded: number, total: number | null): string | null => {
  if (downloaded <= 0 && !total) return null;
  if (!total) return formatBytes(downloaded);
  const percent = Math.min(100, Math.round((downloaded / total) * 100));
  return `${formatBytes(downloaded)} / ${formatBytes(total)} · ${percent}%`;
};
