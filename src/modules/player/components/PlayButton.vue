<template>
  <Motion
    tabindex="-1"
    :while-press="{ scale: 0.95 }"
    class="size-fit"
  >
    <Button
      :class="cn('relative p-0 size-10 min-w-10 rounded-full overflow-hidden', props.class)"
      :disabled="!canInteract"
      :aria-label="shouldShowPauseIcon ? $t('player.pause') : $t('player.play')"
      @click="toggle"
    >
      <MorphIcon
        tabindex="-1"
        :icon="shouldShowPauseIcon ? pausePath : playPath"
        :size="props.iconSize"
        spring="snappy"
        reduced-motion="user"
        class="morph-icon relative z-10"
      />

      <Spinner
        v-if="playerStore.showLoadingIndicator"
        class="size-10 pointer-events-none absolute inset-0 m-auto z-0"
      />
    </Button>
  </Motion>
</template>

<script setup lang="ts">
import { Motion } from "motion-v";
import { MorphIcon } from "morphicons/vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { computed, type HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import { svgPathData } from "@/lib/svg";
import { getLogger } from "@/lib/logger";
import { usePlayerStore } from "@/modules/player/store/player.store";
import playSvg from "@/assets/icons/play-rounded.svg?raw";
import pauseSvg from "@/assets/icons/pause-rounded.svg?raw";

interface Props {
  class?: HTMLAttributes["class"];
  iconSize?: number;
}

const props = withDefaults(defineProps<Props>(), { iconSize: 32, class: undefined });
const playerStore = usePlayerStore();

const playPath = svgPathData(playSvg);
const pausePath = svgPathData(pauseSvg);

const isLoading = computed(() => playerStore.isLoading);
const shouldShowPauseIcon = computed(() => playerStore.isPlaying || isLoading.value);
const canInteract = computed(() => !playerStore.showLoadingIndicator);

const toggle = () => {
  if (isLoading.value) return;
  playerStore.togglePlay()
    .catch(error => getLogger().error(`[Player] Toggling playback failed: ${String(error)}`));
};
</script>

<style scoped>
.morph-icon {
  fill: currentColor;
  stroke: none;
}
</style>
