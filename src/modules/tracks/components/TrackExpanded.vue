<template>
  <div
    ref="rowRef"
    v-ripple
    role="button"
    tabindex="0"
    data-track-row
    :class="[
      'library-track-row group h-14 w-full select-none cursor-pointer items-center rounded-md px-3 transition-colors outline-none',
      rowStateClass,
      'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    ]"
    @click="handleClick"
    @keypress="handleClick"
    @contextmenu="emit('contextmenu', track)"
  >
    <div class="index-col hidden md:flex items-center justify-center">
      <span class="text-center font-medium text-muted-foreground text-sm">
        {{ index }}
      </span>
    </div>

    <div class="first-col flex min-w-0 items-center gap-3">
      <div class="relative size-10 shrink-0 overflow-hidden rounded bg-muted z-10">
        <NuxtImage
          :src="coverUrl"
          :alt="track.title"
          fallback-src="/img/fallback.svg"
          class="size-full object-cover"
        />
        <div
          :class="[
            'absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity',
            (isRowHovered || props.isActive) ? 'opacity-100' : 'opacity-0',
          ]"
        >
          <IconPause
            v-if="isActive && isPlaying && isRowHovered"
            class="size-4.5 text-white"
          />
          <IconPlay
            v-else
            class="size-4.5 text-white"
          />
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div :class="['truncate text-sm font-medium hover:underline', isActive ? 'text-primary' : 'text-foreground']">
          {{ track.title }}
        </div>
        <div class="flex items-center truncate text-xs text-muted-foreground">
          <span
            v-if="isExplicit"
            class="mr-1.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted font-semibold text-[10px] uppercase text-foreground"
          >E</span>
          <template
            v-for="(artist, artistIndex) in artists"
            :key="`${track.id}-${artistIndex}`"
          >
            <span
              role="link"
              tabindex="0"
              class="cursor-pointer  truncate underline-offset-2 hover:text-foreground hover:underline"
              @click.stop="handleArtistClick(artistIndex)"
              @keydown.enter.stop="handleArtistClick(artistIndex)"
            >
              {{ artist }}
            </span>
            <span v-if="artistIndex < artists.length - 1">,&nbsp;</span>
          </template>
        </div>
      </div>
    </div>

    <div class="var1-col hidden min-w-0 md:block truncate text-sm text-muted-foreground">
      <span
        role="link"
        tabindex="0"
        class="cursor-pointer hover:text-foreground hover:underline pl-2"
        @click.stop="handleAlbumClick"
        @keydown.enter.stop="handleAlbumClick"
      >
        {{ track.albumName }}
      </span>
    </div>

    <div class="var2-col pl-2 hidden min-w-0 lg:block truncate text-sm text-muted-foreground">
      {{ relativeAddedAt }}
    </div>

    <div class="last-col flex items-center justify-end relative">
      <span class="text-sm text-muted-foreground sm:group-hover:hidden [@media(hover:none)]:hidden">
        {{ formatDuration(track.duration) }}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        class="absolute rounded-full opacity-0 transition-opacity [@media(hover:none)]:opacity-100 sm:group-hover:opacity-100"
        @click.stop="onDotsClick"
      >
        <IconDots class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useElementHover } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { formatDuration } from "@/lib/format/time";
import { useEntityCover } from "@/modules/covers/composables/useEntityCover";
import type { Track } from "@/modules/player/types";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { routeLocation } from "@/app/router/route-locations";
import IconDots from "~icons/tabler/dots";
import IconPause from "~icons/tabler/player-pause-filled";
import IconPlay from "~icons/tabler/player-play-filled";

interface Props {
  track: Track;
  index: number;
  isActive?: boolean;
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  isSelected: false,
});

const emit = defineEmits<{
  play: [track: Track];
  contextmenu: [track: Track];
  select: [track: Track];
}>();

const playerStore = usePlayerStore();
const router = useRouter();
const { locale } = useI18n();
const { openDropdown } = useTrackMenu();

const rowRef = useTemplateRef("rowRef");
const isRowHovered = useElementHover(() => rowRef.value);
const { url: coverBlobUrl } = useEntityCover("album", () => props.track.albumId);

const coverUrl = computed(() => coverBlobUrl.value ?? "/img/fallback.svg");
const isPlaying = computed(() => playerStore.isPlaying);
const isExplicit = computed(() => Boolean(props.track.isExplicit));
const relativeAddedAt = computed(() => formatRelativeTime(props.track.addedAt));
const artists = computed(() => {
  const artistStr = props.track.artist;
  if (!artistStr) return [];
  return artistStr.split(/,\s*/).map(artist => artist.trim()).filter(Boolean);
});

const rowStateClass = computed(() => {
  if (props.isSelected) return "bg-accent/80";
  if (props.isActive) return "bg-primary/10";
  return "hover:bg-muted/50";
});

function handleClick(event: MouseEvent | KeyboardEvent) {
  if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey)) {
    emit("select", props.track);
    return;
  }
  emit("play", props.track);
}

function onDotsClick(event: MouseEvent) {
  openDropdown(props.track, props.index, event, { target: "default" });
}

function handleArtistClick(index: number) {
  const artistId = props.track.artistIds?.[index] ?? props.track.artistIds?.[0];
  if (artistId) router.push(routeLocation.artist(artistId));
}

function handleAlbumClick() {
  router.push(routeLocation.album(props.track.albumId));
}

function formatRelativeTime(value?: number): string {
  if (!value) return "-";
  const diffSeconds = Math.round((value - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(locale.value, { numeric: "auto" });
  if (absSeconds < 60) return formatter.format(diffSeconds, "second");
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (absSeconds < 86400) return formatter.format(diffHours, "hour");
  return formatter.format(Math.round(diffHours / 24), "day");
}
</script>

<style scoped>
.library-track-row {
  display: grid;
  grid-template-columns: var(--grid-template-columns);
  gap: 12px;
  align-items: center;
}

.index-col { grid-column: index; }
.first-col { grid-column: first; }
.var1-col { grid-column: var1; }
.var2-col { grid-column: var2; }
.last-col { grid-column: last; }

@media (max-width: 1024px) {
  .library-track-row {
    --grid-template-columns: [first] 4fr [var1] 2fr [last] 1fr !important;
  }
}

@media (max-width: 768px) {
  .library-track-row {
    --grid-template-columns: [first] 1fr [last] auto !important;
    gap: 8px;
  }
}
</style>
