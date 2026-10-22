import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { artistFallbackUrl, mascotCoverUrl } from "@/modules/covers/lib/placeholder";
import EntityCoverImage from "../EntityCoverImage.vue";

const cover = vi.hoisted(() => ({ url: undefined as string | undefined, isLoading: false }));

vi.mock("@/modules/covers/composables/useEntityCover", async () => {
  const { computed } = await import("vue");
  return {
    useEntityCover: () => ({
      url: computed(() => cover.url),
      isLoading: computed(() => cover.isLoading),
    }),
  };
});

const renderImage = (props: InstanceType<typeof EntityCoverImage>["$props"]) =>
  mount(EntityCoverImage, { props, global: { stubs: { NuxtImage: true } } }).findComponent(NuxtImage);

beforeEach(() => {
  cover.url = undefined;
  cover.isLoading = false;
});

describe("EntityCoverImage", () => {
  it("draws no placeholder while the cover lookup is pending", () => {
    cover.isLoading = true;

    const image = renderImage({ ownerType: "album", ownerId: "a1", alt: "Album" });

    expect(image.props("src")).not.toBe(mascotCoverUrl("a1"));
    expect(image.props("src")).not.toContain("fallback.svg");
    expect(image.classes()).toContain("bg-muted");
  });

  it("shows the mascot of the id once the lookup finds no cover", () => {
    expect(renderImage({ ownerType: "playlist", ownerId: "p1", alt: "Playlist" }).props("src"))
      .toBe(mascotCoverUrl("p1"));
    expect(renderImage({ ownerType: "artist", ownerId: "r1", alt: "Artist" }).props("src"))
      .toBe(artistFallbackUrl("r1"));
  });

  it("shows the stored cover and falls back to the placeholder if it fails to load", () => {
    cover.url = "blob:cover";

    const image = renderImage({ ownerType: "album", ownerId: "a1", alt: "Album" });

    expect(image.props("src")).toBe("blob:cover");
    expect(image.props("fallbackSrc")).toBe(mascotCoverUrl("a1"));
    expect(image.classes()).not.toContain("bg-muted");
  });

  it("puts the caller's fallback before the placeholder, even while loading", () => {
    cover.isLoading = true;

    const image = renderImage({ ownerType: "album", ownerId: "a1", alt: "Album", fallbackSrc: "https://art/a1.jpg" });

    expect(image.props("src")).toBe("https://art/a1.jpg");
    expect(image.props("fallbackSrc")).toBe(mascotCoverUrl("a1"));
  });
});
