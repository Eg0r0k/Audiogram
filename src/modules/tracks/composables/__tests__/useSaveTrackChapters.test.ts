import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, effectScope } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { toaster } from "@/app/toaster";
import type { TrackId } from "@/types/ids";
import { shownToasts } from "@/test/toasts";

const saveTrackChapters = vi.hoisted(() => vi.fn());

vi.mock("@/queries/trackChapters.queries", () => ({ saveTrackChapters, trackChaptersQueries: {} }));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn(), remove: vi.fn() } }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/app/i18n", () => ({ i18n: { global: { t: (key: string) => key } } }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

import { useSaveTrackChapters } from "../useTrackChapters";

const save = { trackId: "t1" as TrackId, chapters: [{ time: 5, title: "Intro" }] };

const setup = () => {
  const app = createApp({ render: () => null });
  app.use(VueQueryPlugin, { queryClient: new QueryClient() });
  let api!: ReturnType<typeof useSaveTrackChapters>;
  app.runWithContext(() => {
    effectScope().run(() => {
      api = useSaveTrackChapters();
    });
  });
  return api;
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("useSaveTrackChapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a failed save with a retry that saves the same chapters again", async () => {
    saveTrackChapters.mockRejectedValueOnce(new Error("quota")).mockResolvedValueOnce(undefined);
    const { mutate } = setup();

    mutate(save);
    await flush();

    const [failure] = shownToasts("destructive");
    expect(failure.title).toBe("chapters.saveFailed");
    expect(failure.actions?.[0]?.label).toBe("common.retry");

    failure.actions?.[0]?.onClick?.(new MouseEvent("click"));
    await flush();

    expect(saveTrackChapters).toHaveBeenCalledTimes(2);
    expect(saveTrackChapters.mock.calls[1]?.[1]).toBe(save.trackId);
    expect(saveTrackChapters.mock.calls[1]?.[2]).toEqual(save.chapters);
  });

  it("keeps repeated failures of one track in one toast", async () => {
    saveTrackChapters.mockRejectedValue(new Error("quota"));
    const { mutate } = setup();

    mutate(save);
    await flush();
    mutate(save);
    await flush();

    const [first, second] = shownToasts("destructive");
    expect(first.id).toBeDefined();
    expect(second.id).toBe(first.id);
  });

  it("takes the failure down once a later save of that track succeeds", async () => {
    saveTrackChapters.mockRejectedValueOnce(new Error("quota")).mockResolvedValueOnce(undefined);
    const { mutate } = setup();

    mutate(save);
    await flush();
    const failureId = shownToasts("destructive")[0]?.id;
    mutate(save);
    await flush();

    expect(vi.mocked(toaster.remove)).toHaveBeenCalledWith(failureId);
  });
});
