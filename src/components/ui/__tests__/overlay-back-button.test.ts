import { beforeAll, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { defineComponent, h, ref } from "vue";
import { Menu, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useOverlayBackButton } from "@/composables/useOverlayBackButton";

//
// Android's hardware back must dismiss an open menu or drawer. Only surfaces
// that register with the overlay coordinator are offered the press; anything
// else falls through to the shell, which minimises the app with the menu
// still up. The shell asks the page over a native bridge; these tests stand in
// for it.
//

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

// The global setup stubs teleport, which would swallow the portaled content.
const renderOptions = { global: { stubs: { teleport: false } } };

const pressNativeBack = () => {
  window.dispatchEvent(new CustomEvent("audiogram-back"));
};

const withBridge = async (run: (depths: number[]) => Promise<void> | void) => {
  const depths: number[] = [];
  window.AudiogramBack = { setOverlayDepth: d => depths.push(d) };
  try {
    await run(depths);
  }
  finally {
    delete window.AudiogramBack;
  }
};

const DropdownHost = defineComponent({
  setup() {
    useOverlayBackButton();
    return () => h("div", [
      h(MenuTrigger, null, { default: () => "open dropdown" }),
      h(Menu, null, { default: () => h(MenuItem, null, { default: () => "dropdown item" }) }),
    ]);
  },
});

const ContextHost = defineComponent({
  setup() {
    useOverlayBackButton();
    return () => h("div", [
      "context target",
      h(Menu, { contextMenu: true }, { default: () => h(MenuItem, null, { default: () => "context item" }) }),
    ]);
  },
});

const DrawerHost = defineComponent({
  setup() {
    useOverlayBackButton();
    const open = ref(true);
    return () => h(Drawer, { "open": open.value, "onUpdate:open": (value: boolean) => (open.value = value) }, {
      default: () => h(DrawerContent, null, { default: () => h(DrawerTitle, null, { default: () => "drawer title" }) }),
    });
  },
});

describe("overlays and the hardware back button", () => {
  it("claims the press while a dropdown is open, and closes it", () => withBridge(async (depths) => {
    render(DropdownHost, renderOptions);
    expect(depths.at(-1)).toBe(0);

    await userEvent.click(screen.getByText("open dropdown"));
    await screen.findByText("dropdown item");
    // Claiming the press is what stops the shell from minimising the app.
    await waitFor(() => expect(depths.at(-1)).toBe(1));

    pressNativeBack();

    await waitFor(() => expect(screen.queryByText("dropdown item")).toBeNull());
    await waitFor(() => expect(depths.at(-1)).toBe(0));
  }));

  it("claims the press while a context menu is open, and closes it", () => withBridge(async (depths) => {
    render(ContextHost, renderOptions);

    await userEvent.pointer({ keys: "[MouseRight]", target: screen.getByText("context target") });
    await screen.findByText("context item");
    await waitFor(() => expect(depths.at(-1)).toBe(1));

    pressNativeBack();

    await waitFor(() => expect(screen.queryByText("context item")).toBeNull());
    await waitFor(() => expect(depths.at(-1)).toBe(0));
  }));

  it("claims the press while a drawer is open, and closes it", () => withBridge(async (depths) => {
    render(DrawerHost, renderOptions);
    await screen.findByText("drawer title");
    await waitFor(() => expect(depths.at(-1)).toBe(1));

    pressNativeBack();

    await waitFor(() => expect(screen.queryByText("drawer title")).toBeNull());
    await waitFor(() => expect(depths.at(-1)).toBe(0));
  }));

  it("claims nothing while the menu is closed", () => withBridge(() => {
    render(DropdownHost, renderOptions);
    // A press the shell must handle itself: router back, or leaving the app.
    expect(screen.queryByText("dropdown item")).toBeNull();
  }));
});
