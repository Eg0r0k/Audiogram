<template>
  <div class="px-4 pt-2 pb-3">
    <div class="flex items-center gap-3">
      <NuxtImage
        :src="coverUrl"
        :alt="input.track.title"
        :width="48"
        :height="48"
        fallback-src="/img/fallback.svg"
        class="size-12 shrink-0 rounded object-cover"
      />
      <div class="min-w-0 flex-1">
        <DrawerTitle class="truncate">
          {{ input.track.title }}
        </DrawerTitle>
        <DrawerDescription class="truncate">
          {{ input.track.artist }}
        </DrawerDescription>
      </div>
    </div>

    <template v-if="tiles.length">
      <div class="mt-4 grid grid-cols-3 gap-3">
        <label
          v-for="tile in tiles"
          :key="tile.id"
          :for="`${idPrefix}-${tile.id}`"
          class="flex min-w-0 flex-col items-center gap-2"
        >
          <Button
            :id="`${idPrefix}-${tile.id}`"
            color="accent"
            class="h-16 w-full rounded-control-xl icon-size-6"
            :aria-pressed="tile.pressed"
            :aria-disabled="tile.disabled || undefined"
            @click="runTile(tile)"
          >
            <component
              :is="TRACK_MENU_ICONS[tile.icon]"
              :class="tile.icon === 'liked' ? 'text-primary' : undefined"
            />
          </Button>
          <span class="line-clamp-2 text-center text-label-md text-foreground">
            {{ $t(tile.label) }}
          </span>
        </label>
      </div>
      <Separator class="mt-4" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";
import { Button } from "@/components/ui/button";
import { DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { Separator } from "@/components/ui/separator";
import type { Track } from "@/types/track";
import { useTrackRowCover } from "@/modules/tracks/composables/useTrackRowCover";
import type { HeaderTile, TrackMenuFacts } from "@/modules/tracks/lib/trackMenu";
import { useTrackMenuModel } from "./composables/useTrackMenuModel";
import { TRACK_MENU_ICONS } from "./trackMenuIcons";
import type { TrackMenuActions } from "./type";

const props = defineProps<{
  input: TrackMenuFacts;
  actions: TrackMenuActions;
}>();

const coverUrl = useTrackRowCover(() => props.input.track as Track);

const model = useTrackMenuModel(() => props.input);
const tiles = computed(() => model.value.header);

const idPrefix = useId();

const runTile = (tile: HeaderTile) => (tile.disabled ? undefined : props.actions[tile.action]?.());
</script>
