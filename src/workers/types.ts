import { AudioFormat } from "@/db/entities";

export interface ParseRequest {
  fileId: string;
  fileName: string;
  fileData: Uint8Array;
  extractCover?: boolean;
}

export type ParseResponse
  = | { success: true; fileId: string; meta: BaseMetadata }
    | { success: false; fileId: string; error: string };

export interface BaseMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number;
  duration: number;
  trackNo?: number;
  diskNo?: number;

  format: AudioFormat;

  pictureBlob?: Blob;
}
