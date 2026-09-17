import { TrackSource, TrackState, type AudioFormat } from "@/db/entities";

/** i18n key for a row's source, null for a value the UI has no name for. */
export const trackSourceLabelKey = (source: TrackSource): string | null => {
  switch (source) {
    case TrackSource.LOCAL_INTERNAL:
      return "track.details.values.localInternal";
    case TrackSource.LOCAL_EXTERNAL:
      return "track.details.values.localExternal";
    case TrackSource.REMOTE_HLS:
      return "track.details.values.remoteHls";
    case TrackSource.REMOTE_YT:
      return "track.details.values.remoteYt";
    case TrackSource.REMOTE_SUBSONIC:
      return "track.details.values.remoteNd";
    default:
      return null;
  }
};

export const trackStateLabelKey = (state: TrackState): string | null => {
  switch (state) {
    case TrackState.READY:
      return "track.details.values.ready";
    case TrackState.BROKEN:
      return "track.details.values.broken";
    default:
      return null;
  }
};

/**
 * The row's own format, field by field over the downloaded copy's: remote
 * rows store no format of their own, the real one sits on the downloaded
 * local row.
 */
export const resolveTrackFormat = (own: AudioFormat | undefined, copy: AudioFormat | undefined): AudioFormat => ({
  codec: own?.codec ?? copy?.codec,
  bitrate: own?.bitrate ?? copy?.bitrate,
  sampleRate: own?.sampleRate ?? copy?.sampleRate,
  channels: own?.channels ?? copy?.channels,
  lossless: own?.lossless ?? copy?.lossless,
});
