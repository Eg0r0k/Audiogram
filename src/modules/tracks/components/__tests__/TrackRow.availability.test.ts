import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/vue";
import { createPinia } from "pinia";
import { i18n } from "@/app/i18n";
import { TrackSource, TrackState } from "@/db/entities";
import { setMediaServerBaseForTests } from "@/lib/stream-url";
import type { Track } from "@/modules/player/types";
import type { SourceTrackDTO } from "@/types/source-dto";
import TrackRow from "../TrackRow.vue";
import { sources } from "@/modules/sources/registry";
import { ndSourceProvider } from "@/modules/sources/navidrome/provider";

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false }));

// Bootstrap registers the providers (src/main.ts); the row asks the registry about its source.
sources.register(ndSourceProvider);
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/tracks/composables/useTrackMenu", () => ({
  useTrackMenu: () => ({ openMenu: vi.fn(), openDropdown: vi.fn(), isMenuOpenFor: () => false }),
}));
vi.mock("@/modules/tracks/composables/useToggleTrackLike", () => ({
  useToggleTrackLike: () => ({ toggleTrackLike: vi.fn() }),
}));

setMediaServerBaseForTests("http://127.0.0.1:4321/tok");

const catalogRow = (availability: SourceTrackDTO["availability"]): Track => ({
  kind: "library",
  id: "nd:s1" as Track["id"],
  title: "Locked Song",
  artist: "Artist",
  artistIds: [],
  albumId: "" as Track["albumId"],
  albumName: "",
  storagePath: "",
  source: TrackSource.REMOTE_SUBSONIC,
  state: TrackState.READY,
  duration: 200,
  isLiked: false,
  sourceDto: { id: "nd:s1" as Track["id"], title: "Locked Song", coverRef: "c1", availability },
});

const renderRow = (track: Track) =>
  render(TrackRow, {
    props: { track, index: 1 },
    global: {
      plugins: [createPinia(), i18n],
      directives: { ripple: {} },
      stubs: { SourceDownloadButton: true, NuxtImage: true, BlurSwapTransition: true },
    },
  });

const rowOf = () => screen.getByText("Locked Song").closest("[data-track-row]") as HTMLElement;

describe("TrackRow — catalog availability", () => {
  it("renders an unavailable row disabled and swallows the click", async () => {
    const { emitted } = renderRow(catalogRow("unavailable"));

    const row = rowOf();
    expect(row).toHaveAttribute("aria-disabled", "true");

    await fireEvent.click(row);

    expect(emitted().play).toBeUndefined();
  });

  it("marks a preview row and still lets it play", async () => {
    const { emitted } = renderRow(catalogRow("preview"));

    expect(screen.getByText(/preview/i)).toBeInTheDocument();

    await fireEvent.click(rowOf());

    expect(emitted().play).toHaveLength(1);
  });

  it("leaves a fully available row as it was", async () => {
    const { emitted } = renderRow(catalogRow(undefined));

    const row = rowOf();
    expect(row).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();

    await fireEvent.click(row);

    expect(emitted().play).toHaveLength(1);
  });
});
