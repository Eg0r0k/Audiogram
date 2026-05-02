import path from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

type FetchHandler = (event: {
  request: Request;
  respondWith: (response: Response | Promise<Response>) => void;
}) => void;

const opfsServiceWorkerSource = readFileSync(
  path.resolve(process.cwd(), "public/opfs-sw.js"),
  "utf8",
);

function loadOpfsServiceWorker(storageManager: { getDirectory: ReturnType<typeof vi.fn> }) {
  let fetchHandler: FetchHandler | null = null;

  vi.stubGlobal("navigator", { storage: storageManager });
  vi.stubGlobal("self", {
    addEventListener: vi.fn((type: string, handler: FetchHandler) => {
      if (type === "fetch") {
        fetchHandler = handler;
      }
    }),
  });

  // eslint-disable-next-line sonarjs/code-eval -- test loads the real public service worker source verbatim
  new Function(opfsServiceWorkerSource)();

  if (!fetchHandler) {
    throw new Error("OPFS service worker did not register a fetch handler");
  }

  return fetchHandler;
}

async function dispatchFetch(fetchHandler: FetchHandler, url: string) {
  let responsePromise: Promise<Response> | null = null;
  const respondWith = vi.fn((response: Response | Promise<Response>) => {
    responsePromise = Promise.resolve(response);
  });

  fetchHandler({
    request: new Request(url),
    respondWith,
  });

  return {
    respondWith,
    response: responsePromise ? await responsePromise : null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("opfs-sw", () => {
  it("ignores requests outside the /opfs/ prefix", async () => {
    const storageManager = {
      getDirectory: vi.fn(),
    };

    const fetchHandler = loadOpfsServiceWorker(storageManager);
    const { respondWith, response } = await dispatchFetch(fetchHandler, "https://app.local/img/cover.png");

    expect(respondWith).not.toHaveBeenCalled();
    expect(response).toBeNull();
    expect(storageManager.getDirectory).not.toHaveBeenCalled();
  });

  it("serves an OPFS file from nested decoded directories", async () => {
    const file = new File(["audio-data"], "Track Name.flac", { type: "audio/flac" });
    const fileHandle = {
      getFile: vi.fn().mockResolvedValue(file),
    };
    const artistDir = {
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn().mockResolvedValue(fileHandle),
    };
    const musicDir = {
      getDirectoryHandle: vi.fn().mockImplementation(async (name: string) => {
        if (name === "Artist Name") return artistDir;
        throw new Error(`Unknown directory: ${name}`);
      }),
    };
    const root = {
      getDirectoryHandle: vi.fn().mockImplementation(async (name: string) => {
        if (name === "music") return musicDir;
        throw new Error(`Unknown directory: ${name}`);
      }),
    };
    const storageManager = {
      getDirectory: vi.fn().mockResolvedValue(root),
    };

    const fetchHandler = loadOpfsServiceWorker(storageManager);
    const { respondWith, response } = await dispatchFetch(
      fetchHandler,
      "https://app.local/opfs/music/Artist%20Name/Track%20Name.flac",
    );

    expect(respondWith).toHaveBeenCalledOnce();
    expect(storageManager.getDirectory).toHaveBeenCalledOnce();
    expect(root.getDirectoryHandle).toHaveBeenCalledWith("music");
    expect(musicDir.getDirectoryHandle).toHaveBeenCalledWith("Artist Name");
    expect(artistDir.getFileHandle).toHaveBeenCalledWith("Track Name.flac");
    expect(fileHandle.getFile).toHaveBeenCalledOnce();

    expect(response?.status).toBe(200);
    expect(response?.headers.get("Content-Type")).toBe("audio/flac");
    expect(response?.headers.get("Content-Length")).toBe(String(file.size));
    expect(response?.headers.get("Accept-Ranges")).toBe("bytes");
    expect(await response?.text()).toBe("audio-data");
  });

  it("falls back to audio/mpeg when the file type is missing", async () => {
    const file = new File(["raw"], "track.bin");
    const storageManager = {
      getDirectory: vi.fn().mockResolvedValue({
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi.fn().mockResolvedValue(file),
        }),
      }),
    };

    const fetchHandler = loadOpfsServiceWorker(storageManager);
    const { response } = await dispatchFetch(fetchHandler, "https://app.local/opfs/track.bin");

    expect(response?.status).toBe(200);
    expect(response?.headers.get("Content-Type")).toBe("audio/mpeg");
  });

  it("returns a 404 response when the OPFS file lookup fails", async () => {
    const storageManager = {
      getDirectory: vi.fn().mockRejectedValue(new Error("missing")),
    };

    const fetchHandler = loadOpfsServiceWorker(storageManager);
    const { response } = await dispatchFetch(fetchHandler, "https://app.local/opfs/missing-track.mp3");

    expect(response?.status).toBe(404);
    expect(await response?.text()).toBe("Not found");
  });
});
