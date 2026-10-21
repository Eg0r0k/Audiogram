import { describe, expect, it } from "vitest";
import { render } from "@testing-library/vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import MediaHeroMeta from "../MediaHeroMeta.vue";
import type { MediaData } from "@/types/media-data";

const album = (releaseYear: number) => ({
  type: "album",
  id: "a1",
  title: "Discovery",
  image: "",
  artistId: "ar1",
  artistName: "Daft Punk",
  releaseYear,
  trackCount: 14,
  duration: "1 h 1 min",
}) as unknown as MediaData;

const mount = (data: MediaData, stacked: boolean) => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en: { common: { trackCount: "{count} tracks" } } },
    missingWarn: false,
    fallbackWarn: false,
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", name: "artist", component: { render: () => null } }],
  });
  return render(MediaHeroMeta, {
    props: { data, stacked, typeLabel: "Album" },
    global: { plugins: [i18n, router] },
  });
};

// Separators sit in spans of their own and the gap draws the spacing, so the raw text has none.
const text = (el: Element) => el.textContent?.replace(/\s*·\s*/g, " · ").replace(/\s+/g, " ").trim();
const lines = (container: Element) => [...container.firstElementChild!.children].map(text);

describe("MediaHeroMeta", () => {
  it("stacks the artist over the type-led details on a phone", () => {
    const { container } = mount(album(2001), true);

    expect(lines(container)).toEqual(["Daft Punk", "Album · 2001 · 14 tracks · 1 h 1 min"]);
  });

  it("leaves an unknown year out instead of printing 0", () => {
    const { container } = mount(album(0), true);

    expect(lines(container)[1]).toBe("Album · 14 tracks · 1 h 1 min");
  });

  it("keeps one line led by the artist on desktop", () => {
    const { container } = mount(album(2001), false);

    expect(text(container.firstElementChild!)).toBe("Daft Punk · 2001 · 14 tracks · 1 h 1 min");
  });
});
