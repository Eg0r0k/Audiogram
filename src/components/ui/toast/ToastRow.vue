<script setup lang="ts">
import { computed } from "vue";

import { Spinner } from "@/components/ui/spinner";
import { type Toast, toastIcons } from ".";
import ToastAction from "./ToastAction.vue";
import ToastClose from "./ToastClose.vue";
import ToastDescription from "./ToastDescription.vue";
import ToastTitle from "./ToastTitle.vue";

const props = defineProps<{ toast: Toast }>();

const icon = computed(() =>
  props.toast.icon === false ? undefined : (props.toast.icon ?? toastIcons[props.toast.color ?? "neutral"]),
);
</script>

<template>
  <div class="flex items-center gap-2.5">
    <Spinner
      v-if="props.toast.loading"
      class="size-5"
    />
    <component
      :is="icon"
      v-else-if="icon"
      data-slot="toast-icon"
      aria-hidden="true"
      class="size-5 shrink-0 text-tone-text"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <ToastTitle v-if="props.toast.title">
        {{ props.toast.title }}
      </ToastTitle>
      <ToastDescription v-if="props.toast.description">
        {{ props.toast.description }}
      </ToastDescription>
    </div>
    <div
      v-if="props.toast.actions?.length"
      class="flex shrink-0 items-center gap-2 self-center"
    >
      <ToastAction
        v-for="action in props.toast.actions"
        :key="action.label"
        :alt-text="action.altText ?? action.label"
        @click="action.onClick?.($event)"
      >
        {{ action.label }}
      </ToastAction>
    </div>
    <ToastClose
      v-if="props.toast.close === true"
      class="-mt-1.5 -mb-1 -me-1.5"
    />
  </div>
</template>
