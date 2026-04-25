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
      </ItemContent>

      <ItemActions>
        <ItemSubtitle class=" capitalize">
          {{ subtitle }}
        </ItemSubtitle>
      </ItemActions>
    </Link>
  </Item>
</template>

<script setup lang="ts">
import { Item, ItemContent, ItemMedia, ItemTitle, ItemActions, ItemSubtitle } from "@/components/ui/item";
import Link from "@/components/ui/link/Link.vue";
import { type Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

interface Props {
  to: RouteLocationRaw;
  icon: Component;
  title: string;
  subtitle?: string;
}

defineProps<Props>();
</script>
