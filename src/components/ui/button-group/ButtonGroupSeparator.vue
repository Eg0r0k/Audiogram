<script setup lang="ts">
import type { HTMLAttributes } from "vue";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const props = withDefaults(
  defineProps<{
    orientation?: "horizontal" | "vertical";
    class?: HTMLAttributes["class"];
  }>(),
  { orientation: "vertical" },
);
</script>

<template>
  <Separator
    data-slot="button-group-separator"
    :orientation="props.orientation"
    :class="cn('relative m-0 self-stretch bg-transparent data-[orientation=vertical]:h-auto', props.class)"
  />
</template>
