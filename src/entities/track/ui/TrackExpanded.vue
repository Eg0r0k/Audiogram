<template>
  <div
    ref="rowRef"
    v-ripple
    role="button"
    tabindex="0"
    data-track-row
    :class="[
      'group flex h-14 w-full select-none cursor-pointer items-center gap-3 rounded-md px-3 transition-colors outline-none',
      rowStateClass,
      'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
    ]"
    @click="handleClick"
    @keypress="handleClick"
    @contextmenu="emit('contextmenu', track)"
  >
    <div class="hidden w-10 shrink-0 items-center justify-center md:flex">
      <span class="text-center font-medium text-muted-foreground text-sm">
        {{ index }}
      </span>
    </div>

    <div class="flex min-w-0 flex-[3_1_0%] items-center gap-3">
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
        <div
          :class="[
            'truncate text-sm font-medium hover:underline',
            isActive ? 'text-primary' : 'text-foreground',
          ]"
        >
          {{ track.title }}
        </div>

        <div class="flex items-center truncate text-xs text-muted-foreground">
          <span
            v-if="isExplicit"
            class="mr-1.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted font-semibold text-[10px] uppercase text-foreground"
          >
            E
          </span>

          <template
            v-for="(artist, artistIndex) in artists"
            :key="`${track.id}-${artistIndex}`"
          >
            <span
              role="link"
              tabindex="0"
              class="cursor-pointer truncate underline-offset-2 transition-colors duration-200 hover:text-foreground hover:underline"
              @click.stop="handleArtistClick(artistIndex)"
              @keypress.enter.stop="handleArtistClick(artistIndex)"
            >
              {{ artist }}
            </span>
            <span v-if="artistIndex < artists.length - 1">,&nbsp;</span>
          </template>
        </div>
      </div>
    </div>

    <div class="hidden min-w-0 flex-[2_1_0%] truncate text-sm text-muted-foreground md:block">
      <span
        role="link"
        tabindex="0"
        class="cursor-pointer truncate underline-offset-2 transition-colors duration-200 hover:text-foreground hover:underline"
        @click.stop="handleAlbumClick"
        @keypress.enter.stop="handleAlbumClick"
      >
        {{ track.albumName }}
      </span>
    </div>

    <div class="hidden min-w-0 flex-[1.5_1_0%] truncate text-sm text-muted-foreground md:block">
      {{ relativeAddedAt }}
    </div>

    <div class="flex w-[60px] shrink-0 items-center justify-end relative">
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
const isExplicit = computed(() => Boolean((props.track as Track & { isExplicit?: boolean }).isExplicit));
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

  if (artistId) {
    router.push({ name: "artist", params: { id: artistId } });
  }
}

function handleAlbumClick() {
  router.push({ name: "album", params: { id: props.track.albumId } });
}

function formatRelativeTime(value?: number): string {
  if (!value) {
    return "-";
  }

  const diffSeconds = Math.round((value - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat(locale.value, { numeric: "auto" });

  if (absSeconds < 60) return formatter.format(diffSeconds, "second");

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return formatter.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return formatter.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return formatter.format(diffDays, "day");

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) return formatter.format(diffWeeks, "week");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return formatter.format(diffMonths, "month");

  return formatter.format(Math.round(diffDays / 365), "year");
}
</script>
