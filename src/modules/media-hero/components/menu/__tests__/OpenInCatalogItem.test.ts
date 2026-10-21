import { describe, expect, it } from "vitest";
import { computed, defineComponent, h } from "vue";
import { fireEvent, render, screen } from "@testing-library/vue";
import { createI18n } from "vue-i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { provideMediaContext } from "../../../composables/useMediaContext";
import { provideMenuComponents, type MenuComponents } from "../../../composables/useMenuComponents";
import OpenInCatalogItem from "../OpenInCatalogItem.vue";

const stubComponents: MenuComponents = {
  Item: { setup: (_, { slots, attrs }) => () => h("button", { type: "button", onClick: attrs.onClick }, slots.default?.()) },
  Separator: { setup: () => () => h("hr") },
};

const mount = async (catalogRoute: RouteLocationRaw | null) => {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: { en: { media: { openInCatalog: "Open in catalog" } } },
    missingWarn: false,
    fallbackWarn: false,
  });
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { render: () => null } }],
  });
  const Host = defineComponent({
    setup() {
      provideMenuComponents(stubComponents);
      provideMediaContext({
        addToQueue: () => {},
        edit: () => {},
        delete: () => {},
        catalogRoute: computed(() => catalogRoute),
      });
      return () => h(OpenInCatalogItem);
    },
  });
  render(Host, { global: { plugins: [i18n, router] } });
  await router.isReady();
  return router;
};

describe("OpenInCatalogItem", () => {
  it("is absent without a catalog view", async () => {
    await mount(null);

    expect(screen.queryByRole("button", { name: "Open in catalog" })).toBeNull();
  });

  it("opens the catalog view of the entity", async () => {
    const router = await mount("/album/nd:1?catalog=1");

    await fireEvent.click(screen.getByRole("button", { name: "Open in catalog" }));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(router.currentRoute.value.fullPath).toBe("/album/nd:1?catalog=1");
  });
});
