<template>
  <nav
    :aria-label="t('nav.menu')"
    class="grid h-14 auto-cols-fr grid-flow-col gap-(--nav-gap) p-1 mb-1 backdrop-blur-xl bg-muted rounded-lg [--nav-gap:--spacing(1)]"
  >
    <span
      v-if="activeIndex >= 0"
      aria-hidden="true"
      class="pointer-events-none col-start-1 row-start-1 flex items-center justify-center transition-[translate] duration-short-4 ease-standard motion-reduce:transition-none"
      :style="{ translate: `calc(${activeIndex} * (100% + var(--nav-gap)))` }"
    >
      <span class="h-8 w-16 rounded-full bg-primary" />
    </span>
    <button
      v-for="(item, index) in items"
      :key="item.key"
      type="button"
      :aria-label="t(item.label)"
      :aria-current="activeKey === item.key ? 'page' : undefined"
      :data-active="activeKey === item.key || undefined"
      :style="{ gridColumn: index + 1 }"
      class="relative row-start-1 flex min-w-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-short-4 ease-standard focus-visible:focus-ring data-active:text-primary-foreground"
      @click="select(item)"
    >
      <span
        v-ripple
        class="state-layer relative flex h-8 w-16 items-center justify-center rounded-full"
      >
        <component
          :is="activeKey === item.key ? item.activeIcon : item.icon"
          class="size-6"
        />
      </span>
    </button>
  </nav>
</template>
<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import vRipple from "@/lib/ripple";
import { ROUTE_NAMES } from "@/app/router/route-names";
import { routeLocation } from "@/app/router/route-locations";
import { useSearch } from "@/modules/search/composables/useSearch";
import { getLogger } from "@/lib/logger";

import IconHome from "~icons/tabler/home";
import IconHomeFilled from "~icons/tabler/home-filled";
import IconSearch from "~icons/tabler/search";
import IconChartBar from "~icons/tabler/chart-bar";
import IconSettings from "~icons/tabler/settings";
import IconSettingsFilled from "~icons/tabler/settings-filled";
import { formatError } from "@/lib/errors";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const { requestSearchFocus, closeSearch, clear, isSearchOpen } = useSearch();

// Search has no page of its own — it lives in the sidebar the home route
// renders on mobile. So this entry goes home and asks that field for focus.
const goToSearch = async () => {
  await router.push(routeLocation.home());
  requestSearchFocus();
};

// The search state is module-level and outlives the home page, so a tab
// switch has to drop it explicitly; otherwise the typed text greets the
// user on the next visit.
const leaveSearch = () => {
  if (!isSearchOpen.value) return;
  closeSearch();
  clear();
};

// Home shares its route with the search panel, so navigating to it from
// search would otherwise land on the panel rather than the home content.
const goHome = async () => {
  leaveSearch();
  await router.push(routeLocation.home());
};

// Search is dropped only once the page has changed: the route stays on home
// until a lazy page loads, and a closed search on home reads as the home tab.
const goToPage = (to: RouteLocationRaw) => async () => {
  await router.push(to);
  leaveSearch();
};

interface NavItem {
  key: string;
  label: string;
  icon: Component;
  /** Filled variant shown while the entry is the current one. */
  activeIcon: Component;
  active: () => boolean;
  go: () => Promise<void>;
}

const isHomeRoute = () => route.name === ROUTE_NAMES.HOME;
const isStatsRoute = () => route.name === ROUTE_NAMES.SETTINGS_STATS;
// Stats is a settings subpage with a tab of its own, so it lights that tab instead.
const isSettingsRoute = () =>
  typeof route.name === "string" && route.name.startsWith(ROUTE_NAMES.SETTINGS) && !isStatsRoute();

const items: NavItem[] = [
  {
    key: "home",
    label: "nav.home",
    icon: IconHome,
    activeIcon: IconHomeFilled,
    active: () => isHomeRoute() && !isSearchOpen.value,
    go: goHome,
  },
  {
    key: "search",
    label: "nav.search",
    icon: IconSearch,
    activeIcon: IconSearch,
    active: () => isHomeRoute() && isSearchOpen.value,
    go: goToSearch,
  },
  {
    key: "stats",
    label: "nav.stats",
    icon: IconChartBar,
    activeIcon: IconChartBar,
    active: isStatsRoute,
    go: goToPage(routeLocation.settingsStats()),
  },
  {
    key: "settings",
    label: "nav.settings",
    icon: IconSettings,
    activeIcon: IconSettingsFilled,
    active: isSettingsRoute,
    go: goToPage(routeLocation.settings()),
  },
];

// The tapped tab holds the highlight until its navigation settles, so the
// pill heads there at once instead of waiting on the page to load.
const pendingKey = ref<string | null>(null);
const activeKey = computed(() => pendingKey.value ?? items.find(item => item.active())?.key ?? null);
const activeIndex = computed(() => items.findIndex(item => item.key === activeKey.value));

const select = (item: NavItem) => {
  pendingKey.value = item.key;
  item.go()
    .catch(error => getLogger().error(`[Nav] Opening the ${item.key} tab failed: ${formatError(error)}`))
    .finally(() => {
      if (pendingKey.value === item.key) pendingKey.value = null;
    });
};
</script>
