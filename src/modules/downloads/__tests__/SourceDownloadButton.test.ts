import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { TrackSource, TrackState } from "@/db/entities";
import { AlbumId, TrackId } from "@/types/ids";
import type { SourceTrackDTO } from "@/modules/sources/types";
import { downloadSubject } from "../service/enqueue";
import { removeLocalCopy } from "../service/removeCopy";
import SourceDownloadButton from "../components/SourceDownloadButton.vue";
import { shownToasts } from "@/test/toasts";

vi.mock("../service/enqueue", () => ({
  downloadSubject: vi.fn(),
}));

vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));

vi.mock("@/db/storage", async () => {
  const { okAsync } = await import("neverthrow");
  return { storageService: { deleteFile: vi.fn(() => okAsync(undefined)) } };
});

const dto: SourceTrackDTO = {
  id: TrackId("yt:abc123def45"),
  title: "T",
};

function renderButton() {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en: {} },
    missingWarn: false,
    fallbackWarn: false,
  });
  return render(SourceDownloadButton, {
    props: { dto },
    global: {
      plugins: [createPinia(), VueQueryPlugin, i18n],
    },
  });
}

describe("SourceDownloadButton", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  it("queues a download for the row dto", async () => {
    vi.mocked(downloadSubject).mockResolvedValue("job-1");
    renderButton();

    const button = await screen.findByRole("button");
    button.click();
    await Promise.resolve();

    expect(downloadSubject).toHaveBeenCalledWith({ kind: "remote", dto });
    expect(shownToasts("info")).toHaveLength(0);
  });

  it("tells the user when nothing needs downloading (copy already exists)", async () => {
    // downloadSubject returns null when an offline copy is already present —
    // e.g. the click landed while the hasCopy query was still loading.
    vi.mocked(downloadSubject).mockResolvedValue(null);
    renderButton();

    const button = await screen.findByRole("button");
    button.click();
    await vi.waitFor(() => {
      expect(shownToasts("info")).toHaveLength(1);
    });
  });

  it("SourceDownloadButton: follows the row after a write", async () => {
    await db.tracks.add({
      id: TrackId("t-copy"),
      title: "T",
      artistName: "",
      albumTitle: "",
      artistIds: [],
      albumId: AlbumId(""),
      tagIds: [],
      source: TrackSource.LOCAL_INTERNAL,
      sourceRef: dto.id,
      pinned: 1,
      state: TrackState.READY,
      storagePath: "tracks/t-copy.m4a",
      duration: 100,
      format: {},
      playCount: 0,
      addedAt: 1,
    });
    renderButton();
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());

    await removeLocalCopy(dto.id);

    expect(await screen.findByRole("button")).toBeInTheDocument();
  });
});
