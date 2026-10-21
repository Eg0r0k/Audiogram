<template>
  <Item
    v-ripple
    as-child
    size="sm"
    class="cursor-pointer"
  >
    <Link :to="to">
      <ItemMedia>
        <component
          :is="icon"
          class="size-6"
        />
      </ItemMedia>

      <ItemContent class=" ml-4">
        <ItemTitle class=" text-base">
          {{ title }}
        </ItemTitle>
        <ItemDescription v-if="$slots.description || description">
          <slot name="description">
            {{ description }}
          </slot>
        </ItemDescription>
      </ItemContent>

      <ItemActions>
        <ItemDescription
          v-if="subtitle"
          class=" capitalize"
        >
          {{ subtitle }}
        </ItemDescription>
        <IconChevronRight class="size-5 text-muted-foreground" />
      </ItemActions>
    </Link>
  </Item>
</template>

<script setup lang="ts">
import { Item, ItemContent, ItemMedia, ItemTitle, ItemActions, ItemDescription } from "@/components/ui/item";
import Link from "@/components/ui/link/Link.vue";
import IconChevronRight from "~icons/tabler/chevron-right";
import { type Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

interface Props {
  to: RouteLocationRaw;
  icon: Component;
  title: string;
  /** Under the title. */
  description?: string;
  /** Muted, on the right: the current value behind the link. */
  subtitle?: string;
}

defineProps<Props>();
</script>
