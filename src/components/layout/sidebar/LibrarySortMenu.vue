<template>
  <Button
    variant="ghost"
    color="muted"
    size="icon-lg"
    class="rounded-full"
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
        v-for="option in SORT_OPTIONS"
        :key="option"
        :data-active="option === modelValue || undefined"
        @select="pick(option)"
      >
        <span class="flex-1 truncate">{{ t(LABEL_KEYS[option]) }}</span>
        <IconChevronDown
          v-if="option === modelValue"
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
import { SORT_OPTIONS, type SortOption } from "@/modules/library/types";
import IconSort from "~icons/tabler/arrows-sort";
import IconChevronDown from "~icons/tabler/chevron-down";

const LABEL_KEYS: Record<SortOption, string> = {
  recent: "library.sortRecent",
  updated: "library.sortUpdated",
  alphabetical: "library.sortAlphabetical",
  author: "library.sortAuthor",
};

defineProps<{
  modelValue: SortOption;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SortOption];
}>();

const { t } = useI18n();

const pick = (option: SortOption) => {
  emit("update:modelValue", option);
};
</script>
