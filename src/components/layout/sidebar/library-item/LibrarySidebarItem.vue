<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import type { LibraryItem } from "@/modules/library/types";
import { Item } from "@/components/ui/item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "@/components/ui/link/Link.vue";
import { canOpenLibraryMenu, useLibraryMenu } from "@/modules/library/composables/useLibraryMenu";
import LibraryItemCover from "./LibraryItemCover.vue";
import LibraryItemInfo from "./LibraryItemInfo.vue";
import { useLibraryItemView } from "./useLibraryItemView";
import { getLogger } from "@/lib/logger";

const props = defineProps<{
  item: LibraryItem;
  compact?: boolean;
}>();

const emit = defineEmits<{
  openFolder: [folderId: string];
  startRadio: [station: string];
}>();

// Folders open in place and stations start playback: neither is a page, so
// neither takes the route highlight.
const isPageRow = computed(() => props.item.type !== "folder" && props.item.type !== "radio");

const { openMenu, activeItem, isContextMenuOpen } = useLibraryMenu();
const router = useRouter();

// The row keeps its hover look while its own context menu is up.
const isMenuSelected = computed(() =>
  isContextMenuOpen.value
  && activeItem.value?.id === props.item.id
  && activeItem.value.type === props.item.type,
);

const { subtitle, coverOwnerType, coverOwnerId, isCurrentPlaybackSource }
  = useLibraryItemView(() => props.item);

const handleClick = () => {
  if (props.item.type === "folder") {
    emit("openFolder", props.item.id);
    return;
  }
  if (props.item.type === "radio") {
    emit("startRadio", props.item.id);
    return;
  }

  router.push(props.item.to)
    .catch(error => getLogger().error(`[LibrarySidebarItem] Navigation failed: ${String(error)}`));
};
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <div
        v-ripple
        class="group/row block rounded-sm focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none focus-visible:border-ring cursor-pointer"
        data-library-item
        :data-library-menu="canOpenLibraryMenu(item) ? undefined : 'none'"
        :data-menu-open="isMenuSelected || undefined"
        role="button"
        :class="compact ? '' : 'mx-2'"
        tabindex="0"
        @click="handleClick"
        @keydown.enter="handleClick"
        @contextmenu="openMenu(item)"
      >
        <Link
          v-slot="{ isExactActive }"
          :to="item.to"
          inactive
        >
          <Item
            class="min-w-0 py-2 transition-colors pointer-events-none"
            :class="[
              isExactActive && isPageRow
                ? 'bg-primary text-primary-foreground group-hover/row:bg-primary/95 group-data-[menu-open]/row:bg-primary/95'
                : 'group-hover/row:bg-accent/60 group-data-[menu-open]/row:bg-accent/60',
              compact ? 'justify-center gap-0 px-2' : 'gap-3 px-3',
            ]"
          >
            <LibraryItemCover
              :item="item"
              :cover-owner-type="coverOwnerType"
              :cover-owner-id="coverOwnerId"
              :compact="compact"
              :active="isExactActive && isPageRow"
              :is-playback-source="isCurrentPlaybackSource"
            />

            <LibraryItemInfo
              v-if="!compact"
              :item="item"
              :subtitle="subtitle"
              :active="isExactActive && isPageRow"
              :is-playback-source="isCurrentPlaybackSource"
            />
          </Item>
        </Link>
      </div>
    </TooltipTrigger>

    <TooltipContent
      v-if="compact"
      side="right"
      :side-offset="10"
    >
      <p class="font-medium">
        {{ item.title }}
      </p>
      <p class="text-muted-foreground">
        {{ subtitle }}
      </p>
    </TooltipContent>
  </Tooltip>
</template>
