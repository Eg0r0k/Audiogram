/** `320 kbps`; "—" for a missing or zero value. */
export const formatBitrate = (bps?: number): string =>
  bps ? `${Math.round(bps / 1000)} kbps` : "—";

/** `44.1 kHz`; "—" for a missing or zero value. */
export const formatSampleRate = (hz?: number): string =>
  hz ? `${(hz / 1000).toFixed(1)} kHz` : "—";
