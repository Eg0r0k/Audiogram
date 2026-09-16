import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, type Ref } from "vue";
import { mount } from "@vue/test-utils";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { errAsync, okAsync, ResultAsync } from "neverthrow";

const provider = vi.hoisted(() => ({
  setEntityLiked: vi.fn(),
}));
const registry = vi.hoisted(() => ({ provider: provider as unknown }));
vi.mock("../../registry", () => ({ sources: { find: () => registry.provider, get: () => registry.provider } }));

// Refs cannot be built inside vi.hoisted (vue is not imported yet there);
// the mock factory runs lazily and may import it.
const lists = vi.hoisted(() => ({ artists: null as { data: Ref<{ id: string }[] | undefined> } | null }));
vi.mock("../useSourceCatalog", async () => {
  const { ref: makeRef } = await import("vue");
  lists.artists = { data: makeRef<{ id: string }[] | undefined>(undefined) };
  return {
    useSourceArtists: () => lists.artists,
    useSourceAlbumsInfinite: () => ({ data: makeRef(undefined) }),
    useSourcePlaylists: () => ({ data: makeRef(undefined) }),
  };
});

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("vue-sonner", () => ({ toast }));
vi.mock("@/app/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }));

import { useEntityLike } from "../useEntityLike";

let queryClient!: QueryClient;

const mountLike = (kind: "ym" | null, id: string | null) => {
  let result!: ReturnType<typeof useEntityLike>;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mount(defineComponent({
    setup() {
      result = useEntityLike(kind, "artist", id);
      return () => h("div");
    },
  }), { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return result;
};

describe("useEntityLike", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.provider = provider;
    lists.artists!.data.value = [{ id: "ym:41075" }];
  });

  it("is unsupported for a source without entity likes, and off the local path", () => {
    registry.provider = {};
    expect(mountLike("ym", "ym:41075").supported.value).toBe(false);

    registry.provider = provider;
    expect(mountLike(null, "ym:41075").state.value).toBeUndefined();
  });

  it("reads the like off the source's liked list", () => {
    expect(mountLike("ym", "ym:41075").isLiked.value).toBe(true);
    expect(mountLike("ym", "ym:1").isLiked.value).toBe(false);
  });

  it("likes optimistically, then invalidates the list so the sidebar follows", async () => {
    provider.setEntityLiked.mockReturnValue(okAsync(undefined));
    const like = mountLike("ym", "ym:1");
    const spy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    const pending = like.toggle();
    expect(like.isLiked.value).toBe(true);
    expect(like.isPending.value).toBe(true);
    await pending;

    expect(provider.setEntityLiked).toHaveBeenCalledWith("artist", "ym:1", true);
    expect(spy).toHaveBeenCalledWith({ queryKey: ["source", "ym", "artists"] });
    expect(like.isPending.value).toBe(false);
  });

  it("rolls the heart back and toasts when the source refuses", async () => {
    provider.setEntityLiked.mockReturnValue(errAsync({ kind: "AUTH", message: "session expired" }));
    const like = mountLike("ym", "ym:41075");

    await like.toggle();
    await nextTick();

    expect(like.isLiked.value).toBe(true);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("ignores a second press while the first request is in flight", async () => {
    let release!: () => void;
    provider.setEntityLiked.mockReturnValue(ResultAsync.fromSafePromise(new Promise<void>((resolve) => { release = resolve; })));
    const like = mountLike("ym", "ym:1");
    vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    const first = like.toggle();
    const second = like.toggle();
    release();
    await Promise.all([first, second]);

    expect(provider.setEntityLiked).toHaveBeenCalledTimes(1);
  });
});
