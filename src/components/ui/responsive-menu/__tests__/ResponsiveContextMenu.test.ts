import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { ResponsiveContextMenu, ResponsiveMenuContent } from "@/components/ui/responsive-menu";

//
// A context menu shell no longer has to self-open on right-click over a
// trigger wrapper: the consumer calls show(event) from the row that owns the
// event. In popper mode that is Menu.show at the pointer, in sheet mode the
// drawer opens; either way the event is taken so nothing outside opens on it.
//

const layout = vi.hoisted(() => ({ isMobile: false }));
vi.mock("@/composables/useDeviceLayout", () => ({
  useDeviceLayout: () => ({
    isMobileLayout: { get value() { return layout.isMobile; } },
    isDesktopLayout: { get value() { return !layout.isMobile; } },
    layoutType: { get value() { return layout.isMobile ? "mobile" : "desktop"; } },
  }),
}));

const popper = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn(), targets: [] as unknown[] }));
vi.mock("@/components/ui/menu", async (importOriginal) => {
  const { defineComponent: define } = await import("vue");
  return {
    ...(await importOriginal<typeof import("@/components/ui/menu")>()),
    Menu: define({
      name: "MenuStub",
      props: { modelValue: { type: Boolean, default: false }, target: { type: null, default: true } },
      emits: ["update:modelValue"],
      setup(props, { emit, expose }) {
        popper.targets.push(props.target);
        expose({
          show: (event?: Event) => {
            popper.show(event);
            emit("update:modelValue", true);
          },
          hide: () => {
            popper.hide();
            emit("update:modelValue", false);
          },
        });
      },
      template: "<div data-menu :data-open=\"modelValue\"><slot /></div>",
    }),
  };
});

const DrawerStub = {
  props: { open: { type: Boolean, default: false } },
  template: "<div data-sheet :data-open=\"open\"><slot /></div>",
};

const Host = defineComponent({
  components: { ResponsiveContextMenu, ResponsiveMenuContent },
  setup() {
    const open = ref(false);
    const menu = ref<InstanceType<typeof ResponsiveContextMenu> | null>(null);
    return { open, menu };
  },
  template: `
    <ResponsiveContextMenu ref="menu" v-model:open="open">
      <div data-testid="rows">rows</div>
      <ResponsiveMenuContent>items</ResponsiveMenuContent>
    </ResponsiveContextMenu>
  `,
});

const mountHost = () => mount(Host, {
  global: { stubs: { Drawer: DrawerStub, DrawerContent: true, DrawerTitle: true, DrawerMenu: true } },
});

const rightClick = () => new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

describe("ResponsiveContextMenu.show", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    popper.targets.length = 0;
  });

  describe("popper", () => {
    beforeEach(() => {
      layout.isMobile = false;
    });

    it("opens the popper at the event and takes the event", async () => {
      const wrapper = mountHost();
      const event = rightClick();
      const stop = vi.spyOn(event, "stopPropagation");

      wrapper.vm.menu!.show(event);
      await nextTick();

      expect(popper.show).toHaveBeenCalledWith(event);
      expect(event.defaultPrevented).toBe(true);
      expect(stop).toHaveBeenCalled();
      expect(wrapper.vm.open).toBe(true);
    });

    it("re-places an open popper: hides, then shows at the new event on the next tick", async () => {
      const wrapper = mountHost();
      wrapper.vm.menu!.show(rightClick());
      await nextTick();
      popper.show.mockClear();

      const second = rightClick();
      wrapper.vm.menu!.show(second);

      expect(popper.hide).toHaveBeenCalledTimes(1);
      expect(popper.show).not.toHaveBeenCalled();
      await nextTick();
      expect(popper.show).toHaveBeenCalledWith(second);
      expect(wrapper.vm.open).toBe(true);
    });

    it("gives the popper no target without a trigger, so nothing self-opens", () => {
      mountHost();

      expect(popper.targets).toEqual([false]);
    });
  });

  describe("sheet", () => {
    beforeEach(() => {
      layout.isMobile = true;
    });

    it("opens the sheet and takes the event", async () => {
      const wrapper = mountHost();
      const event = rightClick();
      const stop = vi.spyOn(event, "stopPropagation");

      wrapper.vm.menu!.show(event);
      await nextTick();

      expect(wrapper.find("[data-sheet]").attributes("data-open")).toBe("true");
      expect(event.defaultPrevented).toBe(true);
      expect(stop).toHaveBeenCalled();
      expect(wrapper.vm.open).toBe(true);
    });
  });
});
