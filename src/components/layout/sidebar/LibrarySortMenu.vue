<template>
  <Button
    variant="ghost"
    color="muted"
    size="icon-lg"
    :class="['rounded-full', modelValue && 'text-foreground']"
    :aria-label="t('library.sortLabel')"
    :title="t('library.sortLabel')"
  >
    <IconSort class="size-6" />
    <Menu
      anchor="bottom end"
      self="top end"
      class="min-w-52"
    >
      <MenuLabel>{{ t('library.sortLabel') }}</MenuLabel>
      <MenuSeparator />
      <MenuItem
        v-for="field in SORT_OPTIONS"
        :key="field"
        :data-active="directionOf(field) !== null || undefined"
        @select="toggle(field)"
      >
        <span class="flex-1 truncate">{{ t(LABEL_KEYS[field]) }}</span>
        <IconChevronDown
          v-if="directionOf(field) === 'asc'"
          class="size-5 rotate-180 text-green-400!"
        />
        <IconChevronDown
          v-else-if="directionOf(field) === 'desc'"
          class="size-5 text-green-400!"
        />
      </MenuItem>
    </Menu>
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { getLibrarySortDirection, getNextLibrarySortKey } from "@/modules/library/lib/librarySort";
import { SORT_OPTIONS, type LibrarySortKey, type SortOption } from "@/modules/library/types";
import IconSort from "~icons/tabler/arrows-sort";
import IconChevronDown from "~icons/tabler/chevron-down";

const LABEL_KEYS: Record<SortOption, string> = {
  recent: "library.sortRecent",
  updated: "library.sortUpdated",
  alphabetical: "library.sortAlphabetical",
  author: "library.sortAuthor",
};

const props = defineProps<{
  modelValue: LibrarySortKey | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: LibrarySortKey | null];
}>();

const { t } = useI18n();

const directionOf = (field: SortOption) => getLibrarySortDirection(props.modelValue, field);

const toggle = (field: SortOption) => {
  emit("update:modelValue", getNextLibrarySortKey(props.modelValue, field));
};
</script>
