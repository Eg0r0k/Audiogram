import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, type PropType } from "vue";
import { RouterView, createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it, vi } from "vitest";
import { useScrollRestoration, type ScrollRestorationTarget } from "../useScrollRestoration";

const Host = defineComponent({
  props: {
    target: { type: Object as PropType<ScrollRestorationTarget>, required: true },
  },
  setup(props) {
    useScrollRestoration(() => props.target, { key: "restore-test" });
    return () => h("div");
  },
});

const makeRouter = () => createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/:pathMatch(.*)*", component: { template: "<div />" } }],
});

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const settle = async () => {
  await nextTick();
  await nextTick();
  await nextFrame();
  await nextTick();
};

const makeVirtualTarget = (anchorOffset: number | null) => ({
  scrollPosition: 400,
  getScrollAnchor: vi.fn(() => ({ key: "r3", delta: 10 })),
  getOffsetForAnchor: vi.fn(() => anchorOffset),
  setScrollPositionSilently: vi.fn(),
  scrollToOffset: vi.fn(),
  virtualizer: { measure: vi.fn() },
});

// Mount, let the page leave (save), mount again (restore).
const roundTrip = async (target: ScrollRestorationTarget) => {
  const router = makeRouter();
  await router.push("/");
  const first = mount(Host, { props: { target }, global: { plugins: [router] } });
  await settle();
  first.unmount();

  mount(Host, { props: { target }, global: { plugins: [router] } });
  await settle();
};

describe("useScrollRestoration", () => {
  it("restores through the anchor and sets the position silently", async () => {
    const target = makeVirtualTarget(530);

    await roundTrip(target);

    expect(target.getScrollAnchor).toHaveBeenCalled();
    expect(target.getOffsetForAnchor).toHaveBeenCalledWith({ key: "r3", delta: 10 });
    expect(target.virtualizer.measure).toHaveBeenCalled();
    expect(target.setScrollPositionSilently).toHaveBeenCalledWith(530);
    expect(target.scrollToOffset).not.toHaveBeenCalled();
  });

  it("falls back to the saved offset when the anchor row is gone", async () => {
    const target = makeVirtualTarget(null);

    await roundTrip(target);

    expect(target.setScrollPositionSilently).toHaveBeenCalledWith(400);
  });

  it("uses scrollToOffset for targets without a silent setter", async () => {
    const target = {
      scrollPosition: 400,
      scrollToOffset: vi.fn(),
      virtualizer: { measure: vi.fn() },
    };

    await roundTrip(target);

    expect(target.scrollToOffset).toHaveBeenCalledWith(400, { behavior: "auto" });
  });

  // By the time the old page unmounts the new one is already in the DOM, so a
  // scroll read there lays out the whole document. The route leave, which
  // runs before the swap, has already saved the position.
  it("reads the position once when the page is left by navigation", async () => {
    const target = makeVirtualTarget(530);
    const Page = defineComponent({
      setup() {
        useScrollRestoration(() => target, { key: "leave-test" });
        return () => h("div");
      },
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: Page }, { path: "/other", component: { render: () => h("div") } }],
    });
    await router.push("/");
    mount(RouterView, { global: { plugins: [router] } });
    await settle();

    await router.push("/other");
    await settle();

    expect(target.getScrollAnchor).toHaveBeenCalledTimes(1);
  });

  it("still saves on unmount when the leave was cancelled", async () => {
    const target = makeVirtualTarget(530);
    const Page = defineComponent({
      setup() {
        useScrollRestoration(() => target, { key: "cancel-test" });
        return () => h("div");
      },
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: Page }, { path: "/other", component: { render: () => h("div") } }],
    });
    await router.push("/");
    const app = mount(RouterView, { global: { plugins: [router] } });
    await settle();
    router.beforeEach(to => to.path !== "/other");

    await router.push("/other");
    app.unmount();

    expect(target.getScrollAnchor).toHaveBeenCalledTimes(2);
  });
});
