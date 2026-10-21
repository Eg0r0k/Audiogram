import { fireEvent, render, screen } from "@testing-library/vue";
import { flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { summonDialog } from "@/components/dialogs/summonDialog";
import StorageSettings from "../StorageSettings.vue";

const storage = vi.hoisted(() => ({
  refresh: vi.fn<() => Promise<void>>(),
  clearAllData: vi.fn<() => Promise<void>>(),
  clearLyricsData: vi.fn<() => Promise<void>>(),
  clearTimingsData: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/modules/settings/store/storage", () => ({
  useStorageSettings: () => ({
    ...storage,
    info: ref(null),
    isLoading: ref(false),
    isClearing: ref(false),
    formatted: ref({ storagePath: "-", totalUsed: "-", tracksCount: 0, albumsCount: 0, artistsCount: 0, listensCount: 0 }),
  }),
}));
vi.mock("@/components/dialogs/summonDialog", () => ({ summonDialog: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }));
vi.mock("@/modules/recommendations/service/recommender-context.service", () => ({ markRecommenderContextDirty: vi.fn() }));
vi.mock("@/modules/recommendations/service/recommender-model.service", () => ({ invalidateWeightsCache: vi.fn() }));

const slot = { template: "<div><slot /></div>" };

const renderPage = () => render(StorageSettings, {
  global: {
    plugins: [i18n],
    stubs: { SettingsScreen: slot, SettingsGroup: slot },
    directives: { copy: {}, ripple: {} },
  },
});

const summoned = () => vi.mocked(summonDialog).mock.calls.map(([key]) => key);

describe("StorageSettings", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    vi.mocked(summonDialog).mockReset();
    storage.refresh.mockReset().mockResolvedValue(undefined);
    storage.clearLyricsData.mockReset().mockResolvedValue(undefined);
    storage.clearTimingsData.mockReset().mockResolvedValue(undefined);
  });

  it("asks before clearing the listening history and analysis", async () => {
    renderPage();
    await fireEvent.click(screen.getByRole("button", { name: "Clear listen history, audio features, and chapter data" }));
    await flushPromises();

    expect(summoned()).toEqual(["confirmWipe"]);
    expect(storage.clearTimingsData).not.toHaveBeenCalled();
  });

  it("asks before deleting the lyrics", async () => {
    renderPage();
    await fireEvent.click(screen.getByRole("button", { name: "Delete lyrics" }));
    await flushPromises();

    expect(summoned()).toEqual(["confirmWipe"]);
    expect(storage.clearLyricsData).not.toHaveBeenCalled();
  });

  it("says when the storage usage could not be counted and counts again on retry", async () => {
    storage.refresh.mockRejectedValueOnce(new Error("quota"));
    renderPage();
    await flushPromises();

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't count the storage used");
    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flushPromises();

    expect(storage.refresh).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
