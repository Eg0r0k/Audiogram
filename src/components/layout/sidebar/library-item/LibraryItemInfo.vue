<script setup lang="ts">
import type { LibraryItem } from "@/modules/library/types";
import { Badge } from "@/components/ui/badge";
import { ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import IconPinFilled from "~icons/tabler/pin-filled";
import IconVolume from "~icons/tabler/volume";

defineProps<{
  item: LibraryItem;
  subtitle: string;
  active?: boolean;
  isPlaybackSource?: boolean;
}>();
</script>

<template>
  <ItemContent class="min-w-0 overflow-hidden">
    <ItemTitle
      class="block min-w-0 w-full! overflow-hidden text-ellipsis whitespace-nowrap"
      :class="active ? 'text-primary-foreground' : ''"
    >
      <span class="flex items-center min-w-0 gap-1">
        <span
          class="truncate"
          :title="item.title"
        >
          {{ item.title }}
        </span>

        <IconVolume
          v-if="isPlaybackSource"
          class="size-5 shrink-0"
          :class="active ? 'text-white' : 'text-primary'"
        />

        <IconPinFilled
          v-if="item.isPinned"
          class="ms-auto size-4 shrink-0"
          :class="active ? 'text-white' : 'text-primary'"
        />
      </span>
    </ItemTitle>

    <ItemDescription
      class="block min-w-0 leading-5.5"
      :class="active ? 'text-primary-foreground' : ''"
    >
      <span class="flex items-center min-w-0 gap-1">
        <span
          class="min-w-0 flex-1 truncate"
          :title="subtitle"
        >
          {{ subtitle }}
        </span>

        <Badge
          v-if="item.count !== undefined"
          variant="soft"
          color="neutral"
          size="lg"
          class="shrink-0 h-5.5 min-w-5.5 px-1.75 bg-accent text-white"
        >{{ item.count }}</Badge>
      </span>
    </ItemDescription>
  </ItemContent>
</template>
