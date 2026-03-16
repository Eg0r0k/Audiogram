import { parseBuffer, type IOptions } from "music-metadata";
import type { BaseMetadata, ParseRequest, ParseResponse } from "./types";

const OPTIONS: IOptions = {
  duration: true,
  skipCovers: false,
  skipPostHeaders: true,
  includeChapters: false,
  mkvUseIndex: true,
};

self.onmessage = async (e: MessageEvent<ParseRequest>) => {
  const { fileId, fileData, fileName } = e.data;

  try {
    const metadata = await parseBuffer(fileData, undefined, OPTIONS);

    let pictureBlob: Blob | undefined;
    if (metadata.common.picture?.[0]) {
      const pic = metadata.common.picture[0];
      pictureBlob = new Blob([pic.data], { type: pic.format });
    }

    const titleFromFile = fileName.replace(/\.[^/.]+$/, "");

    const meta: BaseMetadata = {
      title: metadata.common.title || titleFromFile,
      artist: metadata.common.artist || "Unknown Artist",
      album: metadata.common.album || "Unknown Album",
      year: metadata.common.year,
      duration: metadata.format.duration || 0,
      trackNo: metadata.common.track.no || undefined,
      diskNo: metadata.common.disk.no || undefined,
      format: {
        codec: metadata.format.codec,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        lossless: metadata.format.lossless,
        channels: metadata.format.numberOfChannels,
      },
      pictureBlob,
    };

    const response: ParseResponse = { success: true, fileId, meta };
    self.postMessage(response);
  }
  catch (error: unknown) {
    if (error instanceof Error) {
      const response: ParseResponse = {
        success: false,
        fileId,
        error: error.message || "Parsing failed",
      };
      self.postMessage(response);
    }
  }
};
