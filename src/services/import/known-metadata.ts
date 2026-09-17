import { splitArtistNames } from "@/lib/artist-names";
import type { BaseMetadata } from "@/workers/types";
import type { KnownMetadata } from "../types";

/** Source-known identity over parsed tags; blank source values do not erase tags. */
export const applyKnownMetadata = (meta: BaseMetadata, known: KnownMetadata): BaseMetadata => {
  const artists = splitArtistNames(known.artistName);
  const album = known.albumTitle?.trim();
  return {
    ...meta,
    title: known.title.trim() || meta.title,
    artists: artists.length > 0 ? artists : meta.artists,
    album: album || meta.album,
    year: known.year ?? meta.year,
    trackNo: known.trackNo ?? meta.trackNo,
    diskNo: known.discNo ?? meta.diskNo,
    pictureBlob: known.cover ?? meta.pictureBlob,
  };
};
