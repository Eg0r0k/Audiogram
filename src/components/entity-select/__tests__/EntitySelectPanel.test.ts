import { render, fireEvent } from "@testing-library/vue";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import EntitySelectPanel from "../EntitySelectPanel.vue";

const scrollToIndex = vi.fn();

const VirtualScrollableStub = {
  props: ["items"],
  methods: { scrollToIndex },
  template: `
    <div>
      <template v-if="items.length">
        <div v-for="(item, index) in items" :key="index">
          <slot :item="item" :index="index" />
        </div>
      </template>
      <slot v-else name="empty" />
    </div>`,
};

const stubs = {
  RightPanelHeader: true,
  VirtualScrollable: VirtualScrollableStub,
  AddFloatingButton: {
    props: ["count", "show"],
    emits: ["click"],
    template: `<button v-if="show" data-testid="fab" @click="$emit('click')">{{ count }}</button>`,
  },
};

const renderPanel = (props: Record<string, unknown> = {}) =>
  render(EntitySelectPanel, {
    props: {
      title: "T",
      items: [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }],
      getKey: (item: { id: string }) => item.id,
      search: "",
      ...props,
    },
    slots: { row: `<template #row="{ item }"><span data-testid="row">{{ item.name }}</span></template>` },
    global: { plugins: [i18n], stubs },
  });

describe("EntitySelectPanel", () => {
  beforeEach(() => {
    scrollToIndex.mockReset();
  });

  describe("revealKey", () => {
    const items = [{ id: "a", name: "Alpha" }, { id: "b", name: "Beta" }, { id: "c", name: "Gamma" }];

    it("scrolls the revealed item into the middle once its row is in the list", async () => {
      const { rerender } = renderPanel({ items: [], revealKey: "c" });
      expect(scrollToIndex).not.toHaveBeenCalled();

      await rerender({ items });
      await nextTick();

      expect(scrollToIndex).toHaveBeenCalledWith(2, { align: "center" });
    });

    it("reveals only once: a later list (a search) keeps its own scroll", async () => {
      const { rerender } = renderPanel({ items, revealKey: "c" });
      await nextTick();
      expect(scrollToIndex).toHaveBeenCalledTimes(1);

      await rerender({ items: [items[2]] });
      await nextTick();

      expect(scrollToIndex).toHaveBeenCalledTimes(1);
    });

    it("does nothing without a revealKey or when the key is absent", async () => {
      renderPanel({ items });
      const { rerender } = renderPanel({ items, revealKey: "zzz" });
      await rerender({ items: [...items] });
      await nextTick();

      expect(scrollToIndex).not.toHaveBeenCalled();
    });
  });

  it("renders rows through the #row slot", () => {
    const { getAllByTestId } = renderPanel();
    expect(getAllByTestId("row")).toHaveLength(2);
  });

  it("emits update:search on typing", async () => {
    const { container, emitted } = renderPanel();
    const input = container.querySelector("input")!;
    await fireEvent.update(input, "abc");
    expect(emitted("update:search")?.at(-1)).toEqual(["abc"]);
  });

  it("FAB is hidden at confirmCount 0 and emits confirm on click otherwise", async () => {
    const { queryByTestId, getByTestId, emitted, rerender } = renderPanel({ confirmCount: 0 });
    expect(queryByTestId("fab")).toBeNull();
    await rerender({ confirmCount: 3 });
    await fireEvent.click(getByTestId("fab"));
    expect(emitted("confirm")).toHaveLength(1);
  });
});
