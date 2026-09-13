import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { VueQueryPlugin } from "@tanstack/vue-query";
import MediaHeroActions from "../MediaHeroActions.vue";

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false, IS_CHROMIUM: true, IS_SAFARI: false, IS_MOBILE_SAFARI: false }));

const mount = (filterable: boolean) => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en: { media: { filter: "Filter", filterClear: "Clear filter" } } },
    missingWarn: false,
    fallbackWarn: false,
  });

  return render(MediaHeroActions, {
    props: {
      type: "album",
      source: { type: "album", albumId: "a1" },
      hasTracks: true,
      showMenu: false,
      filterable,
      filter: "",
    },
    global: { plugins: [createPinia(), VueQueryPlugin, i18n] },
  });
};

describe("MediaHeroActions filter", () => {
  it("renders no input unless filterable", () => {
    mount(false);

    expect(screen.queryByPlaceholderText("Filter")).toBeNull();
  });

  it("reports typing through the filter model and clears on Escape", async () => {
    const { emitted } = mount(true);
    const input = screen.getByPlaceholderText("Filter");

    await fireEvent.update(input, "abba");
    await fireEvent.keyDown(input, { key: "Escape" });

    expect(emitted("update:filter")).toEqual([["abba"], [""]]);
  });
});
