import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { defineComponent, h, nextTick, ref, type PropType } from "vue";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/types/track";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import TrackContextMenu from "../TrackContextMenu.vue";
import { useTrackContextMenu } from "../useTrackContextMenu";

//
// The shell opens only when asked: a row inside it hands over the track and
// the right-click through the injected handle, the owner of the shell through
// the exposed one. The shell stamps its own context on the menu, so a row
// never opens a menu of another list by mistake.
//

vi.mock("@/composables/useDeviceLayout", () => ({
  useDeviceLayout: () => ({
    isMobileLayout: { value: false },
    isDesktopLayout: { value: true },
    layoutType: { value: "desktop" },
  }),
}));
vi.mock("../../composables/useTrackMenuContent", async () => {
  const { computed } = await import("vue");
  const { useTrackMenu: menu } = await import("@/modules/tracks/composables/useTrackMenu");
  return {
    useTrackMenuContent: () => ({
      input: computed(() => (menu().activeTrack.value ? {} : null)),
      actions: {},
    }),
  };
});
vi.mock("../../composables/useTrackMenuAutoClose", () => ({ useTrackMenuAutoClose: () => undefined }));
vi.mock("../../TrackMenuSheetHeader.vue", () => ({ default: { template: "<div />" } }));
vi.mock("../../TrackMenuEntries.vue", () => ({ default: { template: "<div data-context>items</div>" } }));

const popper = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock("@/components/ui/menu", async (importOriginal) => {
  const { defineComponent: define } = await import("vue");
  return {
    ...(await importOriginal<typeof import("@/components/ui/menu")>()),
    Menu: define({
      name: "MenuStub",
      props: { modelValue: { type: Boolean, default: false } },
      emits: ["update:modelValue"],
      setup(_props, { emit, expose }) {
        expose({
          show: (event?: Event) => {
            popper.show(event);
            emit("update:modelValue", true);
          },
          hide: () => emit("update:modelValue", false),
        });
      },
      template: "<div data-menu :data-open=\"modelValue\"><slot /></div>",
    }),
  };
});

const track = (id: string): Track => ({
  kind: "library",
  id: id as Track["id"],
  title: id,
  artist: "Artist",
  artistIds: [],
  albumId: "a1" as Track["albumId"],
  albumName: "Album",
  storagePath: `tracks/${id}.mp3`,
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
});

const Row = defineComponent({
  props: {
    track: { type: Object as PropType<Track>, required: true },
    testid: { type: String, required: true },
  },
  setup() {
    return { menu: useTrackContextMenu() };
  },
  template: "<div :data-testid=\"testid\" @contextmenu=\"menu.open(track, 3, $event)\">row</div>",
});

const i18n = () => createI18n({ legacy: false, locale: "en", messages: { en: {} }, missingWarn: false, fallbackWarn: false });

const rightClick = (el: Element) => {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
};

describe("TrackContextMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTrackMenu().closeMenu();
  });

  it("opens the popper at the row's right-click under the shell's own context", async () => {
    const wrapper = mount(TrackContextMenu, {
      props: { context: "album" },
      global: { plugins: [createPinia(), i18n()] },
      slots: { default: () => h(Row, { track: track("t1"), testid: "row" }) },
    });

    const event = rightClick(wrapper.get("[data-testid=row]").element);
    await nextTick();

    const menu = useTrackMenu();
    expect(popper.show).toHaveBeenCalledWith(event);
    expect(event.defaultPrevented).toBe(true);
    expect(menu.isContextMenuOpen.value).toBe(true);
    expect(menu.activeContextMenuTarget.value).toBe("album");
    expect(menu.activeTrack.value?.id).toBe("t1");
    expect(menu.activeIndex.value).toBe(3);
    expect(wrapper.get("[data-menu]").text()).toContain("items");
  });

  it("lets the shell's owner open it through the exposed handle", async () => {
    const Host = defineComponent({
      components: { TrackContextMenu },
      setup() {
        const shell = ref<InstanceType<typeof TrackContextMenu> | null>(null);
        return { shell };
      },
      template: "<TrackContextMenu ref=\"shell\" context=\"current-track\"><div data-testid=\"cover\">cover</div></TrackContextMenu>",
    });
    const wrapper = mount(Host, { global: { plugins: [createPinia(), i18n()] } });
    const event = rightClick(wrapper.get("[data-testid=cover]").element);

    wrapper.vm.shell!.open(track("t2"), 0, event);
    await nextTick();

    expect(popper.show).toHaveBeenCalledWith(event);
    expect(useTrackMenu().activeContextMenuTarget.value).toBe("current-track");
  });

  it("gives a row outside any shell an inert handle", () => {
    const wrapper = mount(Row, { props: { track: track("t3"), testid: "row" } });

    const event = rightClick(wrapper.element);

    expect(popper.show).not.toHaveBeenCalled();
    expect(useTrackMenu().isContextMenuOpen.value).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it("drops the open flag once the popper closes", async () => {
    const wrapper = mount(TrackContextMenu, {
      props: { context: "album" },
      global: { plugins: [createPinia(), i18n()] },
      slots: { default: () => h(Row, { track: track("t1"), testid: "row" }) },
    });
    rightClick(wrapper.get("[data-testid=row]").element);
    await nextTick();

    wrapper.findComponent({ name: "MenuStub" }).vm.$emit("update:modelValue", false);
    // A popper close reaches the consumer one macrotask later (see useResponsiveMenuRoot).
    await new Promise(resolve => setTimeout(resolve, 0));
    await nextTick();

    expect(useTrackMenu().isContextMenuOpen.value).toBe(false);
  });
});
