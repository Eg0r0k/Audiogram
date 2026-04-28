<template>
  <div class="library-track-row-container">
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
      <div class="index-col flex items-center justify-center">
        <span class="text-center font-medium text-muted-foreground text-sm">
          {{ index }}
        </span>
      </div>

      <div class="first-col flex min-w-0 items-center gap-3">
        <div class="relative z-10 size-10 shrink-0 overflow-hidden rounded bg-muted">
          <NuxtImage
            :src="coverUrl"
            :alt="track.title"
            fallback-src="/img/fallback.svg"
            class="size-full rounded object-cover"
          />

          <div
            :class="[
              'absolute inset-0 flex items-center justify-center rounded bg-black/50 transition-opacity duration-200 ease-out',
              showOverlay ? 'opacity-100' : 'opacity-0',
            ]"
          >
            <span
              v-if="isCurrentTrack && isPlaying && !isRowHovered"
              class="playing-pulse-dot"
            >
              <span />
              <span />
              <span />
            </span>

            <IconPause
              v-else-if="isCurrentTrack && isPlaying && isRowHovered"
              class="size-5 text-white drop-shadow-md"
            />

            <IconPlay
              v-else
              class="size-5 text-white drop-shadow-md"
            />
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <div :class="['truncate text-sm font-medium hover:underline', isActivePlayback ? 'text-primary' : 'text-foreground']">
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

      <div class="var1-col min-w-0 truncate text-sm text-muted-foreground">
        <span
          role="link"
          tabindex="0"
          class="cursor-pointer pl-2 hover:text-foreground hover:underline"
          @click.stop="handleAlbumClick"
          @keydown.enter.stop="handleAlbumClick"
        >
          {{ track.albumName }}
        </span>
      </div>

      <div class="var2-col min-w-0 truncate pl-2 text-sm text-muted-foreground">
        {{ relativeAddedAt }}
      </div>

      <div class="last-col relative flex items-center justify-end">
        <span class="w-12 text-right text-sm font-medium text-muted-foreground group-hover:hidden [@media(hover:none)]:hidden">
          {{ formatDuration(track.duration) }}
        </span>

        <div class="absolute right-0 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            :class="[
              'rounded-full transition-colors',
              isLiked
                ? 'text-primary hover:text-primary'
                : 'text-muted-foreground hover:text-foreground'
            ]"
            @click.stop="toggle"
          >
            <IconLikedFilled
              v-if="isLiked"
              class="size-5"
            />
            <IconLike
              v-else
              class="size-5"
            />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            class="rounded-full"
            @click.stop="onDotsClick"
          >
            <IconDots class="size-4" />
          </Button>
        </div>
      </div>
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
import type { TrackContext } from "@/modules/tracks/components/menu/type";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { routeLocation } from "@/app/router/route-locations";
import IconDots from "~icons/tabler/dots";
import IconLike from "~icons/tabler/heart";
import IconLikedFilled from "~icons/tabler/heart-filled";
import IconPause from "~icons/tabler/player-pause-filled";
import IconPlay from "~icons/tabler/player-play-filled";
import { useToggleTrackLike } from "@/modules/tracks/composables/useToggleTrackLike";

interface Props {
  track: Track;
  index: number;
  isActive?: boolean;
  isSelected?: boolean;
  menuTarget?: TrackContext;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  isSelected: false,
  menuTarget: "default",
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
const { toggleTrackLike } = useToggleTrackLike();

const rowRef = useTemplateRef("rowRef");
const isRowHovered = useElementHover(() => rowRef.value);
const { url: coverBlobUrl } = useEntityCover("album", () => props.track.albumId);

const coverUrl = computed(() => coverBlobUrl.value ?? "/img/fallback.svg");
const isCurrentTrack = computed(() => props.isActive || playerStore.currentTrack?.id === props.track.id);
const isPlaying = computed(() => playerStore.isPlaying);
const showOverlay = computed(() => isCurrentTrack.value || isRowHovered.value);
const isExplicit = computed(() => Boolean(props.track.isExplicit));
const isLiked = computed(() => props.track.isLiked);
const relativeAddedAt = computed(() => formatRelativeTime(props.track.addedAt));
const artists = computed(() => {
  const artistStr = props.track.artist;
  if (!artistStr) return [];
  return artistStr.split(/,\s*/).map(artist => artist.trim()).filter(Boolean);
});

const rowStateClass = computed(() => {
  if (props.isSelected) return "bg-accent/80";
  if (isActivePlayback.value) return "bg-primary/10";
  return "hover:bg-muted/50";
});

const isActivePlayback = computed(() => props.isActive || isCurrentTrack.value);

function handleClick(event: MouseEvent | KeyboardEvent) {
  if (event instanceof MouseEvent && (event.metaKey || event.ctrlKey || event.shiftKey)) {
    emit("select", props.track);
    return;
  }
  emit("play", props.track);
}

function onDotsClick(event: MouseEvent) {
  openDropdown(props.track, props.index, event, { target: props.menuTarget });
}

async function toggle() {
  await toggleTrackLike(props.track);
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

.library-track-row-container {
  container-type: inline-size;
}

.index-col { grid-column: index; }
.first-col { grid-column: first; }
.var1-col { grid-column: var1; }
.var2-col { grid-column: var2; }
.last-col { grid-column: last; }

@container (max-width: 900px) {
  .library-track-row {
    --grid-template-columns: [index] 28px [first] minmax(160px, 4fr) [var1] minmax(120px, 2fr) [last] minmax(var(--last-min-width), var(--last-max-width)) !important;
  }

  .var2-col { display: none; }
}

@container (max-width: 620px) {
  .library-track-row {
    --grid-template-columns: [first] minmax(0, 1fr) [last] var(--last-min-width) !important;
    gap: 8px;
  }

  .index-col,
  .var1-col,
  .var2-col { display: none; }
}
</style>
