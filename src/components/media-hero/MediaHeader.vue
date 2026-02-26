<template>
  <header
    class="sticky top-0 z-10 transition-all duration-200 ease-standard"
    :class="[
      isScrolled
        ? 'bg-background/80 backdrop-blur-lg '
        : 'bg-transparent'
    ]"
  >
    <div class="flex items-center gap-7 px-7 py-4">
      <Button
        variant="ghost"
        size="icon-lg"
        class="rounded-full shrink-0"
        :class="!isScrolled ? 'text-white bg-white/5' : ''"
        @click="$router.back()"
      >
        <IconArrowLeft class="size-5" />
      </Button>

      <div class="flex-1 min-w-0">
        <Transition
          enter-active-class="transition-all duration-200 ease-standard"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-standard"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
          mode="out-in"
        >
          <h1
            v-if="isScrolled"
            class="font-semibold text-base truncate"
          >
            {{ title }}
          </h1>
        </Transition>
      </div>

      <Transition
        enter-active-class="transition-all duration-200 ease-standard"
        enter-from-class="opacity-0 scale-75"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition-all duration-150 ease-standard"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-75"
        mode="out-in"
      >
        <Button
          v-if="isScrolled"
          size="icon"
          class="rounded-full shrink-0"
          :aria-label="$t('player.play')"
          @click="$emit('play')"
        >
          <IconPlay class="size-5" />
        </Button>
      </Transition>
    </div>
  </header>
</template>

<script setup lang="ts">
import { inject, computed, type ComputedRef } from "vue";
import { Button } from "@/components/ui/button";
import IconArrowLeft from "~icons/tabler/arrow-left";
import IconPlay from "~icons/tabler/player-play-filled";

defineProps<{
  title: string;
}>();

defineEmits<{
  play: [];
}>();

interface ScrollableContext {
  scrollPosition: ComputedRef<number> & { value: number };
}

const scrollable = inject<ScrollableContext | null>("scrollable", null);

const isScrolled = computed(() => {
  if (!scrollable) return false;
  return scrollable.scrollPosition.value > 60;
});
</script>
