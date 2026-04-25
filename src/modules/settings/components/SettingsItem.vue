<template>
  <Item
    tabindex="0"
    size="sm"
    class="cursor-pointer"
    @click="$emit('click')"
  >
    <ItemMedia v-if="icon">
      <div
        class="size-8 rounded-lg flex items-center justify-center text-white"
        :class="iconClass"
      >
        <Icon
          :icon="icon"
          class="size-5"
        />
      </div>
    </ItemMedia>

    <ItemContent>
      <ItemTitle>{{ title }}</ItemTitle>
      <ItemSubtitle v-if="subtitle">
        {{ subtitle }}
      </ItemSubtitle>
    </ItemContent>

    <ItemActions>
      <slot name="action" />
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemSubtitle,
  ItemTitle,
} from "@/components/ui/item";

interface Props {
  icon?: string;
  iconClass?: string;
  title: string;
  subtitle?: string;
}

defineProps<Props>();
defineEmits<{
  click: [];
}>();
</script>
