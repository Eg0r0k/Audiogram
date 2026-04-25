<template>
  <Item class="px-2">
    <ItemMedia v-if="icon">
      <div
        class="size-8 rounded-lg flex items-center justify-center"
        :class="iconClass"
      >
        <Icon
          :icon="icon"
          class="size-6"
        />
      </div>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ title }}</ItemTitle>
      <ItemSubtitle v-if="displayValue">
        {{ displayValue }}
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
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  icon?: string;
  iconClass?: string;
  title: string;
  value?: string | number | null;
}>();

const displayValue = computed(() => {
  return props.value === undefined || props.value === null || props.value === ""
    ? "—"
    : String(props.value);
});
</script>
