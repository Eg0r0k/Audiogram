<template>
  <div
    v-ripple
    class="group select-none cursor-pointer rounded-lg p-2 outline-none transition-colors hover:bg-accent/60 data-[menu-open]:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/50"
    :class="fluid ? 'w-full min-w-0' : 'w-40 shrink-0 sm:w-44'"
    :data-menu-open="isMenuSelected || undefined"
    role="button"
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
    @contextmenu="openMenu(item, $event)"
  >
    <div class="relative aspect-square z-1 overflow-hidden rounded-md bg-muted shadow-sm">
      <EntityCoverImage
        :owner-type="coverOwnerType"
        :owner-id="item.id"
        :alt="item.title"
        :fallback-src="item.image"
        image-class="size-full object-cover transition-transform duration-200 group-hover:scale-105"
      />

      <Button
        size="icon-lg"
        class="play-button absolute bottom-2 right-2 size-11 rounded-full shadow-lg"
        :class="isActiveSource
          ? 'translate-y-0 opacity-100'
          : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-data-[menu-open]:translate-y-0 group-data-[menu-open]:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100'"
        @click.prevent.stop="handlePlay"
        @keydown.enter.stop
      >
        <IconPause
          v-if="showPauseIcon"
          class="size-5 fill-current"
        />
        <IconPlay
          v-else
          class="size-5 fill-current"
        />
      </Button>
    </div>

    <div class="mt-3 min-w-0">
      <div class="flex min-w-0 items-center gap-1.5">
        <p class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {{ item.title }}
        </p>

        <IconPinFilled
          v-if="item.isPinned"
          role="img"
          :aria-label="t('library.pinned')"
          class="size-5 shrink-0 text-primary"
        />
      </div>

      <p
        v-if="item.subtitle"
        class="mt-0.5 truncate text-xs text-muted-foreground"
      >
        {{ item.subtitle }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { getLogger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import { usePlaybackState } from "@/modules/player/composables/usePlaybackState";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useLibraryMenu } from "@/modules/library/composables/useLibraryMenu";
import type { LibraryItem } from "@/modules/library/types";
import type { QueueSource } from "@/modules/queue/types";
import type { AlbumId, PlaylistId } from "@/types/ids";
import type { CoverOwnerType } from "@/db/entities";
import IconPause from "~icons/audiogram/pause-rounded";
import IconPlay from "~icons/audiogram/play-rounded";
import IconPinFilled from "~icons/tabler/pin-filled";
import { formatError } from "@/lib/errors";

// A no-hover device (touch) can't reveal the play button, so it stays visible
// there; `fluid` lets a grid size the card instead of the slider width.
const props = defineProps<{
  item: LibraryItem;
  fluid?: boolean;
}>();

const emit = defineEmits<{
  play: [item: LibraryItem];
}>();

const router = useRouter();
const { t } = useI18n();
const playerStore = usePlayerStore();
const { openMenu, isMenuOpenFor } = useLibraryMenu();

const isMenuSelected = computed(() => isMenuOpenFor(props.item));

// The card renders any collection that plays as a unit — albums on an
// artist page, playlists on a catalog artist's shelf. Both the cover owner
// and the queue source follow item.type rather than assuming "album".
const coverOwnerType = computed<CoverOwnerType>(() =>
  (props.item.type === "playlist" ? "playlist" : "album"),
);

const source = computed<QueueSource>(() =>
  (props.item.type === "playlist"
    ? { type: "playlist", playlistId: props.item.id as PlaylistId }
    : { type: "album", albumId: props.item.id as AlbumId }),
);
const { isActiveSource, isPlaying, isLoading } = usePlaybackState(() => source.value);
const showPauseIcon = computed(() => isPlaying.value || isLoading.value);

function handleClick() {
  router.push(props.item.to)
    .catch(error => getLogger().error(`[Library] Opening ${props.item.type} ${props.item.id} failed: ${formatError(error)}`));
}

function handlePlay() {
  if (isActiveSource.value) {
    playerStore.togglePlay()
      .catch(error => getLogger().error(`[Player] Toggling playback failed: ${formatError(error)}`));
    return;
  }

  emit("play", props.item);
}
</script>

<style scoped>
/* Outranks Button's own scoped `transition: transform 160ms`, which would
   otherwise cancel every transition set on the button. */
.play-button[data-slot="button"] {
  transition:
    opacity 0.2s var(--ease-standard),
    translate 0.2s var(--ease-standard),
    scale 0.2s var(--ease-standard),
    transform 160ms var(--ease-out),
    background-color 0.2s var(--ease-standard);
}

/* Keyboard focus is a repeated action: reveal without motion. */
.play-button[data-slot="button"]:focus-visible {
  transition-duration: 0s;
}

@media (hover: hover) and (pointer: fine) {
  .play-button[data-slot="button"]:hover {
    scale: 1.05;
  }
}

@media (prefers-reduced-motion: reduce) {
  .play-button[data-slot="button"]:hover {
    scale: 1;
  }
}
</style>
