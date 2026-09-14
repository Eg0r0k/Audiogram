import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { mount } from "@vue/test-utils";
import HistoryList from "../HistoryList.vue";

vi.mock("../../composables/useHistoryList", () => ({
  useHistoryList: () => ({
    entries: ref([{ eventId: "e1", track: { id: "t1" } }]),
    isEmpty: ref(false),
    isLoading: ref(false),
  }),
}));

vi.mock("../../store/queue.store", () => ({
  useQueueStore: () => ({ setQueue: vi.fn() }),
}));

describe("HistoryList", () => {
  // Same reorder slide as the library sidebar: a new play shifts the older
  // entries down instead of teleporting them.
  it("asks VirtualScrollable to animate reorders", () => {
    const wrapper = mount(HistoryList, {
      global: {
        stubs: {
          VirtualScrollable: true,
          TrackContextMenu: { template: "<div><slot /></div>" },
          TrackDropdown: true,
          TrackRow: true,
        },
      },
    });

    const scrollable = wrapper.findComponent({ name: "VirtualScrollable" });
    expect(scrollable.exists()).toBe(true);
    expect(scrollable.props("animateReorder")).toBe(true);
  });
});
