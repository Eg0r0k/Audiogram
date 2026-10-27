import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h, shallowRef, type Ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { i18n } from "@/app/i18n";
import { db } from "@/db";
import type { PlaylistEntity } from "@/db/entities";
import { updatePlaylistAndSync } from "@/queries/playlist.queries";
import { PlaylistId } from "@/types/ids";
import { usePlaylistMenu } from "../usePlaylistMenu";

const ROW: PlaylistEntity = { id: PlaylistId("p1"), name: "Road trip", trackIds: [], addedAt: 1, updatedAt: 1 };

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("usePlaylistMenu", () => {
  let wrapper: VueWrapper | undefined;

  const mountMenu = (enabled?: Ref<boolean>) => {
    let api!: ReturnType<typeof usePlaylistMenu>;
    wrapper = mount(defineComponent({
      setup() {
        api = usePlaylistMenu(enabled ? { enabled } : {});
        return () => h("div");
      },
    }), { global: { plugins: [i18n, [VueQueryPlugin, { queryClient: new QueryClient() }]] } });
    return api;
  };

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
    await db.playlists.add(ROW);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("usePlaylistMenu: follows the row after a write", async () => {
    const api = mountMenu();
    await until(() => api.playlists.value.length === 1);
    expect(api.playlists.value).toEqual([{ id: "p1", name: "Road trip" }]);
    expect(api.isLoading.value).toBe(false);

    await updatePlaylistAndSync(ROW, { name: "Night drive" });

    await until(() => api.playlists.value[0]?.name === "Night drive");
    expect(api.playlists.value).toEqual([{ id: "p1", name: "Night drive" }]);
  });

  it("reads nothing until it is enabled", async () => {
    const enabled = shallowRef(false);
    const api = mountMenu(enabled);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(api.playlists.value).toEqual([]);

    enabled.value = true;

    await until(() => api.playlists.value.length === 1);
  });
});
