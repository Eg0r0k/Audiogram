<template>
  <CrossfadeTransition class="h-full">
    <div
      v-if="loading"
      class="flex flex-col gap-2 overflow-hidden p-2"
    >
      <div
        v-for="i in 20"
        :key="i"
        class="flex items-center gap-3 px-2"
        :class="compact && 'justify-center'"
      >
        <Skeleton class="size-13.5 rounded-full shrink-0" />
        <div
          v-if="!compact"
          class="flex flex-col gap-2 w-full"
        >
          <Skeleton class="h-3 w-[40%]" />
          <Skeleton class="h-3 w-[65%]" />
        </div>
      </div>
    </div>

    <VirtualScrollable
      v-else
      ref="scrollableRef"
      hide-thumb
      :padding-top="8"
      :padding-bottom="8"
      :items="items"
      :item-height="74"
      :get-item-key="getItemKey"
      animate-reorder
      :loading="loadingMore"
      @scroll="emit('scroll', $event)"
      @load-more="emit('loadMore')"
    >
      <template #default="{ item }">
        <LibrarySidebarItem
          :item="item"
          :compact="compact"
          @open-folder="emit('openFolder', $event)"
          @start-radio="emit('startRadio', $event)"
        />
      </template>
    </VirtualScrollable>
  </CrossfadeTransition>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue";
import CrossfadeTransition from "@/components/transitions/CrossfadeTransition.vue";
import LibrarySidebarItem from "@/components/layout/sidebar/library-item/LibrarySidebarItem.vue";
import { useScrollRestoration } from "@/components/ui/scrollable/useScrollRestoration";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import Skeleton from "@/components/ui/skeleton/Skeleton.vue";
import type { LibraryItem } from "@/modules/library/types";

const props = defineProps<{
  items: LibraryItem[];
  loading: boolean;
  loadingMore: boolean;
  compact: boolean;
  /** Each list keeps its own scroll position under this key. */
  restoreKey: string;
}>();

const emit = defineEmits<{
  scroll: [event: Event];
  loadMore: [];
  openFolder: [id: string];
  startRadio: [station: string];
}>();

const scrollableRef = useTemplateRef("scrollableRef");

useScrollRestoration(scrollableRef, {
  key: () => props.restoreKey,
  ready: () => !props.loading,
  deps: () => props.items.length,
});

const getItemKey = (index: number) => {
  const item = props.items[index] as LibraryItem | undefined;
  return item ? `${item.type}:${item.id}` : index;
};
</script>
