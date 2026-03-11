export interface StreamCheckOptions {
  duration: number;
  url?: string;
}

const ONE_DAY_SECONDS = 86400;

export const isLiveStreamTrack = (options: StreamCheckOptions): boolean => {
  const { duration, url } = options;

  if (!isFinite(duration) || duration === 0) {
    return true;
  }

  if (!url) {
    return false;
  }

  const lowerUrl = url.toLowerCase();
  const hasStreamIndicator
    = lowerUrl.includes(".m3u8")
      || lowerUrl.includes("stream")
      || lowerUrl.includes("radio");

  if (hasStreamIndicator && duration > ONE_DAY_SECONDS) {
    return true;
  }

  return false;
};
