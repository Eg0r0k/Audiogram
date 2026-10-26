import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computed, defineComponent, h, shallowRef } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { db } from "@/db";
import { saveTrackChapters } from "@/queries/trackChapters.queries";
import { TrackId } from "@/types/ids";
import { useTrackChapters } from "../useTrackChapters";

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useTrackChapters", () => {
  let wrapper: VueWrapper | undefined;

  const mountChapters = (trackId: () => TrackId) => {
    let api!: ReturnType<typeof useTrackChapters>;
    wrapper = mount(defineComponent({
      setup() {
        api = useTrackChapters(computed(trackId));
        return () => h("div");
      },
    }), { global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] } });
    return api;
  };

  beforeEach(async () => {
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("useTrackChapters: follows the row after a write", async () => {
    const { data } = mountChapters(() => TrackId("t1"));
    await until(() => data.value !== undefined);
    expect(data.value).toEqual([]);

    await saveTrackChapters(new QueryClient(), TrackId("t1"), [{ time: 5, title: "Intro" }]);

    await until(() => data.value?.length === 1);
    expect(data.value).toEqual([{ time: 5, title: "Intro" }]);
  });

  it("does not show the previous track's chapters while the next track's are read", async () => {
    await db.trackChapters.add({ trackId: TrackId("t1"), chapters: [{ time: 5, title: "Intro" }], updatedAt: 1 });
    const trackId = shallowRef(TrackId("t1"));
    const { data } = mountChapters(() => trackId.value);
    await until(() => data.value?.length === 1);

    trackId.value = TrackId("t2");

    expect(data.value).toBeUndefined();
    await until(() => data.value !== undefined);
    expect(data.value).toEqual([]);
  });
});
