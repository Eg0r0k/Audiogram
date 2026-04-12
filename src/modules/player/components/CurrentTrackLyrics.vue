<template>
  <section
    v-if="track"
    class="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6"
  >
    <div
      v-if="playerStore.lyrics.length > 0"
      class="space-y-5 text-center"
    >
      <button
        v-for="(line, index) in playerStore.lyrics"
        :ref="element => setLineRef(element, index)"
        :key="`${line.time}-${index}`"
        type="button"
        :class="getLineClass(index, line.text)"
        @click="handleLineClick(line.time)"
      >
        {{ line.text || "\u00A0" }}
      </button>
    </div>

    <p
      v-else
      class="pt-6 text-center text-lg text-muted-foreground sm:text-xl"
    >
      {{ placeholderText }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { ComponentPublicInstance, computed, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { Track } from "@/modules/player/types";

const playerStore = usePlayerStore();
const { t } = useI18n();
const lineRefs: Array<HTMLElement | null> = [];

const track = computed<Track | null>(() => {
  const currentTrack = playerStore.currentTrack;
  return currentTrack?.kind === "library" ? currentTrack : null;
});

const placeholderText = computed(() => {
  if (playerStore.lyricsStatus === "loading") {
    return t("player.lyricsLoading");
  }

  if (playerStore.lyricsStatus === "error") {
    return t("player.lyricsLoadFailed");
  }

  return t("player.lyricsEmpty");
});

watch(
  () => playerStore.activeLyricsIndex,
  async (index) => {
    if (index < 0) return;

    await nextTick();
    lineRefs[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  },
);

function setLineRef(element: Element | ComponentPublicInstance | null, index: number) {
  if (element instanceof HTMLElement) {
    lineRefs[index] = element;
  }
  else {
    lineRefs[index] = null;
  }
}

function handleLineClick(time: number) {
  if (!playerStore.canSeek) return;
  playerStore.seekTo(time);
}

function getLineClass(index: number, text: string): string {
  const isActive = index === playerStore.activeLyricsIndex;

  if (isActive) {
    return "lyrics-line-active block w-full cursor-pointer bg-transparent text-center text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl";
  }

  if (!text.trim()) {
    return "lyrics-line-inactive block h-6 w-full bg-transparent sm:h-8";
  }

  return "lyrics-line-inactive block w-full cursor-pointer bg-transparent text-center text-xl leading-relaxed text-muted-foreground/55 sm:text-2xl";
}
</script>

<style scoped>
.lyrics-line-active,
.lyrics-line-inactive {
  transition:
    color 220ms ease,
    opacity 220ms ease,
    transform 260ms ease,
    filter 220ms ease;
}

.lyrics-line-active {
  opacity: 1;
  filter: blur(0);
  transform: scale(1);
}

.lyrics-line-inactive {
  opacity: 0.58;
  filter: blur(0.2px);
  transform: scale(0.985);
}
</style>
