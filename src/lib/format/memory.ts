export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / k ** i;

  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};
