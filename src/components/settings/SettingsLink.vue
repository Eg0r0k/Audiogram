<template>
  <Item
    v-ripple
    as-child
    size="sm"
    class="cursor-pointer"
  >
    <Link :to="to">
      <ItemMedia>
        <Icon
          :icon="icon"
          class="size-6"
        />
      </ItemMedia>

      <ItemContent class=" ml-4">
        <ItemTitle class=" text-base">
          {{ title }}
        </ItemTitle>
      </ItemContent>

      <ItemActions>
        <ItemSubtitle>
          {{ subtitle }}
        </ItemSubtitle>
      </ItemActions>
    </Link>
  </Item>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Item, ItemContent, ItemMedia, ItemTitle, ItemActions } from "@/components/ui/item";
import Link from "@/components/ui/link/Link.vue";
import ItemSubtitle from "../ui/item/ItemSubtitle.vue";

interface Props {
  to: string;
  icon: string;
  title: string;
  subtitle?: string;
}

defineProps<Props>();
</script>
