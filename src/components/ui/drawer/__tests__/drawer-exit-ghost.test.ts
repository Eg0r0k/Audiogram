import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/vue";
import { defineComponent, h } from "vue";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

//
// A menu item that opens a page unmounts the page that owns the menu. Vue
// drops teleported content at once and skips leave animations when the
// parent unmounts, so the sheet vanished mid-close; a detached copy now plays
// the close out.
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
});

afterEach(() => {
  document.body.innerHTML = "";
});

const renderOptions = { global: { stubs: { teleport: false } } };

const Owner = defineComponent({
  setup() {
    return () => h(Drawer, { open: true }, {
      default: () => h(DrawerContent, null, { default: () => h(DrawerTitle, null, { default: () => "sheet title" }) }),
    });
  },
});

const ghosts = (slot: string) => [...document.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]`)];

describe("drawer torn down with its owner", () => {
  it("leaves a closing copy of the sheet and its overlay", async () => {
    const { unmount } = render(Owner, renderOptions);
    await screen.findByText("sheet title");

    unmount();

    const [sheet] = ghosts("drawer-content");
    const [overlay] = ghosts("drawer-overlay");
    expect(sheet?.dataset.state).toBe("closed");
    expect(overlay?.dataset.state).toBe("closed");
    expect(sheet?.textContent).toContain("sheet title");
  });

  it("keeps the copy out of reach of the pointer and assistive tech", async () => {
    const { unmount } = render(Owner, renderOptions);
    await screen.findByText("sheet title");

    unmount();

    const [sheet] = ghosts("drawer-content");
    expect(sheet?.inert).toBe(true);
    expect(sheet?.getAttribute("aria-hidden")).toBe("true");
  });

  it("removes the copy once its close animation ends", async () => {
    const { unmount } = render(Owner, renderOptions);
    await screen.findByText("sheet title");

    unmount();
    for (const slot of ["drawer-content", "drawer-overlay"]) {
      for (const ghost of ghosts(slot)) ghost.dispatchEvent(new Event("animationend"));
    }

    expect(ghosts("drawer-content")).toHaveLength(0);
    expect(ghosts("drawer-overlay")).toHaveLength(0);
  });
});
