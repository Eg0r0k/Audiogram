import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The progress ticks up to every display frame on a short track; only the bar
// has to follow it, not the whole footer with the track info and controls.

const progress = ref(10);

vi.mock("@/modules/tracks/composables/usePlayerProgress", () => ({
  usePlayerProgress: () => ({
    displayProgress: progress,
    isTransitionEnabled: ref(true),
    onScrubStart: vi.fn(),
    onScrub: vi.fn(),
    onScrubEnd: vi.fn(),
  }),
}));
vi.mock("@/modules/tracks/composables/useCurrentTrackChapters", () => ({
  useCurrentTrackChapters: () => ({ chapters: ref([]) }),
}));

import FooterMediaPlayer from "../FooterMediaPlayer.vue";

const mountFooter = () => {
  let footerUpdates = 0;
  const wrapper = mount(FooterMediaPlayer, {
    global: {
      stubs: {
        SidebarMusic: true,
        PlayBarControls: true,
        SidebarControls: true,
        RangeSelector: { props: ["modelValue"], template: "<div class=\"range\" :data-value=\"modelValue\" />" },
      },
      mixins: [{
        beforeUpdate(this: { $options: { __name?: string } }) {
          if (this.$options.__name === "FooterMediaPlayer") footerUpdates++;
        },
      }],
    },
  });
  return { wrapper, footerUpdates: () => footerUpdates };
};

beforeEach(() => {
  setActivePinia(createPinia());
  progress.value = 10;
});

describe("FooterMediaPlayer progress", () => {
  it("moves the bar without re-rendering the footer", async () => {
    const { wrapper, footerUpdates } = mountFooter();

    progress.value = 55;
    await nextTick();

    expect(wrapper.find(".range").attributes("data-value")).toBe("55");
    expect(footerUpdates()).toBe(0);
  });
});
