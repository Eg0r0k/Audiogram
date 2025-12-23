<template>
  <SettingsGroup
    class="sticky top-0 z-10 bg-background border-b transition-colors duration-200"
    :class="isScrolled ? 'border-background' : 'border-transparent'"
  >
    <div class="flex px-2 gap-6 items-center">
      <Button
        variant="ghost"
        size="icon-lg"
        class="rounded-full"
        @click="$router.back()"
      >
        <Icon
          class="size-6"
          icon="tabler:arrow-left"
        />
      </Button>
      <h1 class="font-bold text-xl py-3">
        {{ title }}
      </h1>
    </div>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { inject, computed, type Ref, type ComputedRef } from "vue";
import { Icon } from "@iconify/vue";
import Button from "@/components/ui/button/Button.vue";
import SettingsGroup from "./SettingsGroup.vue";

defineProps<{
  title: string;
}>();

const scrollable = inject<{
  isScrolledToStart: ComputedRef<boolean>;
}>("scrollable");

const isScrolled = computed(() => !scrollable?.isScrolledToStart.value);
</script>
