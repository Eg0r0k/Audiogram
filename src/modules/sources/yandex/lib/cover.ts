const ALLOWED_HOSTS = ["avatars.yandex.net", "avatars.mds.yandex.net"];
const RENDITIONS = [100, 200, 300, 400, 500, 700, 1000];
const DEFAULT_SIZE = 300;

export const ymCoverHttpsUrl = (coverRef: string, size?: number): string => {
  if (coverRef.includes("://")) return "";
  const slash = coverRef.indexOf("/");
  if (slash === -1 || !ALLOWED_HOSTS.includes(coverRef.slice(0, slash))) return "";
  if (!coverRef.includes("%%")) return "";
  const wanted = size ?? DEFAULT_SIZE;
  const px = RENDITIONS.find(served => served >= wanted);
  if (px === undefined) return "";
  const rendition = `${px}x${px}`;
  return `https://${coverRef.split("%%").join(rendition)}`;
};
