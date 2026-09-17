import { describe, expect, it } from "vitest";
import {
  albumDetailFrom,
  applyTrackDetails,
  artistDetailFrom,
  entitiesFromSearchAll,
  entityFromNode,
  fillTopTrackDurations,
  needsDetails,
  parseCount,
  playlistDetailFrom,
  textOf,
  trackFromInfo,
  videosFromNodes,
  type CardShelfLike,
  type ListItemLike,
  type TextLike,
  type TwoRowItemLike,
} from "../mappers";

//
// Fixtures are the parsed-node shapes recorded from live responses on
// 2026-09-17 (Daft Punk searches, MPREb_K8qWMWVqXGi, UCRr1xG_2WIDs18a6cIiCxeA,
// PLbVEkNUDhmcKodkYlYxvQ13NTsF-SX2ZA), trimmed to the fields the mappers read.
//

const text = (value: string, runs?: TextLike["runs"]): TextLike => ({ toString: () => value, runs });
const channelRun = (name: string, id: string) => ({ text: name, endpoint: { payload: { browseId: id } } });
const plainRun = (value: string) => ({ text: value });

const DAFT_PUNK = "UCRr1xG_2WIDs18a6cIiCxeA";

const songRow: ListItemLike = {
  type: "MusicResponsiveListItem",
  item_type: "song",
  id: "khnokW3Mw24",
  title: "Instant Crush (feat. Julian Casablancas)",
  duration: { seconds: 338 },
  artists: [{ name: "Daft Punk", channel_id: DAFT_PUNK }, { name: "Julian Casablancas", channel_id: "UCWhpbdGLnR8XtXLr0yl2nYA" }],
  album: { id: "MPREb_K8qWMWVqXGi", name: "Random Access Memories" },
  thumbnails: [{ url: "https://yt3.googleusercontent.com/c=w120-h120", width: 120 }, { url: "https://yt3.googleusercontent.com/c=w60-h60", width: 60 }],
};

const albumRow: ListItemLike = {
  type: "MusicResponsiveListItem",
  item_type: "album",
  id: "MPREb_K8qWMWVqXGi",
  title: "Random Access Memories",
  year: "2013",
  author: { name: "Daft Punk", channel_id: DAFT_PUNK },
  thumbnails: [{ url: "https://yt3.googleusercontent.com/a=w544-h544", width: 544 }, { url: "https://yt3.googleusercontent.com/a=w226-h226", width: 226 }],
  flex_columns: [{ title: text("Random Access Memories") }, { title: text("Album • Daft Punk • 2013", [plainRun("Album"), plainRun(" • "), channelRun("Daft Punk", DAFT_PUNK), plainRun(" • "), plainRun("2013")]) }],
};

const artistRow: ListItemLike = {
  type: "MusicResponsiveListItem",
  item_type: "artist",
  id: DAFT_PUNK,
  name: "Daft Punk",
  subscribers: "",
  thumbnails: [{ url: "https://lh3.googleusercontent.com/p=w120-h120", width: 120 }],
};

const playlistRow: ListItemLike = {
  type: "MusicResponsiveListItem",
  item_type: "playlist",
  id: "VLPLbVEkNUDhmcKodkYlYxvQ13NTsF-SX2ZA",
  title: "Daft punk radio",
  author: { name: "Jessica Wilke-Reyes", channel_id: "UCGp9clhDzMwrxbH8cWsMrDw" },
  item_count: "25 songs",
  thumbnails: [{ url: "https://yt3.ggpht.com/pl=s1200", width: 1200 }, { url: "https://yt3.ggpht.com/pl=s576", width: 576 }],
};

const albumCard: TwoRowItemLike = {
  type: "MusicTwoRowItem",
  item_type: "album",
  id: "MPREb_AkAwWpvJOOS",
  title: text("prime time of your life"),
  subtitle: text("Single • 2006", [plainRun("Single"), plainRun(" • "), plainRun("2006")]),
  year: "2006",
  artists: [],
  thumbnail: [{ url: "https://yt3.googleusercontent.com/s=w544-h544", width: 544 }, { url: "https://yt3.googleusercontent.com/s=w226-h226", width: 226 }],
};

describe("helpers", () => {
  it("treats youtubei.js's N/A and empty text as no value", () => {
    expect(textOf(text("N/A"))).toBeNull();
    expect(textOf(text(""))).toBeNull();
    expect(textOf(text("Daft Punk"))).toBe("Daft Punk");
    expect(textOf(undefined)).toBeNull();
  });

  it("parses counts with separators and suffixes", () => {
    expect(parseCount("25 songs")).toBe(25);
    expect(parseCount("1,234 songs")).toBe(1234);
    expect(parseCount("83.5M monthly audience")).toBe(83_500_000);
    expect(parseCount("12K subscribers")).toBe(12_000);
    expect(parseCount("")).toBeNull();
    expect(parseCount("Playlist")).toBeNull();
  });
});

describe("entityFromNode", () => {
  it("maps a song row with credits, album and the largest thumbnail", () => {
    expect(entityFromNode(songRow)).toEqual({
      kind: "track",
      id: "khnokW3Mw24",
      title: "Instant Crush (feat. Julian Casablancas)",
      artists: [{ id: DAFT_PUNK, name: "Daft Punk" }, { id: "UCWhpbdGLnR8XtXLr0yl2nYA", name: "Julian Casablancas" }],
      album: { id: "MPREb_K8qWMWVqXGi", name: "Random Access Memories" },
      duration: 338,
      thumbnail: "https://yt3.googleusercontent.com/c=w120-h120",
      isVideo: false,
      trackNr: null,
    });
  });

  it("maps a video row through its authors and flags it as a video", () => {
    const entity = entityFromNode({
      type: "MusicResponsiveListItem",
      item_type: "video",
      id: "Q5l2ChAqRDg",
      title: "Daft Punk - Within",
      duration: { seconds: 241 },
      authors: [{ name: "John Schroter", channel_id: "UC-L8sbkj8DxzCbK80MEySXQ" }],
      thumbnails: [{ url: "https://i.ytimg.com/vi/Q5l2ChAqRDg/hqdefault.jpg", width: 400 }],
    });

    expect(entity).toMatchObject({ kind: "track", isVideo: true, artists: [{ id: "UC-L8sbkj8DxzCbK80MEySXQ", name: "John Schroter" }] });
  });

  it("drops id-less Song/Video type badges from the credits", () => {
    const entity = entityFromNode({ ...songRow, artists: [{ name: "Song" }, { name: "Daft Punk", channel_id: DAFT_PUNK }] });

    expect(entity).toMatchObject({ artists: [{ id: DAFT_PUNK, name: "Daft Punk" }] });
  });

  it("maps an album row with its type, year and author", () => {
    expect(entityFromNode(albumRow)).toEqual({
      kind: "album",
      id: "MPREb_K8qWMWVqXGi",
      title: "Random Access Memories",
      artists: [{ id: DAFT_PUNK, name: "Daft Punk" }],
      albumType: "album",
      year: 2013,
      thumbnail: "https://yt3.googleusercontent.com/a=w544-h544",
    });
  });

  it("maps an artist row", () => {
    expect(entityFromNode(artistRow)).toEqual({
      kind: "artist",
      id: DAFT_PUNK,
      name: "Daft Punk",
      thumbnail: "https://lh3.googleusercontent.com/p=w120-h120",
      subscriberCount: null,
    });
  });

  it("strips the VL prefix off playlist browse ids", () => {
    expect(entityFromNode(playlistRow)).toEqual({
      kind: "playlist",
      id: "PLbVEkNUDhmcKodkYlYxvQ13NTsF-SX2ZA",
      title: "Daft punk radio",
      owner: "Jessica Wilke-Reyes",
      trackCount: 25,
      thumbnail: "https://yt3.ggpht.com/pl=s1200",
    });
  });

  it("maps an artist-page album card with its type from the subtitle", () => {
    expect(entityFromNode(albumCard)).toEqual({
      kind: "album",
      id: "MPREb_AkAwWpvJOOS",
      title: "prime time of your life",
      artists: [],
      albumType: "single",
      year: 2006,
      thumbnail: "https://yt3.googleusercontent.com/s=w544-h544",
    });
  });

  it("keeps non-music audio tracks as tracks", () => {
    expect(entityFromNode({ ...songRow, item_type: "non_music_track" })).toMatchObject({ kind: "track", id: "khnokW3Mw24", isVideo: false });
  });

  it("returns null for rows the UI has no shape for and for greyed-out rows without an id", () => {
    expect(entityFromNode({ type: "MusicResponsiveListItem", item_type: "podcast_show", id: "x", title: "Pod", thumbnails: [] })).toBeNull();
    expect(entityFromNode({ type: "MusicResponsiveListItem", item_type: "unknown", title: "Dai Dai", thumbnails: [] })).toBeNull();
    expect(entityFromNode({ ...songRow, id: undefined })).toBeNull();
  });
});

describe("entitiesFromSearchAll", () => {
  const card: CardShelfLike = {
    type: "MusicCardShelf",
    title: text("Daft Punk"),
    subtitle: text("Artist • 83.5M monthly audience", [plainRun("Artist"), plainRun(" • "), plainRun("83.5M monthly audience")]),
    thumbnail: { contents: [{ url: "https://lh3.googleusercontent.com/q=w120", width: 120 }] },
    on_tap: { payload: { browseId: DAFT_PUNK, browseEndpointContextSupportedConfigs: { browseEndpointContextMusicConfig: { pageType: "MUSIC_PAGE_TYPE_ARTIST" } } } },
    contents: [{ ...songRow, id: "4D7u5KF7SP8", title: "Get Lucky", artists: [], album: undefined }],
  };

  it("emits the top-result card first, then its rows, then the shelves' rows", () => {
    const entities = entitiesFromSearchAll([
      card,
      { type: "ItemSection", contents: [albumRow] },
      { type: "ItemSection", contents: [artistRow] },
    ]);

    expect(entities.map(entity => [entity.kind, entity.id])).toEqual([
      ["artist", DAFT_PUNK],
      ["track", "4D7u5KF7SP8"],
      ["album", "MPREb_K8qWMWVqXGi"],
      ["artist", DAFT_PUNK],
    ]);
  });

  it("types a song card by its watch endpoint", () => {
    const [entity] = entitiesFromSearchAll([{
      ...card,
      title: text("Get Lucky"),
      subtitle: text("Song • Daft Punk", [plainRun("Song"), plainRun(" • "), channelRun("Daft Punk", DAFT_PUNK)]),
      on_tap: { payload: { videoId: "4D7u5KF7SP8" } },
      contents: [],
    }]);

    expect(entity).toMatchObject({ kind: "track", id: "4D7u5KF7SP8", artists: [{ id: DAFT_PUNK, name: "Daft Punk" }], isVideo: false });
  });
});

describe("track details", () => {
  it("flags stripped rows and fills them from the details, keeping what the details lack", () => {
    const base = entityFromNode({ ...songRow, artists: [], album: undefined, duration: undefined });
    if (base?.kind !== "track") throw new Error("expected a track");
    expect(needsDetails(base)).toBe(true);

    const details = trackFromInfo(
      { id: "khnokW3Mw24", title: "Instant Crush", duration: 338, author: "Daft Punk, Julian Casablancas", thumbnail: [{ url: "https://lh3.googleusercontent.com/cover=w544", width: 544 }] },
      { video_id: "khnokW3Mw24", artists: [{ name: "Daft Punk", channel_id: DAFT_PUNK }], album: { id: "MPREb_K8qWMWVqXGi", name: "Random Access Memories" } },
    )!;
    const filled = applyTrackDetails(base, details);

    expect(filled).toMatchObject({
      artists: [{ id: DAFT_PUNK, name: "Daft Punk" }],
      album: { id: "MPREb_K8qWMWVqXGi", name: "Random Access Memories" },
      duration: 338,
      thumbnail: "https://lh3.googleusercontent.com/cover=w544",
    });
    expect(needsDetails(filled)).toBe(false);
  });

  it("splits the author string into id-less credits when the queue row is missing", () => {
    const details = trackFromInfo(
      { id: "Rgrt_8mXrK8", title: "Get Lucky", duration: 248, author: "Daft Punk, Pharrell Williams, & Nile Rodgers", thumbnail: [] },
      undefined,
    );

    expect(details?.artists).toEqual([
      { id: null, name: "Daft Punk" },
      { id: null, name: "Pharrell Williams" },
      { id: null, name: "Nile Rodgers" },
    ]);
    expect(details?.album).toBeNull();
  });
});

describe("albumDetailFrom", () => {
  it("reads artists from the strapline, type and year from the subtitle and the playlist id from the url", () => {
    const detail = albumDetailFrom("MPREb_K8qWMWVqXGi", {
      header: {
        type: "MusicResponsiveHeader",
        title: text("Random Access Memories"),
        subtitle: text("Album • 2013", [plainRun("Album"), plainRun(" • "), plainRun("2013")]),
        second_subtitle: text("13 songs • 1 hour, 14 minutes"),
        strapline_text_one: text("Daft Punk", [channelRun("Daft Punk", DAFT_PUNK)]),
        thumbnail: { contents: [{ url: "https://yt3.googleusercontent.com/a=w544-h544", width: 544 }] },
      },
      url: "https://music.youtube.com/playlist?list=OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c",
      contents: [
        { type: "MusicResponsiveListItem", item_type: "video", id: "IluRBvnYMoY", title: "Give Life Back to Music", duration: { seconds: 276 }, index: text("1"), authors: [{ name: "Daft Punk", channel_id: DAFT_PUNK }], thumbnails: [] },
        { type: "MusicResponsiveListItem", item_type: "video", id: "ajGKWk0auOc", title: "The Game of Love", duration: { seconds: 323 }, index: text("2"), authors: [{ name: "Daft Punk", channel_id: DAFT_PUNK }], thumbnails: [] },
      ],
    });

    expect(detail).toMatchObject({
      id: "MPREb_K8qWMWVqXGi",
      playlistId: "OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c",
      title: "Random Access Memories",
      artists: [{ id: DAFT_PUNK, name: "Daft Punk" }],
      albumType: "album",
      year: 2013,
      thumbnail: "https://yt3.googleusercontent.com/a=w544-h544",
      trackCount: 2,
    });
    // Album rows are typed as videos by the parser; inside an album they are songs with a track number.
    expect(detail.tracks[1]).toMatchObject({ id: "ajGKWk0auOc", trackNr: 2, isVideo: false, duration: 323, thumbnail: null });
  });
});

describe("artistDetailFrom", () => {
  it("collects top songs, albums and playlists from the sections and names the tracks playlist", () => {
    const { detail, tracksPlaylistId } = artistDetailFrom(DAFT_PUNK, {
      header: { type: "MusicImmersiveHeader", title: text("Daft Punk"), thumbnail: { contents: [{ url: "https://lh3.googleusercontent.com/q=w1440", width: 1440 }] } },
      sections: [
        { type: "MusicShelf", title: text("Top songs"), endpoint: { payload: { browseId: "VLOLAK5uy_lNVBcjNtiCwq-n95uoxJ-Gd4vsfMkyZNs" } }, contents: [{ ...songRow, duration: undefined, album: undefined }] },
        { type: "MusicCarouselShelf", header: { title: text("Albums") }, contents: [{ ...albumCard, item_type: "album", subtitle: text("2013"), year: "2013" }] },
        { type: "MusicCarouselShelf", header: { title: text("Singles & EPs") }, contents: [albumCard] },
        { type: "MusicCarouselShelf", header: { title: text("Videos") }, contents: [{ type: "MusicTwoRowItem", item_type: "video", id: "a5uQMwRMHcs", title: text("Instant Crush"), subtitle: text("Daft Punk • 895M views"), thumbnail: [] }] },
        { type: "MusicCarouselShelf", header: { title: text("Featured on") }, contents: [{ type: "MusicTwoRowItem", item_type: "playlist", id: "VLRDCLAK5uy_n20FRYQXNt1p1wS55Nj2r14IouO5weaYU", title: text("Presenting Daft Punk"), subtitle: text("Playlist • YouTube Music"), item_count: null, thumbnail: [{ url: "https://yt3.googleusercontent.com/e=w544", width: 544 }] }] },
        { type: "MusicCarouselShelf", header: { title: text("Fans might also like") }, contents: [{ type: "MusicTwoRowItem", item_type: "artist", id: "UCq7VAQmXDurV-9VN2bSFXvw", title: text("Gesaffelstein"), subtitle: text("27.1M monthly audience"), thumbnail: [] }] },
      ],
    });

    expect(tracksPlaylistId).toBe("OLAK5uy_lNVBcjNtiCwq-n95uoxJ-Gd4vsfMkyZNs");
    expect(detail).toMatchObject({ id: DAFT_PUNK, name: "Daft Punk", thumbnail: "https://lh3.googleusercontent.com/q=w1440" });
    expect(detail.topTracks.map(track => track.id)).toEqual(["khnokW3Mw24"]);
    expect(detail.albums.map(album => album.albumType)).toEqual(["album", "single"]);
    expect(detail.playlists.map(playlist => playlist.id)).toEqual(["RDCLAK5uy_n20FRYQXNt1p1wS55Nj2r14IouO5weaYU"]);
  });

  it("fills top-track durations from the tracks playlist by video id", () => {
    const { detail } = artistDetailFrom(DAFT_PUNK, {
      sections: [{ type: "MusicShelf", contents: [{ ...songRow, duration: undefined }] }],
    });

    const filled = fillTopTrackDurations(detail, new Map([["khnokW3Mw24", 338], ["other", 1]]));

    expect(filled.topTracks[0].duration).toBe(338);
  });
});

describe("playlistDetailFrom", () => {
  it("reads the owner, count and description from the responsive header and skips continuation items", () => {
    const detail = playlistDetailFrom("PLbVEkNUDhmcKodkYlYxvQ13NTsF-SX2ZA", {
      header: {
        type: "MusicResponsiveHeader",
        title: text("Daft punk radio"),
        subtitle: text("Playlist • 2022"),
        second_subtitle: text("267K views • 25 tracks • 1 hour, 46 minutes"),
        strapline_text_one: text("Jessica Wilke-Reyes"),
        description: { description: text("Best of") },
        thumbnail: { contents: [{ url: "https://yt3.ggpht.com/pl=s1200", width: 1200 }] },
      },
      items: [songRow, { type: "ContinuationItem" }],
    });

    expect(detail).toMatchObject({
      id: "PLbVEkNUDhmcKodkYlYxvQ13NTsF-SX2ZA",
      title: "Daft punk radio",
      owner: "Jessica Wilke-Reyes",
      description: "Best of",
      trackCount: 25,
      thumbnail: "https://yt3.ggpht.com/pl=s1200",
      fromYtm: false,
    });
    expect(detail.tracks.map(track => track.id)).toEqual(["khnokW3Mw24"]);
  });

  it("marks auto-generated lists as YouTube Music's and tolerates a missing header", () => {
    const detail = playlistDetailFrom("RDCLAK5uy_n20FRYQXNt1p1wS55Nj2r14IouO5weaYU", { items: [] });

    expect(detail).toMatchObject({ fromYtm: true, title: "RDCLAK5uy_n20FRYQXNt1p1wS55Nj2r14IouO5weaYU", owner: null, trackCount: null });
  });
});

describe("videosFromNodes", () => {
  it("maps plain video results and ignores other result nodes", () => {
    const videos = videosFromNodes([
      { type: "Video", id: "n61ULEU7CO0", title: text("Best of lofi hip hop 2021"), author: { name: "Lofi Girl" }, duration: { seconds: 22258 }, thumbnails: [{ url: "https://i.ytimg.com/vi/n61ULEU7CO0/hq720.jpg", width: 720 }, { url: "https://i.ytimg.com/vi/n61ULEU7CO0/hqdefault.jpg", width: 360 }] },
      { type: "ReelShelf" },
    ]);

    expect(videos).toEqual([{
      id: "n61ULEU7CO0",
      title: "Best of lofi hip hop 2021",
      uploader: "Lofi Girl",
      duration: 22258,
      thumbnail: "https://i.ytimg.com/vi/n61ULEU7CO0/hq720.jpg",
    }]);
  });
});
