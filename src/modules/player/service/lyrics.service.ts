import { ResultAsync, err, ok, type Result } from "neverthrow";
import { hasLyricsText, parseLyrics, type ParsedLyrics } from "@/modules/player/lib/lrc";

export type LyricsError = | { type: "NOT_FOUND" }
  | { type: "NETWORK"; cause: unknown };

export interface LrcLibLyrics {
  raw: string;
  lyrics: ParsedLyrics;
}

interface LrclibTrack {
  syncedLyrics: string | null;
  plainLyrics: string | null;
  artistName: string;
}

const LRCLIB_BASE = "https://lrclib.net/api";

const FEAT_KEYWORDS = ["feat.", "ft.", "with "] as const;
const VERSION_KEYWORDS = ["remastered", "radio edit", "live", "mono", "deluxe"] as const;

function removeFeatParenthetical(title: string): string {
  let result = "";
  let i = 0;

  while (i < title.length) {
    const ch = title[i];

    if (ch === "(" || ch === "[") {
      const closeChar = ch === "(" ? ")" : "]";
      const closeIdx = title.indexOf(closeChar, i + 1);

      if (closeIdx !== -1) {
        const inner = title.slice(i + 1, closeIdx).trimStart().toLowerCase();
        if (FEAT_KEYWORDS.some(k => inner.startsWith(k))) {
          result = result.trimEnd();
          i = closeIdx + 1;
          continue;
        }
      }
    }

    result += ch;
    i++;
  }

  return result;
}

function removeVersionSuffix(title: string): string {
  let searchFrom = 0;

  while (searchFrom < title.length) {
    const dashIdx = title.indexOf(" - ", searchFrom);
    if (dashIdx === -1) return title;

    const after = title.slice(dashIdx + 3).toLowerCase();
    if (VERSION_KEYWORDS.some(k => after.startsWith(k))) {
      return title.slice(0, dashIdx);
    }

    searchFrom = dashIdx + 3;
  }

  return title;
}

export function cleanTitle(title: string): string {
  return removeVersionSuffix(removeFeatParenthetical(title)).trim();
}

class LyricsFetchError extends Error {
  constructor(readonly info: LyricsError) {
    super(info.type);
  }
}

const fetchJson = <T>(url: string): ResultAsync<T, LyricsError> => {
  return ResultAsync.fromPromise(
    fetch(url).then((res) => {
      if (res.status === 404) throw new LyricsFetchError({ type: "NOT_FOUND" });
      if (!res.ok) throw new LyricsFetchError({ type: "NETWORK", cause: res.statusText });
      return res.json() as Promise<T>;
    }),
    (e): LyricsError => {
      if (e instanceof LyricsFetchError) return e.info;
      return { type: "NETWORK", cause: e };
    },
  );
};

const fetchExact = (title: string, artist: string): ResultAsync<LrclibTrack, LyricsError> => {
  const url = `${LRCLIB_BASE}/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
  return fetchJson<LrclibTrack>(url);
};

const fetchFuzzyMatches = (title: string, artist: string): ResultAsync<LrclibTrack[], LyricsError> => {
  const firstWord = cleanTitle(title).split(/\s+/)[0];
  const trackName = `${title} ${firstWord}`;
  const url = `${LRCLIB_BASE}/search?q=${encodeURIComponent(trackName)}`;

  return fetchJson<LrclibTrack[]>(url).map((results) => {
    const artistLower = artist.toLowerCase();

    return results.filter((r) => {
      const candidates = r.artistName.toLowerCase().split(/[,&]/).map(s => s.trim());
      return candidates.some(c => artistLower.includes(c));
    });
  });
};

const usableLyrics = (raw: string | null | undefined): LrcLibLyrics | null => {
  if (!raw) return null;
  const lyrics = parseLyrics(raw);
  return hasLyricsText(lyrics) ? { raw, lyrics } : null;
};

const firstUsableLyrics = (raws: readonly (string | null)[]): LrcLibLyrics | null => {
  for (const raw of raws) {
    const found = usableLyrics(raw);
    if (found) return found;
  }
  return null;
};

const findLrcLibLyrics = async (title: string, artist: string): Promise<Result<LrcLibLyrics, LyricsError>> => {
  const exact = await fetchExact(title, artist);
  const exactTrack = exact.isOk() ? exact.value : null;
  const exactSynced = usableLyrics(exactTrack?.syncedLyrics);
  if (exactSynced) return ok(exactSynced);

  const fuzzy = await fetchFuzzyMatches(title, artist);
  const matches = fuzzy.isOk() ? fuzzy.value : [];
  const found = firstUsableLyrics(matches.map(match => match.syncedLyrics))
    ?? usableLyrics(exactTrack?.plainLyrics)
    ?? firstUsableLyrics(matches.map(match => match.plainLyrics));
  if (found) return ok(found);

  for (const attempt of [exact, fuzzy]) {
    if (attempt.isErr() && attempt.error.type === "NETWORK") return err(attempt.error);
  }
  return err({ type: "NOT_FOUND" });
};

export const fetchLrcLibLyrics = (title: string, artist: string): ResultAsync<LrcLibLyrics, LyricsError> =>
  new ResultAsync(findLrcLibLyrics(cleanTitle(title), artist));
