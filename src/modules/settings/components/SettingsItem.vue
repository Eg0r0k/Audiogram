<template>
  <Item
    tabindex="0"
    size="sm"
    class="cursor-pointer"
    @click="$emit('click')"
  >
    <ItemMedia v-if="icon">
      <component
        :is="icon"
        class="size-6"
      />
    </ItemMedia>

    <ItemContent :class="{ 'ml-4': icon }">
      <ItemTitle class="text-base">
        {{ title }}
      </ItemTitle>
      <InlineError v-if="error">
        {{ error }}
      </InlineError>
      <ItemDescription v-else-if="subtitle">
        {{ subtitle }}
      </ItemDescription>
    </ItemContent>

    <ItemActions>
      <slot name="action" />
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import InlineError from "@/components/common/InlineError.vue";

interface Props {
  /** Same muted 24px glyph as {@link SettingsLink}, so both rows line up. */
  icon?: Component;
  title: string;
  subtitle?: string;
  /** Shown in place of the subtitle until the next attempt clears it. */
  error?: string;
}

defineProps<Props>();
defineEmits<{
  click: [];
}>();
</script>
