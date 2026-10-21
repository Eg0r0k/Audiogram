<template>
  <Item
    class="px-2 flex-nowrap "
    @click="emit('click')"
  >
    <ItemMedia v-if="$slots.icon">
      <div
        class="size-8 rounded-lg flex items-center justify-center"
        :class="iconClass"
      >
        <slot name="icon" />
      </div>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ title }}</ItemTitle>
      <ItemDescription
        v-if="displayValue"
      >
        {{ displayValue }}
      </ItemDescription>
    </ItemContent>

    <ItemActions>
      <slot name="action" />
    </ItemActions>
  </Item>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";

defineOptions({
  inheritAttrs: false,
});

const emit = defineEmits<{
  (e: "click"): void;
}>();

const props = defineProps<{
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
