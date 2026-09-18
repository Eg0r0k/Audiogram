import { describe, expect, it } from "vitest";
import { computed, ref } from "vue";
import { mount } from "@vue/test-utils";
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
    gradientColor: "rgb(30, 30, 30)",
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
