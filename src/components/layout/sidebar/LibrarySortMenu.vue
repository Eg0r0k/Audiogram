<template>
  <Button
    variant="ghost"
    size="icon-sm"
    class="rounded-full"
    :aria-label="t('library.sortLabel')"
    :title="t('library.sortLabel')"
  >
    <IconSort class="size-5" />
    <Menu
      anchor="bottom end"
      self="top end"
      class="min-w-52"
    >
      <MenuLabel>{{ t('library.sortLabel') }}</MenuLabel>
      <MenuSeparator />
      <MenuRadioGroup
        :model-value="modelValue"
        @update:model-value="pick"
      >
        <MenuRadioItem
          v-for="option in SORT_OPTIONS"
          :key="option"
          :value="option"
        >
          {{ t(LABEL_KEYS[option]) }}
        </MenuRadioItem>
      </MenuRadioGroup>
    </Menu>
  </Button>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Menu, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "@/components/ui/menu";
import { SORT_OPTIONS, type SortOption } from "@/modules/library/types";
import IconSort from "~icons/tabler/arrows-sort";

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

const pick = (value: unknown) => {
  const option = SORT_OPTIONS.find(candidate => candidate === value);
  if (option) emit("update:modelValue", option);
};
</script>
