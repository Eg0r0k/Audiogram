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
      variant="solid"
      color="silver"
      size="sm"
      class="mt-3"
      @click="rightPanel.openLyrics()"
    >
      {{ $t('lyrics.add') }}
    </Button>
    <Button
      v-else
      variant="solid"
      color="silver"
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
import { useCurrentLyrics } from "@/modules/player/composables/useCurrentLyrics";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";

const props = defineProps<{
  coverColor: string;
}>();

const VISIBLE_LINES = 4;
const SKELETON_WIDTHS = ["72%", "56%", "64%", "44%"];

const lyricsStore = useLyricsStore();
const rightPanel = useRightPanelStore();
const { track, kind, lines, plainLines, status, activeLineIndex } = useCurrentLyrics();
const { attachableTrack } = useAttachCurrentTrackLyrics();

const surface = computed(() => tintedSurface(props.coverColor));

// Blank lines are verse separators, not lines to show.
const textLines = computed(() => {
  const texts = kind.value === "plain" ? plainLines.value : lines.value.map(line => line.text);
  return texts.flatMap((text, index) => (text.trim() ? [{ text, index }] : []));
});

const state = computed(() => {
  if (status.value === "loading") return "loading";
  if (status.value === "error") return "error";
  if (status.value === "ready" && textLines.value.length > 0) return "lines";
  return attachableTrack.value ? "empty" : "hidden";
});

const rows = computed(() => {
  const visible = textLines.value;
  let current = -1;
  visible.forEach((line, position) => {
    if (line.index <= activeLineIndex.value) current = position;
  });
  const start = Math.min(Math.max(current - 1, 0), Math.max(visible.length - VISIBLE_LINES, 0));
  return visible
    .slice(start, start + VISIBLE_LINES)
    .map((line, offset) => ({ ...line, current: start + offset === current }));
});

const retry = () => {
  lyricsStore.loadFor(track.value)
    .catch(() => {});
};
</script>
