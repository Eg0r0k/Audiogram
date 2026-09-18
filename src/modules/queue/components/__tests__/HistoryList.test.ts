import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { mount } from "@vue/test-utils";
import { createI18n } from "vue-i18n";
import CrossfadeTransition from "@/components/transitions/CrossfadeTransition.vue";
import { Spinner } from "@/components/ui/spinner";
import HistoryList from "../HistoryList.vue";

// `ref` cannot be called inside vi.hoisted — it runs before the imports.
const { history } = vi.hoisted(() => ({
  history: { state: null as unknown as ReturnType<typeof makeState> },
}));

const makeState = ({ loading = false, empty = false } = {}) => ({
  entries: ref([{ eventId: "e1", track: { id: "t1" } }]),
  isEmpty: ref(empty),
  isLoading: ref(loading),
});

vi.mock("../../composables/useHistoryList", () => ({
  useHistoryList: () => history.state,
}));

vi.mock("../../store/queue.store", () => ({
  useQueueStore: () => ({ setQueue: vi.fn() }),
}));

vi.mock("@/composables/useClearHistory", () => ({
  useClearHistory: () => ({ clearHistory: vi.fn() }),
}));

const mountList = (options: { loading?: boolean; empty?: boolean } = {}) => {
  history.state = makeState(options);
  return mount(HistoryList, {
  global: {
    plugins: [createI18n({ legacy: false, locale: "en", messages: { en: {} } })],
    stubs: {
      VirtualScrollable: true,
      TrackContextMenu: { template: "<div><slot /></div>" },
      TrackDropdown: true,
      TrackRow: true,
      HistoryEmpty: true,
      },
    },
  });
};

describe("HistoryList", () => {
  // Same reorder slide as the library sidebar: a new play shifts the older
  // entries down instead of teleporting them.
  it("asks VirtualScrollable to animate reorders", () => {
    const wrapper = mountList();

    const scrollable = wrapper.findComponent({ name: "VirtualScrollable" });
    expect(scrollable.exists()).toBe(true);
    expect(scrollable.props("animateReorder")).toBe(true);
  });

  // Same crossfade as the library sidebar: the spinner and the list share one
  // grid cell, so the swap has no blank frame.
  it("crossfades from the spinner to the list", async () => {
    const wrapper = mountList({ loading: true });

    const crossfade = wrapper.findComponent(CrossfadeTransition);
    expect(crossfade.exists()).toBe(true);
    expect(crossfade.findComponent(Spinner).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "VirtualScrollable" }).exists()).toBe(false);

    history.state.isLoading.value = false;
    await nextTick();

    expect(crossfade.findComponent({ name: "VirtualScrollable" }).exists()).toBe(true);
  });

  it("crossfades to the empty state", async () => {
    const wrapper = mountList({ loading: true, empty: true });

    history.state.isLoading.value = false;
    await nextTick();

    const crossfade = wrapper.findComponent(CrossfadeTransition);
    expect(crossfade.findComponent({ name: "HistoryEmpty" }).exists()).toBe(true);
  });
});
