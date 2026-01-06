export interface ParseRequest {
  fileId: string;
  fileBlob: Blob;
}

export type ParseResponse
  = | { success: true; fileId: string; meta: NormalizedMetaRaw }
    | { success: false; fileId: string; error: string };

export interface NormalizedMetaRaw {
  title: string;
  artist: string;
  album: string;
  year?: number;
  duration: number;
  trackNo?: number;
  diskNo?: number;
  format: {
    codec?: string;
    bitrate?: number;
    sampleRate?: number;
    lossless?: boolean;
    channels?: number;
  };
  pictureBlob?: Blob;
}
