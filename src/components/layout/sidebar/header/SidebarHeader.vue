<template>
  <div class="flex items-center gap-3 shrink-0 px-4 pb-4">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-lg"
          class="rounded-full shrink-0"
        >
          <IconMenu2 class="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        class="w-52 bg-background/30"
        align="start"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem @click="goSettings">
            <IconBookmark class="size-5.5" />
            Favorite
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleThemeToggle">
            <component
              :is="themeIcon"
              class="size-5.5"
            />
            Change Theme
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem @click="goSettings">
            <IconSettings class="size-5.5" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <div
      ref="searchWrapperRef"
      class="relative flex-1"
    >
      <InputGroup class="dark:bg-background! bg-muted! border-none! rounded-full h-10">
        <InputGroupAddon tabindex="-1">
          <IconSearch class="ml-1 size-5" />
        </InputGroupAddon>
        <InputGroupInput
          v-model="query"
          class="pl-4!"
          :placeholder="$t('common.search')"
          @keydown.stop
          @keydown.escape="handleEscape"
          @focus="isDropdownOpen = true"
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

      <!-- Dropdown results panel -->
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1 scale-[0.98]"
        leave-active-class="transition-all duration-100 ease-in"
        leave-to-class="opacity-0 translate-y-1 scale-[0.98]"
      >
        <div
          v-if="showDropdown"
          class="absolute top-full left-0 right-0 mt-2 z-50
                 bg-popover border border-border rounded-xl shadow-xl
                 overflow-hidden"
        >
          <!-- Loading -->
          <div
            v-if="isSearching"
            class="flex items-center justify-center py-6"
          >
            <IconLoader2 class="size-5 animate-spin text-muted-foreground" />
          </div>

          <!-- No results -->
          <div
            v-else-if="hasQuery && !hasDropdownResults"
            class="flex flex-col items-center gap-1.5 py-6 text-center"
          >
            <IconSearchOff class="size-5 text-muted-foreground" />
            <span class="text-xs text-muted-foreground">{{ $t("search.noResults.title", { query }) }}</span>
          </div>

          <!-- Results -->
          <template v-else-if="hasDropdownResults">
            <div class="p-1.5 flex flex-col gap-0.5 max-h-80 overflow-y-auto">
              <SearchDropdownRow
                v-for="item in dropdownResults"
                :key="item.id"
                :item="item"
                @click="navigate(item)"
              />
            </div>

            <!-- See all -->
            <button
              class="w-full py-2.5 text-xs text-primary font-medium text-center
                     hover:bg-muted/50 transition-colors border-t border-border"
              @click="openSearchPage"
            >
              {{ $t("search.seeAll") }}
            </button>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { onClickOutside } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { useTheme } from "@/modules/settings/composables/useTheme";
import { useSearch } from "@/modules/search/composables/useSearch";
import type { SearchResultItem } from "@/modules/search/types";
import SearchDropdownRow from "@/modules/search/components/SearchDropdownRow.vue";

import IconMenu2 from "~icons/tabler/menu-2";
import IconBookmark from "~icons/tabler/bookmark";
import IconSettings from "~icons/tabler/settings";
import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";
import IconSun from "~icons/tabler/sun";
import IconMoon from "~icons/tabler/moon";
import IconLoader2 from "~icons/tabler/loader-2";
import IconSearchOff from "~icons/tabler/search-off";

const router = useRouter();
const theme = useTheme();
const searchWrapperRef = ref<HTMLElement | null>(null);
const isDropdownOpen = ref(false);

const { query, results, isSearching, hasQuery, clear } = useSearch();

// Close dropdown when clicking outside the search wrapper
onClickOutside(searchWrapperRef, () => {
  isDropdownOpen.value = false;
});

const dropdownResults = computed(() => results.value.topResults.slice(0, 5));
const hasDropdownResults = computed(() => dropdownResults.value.length > 0);
const showDropdown = computed(() =>
  isDropdownOpen.value && hasQuery.value,
);

const themeIcon = computed(() => (theme.isDark.value ? IconSun : IconMoon));

function handleThemeToggle(event: MouseEvent) {
  theme.toggleTheme(event);
}

function goSettings() {
  router.push("/settings");
}

function handleEscape() {
  if (query.value.trim()) {
    clear();
  }
  else {
    isDropdownOpen.value = false;
  }
}

function navigate(item: SearchResultItem) {
  isDropdownOpen.value = false;
  switch (item.type) {
    case "artist":
      router.push({ name: "artist", params: { id: item.entityId } });
      break;
    case "album":
      router.push({ name: "album", params: { id: item.entityId } });
      break;
    case "track":
      // TODO: play track
      break;
  }
}

function openSearchPage() {
  isDropdownOpen.value = false;
  router.push({ name: "search" });
}
</script>
