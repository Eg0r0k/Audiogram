import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { VueQueryPlugin } from "@tanstack/vue-query";
import MediaHeroActions from "../MediaHeroActions.vue";
import type { EntityLikeState } from "@/modules/sources/composables/useEntityLike";

vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: false, IS_CHROMIUM: true, IS_SAFARI: false, IS_MOBILE_SAFARI: false }));

const mount = (like?: EntityLikeState) => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en: { media: { like: "Like", unlike: "Remove from liked" } } },
    missingWarn: false,
    fallbackWarn: false,
  });
  return render(MediaHeroActions, {
    props: { type: "artist", source: { type: "artist", artistId: "a1" }, hasTracks: true, showMenu: false, like },
    global: { plugins: [createPinia(), VueQueryPlugin, i18n] },
  });
};

describe("MediaHeroActions like", () => {
  it("shows no heart without a like state", () => {
    mount(undefined);

    expect(screen.queryByRole("button", { name: /like/i })).toBeNull();
  });

  it("labels the heart by its state and toggles on click", async () => {
    const toggle = vi.fn();
    mount({ isLiked: false, isPending: false, toggle });

    const heart = screen.getByRole("button", { name: "Like" });
    await fireEvent.click(heart);

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("names the filled heart 'unlike' and disables it while pending", () => {
    mount({ isLiked: true, isPending: true, toggle: vi.fn() });

    const heart = screen.getByRole("button", { name: "Remove from liked" });
    expect((heart as HTMLButtonElement).disabled).toBe(true);
  });
});
