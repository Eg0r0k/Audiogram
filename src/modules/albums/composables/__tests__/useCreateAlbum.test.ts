import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtistId } from "@/types/ids";
import { routeLocation } from "@/app/router/route-locations";

const { createAlbumAndSync, push, queryClient } = vi.hoisted(() => ({
  createAlbumAndSync: vi.fn(),
  push: vi.fn(() => Promise.resolve()),
  queryClient: { tag: "qc" },
}));

vi.mock("@/queries/album.queries", () => ({ createAlbumAndSync }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));
vi.mock("@tanstack/vue-query", () => ({ useQueryClient: () => queryClient }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => `t:${key}` }) }));

import { useCreateAlbum } from "../useCreateAlbum";

describe("useCreateAlbum", () => {
  beforeEach(() => {
    createAlbumAndSync.mockReset();
    push.mockClear();
  });

  it("creates a default-named album for the artist and opens it", async () => {
    createAlbumAndSync.mockResolvedValue({ id: "album-1" });
    const createAlbum = useCreateAlbum();

    await createAlbum(ArtistId("artist-1"));

    expect(createAlbumAndSync).toHaveBeenCalledWith(queryClient, "artist-1", "t:album.newAlbum");
    expect(push).toHaveBeenCalledWith(routeLocation.album("album-1"));
  });
});
