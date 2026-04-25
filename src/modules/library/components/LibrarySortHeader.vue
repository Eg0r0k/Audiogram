<template>
  <div class="library-sort-header-container border-b border-border/40 px-4 sm:px-6">
    <div class="library-sort-header">
      <div class="index-col flex items-center pl-3">
        <IconHashtag class="size-4" />
      </div>

      <Button
        variant="ghost"
        class="first-col justify-start gap-2 truncate px-2 font-medium"
        @click="$emit('toggle-title')"
      >
        <span class="truncate"> {{ t("library.sortColumn.title") }} </span>
        <IconChevronDown
          v-if="sortKey === 'title_asc'"
          class="size-3 rotate-180 text-green-400"
        />
        <IconChevronDown
          v-else-if="sortKey === 'title_desc'"
          class="size-3 text-green-400"
        />
      </Button>

      <Button
        variant="ghost"
        class="var1-col justify-start gap-2 truncate px-2 font-medium"
        @click="$emit('toggle-album')"
      >
        <span class="truncate"> {{ t("library.sortColumn.album") }} </span>
        <IconChevronDown
          v-if="sortKey === 'album_asc'"
          class="size-3 rotate-180 text-green-400"
        />
        <IconChevronDown
          v-else-if="sortKey === 'album_desc'"
          class="size-3 text-green-400"
        />
      </Button>

      <Button
        variant="ghost"
        class="var2-col justify-start truncate px-2 font-medium"
        @click="$emit('toggle-date')"
      >
        <span class="truncate"> {{ t("library.sortColumn.dateAdded") }} </span>
        <IconChevronDown
          v-if="sortKey === 'date_added_asc'"
          class="size-3 rotate-180 text-green-400"
        />
        <IconChevronDown
          v-else-if="sortKey === 'date_added_desc'"
          class="size-3 text-green-400"
        />
      </Button>

      <div class="last-col flex justify-end">
        <Button
          variant="ghost"
          class="font-medium"
          @click="$emit('toggle-duration')"
        >
          <IconClock class="size-5" />
          <IconChevronDown
            v-if="sortKey === 'duration_asc'"
            class="ml-1 size-3 rotate-180 text-green-400"
          />
          <IconChevronDown
            v-else-if="sortKey === 'duration_desc'"
            class="ml-1 size-3 text-green-400"
          />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import type { TrackSortKey } from "@/modules/tracks/types";
import IconChevronDown from "~icons/tabler/chevron-down";
import IconClock from "~icons/tabler/clock-hour-4";
import IconHashtag from "~icons/tabler/hash";

const { t } = useI18n();

defineProps<{ sortKey: TrackSortKey | null }>();
defineEmits(["toggle-title", "toggle-album", "toggle-date", "toggle-duration"]);
</script>

<style scoped>
.library-sort-header-container {
  container-type: inline-size;
}

.library-sort-header {
  display: grid;
  grid-template-columns: var(--grid-template-columns);
  align-items: center;
  height: 48px;
  gap: 12px;
  color: var(--muted-foreground);
}

.index-col { grid-column: index; }
.first-col { grid-column: first; }
.var1-col { grid-column: var1; }
.var2-col { grid-column: var2; }
.last-col { grid-column: last; }

@container (max-width: 900px) {
  .library-sort-header {
    --grid-template-columns: [index] 28px [first] minmax(160px, 4fr) [var1] minmax(120px, 2fr) [last] minmax(var(--last-min-width), var(--last-max-width)) !important;
  }

  .var2-col { display: none; }
}

@container (max-width: 620px) {
  .library-sort-header {
    --grid-template-columns: [first] minmax(0, 1fr) [last] var(--last-min-width) !important;
    gap: 8px;
  }

  .index-col,
  .var1-col,
  .var2-col { display: none; }
}
</style>
