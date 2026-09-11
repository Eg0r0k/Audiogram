<template>
  <div
    class="sticky top-0 z-15 h-[72px] border-b bg-card @settings-wide:bg-canvas"
    :class="isScrolled ? 'border-b dark:border-background @settings-wide:dark:border-border' : 'border-transparent'"
  >
    <div class="mx-auto flex h-full w-full items-center gap-6 px-4 @settings-wide:max-w-settings">
      <Button
        variant="ghost"
        size="icon-lg"
        class="rounded-full"
        @click="$router.back()"
      >
        <IconArrowLeft
          class="size-6"
        />
      </Button>
      <h1 class="font-bold text-xl py-3">
        {{ title }}
      </h1>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from "vue";
import { scrollableInjectionKey } from "@/components/ui/scrollable/injection";
import Button from "@/components/ui/button/Button.vue";
import IconArrowLeft from "~icons/tabler/arrow-left";

defineProps<{
  title: string;
}>();

const scrollable = inject(scrollableInjectionKey);

const isScrolled = computed(() => !scrollable?.isScrolledToStart.value);
</script>
