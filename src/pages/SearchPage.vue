<template>
  <Scrollable class="flex-1">
    <div class="px-4 pt-4">
      <InputGroup class="dark:bg-muted! bg-background  rounded-full h-10">
        <InputGroupAddon
          tabindex="-1"
        >
          <IconSearch class="ml-1 size-5" />
        </InputGroupAddon>
        <InputGroupInput
          v-model="searchQuery"
          class="pl-4!"
          :placeholder="$t('common.search')"
          @keydown.stop
        />

        <InputGroupAddon
          v-if="searchQuery.trim()"
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
  </Scrollable>
</template>

<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { useSearch } from "@/modules/search/composables/useSearch";
import { SEARCH_ENTITY_TYPES } from "@/modules/search/types";
import type { SearchFilter, SearchResultItem } from "@/modules/search/types";

import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";
import IconLoader2 from "~icons/tabler/loader-2";
import IconSearchOff from "~icons/tabler/search-off";
import SearchResultCard from "@/modules/search/components/SearchResultCard.vue";
import SearchResultRow from "@/modules/search/components/SearchResultRow.vue";
import { Scrollable } from "@/components/ui/scrollable";
import InputGroup from "@/components/ui/input-group/InputGroup.vue";
import { InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { ref } from "vue";

const router = useRouter();
const { t } = useI18n();
const inputRef = useTemplateRef("inputRef");
const searchQuery = ref("");

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

// Labels for each filter type
const filterLabels: Record<SearchFilter, string> = {
  all: t("search.filter.all"),
  track: t("search.filter.tracks"),
  artist: t("search.filter.artists"),
  album: t("search.filter.albums"),
};

// Flat list for filtered mode
const filteredResults = computed(() => {
  if (activeFilter.value === "all") return results.value.topResults;
  return results.value.groups[activeFilter.value];
});

const hasResults = computed(() =>
  results.value.topResults.length > 0
  || SEARCH_ENTITY_TYPES.some(type => results.value.groups[type].length > 0),
);

function navigate(item: SearchResultItem) {
  switch (item.type) {
    case "artist":
      router.push(`/artist/${item.entityId}`);
      break;
    case "album":
      router.push(`/album/${item.entityId}`);
      break;
    case "track":
      // TODO: play track
      break;
  }
}

onMounted(() => {
  inputRef.value?.focus();
});
</script>
