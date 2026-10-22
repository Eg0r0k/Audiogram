import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { shallowRef } from "vue";
import { i18n } from "@/app/i18n";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import { layout, movingLoops, useMarqueeFakes } from "@/components/ui/marquee/__tests__/marquee-fakes";

const currentTrack = shallowRef<{ id: string; title: string; artist: string } | null>(null);

vi.mock("@/modules/player/composables/useCurrentPlayerTrack", () => ({
  useCurrentPlayerTrack: () => ({ currentTrack, libraryTrack: shallowRef(null) }),
}));
vi.mock("@/modules/tracks/composables/useToggleTrackLike", () => ({
  useToggleTrackLike: () => ({ toggleTrackLike: vi.fn() }),
}));
vi.mock("@/modules/tracks/composables/useTrackContextActions", () => ({
  useTrackContextActions: () => ({ goToArtist: vi.fn() }),
}));

import MobileFullPlayerTrackInfo from "../MobileFullPlayerTrackInfo.vue";

const mountInfo = async () => {
  const wrapper = mount(MobileFullPlayerTrackInfo, { global: { plugins: [i18n] }, attachTo: document.body });
  await wrapper.vm.$nextTick();
  return wrapper;
};

const overflowTitle = async (wrapper: Awaited<ReturnType<typeof mountInfo>>) => {
  const [title] = wrapper.findAllComponents(MarqueeBlock);
  layout(title!, { container: 200, text: 400 });
  await wrapper.vm.$nextTick();
};

describe("MobileFullPlayerTrackInfo title", () => {
  useMarqueeFakes();

  it("scrolls a long title twice, then rests", async () => {
    currentTrack.value = { id: "t1", title: "A very long title", artist: "A" };
    const wrapper = await mountInfo();
    await overflowTitle(wrapper);

    await movingLoops()[0]!.finish();
    await movingLoops()[1]!.finish();

    expect(movingLoops()).toHaveLength(2);
  });

  it("scrolls the next track's title again, even at the same width", async () => {
    currentTrack.value = { id: "t1", title: "A very long title", artist: "A" };
    const wrapper = await mountInfo();
    await overflowTitle(wrapper);
    await movingLoops()[0]!.finish();
    await movingLoops()[1]!.finish();

    currentTrack.value = { id: "t2", title: "Another long title", artist: "A" };
    await wrapper.vm.$nextTick();
    await overflowTitle(wrapper);

    expect(movingLoops()).toHaveLength(3);
  });
});
