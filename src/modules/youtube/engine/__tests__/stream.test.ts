import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Innertube } from "youtubei.js";
import { chooseAudioFormat, createStreamResolver, expiresAtOf, type ResolvedStream } from "../stream";
import { YtPlayabilityError } from "../errors";
import type { YtSession } from "../session";

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), debug: vi.fn() }) }));

const VISIONOS_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const URL_140 = "https://rr1---sn-x.googlevideo.com/videoplayback?expire=1789686554&itag=140";

interface FormatStub {
  itag: number;
  mime_type: string;
  bitrate: number;
  decipher: () => Promise<string>;
}

const format = (itag: number, mime_type: string, bitrate: number, url = `https://rr1---sn-x.googlevideo.com/videoplayback?itag=${itag}`): FormatStub =>
  ({ itag, mime_type, bitrate, decipher: () => Promise.resolve(url) });

const playerResponse = (status: string, reason = "", formats: FormatStub[] = [format(140, "audio/mp4; codecs=\"mp4a.40.2\"", 131_057, URL_140)]) => ({
  playability_status: { status, reason },
  streaming_data: { adaptive_formats: formats },
});

/** A fake Innertube: `getBasicInfo` answers from a queue, one response per call. */
const fakeYt = (responses: unknown[]) => {
  const getBasicInfo = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no scripted response left");
    return next;
  });
  return { yt: { getBasicInfo, session: { player: {} } } as unknown as Innertube, getBasicInfo };
};

const fakeSession = (yts: Innertube[]): YtSession & { invalidate: ReturnType<typeof vi.fn> } => {
  let index = 0;
  return {
    get: vi.fn(async () => yts[Math.min(index, yts.length - 1)]),
    invalidate: vi.fn(() => {
      index += 1;
    }),
  };
};

describe("chooseAudioFormat", () => {
  const formats = [
    format(18, "video/mp4", 500_000),
    format(251, "audio/webm; codecs=\"opus\"", 145_135),
    format(140, "audio/mp4; codecs=\"mp4a.40.2\"", 131_057),
    format(250, "audio/webm; codecs=\"opus\"", 71_795),
  ] as never[];

  it("prefers itag 140", () => {
    expect(chooseAudioFormat(formats)?.itag).toBe(140);
  });

  it("falls back to the best Opus, then to any audio", () => {
    expect(chooseAudioFormat(formats.filter((f: FormatStub) => f.itag !== 140))?.itag).toBe(251);
    expect(chooseAudioFormat([format(139, "audio/mp4", 48_000)] as never[])?.itag).toBe(139);
    expect(chooseAudioFormat([format(18, "video/mp4", 1)] as never[])).toBeUndefined();
  });
});

describe("expiresAtOf", () => {
  it("reads the unix expiry googlevideo puts in the URL", () => {
    expect(expiresAtOf(URL_140)).toBe(1_789_686_554);
    expect(expiresAtOf("https://rr1---sn-x.googlevideo.com/videoplayback?itag=140")).toBeNull();
  });
});

describe("createStreamResolver", () => {
  let registered: [string, ResolvedStream][];
  const register = vi.fn(async (id: string, stream: ResolvedStream) => {
    registered.push([id, stream]);
  });

  beforeEach(() => {
    registered = [];
    register.mockClear();
  });

  it("registers the deciphered itag 140 URL with the VISIONOS user agent and expiry", async () => {
    const { yt, getBasicInfo } = fakeYt([playerResponse("OK")]);
    const resolver = createStreamResolver({ session: fakeSession([yt]), register });

    await resolver.resolve("Rgrt_8mXrK8");

    expect(getBasicInfo).toHaveBeenCalledWith("Rgrt_8mXrK8", { client: "VISIONOS" });
    expect(registered).toEqual([["Rgrt_8mXrK8", {
      url: URL_140,
      headers: [["User-Agent", VISIONOS_UA]],
      expiresAt: 1_789_686_554,
      mimeType: "audio/mp4; codecs=\"mp4a.40.2\"",
    }]]);
  });

  it("skips a re-resolve while the registration is fresh and resolves again after the reuse window", async () => {
    let now = 1_000_000;
    const { yt, getBasicInfo } = fakeYt([playerResponse("OK"), playerResponse("OK")]);
    const resolver = createStreamResolver({ session: fakeSession([yt]), register, now: () => now });

    await resolver.resolve("Rgrt_8mXrK8");
    now += 60_000;
    await resolver.resolve("Rgrt_8mXrK8");
    expect(getBasicInfo).toHaveBeenCalledTimes(1);

    now += 5 * 60_000;
    await resolver.resolve("Rgrt_8mXrK8");
    expect(getBasicInfo).toHaveBeenCalledTimes(2);
  });

  it("re-resolves an entry about to expire even inside the reuse window", async () => {
    const expiry = 1_789_686_554;
    const { yt, getBasicInfo } = fakeYt([playerResponse("OK"), playerResponse("OK")]);
    const resolver = createStreamResolver({ session: fakeSession([yt]), register, now: () => (expiry - 30) * 1000 });

    await resolver.resolve("Rgrt_8mXrK8");
    await resolver.resolve("Rgrt_8mXrK8");

    expect(getBasicInfo).toHaveBeenCalledTimes(2);
  });

  it("rebuilds the session once on a bot check and succeeds on the fresh one", async () => {
    const flagged = fakeYt([playerResponse("LOGIN_REQUIRED", "Sign in to confirm you’re not a bot")]);
    const fresh = fakeYt([playerResponse("OK")]);
    const session = fakeSession([flagged.yt, fresh.yt]);
    const resolver = createStreamResolver({ session, register });

    await resolver.resolve("Rgrt_8mXrK8");

    expect(session.invalidate).toHaveBeenCalledTimes(1);
    expect(fresh.getBasicInfo).toHaveBeenCalledTimes(1);
    expect(registered).toHaveLength(1);
  });

  it("surfaces other playability failures as YtPlayabilityError without retrying", async () => {
    const { yt, getBasicInfo } = fakeYt([playerResponse("UNPLAYABLE", "The uploader has not made this video available in your country")]);
    const session = fakeSession([yt]);
    const resolver = createStreamResolver({ session, register });

    await expect(resolver.resolve("Rgrt_8mXrK8")).rejects.toBeInstanceOf(YtPlayabilityError);
    expect(session.invalidate).not.toHaveBeenCalled();
    expect(getBasicInfo).toHaveBeenCalledTimes(1);
    expect(register).not.toHaveBeenCalled();
  });

  it("fails when the player response carries no audio format", async () => {
    const { yt } = fakeYt([playerResponse("OK", "", [format(18, "video/mp4", 1)])]);
    const resolver = createStreamResolver({ session: fakeSession([yt]), register });

    await expect(resolver.resolve("Rgrt_8mXrK8")).rejects.toThrow(/no audio format/);
  });
});
