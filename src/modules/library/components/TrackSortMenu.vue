<template>
  <InputGroupButton
    color="muted"
    size="icon-sm"
    :class="sortKey && 'text-foreground'"
    :aria-label="t('library.sortBy')"
    :title="t('library.sortBy')"
  >
    <IconSort class="size-5" />
    <Menu
      anchor="bottom end"
      self="top end"
      class="min-w-52"
    >
      <MenuLabel>{{ t('library.sortBy') }}</MenuLabel>
      <MenuSeparator />
      <MenuItem
        v-for="field in SORT_FIELDS"
        :key="field.value"
        @select="toggle(field.value)"
      >
        <span class="flex-1 truncate">{{ t(field.labelKey) }}</span>
        <IconChevronDown
          v-if="directionOf(field.value) === 'asc'"
          class="size-5 rotate-180 text-green-400!"
        />
        <IconChevronDown
          v-else-if="directionOf(field.value) === 'desc'"
          class="size-5 text-green-400!"
        />
      </MenuItem>
    </Menu>
  </InputGroupButton>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { InputGroupButton } from "@/components/ui/input-group";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import type { TrackSortKey } from "@/modules/tracks/types";
import IconChevronDown from "~icons/tabler/chevron-down";
import IconSort from "~icons/tabler/arrows-sort";
import { getNextTrackSortKey, getTrackSortDirection, type TrackSortField } from "../lib/trackSort";

const SORT_FIELDS: readonly { value: TrackSortField; labelKey: string }[] = [
  { value: "title", labelKey: "library.sortColumn.title" },
  { value: "artist", labelKey: "library.sortColumn.artist" },
  { value: "album", labelKey: "library.sortColumn.album" },
  { value: "dateAdded", labelKey: "library.sortColumn.dateAdded" },
  { value: "duration", labelKey: "library.sortColumn.duration" },
];

const props = defineProps<{
  sortKey: TrackSortKey | null;
}>();

const emit = defineEmits<{
  "update:sortKey": [value: TrackSortKey | null];
}>();

const { t } = useI18n();

const directionOf = (field: TrackSortField) => getTrackSortDirection(props.sortKey, field);

const toggle = (field: TrackSortField) => {
  emit("update:sortKey", getNextTrackSortKey(props.sortKey, field));
};
</script>
