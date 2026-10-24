<template>
  <section
    v-if="track"
    class="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6"
  >
    <div
      v-if="status === 'loading'"
      class="space-y-5 pt-2 text-center"
    >
      <Skeleton
        v-for="(width, i) in SKELETON_WIDTHS"
        :key="i"
        :style="{ width }"
        class="mx-auto h-5 sm:h-7"
      />
    </div>

    <LyricsLines
      v-else-if="hasSyncedText"
      kind="synced"
      :lines="lines"
      :active-index="activeLineIndex"
      align="center"
      size="fullscreen"
      :anchor-ratio="0.1"
      @select="seekToLine"
    />

    <LyricsLines
      v-else-if="plainAsLines.length > 0"
      kind="plain"
      :lines="plainAsLines"
      :active-index="-1"
      align="center"
      size="fullscreen"
      :anchor-ratio="0.1"
    />

    <p
      v-else
      class="text-center text-lg text-muted-foreground"
    >
      {{ $t("lyrics.empty") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Skeleton } from "@/components/ui/skeleton";
import { hasLyricsText, type LyricsLine } from "@/modules/player/lib/lrc";
import { useCurrentLyrics } from "@/modules/player/composables/useCurrentLyrics";
import LyricsLines from "./LyricsLines.vue";

const SKELETON_WIDTHS = ["55%", "72%", "48%", "66%", "38%", "60%", "44%"];

const { track, kind, lines, plainLines, status, activeLineIndex, seekToLine } = useCurrentLyrics();

const hasSyncedText = computed(() => kind.value === "synced" && hasLyricsText({ kind: "synced", lines: lines.value }));

const plainAsLines = computed<LyricsLine[]>(() =>
  kind.value === "plain" && hasLyricsText({ kind: "plain", lines: plainLines.value })
    ? plainLines.value.map(text => ({ time: 0, text }))
    : [],
);
</script>
