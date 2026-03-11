<template>
  <Link
    :to="to"
    class="block min-w-36 w-full"
    :draggable="false"
  >
    <div
      class="flex group cursor-pointer select-none flex-col p-3 gap-2 rounded-lg hover:bg-muted transition-colors w-full"
      @contextmenu="$emit('contextmenu', $event)"
    >
      <div class="relative">
        <div
          class="aspect-square overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow"
          :class="rounded ? 'rounded-full' : 'rounded-md'"
        >
          <NuxtImage
            :src="image"
            :alt="title"
            :placeholder="true"
            fallback-src="/img/fallback.svg"
            class="size-full object-cover"
          />
        </div>

        <div
          class="absolute bottom-0 right-0 sm:bottom-2 sm:right-2"
          :class="rounded ? 'bottom-4 right-4 sm:bottom-5 sm:right-5' : ''"
        >
          <Button
            size="icon-lg"
            class="rounded-full size-12 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
            @click.prevent.stop="$emit('play')"
          >
            <IconPlay class="size-5 fill-current" />
          </Button>
        </div>
      </div>

      <div class="flex flex-col min-w-0">
        <span
          class="font-semibold truncate"
          :class="rounded ? 'text-center' : ''"
        >
          {{ title }}
        </span>
        <span
          v-if="subtitle"
          class="text-sm text-muted-foreground truncate"
          :class="rounded ? 'text-center' : ''"
        >
          {{ subtitle }}
        </span>
      </div>
    </div>
  </Link>
</template>

<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import IconPlay from "~icons/tabler/player-play-filled";
import type { RouteLocationRaw } from "vue-router";

withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  image?: string | null;
  to: RouteLocationRaw;
  rounded?: boolean;
}>(), {
  subtitle: undefined,
  image: null,
  rounded: false,
});

defineEmits<{
  play: [];
  contextmenu: [event: MouseEvent];
}>();
</script>
