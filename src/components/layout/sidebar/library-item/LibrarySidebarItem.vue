<script setup lang="ts">
import { computed, h, type FunctionalComponent } from "vue";
import { useRouter } from "vue-router";
import type { LibraryItem } from "@/modules/library/types";
import { Item } from "@/components/ui/item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "@/components/ui/link/Link.vue";
import { useLibraryMenu } from "@/modules/library/composables/useLibraryMenu";
import LibraryItemCover from "./LibraryItemCover.vue";
import LibraryItemInfo from "./LibraryItemInfo.vue";
import { useLibraryItemView } from "./useLibraryItemView";
import { getLogger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

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

const { openMenu, isMenuOpenFor } = useLibraryMenu();
const router = useRouter();

// The row keeps its hover look while its own context menu is up.
const isMenuSelected = computed(() => isMenuOpenFor(props.item));

const { subtitle, coverOwnerType, coverOwnerId, isCurrentPlaybackSource }
  = useLibraryItemView(() => props.item);

// Only the collapsed sidebar shows a tooltip; a full row would mount a tooltip
// root, trigger and popper anchor per item for nothing.
const CompactTooltip: FunctionalComponent<{ enabled: boolean }> = (tooltip, { slots }) => (tooltip.enabled
  ? h(Tooltip, null, () => [
      h(TooltipTrigger, { asChild: true }, slots.default),
      h(TooltipContent, { side: "right", sideOffset: 10 }, slots.content),
    ])
  : slots.default?.());

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
    .catch(error => getLogger().error(`[LibrarySidebarItem] Navigation failed: ${formatError(error)}`));
};
</script>

<template>
  <CompactTooltip :enabled="!!compact">
    <div
      v-ripple
      class="group/row block rounded-sm focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none focus-visible:border-ring cursor-pointer"
      :data-menu-open="isMenuSelected || undefined"
      role="button"
      :class="compact ? '' : 'mx-2'"
      tabindex="0"
      @click="handleClick"
      @keydown.enter="handleClick"
      @contextmenu="openMenu(item, $event)"
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
              ? 'bg-primary text-primary-foreground group-hover/row:bg-primary/95 group-data-menu-open/row:bg-primary/95'
              : 'group-hover/row:bg-accent/60 group-data-menu-open/row:bg-accent/60',
            compact ? 'justify-center gap-0 px-2 mx-1' : 'gap-3 px-3',
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

    <template #content>
      <p class="font-medium">
        {{ item.title }}
      </p>
      <p class="text-muted-foreground">
        {{ subtitle }}
      </p>
    </template>
  </CompactTooltip>
</template>
