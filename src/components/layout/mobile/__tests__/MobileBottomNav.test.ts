import { fireEvent, render, screen, within } from "@testing-library/vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";
import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import { ROUTE_NAMES } from "@/app/router/route-names";
import { useSearch } from "@/modules/search/composables/useSearch";
import MobileBottomNav from "../MobileBottomNav.vue";

const Page = { template: "<div />" };

let router: Router;

const renderNav = async () => {
  render(MobileBottomNav, {
    global: {
      plugins: [i18n, router],
      directives: { ripple: {} },
    },
  });
  await router.isReady();
};

const label = (key: string) => i18n.global.t(`nav.${key}`);
const tab = (key: string) => within(screen.getByRole("navigation")).getByLabelText(label(key));
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

beforeEach(() => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: ROUTE_NAMES.HOME, component: Page },
      { path: "/settings", name: ROUTE_NAMES.SETTINGS, component: Page },
      { path: "/settings/stats", name: ROUTE_NAMES.SETTINGS_STATS, component: Page },
      { path: "/settings/audio", name: ROUTE_NAMES.SETTINGS_AUDIO, component: Page },
    ],
  });
});

describe("MobileBottomNav tabs", () => {
  beforeEach(async () => {
    await router.push("/");
  });

  it("lists home, search, stats and settings in that order", async () => {
    await renderNav();

    const names = [...screen.getByRole("navigation").querySelectorAll("[aria-label]")]
      .map(el => el.getAttribute("aria-label"));

    expect(names).toEqual([label("home"), label("search"), label("stats"), label("settings")]);
  });

  it("opens the stats page from its tab", async () => {
    await renderNav();

    await fireEvent.click(tab("stats"));
    await settle();

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.SETTINGS_STATS);
  });

  it("keeps settings selected on a settings subpage, but not on stats", async () => {
    await router.push("/settings/audio");
    await renderNav();

    expect(tab("settings").hasAttribute("data-active")).toBe(true);
    expect(tab("stats").hasAttribute("data-active")).toBe(false);

    await router.push("/settings/stats");
    await settle();

    expect(tab("settings").hasAttribute("data-active")).toBe(false);
    expect(tab("stats").hasAttribute("data-active")).toBe(true);
  });

  it("plays the tapped tab's icon on every tap and leaves the others still", async () => {
    await renderNav();
    const icon = (key: string) => tab(key).querySelector("svg")!;

    expect(icon("stats").hasAttribute("data-playing")).toBe(false);

    await fireEvent.click(tab("stats"));
    const first = icon("stats");
    await fireEvent.click(tab("stats"));

    expect(first.hasAttribute("data-playing")).toBe(true);
    expect(icon("stats")).not.toBe(first);
    expect(icon("stats").hasAttribute("data-playing")).toBe(true);
    expect(icon("home").hasAttribute("data-playing")).toBe(false);
  });
});

describe("MobileBottomNav and the search field", () => {
  const search = useSearch();

  beforeEach(async () => {
    await router.push("/");
    search.openSearch();
    search.query.value = "daft";
  });

  it("clears the typed query when another tab is opened", async () => {
    await renderNav();

    await fireEvent.click(tab("settings"));
    await settle();

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.SETTINGS);
    expect(search.query.value).toBe("");
    expect(search.isSearchOpen.value).toBe(false);
  });

  it("clears the typed query when going home from the search panel", async () => {
    await renderNav();

    await fireEvent.click(tab("home"));
    await settle();

    expect(search.query.value).toBe("");
    expect(search.isSearchOpen.value).toBe(false);
  });

  // A lazy page keeps the route on home for a while after the tap; dropping
  // the search before that lit the home tab in between.
  it("never lights home while leaving search for a slow page", async () => {
    router.addRoute({
      path: "/settings/stats",
      name: ROUTE_NAMES.SETTINGS_STATS,
      component: () => new Promise(resolve => setTimeout(() => resolve(Page), 60)),
    });
    await renderNav();

    await fireEvent.click(tab("stats"));
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.HOME);
    expect(tab("home").hasAttribute("data-active")).toBe(false);
    expect(tab("stats").hasAttribute("data-active")).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 80));

    expect(router.currentRoute.value.name).toBe(ROUTE_NAMES.SETTINGS_STATS);
    expect(tab("stats").hasAttribute("data-active")).toBe(true);
    expect(search.isSearchOpen.value).toBe(false);
    expect(search.query.value).toBe("");
  });

  it("keeps the query when the search tab itself is tapped", async () => {
    await renderNav();

    await fireEvent.click(tab("search"));
    await settle();

    expect(search.query.value).toBe("daft");
    expect(search.isSearchOpen.value).toBe(true);
  });
});
