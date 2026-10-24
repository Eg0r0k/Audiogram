<template>
  <section
    v-if="state === 'loading' || state === 'lines'"
    class="rounded-lg px-4 pt-2 pb-4 transition-[background-color,color] duration-900 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
    :style="{ backgroundColor: surface.background, color: surface.dim }"
  >
    <div class="flex items-center justify-between gap-3">
      <h3 class="text-base font-semibold text-white">
        {{ $t('lyrics.title') }}
      </h3>
      <Button
        variant="ghost"
        size="sm"
        class="-mr-3 text-inherit"
        @click="rightPanel.openLyrics()"
      >
        {{ $t('lyrics.show') }}
      </Button>
    </div>

    <div
      v-if="state === 'loading'"
      class="mt-2 h-28"
    >
      <div
        v-for="width in SKELETON_WIDTHS"
        :key="width"
        class="flex h-7 items-center"
      >
        <Skeleton
          class="h-5 bg-white/16"
          :style="{ width }"
        />
      </div>
    </div>
    <div
      v-else
      class="mt-2 h-28"
    >
      <p
        v-for="row in rows"
        :key="row.index"
        :aria-current="row.current || undefined"
        class="truncate text-xl leading-7 font-semibold"
        :class="row.current && 'text-white'"
      >
        {{ row.text }}
      </p>
    </div>
  </section>

  <section
    v-else-if="state === 'empty' || state === 'error'"
    class="rounded-lg bg-muted p-4"
  >
    <h3 class="text-base font-semibold text-foreground">
      {{ state === 'error' ? $t('lyrics.loadFailed') : $t('lyrics.empty') }}
    </h3>
    <p
      v-if="state === 'empty'"
      class="mt-1 text-sm text-muted-foreground"
    >
      {{ $t('lyrics.emptyHint') }}
    </p>
    <Button
      v-if="state === 'empty'"
      variant="outline"
      color="neutral"
      size="sm"
      class="mt-3"
      @click="rightPanel.openLyrics()"
    >
      {{ $t('lyrics.add') }}
    </Button>
    <Button
      v-else
      variant="outline"
      color="neutral"
      size="sm"
      class="mt-3"
      @click="retry"
    >
      {{ $t('lyrics.retry') }}
    </Button>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { tintedSurface } from "@/lib/color/tinted-surface";
import { useAttachCurrentTrackLyrics } from "@/modules/player/composables/useAttachCurrentTrackLyrics";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";

const props = defineProps<{
  coverColor: string;
}>();

const VISIBLE_LINES = 4;
const SKELETON_WIDTHS = ["72%", "56%", "64%", "44%"];

const lyricsStore = useLyricsStore();
const playerStore = usePlayerStore();
const rightPanel = useRightPanelStore();
const { attachableTrack } = useAttachCurrentTrackLyrics();

const surface = computed(() => tintedSurface(props.coverColor));

// Blank LRC lines are verse separators, not lines to show.
const textLines = computed(() => lyricsStore.lines.flatMap((line, index) =>
  line.text.trim() ? [{ text: line.text, index }] : []));

const state = computed(() => {
  if (lyricsStore.status === "loading") return "loading";
  if (lyricsStore.status === "error") return "error";
  if (lyricsStore.status === "ready" && textLines.value.length > 0) return "lines";
  return attachableTrack.value ? "empty" : "hidden";
});

const rows = computed(() => {
  const lines = textLines.value;
  let current = -1;
  lines.forEach((line, position) => {
    if (line.index <= lyricsStore.activeLineIndex) current = position;
  });
  const start = Math.min(Math.max(current - 1, 0), Math.max(lines.length - VISIBLE_LINES, 0));
  return lines
    .slice(start, start + VISIBLE_LINES)
    .map((line, offset) => ({ ...line, current: start + offset === current }));
});

const retry = () => {
  lyricsStore.loadFor(playerStore.currentTrack)
    .catch(() => {});
};
</script>
