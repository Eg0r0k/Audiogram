import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import { SORT_OPTIONS, type LibrarySortKey, type SortOption } from "@/modules/library/types";
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

const renderMenu = (modelValue: LibrarySortKey | null = null) =>
  render(LibrarySortMenu, {
    props: { modelValue },
    global: { plugins: [i18n], stubs: { teleport: false } },
  });

const sortButton = () => screen.getByRole("button", { name: t("library.sortLabel") });

const openMenu = async () => {
  await userEvent.click(sortButton());
  return screen.findAllByRole("menuitem");
};

const activeChevronRotated = async () => {
  const items = await openMenu();
  const active = items.filter(item => item.hasAttribute("data-active"));
  expect(active.map(item => item.textContent?.trim())).toEqual([label("alphabetical")]);
  const svg = active[0].querySelector("svg");
  expect(svg).not.toBeNull();
  return svg?.classList.contains("rotate-180");
};

const clickAlphabetical = async (modelValue: LibrarySortKey | null) => {
  const { emitted, unmount } = renderMenu(modelValue);
  await openMenu();
  await userEvent.click(screen.getByRole("menuitem", { name: label("alphabetical") }));
  const events = emitted()["update:modelValue"];
  unmount();
  return events;
};

describe("LibrarySortMenu", () => {
  it("offers the four fields with no chevron while nothing is sorted", async () => {
    renderMenu(null);

    const items = await openMenu();

    expect(items.map(item => item.textContent?.trim())).toEqual(SORT_OPTIONS.map(label));
    expect(items.filter(item => item.hasAttribute("data-active"))).toEqual([]);
    expect(items.filter(item => item.querySelector("svg") !== null)).toEqual([]);
  });

  it("shows an upward chevron for an ascending field and a downward one for descending", async () => {
    const asc = renderMenu("alphabetical_asc");
    expect(await activeChevronRotated()).toBe(true);
    asc.unmount();

    renderMenu("alphabetical_desc");
    expect(await activeChevronRotated()).toBe(false);
  });

  it("cycles the clicked field: none to asc, asc to desc, desc to none", async () => {
    expect(await clickAlphabetical(null)).toEqual([["alphabetical_asc"]]);
    expect(await clickAlphabetical("alphabetical_asc")).toEqual([["alphabetical_desc"]]);
    expect(await clickAlphabetical("alphabetical_desc")).toEqual([[null]]);
  });

  it("tints the icon foreground only while a sort is active", () => {
    const sorted = renderMenu("author_desc");
    expect(sortButton()).toHaveClass("text-foreground");
    sorted.unmount();

    renderMenu(null);
    expect(sortButton()).not.toHaveClass("text-foreground");
  });

  it("labels the button for assistive tech", () => {
    renderMenu();

    expect(screen.getByRole("button")).toHaveAttribute("aria-label", t("library.sortLabel"));
  });

  it("draws the icon in the muted tone, not primary", () => {
    renderMenu();

    const button = sortButton();
    expect(button).toHaveAttribute("data-color", "muted");
    expect(button).toHaveAttribute("data-size", "icon-lg");
  });
});
