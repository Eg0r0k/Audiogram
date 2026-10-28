import { render } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = ["first", "second", "third"];

const mountStrip = () => {
  const value = ref(TABS[0]);
  const Host = defineComponent({
    setup: () => () => h("div", { class: "scrollable-x" }, [
      h(Tabs, { modelValue: value.value }, {
        default: () => h(TabsList, { variant: "line" }, {
          default: () => TABS.map(tab => h(TabsTrigger, { key: tab, value: tab }, { default: () => tab })),
        }),
      }),
    ]),
  });
  const { container } = render(Host);
  const host = container.querySelector<HTMLElement>(".scrollable-x")!;
  return { value, host };
};

const stubGeometry = (host: HTMLElement) => {
  Object.defineProperty(host, "clientWidth", { configurable: true, value: 280 });
  Object.defineProperty(host, "scrollLeft", { configurable: true, value: 0 });
  Object.defineProperty(host, "getBoundingClientRect", { configurable: true, value: () => ({ left: 0 }) as DOMRect });
  host.querySelectorAll<HTMLElement>("[role=\"tab\"]").forEach((tab, index) => {
    Object.defineProperty(tab, "getBoundingClientRect", { configurable: true, value: () => ({ left: index * 100 }) as DOMRect });
    Object.defineProperty(tab, "offsetWidth", { configurable: true, value: 90 });
  });
  return vi.spyOn(host, "scrollTo").mockImplementation(() => {});
};

const selectTab = async (tab: string, insetEnd?: string) => {
  const { value, host } = mountStrip();
  if (insetEnd) host.style.setProperty("--tabs-scroll-inset-end", insetEnd);
  const scrollTo = stubGeometry(host);
  value.value = tab;
  await nextTick();
  await nextTick();
  return scrollTo;
};

describe("TabsList scrolling the active tab into view", () => {
  it("scrolls the active tab clear of a declared end inset", async () => {
    const scrollTo = await selectTab("third", "84px");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 290 + 70 + 84 - 280 }));
  });

  it("keeps the plain margin without an inset", async () => {
    const scrollTo = await selectTab("third");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: 290 + 70 - 280 }));
  });

  it("does not scroll when the active tab already fits", async () => {
    const scrollTo = await selectTab("second");
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
