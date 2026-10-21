import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import { VueQueryPlugin } from "@tanstack/vue-query";
import MediaHeroActions from "../MediaHeroActions.vue";

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false, IS_CHROMIUM: true, IS_SAFARI: false, IS_MOBILE_SAFARI: false }));

const mount = (props: { canAddTracks?: boolean; filterable?: boolean; mobile?: boolean }) => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: {
      en: {
        media: { filter: "Filter" },
        track: { addTracks: "Add tracks" },
      },
    },
    missingWarn: false,
    fallbackWarn: false,
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { render: () => null } }],
  });

  return render(MediaHeroActions, {
    props: {
      type: "album",
      source: { type: "album", albumId: "a1" },
      hasTracks: true,
      showMenu: false,
      filter: "",
      ...props,
    },
    global: { plugins: [createPinia(), VueQueryPlugin, i18n, router] },
  });
};

describe("MediaHeroActions add tracks", () => {
  it("shows no add button unless the page can add tracks", () => {
    mount({ canAddTracks: false });

    expect(screen.queryByRole("button", { name: "Add tracks" })).toBeNull();
  });

  it("emits addTracks from the add button", async () => {
    const { emitted } = mount({ canAddTracks: true });

    await fireEvent.click(screen.getByRole("button", { name: "Add tracks" }));

    expect(emitted().addTracks).toHaveLength(1);
  });
});

describe("MediaHeroActions on a phone", () => {
  it("drops the filter", () => {
    mount({ filterable: true, mobile: true });

    expect(screen.queryByPlaceholderText("Filter")).toBeNull();
  });

  it("keeps the add button", () => {
    mount({ canAddTracks: true, mobile: true });

    expect(screen.getByRole("button", { name: "Add tracks" })).toBeInTheDocument();
  });
});
