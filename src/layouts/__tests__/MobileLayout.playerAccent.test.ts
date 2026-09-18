import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import type { ColorResult } from "@/composables/useImageColor";

const { playerColor } = vi.hoisted(() => ({
  playerColor: { value: null as unknown as { value: ColorResult } },
}));

vi.mock("@/modules/player/composables/useMobilePlayerColor", () => ({
  useMobilePlayerColor: () => ({ color: playerColor.value }),
}));
vi.mock("@/composables/useFileDrop", () => ({
  useFileDrop: () => ({ isDragging: ref(false) }),
}));
vi.mock("@/modules/library/composables/useImport", () => ({
  useImport: () => ({ importFiles: vi.fn() }),
}));
vi.mock("@/composables/useOverlayBackButton", () => ({
  useOverlayBackButton: () => {},
  registerOverlayBackHandler: () => () => {},
}));

import MobileLayout from "../MobileLayout.vue";

const NEUTRAL: ColorResult = {
  hex: "#535353",
  rgb: "rgb(83, 83, 83)",
  hsl: "hsl(0, 0%, 21%)",
  isDark: true,
};

const ORANGE: ColorResult = {
  hex: "#a24900",
  rgb: "rgb(162, 73, 0)",
  hsl: "hsl(27, 100%, 32%)",
  isDark: true,
  seeds: ["#f7750e"],
  palette: { accent: "#ffb68d", onAccent: "#532200", text: "#fbeee9", textMuted: "#d7c2b8", vivid: "#a24900" },
};

describe("MobileLayout full-player accent variables", () => {
  let wrapper: VueWrapper | null = null;

  const mountLayout = async (color: ColorResult) => {
    playerColor.value = ref({ ...color });
    wrapper = mount(MobileLayout, {
      global: {
        stubs: {
          WindowToolbar: true,
          DropOverlay: true,
          MiniPlayer: true,
          MobileBottomNav: true,
          MobileFullPlayer: true,
          MobileRightPanel: true,
          Transition: false,
        },
      },
    });
    (wrapper.vm as unknown as { open: () => void }).open();
    await nextTick();
    return wrapper.get(".full-player-bg").attributes("style") ?? "";
  };

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.restoreAllMocks();
  });

  it("passes the cover palette accent and on-accent to the wrapper", async () => {
    const style = await mountLayout(ORANGE);
    expect(style).toContain("--player-bg: hsl(27, 100%, 32%)");
    expect(style).toContain("--player-accent: #ffb68d");
    expect(style).toContain("--player-on-accent: #532200");
  });

  it("passes the cover palette text roles to the wrapper", async () => {
    const style = await mountLayout(ORANGE);
    expect(style).toContain("--player-text: #fbeee9");
    expect(style).toContain("--player-text-muted: #d7c2b8");
  });

  it("falls back to the global primary variables when the palette is absent", async () => {
    const style = await mountLayout(NEUTRAL);
    expect(style).toContain("--player-accent: var(--primary)");
    expect(style).toContain("--player-on-accent: var(--primary-foreground)");
    expect(style).toContain("--player-text: var(--foreground)");
    expect(style).toContain("--player-text-muted: var(--muted-foreground)");
  });

  // `--primary: var(--player-accent)` must live on a descendant of the wrapper
  // that carries `--player-accent: var(--primary)`; on the same element the two
  // declarations form a var() cycle and both compute to invalid (transparent).
  it("overrides --primary on the player element, not on the wrapper", async () => {
    await mountLayout(NEUTRAL);
    const wrapper$ = wrapper!.get(".full-player-bg");
    expect(wrapper$.classes()).not.toContain("full-player-accent");
    expect(wrapper$.find(".full-player-accent").exists()).toBe(true);
  });

  it("follows a palette change on the same open player", async () => {
    await mountLayout(NEUTRAL);
    playerColor.value.value = { ...ORANGE };
    await nextTick();
    expect(wrapper!.get(".full-player-bg").attributes("style")).toContain("--player-accent: #ffb68d");
  });
});
