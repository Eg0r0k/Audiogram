<template>
  <div class="flex items-center justify-between gap-3 px-4 pb-3">
    <Scrollable
      :hide-thumb="true"
      direction="horizontal"
      class=" flex-1 "
    >
      <div
        class="flex gap-2"
      >
        <Button
          v-for="filter in filters"
          :key="filter.value"
          class=" rounded-full"
          :variant=" activeFilter === filter.value ? 'default' :'ghost-primary'"
          size="sm"
          @click="$emit('filter', filter.value)"
        >
          {{ filter.label }}
        </Button>
      </div>
    </Scrollable>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-lg"
          class="rounded-full shrink-0"
        >
          <IconSortDescending class="size-5.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        class=" w-55"
      >
        <DropdownMenuLabel>{{ $t('library.sortLabel') }}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          v-for="option in sortOptions"
          :key="option.value"
          class="pl-2"
          :checked="sortBy === option.value"
          @click="$emit('sort', option.value)"
        >
          {{ option.label }}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IconSortDescending from "~icons/tabler/sort-descending";
import type { LibraryFilter, SortOption } from "../types";
import { Scrollable } from "@/components/ui/scrollable";

defineProps<{
  activeFilter: LibraryFilter;
  sortBy: SortOption;
}>();

defineEmits<{
  filter: [value: LibraryFilter];
  sort: [value: SortOption];
}>();

const { t } = useI18n();

const filters: Array<{ label: string; value: LibraryFilter }> = [
  { label: t("library.filterPlaylists"), value: "playlist" },
  { label: t("library.filterArtists"), value: "artist" },
  { label: t("library.filterAlbums"), value: "album" },
];

const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: t("library.sortRecent"), value: "recent" },
  { label: t("library.sortUpdated"), value: "updated" },
  { label: t("library.sortAlphabetical"), value: "alphabetical" },
  { label: t("library.sortAuthor"), value: "author" },
];
</script>
