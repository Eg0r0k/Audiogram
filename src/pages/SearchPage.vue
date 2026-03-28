<template>
  <Scrollable class="flex-1">
    <!-- Search bar -->
    <div class="px-4 pt-4 pb-3">
      <InputGroup class="dark:bg-muted! bg-background rounded-full h-10">
        <InputGroupAddon tabindex="-1">
          <IconSearch class="ml-1 size-5" />
        </InputGroupAddon>
        <InputGroupInput
          ref="inputRef"
          v-model="query"
          class="pl-4!"
          :placeholder="$t('common.search')"
          @keydown.stop
          @keydown.escape="clear"
        />
        <InputGroupAddon
          v-if="query.trim()"
          tabindex="-1"
          align="inline-end"
        >
          <Button
            class="rounded-full"
            variant="ghost-primary"
            size="icon-sm"
            @click="clear"
          >
            <IconX class="size-5" />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <!-- Filter chips (animated in when there's a query) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition-all duration-150 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="hasQuery"
        class="flex items-center gap-2 px-4 pb-3 overflow-x-auto"
        style="scrollbar-width: none;"
      >
        <button
          v-for="filter in availableFilters"
          :key="filter.value"
          class="shrink-0 text-xs font-medium px-3.5 py-1.5 rounded-full transition-all duration-150"
          :class="activeFilter === filter.value
            ? 'bg-foreground text-background'
            : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'"
          @click="setFilter(filter.value)"
        >
          {{ filterLabel(filter.value) }}
        </button>
      </div>
    </Transition>

    <!-- Loading -->
    <div
      v-if="isSearching"
      class="flex items-center justify-center py-16"
    >
      <IconLoader2 class="size-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Empty state (no query) -->
    <div
      v-else-if="!hasQuery"
      class="flex flex-col items-center justify-center py-24 gap-3 text-center px-6"
    >
      <div class="size-14 rounded-full bg-muted flex items-center justify-center">
        <IconSearch class="size-6 text-muted-foreground" />
      </div>
      <p class="text-sm text-muted-foreground max-w-[200px]">
        {{ $t("search.placeholder") }}
      </p>
    </div>

    <!-- No results -->
    <div
      v-else-if="!hasResults"
      class="flex flex-col items-center justify-center py-24 gap-3 text-center px-6"
    >
      <div class="size-14 rounded-full bg-muted flex items-center justify-center">
        <IconSearchOff class="size-6 text-muted-foreground" />
      </div>
      <div>
        <p class="font-semibold text-base">
          {{ $t("search.noResults.title", { query }) }}
        </p>
        <p class="text-sm text-muted-foreground mt-1">
          {{ $t("search.noResults.hint") }}
        </p>
      </div>
    </div>

    <!-- Results: "all" filter -->
    <template v-else-if="activeFilter === 'all'">
      <!-- Top section: Best result + Tracks — side-by-side on sm+, stacked on mobile -->
      <div
        v-if="topResult || trackResults.length > 0"
        class="grid grid-cols-1 sm:grid-cols-[1fr_1.6fr] gap-x-6 gap-y-5 px-4 pb-5"
      >
        <!-- Best result card -->
        <div v-if="topResult">
          <h2 class="font-bold text-base mb-3">
            {{ $t("search.bestResult") }}
          </h2>
          <SearchCardResult
            :item="topResult"
            @click="navigate(topResult!)"
            @play="navigate(topResult!)"
          />
        </div>

        <!-- Track results -->
        <div v-if="trackResults.length > 0">
          <h2 class="font-bold text-base mb-1">
            {{ $t("search.filter.track") }}
          </h2>
          <SearchResultRow
            v-for="item in trackResults.slice(0, 4)"
            :key="item.id"
            :item="item"
            @click="navigate(item)"
          />
        </div>
      </div>

      <!-- Artists: horizontal scroll on mobile, grid on desktop -->
      <div
        v-if="artistResults.length > 0"
        class="px-4 pb-5"
      >
        <h2 class="font-bold text-base mb-2">
          {{ $t("search.filter.artist") }}
        </h2>
        <!-- Mobile: scroll row of portrait cards -->
        <div
          class="sm:hidden flex gap-3 overflow-x-auto pb-1"
          style="scrollbar-width: none;"
        >
          <button
            v-for="item in artistResults.slice(0, 8)"
            :key="item.id"
            class="shrink-0 flex flex-col items-center gap-2 w-20 text-center"
            @click="navigate(item)"
          >
            <div class="size-16 rounded-full overflow-hidden bg-muted shrink-0">
              <NuxtImage
                v-if="item.coverPath"
                :src="item.coverPath"
                :alt="item.title"
                fallback-src="/img/fallback.svg"
                class="size-full object-cover"
              />
              <div
                v-else
                class="size-full flex items-center justify-center text-muted-foreground"
              >
                <IconUser class="size-6" />
              </div>
            </div>
            <span class="text-xs font-medium line-clamp-2 leading-tight">{{ item.title }}</span>
          </button>
        </div>
        <!-- Desktop: rows -->
        <div class="hidden sm:block">
          <SearchResultRow
            v-for="item in artistResults.slice(0, 6)"
            :key="item.id"
            :item="item"
            @click="navigate(item)"
          />
        </div>
      </div>

      <!-- Albums: 2-col grid on mobile, rows on desktop -->
      <div
        v-if="albumResults.length > 0"
        class="px-4 pb-5"
      >
        <h2 class="font-bold text-base mb-2">
          {{ $t("search.filter.album") }}
        </h2>
        <!-- Mobile: 2-col grid -->
        <div class="grid grid-cols-2 gap-2 sm:hidden">
          <button
            v-for="item in albumResults.slice(0, 6)"
            :key="item.id"
            class="flex items-center gap-2.5 bg-muted/40 hover:bg-muted/70
                   rounded-lg p-2 transition-colors text-left"
            @click="navigate(item)"
          >
            <div class="shrink-0 size-10 rounded overflow-hidden bg-muted">
              <NuxtImage
                v-if="item.coverPath"
                :src="item.coverPath"
                :alt="item.title"
                fallback-src="/img/fallback.svg"
                class="size-full object-cover"
              />
              <div
                v-else
                class="size-full flex items-center justify-center text-muted-foreground"
              >
                <IconDisc class="size-4" />
              </div>
            </div>
            <span class="text-xs font-medium truncate leading-tight">{{ item.title }}</span>
          </button>
        </div>
        <!-- Desktop: rows -->
        <div class="hidden sm:block">
          <SearchResultRow
            v-for="item in albumResults.slice(0, 6)"
            :key="item.id"
            :item="item"
            @click="navigate(item)"
          />
        </div>
      </div>
    </template>

    <!-- Results: filtered mode -->
    <div
      v-else
      class="px-4 pb-4 flex flex-col"
    >
      <SearchResultRow
        v-for="item in filteredResults"
        :key="item.id"
        :item="item"
        @click="navigate(item)"
      />
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useSearch } from "@/modules/search/composables/useSearch";
import { SEARCH_ENTITY_TYPES } from "@/modules/search/types";
import type { SearchFilter, SearchResultItem } from "@/modules/search/types";
import { Scrollable } from "@/components/ui/scrollable";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import SearchCardResult from "@/modules/search/components/SearchCardResult.vue";
import SearchResultRow from "@/modules/search/components/SearchResultRow.vue";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import IconSearch from "~icons/tabler/search";
import IconSearchOff from "~icons/tabler/search-off";
import IconX from "~icons/tabler/x";
import IconLoader2 from "~icons/tabler/loader-2";
import IconUser from "~icons/tabler/user";
import IconDisc from "~icons/tabler/disc";

const router = useRouter();
const { t } = useI18n();
const inputRef = ref<HTMLInputElement | null>(null);

const {
  query,
  activeFilter,
  availableFilters,
  results,
  isSearching,
  hasQuery,
  setFilter,
  clear,
} = useSearch();

// ── Derived ───────────────────────────────────────────────────────────────────

const topResult = computed(() => results.value.topResults[0] ?? null);
const trackResults = computed(() => results.value.groups.track);
const artistResults = computed(() => results.value.groups.artist);
const albumResults = computed(() => results.value.groups.album);

const hasResults = computed(
  () =>
    results.value.topResults.length > 0
    || SEARCH_ENTITY_TYPES.some(t => results.value.groups[t].length > 0),
);

const filteredResults = computed(() => {
  if (activeFilter.value === "all") return results.value.topResults;
  return results.value.groups[activeFilter.value] ?? [];
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const filterLabels: Record<SearchFilter, string> = {
  all: t("search.filter.all"),
  track: t("search.filter.track"),
  artist: t("search.filter.artist"),
  album: t("search.filter.album"),
};

function filterLabel(value: SearchFilter) {
  return filterLabels[value] ?? value;
}

function navigate(item: SearchResultItem) {
  switch (item.type) {
    case "artist":
      router.push({ name: "artist", params: { id: item.entityId } });
      break;
    case "album":
      router.push({ name: "album", params: { id: item.entityId } });
      break;
    case "track":
      // TODO: play track directly
      break;
  }
}
</script>
