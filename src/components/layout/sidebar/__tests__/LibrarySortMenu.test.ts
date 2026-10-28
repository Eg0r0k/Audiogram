import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import { SORT_OPTIONS, type SortOption } from "@/modules/library/types";
import LibrarySortMenu from "../LibrarySortMenu.vue";

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

const { t } = i18n.global;

const LABEL_KEYS: Record<SortOption, string> = {
  recent: "library.sortRecent",
  updated: "library.sortUpdated",
  alphabetical: "library.sortAlphabetical",
  author: "library.sortAuthor",
};

const label = (option: SortOption) => t(LABEL_KEYS[option]);

const renderMenu = (modelValue: SortOption = "recent") =>
  render(LibrarySortMenu, {
    props: { modelValue },
    global: { plugins: [i18n], stubs: { teleport: false } },
  });

const openMenu = async () => {
  await userEvent.click(screen.getByRole("button", { name: t("library.sortLabel") }));
  return screen.findAllByRole("menuitem");
};

describe("LibrarySortMenu", () => {
  it("offers the four sort options and marks the current one with the chevron", async () => {
    renderMenu("alphabetical");

    const items = await openMenu();

    expect(items.map(item => item.textContent?.trim())).toEqual(SORT_OPTIONS.map(label));
    const active = items.filter(item => item.hasAttribute("data-active"));
    expect(active.map(item => item.textContent?.trim())).toEqual([label("alphabetical")]);
    expect(active[0].querySelector("svg")).not.toBeNull();
  });

  it("emits update:modelValue with the picked option", async () => {
    const { emitted } = renderMenu("recent");

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: label("author") }));

    expect(emitted()["update:modelValue"]).toEqual([["author"]]);
  });

  it("labels the button for assistive tech", () => {
    renderMenu();

    expect(screen.getByRole("button")).toHaveAttribute("aria-label", t("library.sortLabel"));
  });

  it("draws the icon in the muted tone, not primary", () => {
    renderMenu();

    const button = screen.getByRole("button", { name: t("library.sortLabel") });
    expect(button).toHaveAttribute("data-color", "muted");
    expect(button).toHaveAttribute("data-size", "icon-lg");
  });
});
