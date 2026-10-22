import { flushPromises, mount } from "@vue/test-utils";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import { createI18n } from "vue-i18n";
import { useImageColor } from "@/composables/useImageColor";
import { artistFallbackUrl, coverGradient, mascotCoverUrl } from "@/modules/covers/lib/placeholder";
import type { AlbumId, ArtistId } from "@/types/ids";
import type { MediaData } from "@/types/media-data";
import MediaHeader from "../MediaHeader.vue";
import MediaHero from "../MediaHero.vue";
import MediaHeroImage from "../MediaHeroImage.vue";

const slotStub = { template: "<div><slot /></div>" };

const mountHero = (data: MediaData) => mount(MediaHero, {
  props: { data },
  global: {
    plugins: [createPinia(), VueQueryPlugin, createI18n({ legacy: false, locale: "en", missingWarn: false, fallbackWarn: false })],
    stubs: { MediaContextMenu: slotStub, MediaHeader: true, MediaHeroImage: true, MediaHeroMeta: true, MediaHeroActions: true },
  },
});

const placeholderHeroColor = (id: string) => {
  const { color, setColorFromHex } = useImageColor();
  setColorFromHex(coverGradient(id).bottom);
  return color.value.palette?.vivid;
};

const album = (id: string): MediaData => ({
  type: "album",
  id: id as AlbumId,
  title: "Album",
  image: "",
  artistName: "Artist",
  artistId: "r1" as ArtistId,
  releaseYear: 2020,
  trackCount: 1,
});

describe("MediaHero without artwork", () => {
  it("shows the album's mascot and takes the hero colour from it", async () => {
    const hero = mountHero(album("a1"));
    await flushPromises();

    expect(hero.findComponent(MediaHeroImage).props("fallbackSrc")).toBe(mascotCoverUrl("a1"));
    expect(hero.findComponent(MediaHeader).props("color")).toBe(placeholderHeroColor("a1"));
  });

  it("shows the artist glyph and takes the hero colour from its gradient", async () => {
    const hero = mountHero({ type: "artist", id: "r1" as ArtistId, title: "Artist", image: "", monthlyListeners: 0 });
    await flushPromises();

    expect(hero.findComponent(MediaHeroImage).props("fallbackSrc")).toBe(artistFallbackUrl("r1"));
    expect(hero.findComponent(MediaHeader).props("color")).toBe(placeholderHeroColor("r1"));
  });
});
