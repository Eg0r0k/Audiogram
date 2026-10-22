import { describe, expect, it } from "vitest";
import { computed, ref } from "vue";
import { mount } from "@vue/test-utils";
import MarqueeBlock from "@/components/ui/marquee/MarqueeBlock.vue";
import { layout, movingLoops, useMarqueeFakes } from "@/components/ui/marquee/__tests__/marquee-fakes";
import MiniPlayerCard from "../MiniPlayerCard.vue";
import MiniPlayerProgress from "../MiniPlayerProgress.vue";
import { miniPlayerProgressKey } from "../mini-player-context";

const progress = ref(0);

const mountCard = (props: Record<string, unknown> = {}) => mount(MiniPlayerCard, {
  props: {
    title: "T",
    artist: "A",
    background: "rgb(20, 20, 20)",
    progressBackground: "rgb(10, 30, 40)",
    showProgress: true,
    ...props,
  },
  global: {
    provide: { [miniPlayerProgressKey as symbol]: computed(() => progress.value) },
    stubs: {
      NuxtImage: true,
      MarqueeBlock: { template: "<div><slot /></div>" },
    },
  },
});

describe("MiniPlayerCard progress", () => {
  // The played part is the card's own background, not a hairline at the
  // bottom: it is scaled rather than sized so a repaint every frame costs no
  // layout of the card's row.
  it("scales the fill to the progress value", () => {
    progress.value = 40;
    const fill = mountCard().getComponent(MiniPlayerProgress);

    expect(fill.attributes("style")).toContain("scaleX(0.4)");
    expect(fill.attributes("style")).toContain("rgb(10, 30, 40)");
  });

  it("paints no fill on the neighbour cards", () => {
    expect(mountCard({ showProgress: false }).findComponent(MiniPlayerProgress).exists()).toBe(false);
  });
});

describe("MiniPlayerCard title", () => {
  useMarqueeFakes();

  // On Android WebView a running marquee redraws the whole app on every
  // display frame, playing or paused; the line has to come to rest.
  it("scrolls a long title twice, then rests", async () => {
    const wrapper = mount(MiniPlayerCard, {
      props: { title: "A very long title", artist: "A", background: "#000", progressBackground: "#111", showProgress: false },
      global: { stubs: { NuxtImage: true } },
      attachTo: document.body,
    });
    await wrapper.vm.$nextTick();
    const [title] = wrapper.findAllComponents(MarqueeBlock);
    layout(title!, { container: 200, text: 400 });
    await wrapper.vm.$nextTick();

    await movingLoops()[0]!.finish();
    await movingLoops()[1]!.finish();

    expect(movingLoops()).toHaveLength(2);
  });
});
