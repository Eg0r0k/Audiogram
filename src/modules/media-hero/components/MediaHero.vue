<template>
  <MediaContextMenu
    :context="contextType"
    :is-playlist-owner="isPlaylist(data) ? data.isOwner : undefined"
    :disabled="!hasMenuItems"
  >
    <div class="relative @container">
      <div
        class="media-hero-gradient absolute inset-0 transition-opacity duration-400 ease-standard pointer-events-none"
        :class="colorReady ? 'opacity-100' : 'opacity-0'"
        :data-phone="isMobileLayout || undefined"
        :style="{ backgroundColor: heroColor }"
      />

      <MediaHeader
        :title="data.title"
        :color="colorReady ? heroColor : null"
        :source="heroSource"
        @play="$emit('play')"
      />

      <div
        v-if="isMobileLayout"
        class="relative mx-auto w-full max-w-page px-4 pt-[72px]"
      >
        <div class="mx-auto size-[220px]">
          <MediaHeroImage
            v-bind="imageBindings"
            @edit="$emit('edit')"
          />
        </div>

        <div class="mt-6 flex min-w-0 select-none flex-col items-start text-left text-white">
          <h1 class="w-full wrap-break-word font-black leading-tight tracking-tight text-3xl">
            {{ data.title }}
          </h1>

          <MediaHeroMeta
            class="mt-2"
            :data="data"
            :type-label="typeLabel"
            stacked
          />

          <p
            v-if="descriptionText"
            class="mt-2 text-sm leading-6 text-white/80 line-clamp-2"
          >
            {{ descriptionText }}
          </p>
        </div>

        <MediaHeroActions
          v-bind="actionBindings"
          class="mt-4"
          mobile
          @play="$emit('play')"
          @shuffle="$emit('shuffle')"
          @add-tracks="$emit('addTracks')"
        />
      </div>

      <div
        v-else
        class="relative mx-auto w-full max-w-page px-4 pb-6 pt-[72px] @lg:px-7 @lg:pb-7"
      >
        <div class="flex flex-col items-center gap-5 text-center @lg:flex-row @lg:items-end @lg:gap-7 @lg:text-left">
          <div class="w-full max-w-44 shrink-0 @sm:max-w-52 @lg:max-w-[232px]">
            <MediaHeroImage
              v-bind="imageBindings"
              @edit="$emit('edit')"
            />
          </div>

          <div class="flex select-none min-w-0 w-full flex-col items-center text-white @lg:items-start">
            <span class="mb-1 text-xs font-medium opacity-90 @sm:text-sm">
              {{ typeLabel }}
            </span>

            <h1
              class="w-full wrap-break-word text-balance font-black leading-none tracking-tight text-3xl @sm:text-4xl @md:text-5xl @xl:text-6xl"
            >
              {{ data.title }}
            </h1>

            <MediaHeroMeta
              class="mt-3 text-white font-medium"
              :data="data"
            />

            <p
              v-if="descriptionText"
              class="mt-3 max-w-2xl text-sm leading-6 text-white/80 line-clamp-3 @lg:max-w-none"
            >
              {{ descriptionText }}
            </p>
          </div>
        </div>

        <MediaHeroActions
          v-model:filter="filter"
          v-bind="actionBindings"
          class="mt-6"
          :filterable="props.filterable"
          @play="$emit('play')"
          @shuffle="$emit('shuffle')"
          @add-tracks="$emit('addTracks')"
        />
      </div>
    </div>
  </MediaContextMenu>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { RouteLocationRaw } from "vue-router";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { useImageColor } from "@/composables/useImageColor";
import { platformCaps } from "@/lib/environment/platformCaps";
import { sourceKindOf } from "@/modules/sources/lib/display";
import {
  enqueueCollectionDownload,
  enqueueLocalPlaylistDownload,
} from "@/modules/downloads/service/enqueue";
import { sources } from "@/modules/sources";
import { provideMediaContext } from "@/modules/media-hero/composables/useMediaContext";
import MediaHeader from "./MediaHeader.vue";
import MediaHeroImage from "./MediaHeroImage.vue";
import MediaContextMenu from "./menu/context-menu/MediaContextMenu.vue";
import MediaHeroMeta from "./MediaHeroMeta.vue";
import MediaHeroActions from "./MediaHeroActions.vue";
import type { QueueSource } from "@/modules/queue/types";
import type { MediaData } from "@/types/media-data";
import type { EntityLikeState } from "@/modules/sources/composables/useEntityLike";
import { isAlbum, isArtist, isLiked, isPlaylist } from "@/types/media-data";

const props = withDefaults(defineProps<{
  data: MediaData;
  hasTracks?: boolean;
  /**
   * False on live catalog pages (ND browsing): the hero shows a server VM
   * with no Dexie row, so editing/deleting it would write nowhere.
   */
  isLibraryEntity?: boolean;
  /** Shows the track filter; the page narrows its list by the `filter` model. */
  filterable?: boolean;
  /** The entity's like at its source, handed down to the actions row. */
  like?: EntityLikeState;
  /** An own catalog playlist its source can delete — "Delete" without a Dexie row. */
  canDeleteAtSource?: boolean;
  /** The catalog view behind this library view, when one exists. */
  catalogRoute?: RouteLocationRaw | null;
  /** Shows the "add tracks" button; the page opens the picker on `addTracks`. */
  canAddTracks?: boolean;
}>(), {
  isLibraryEntity: true,
  filterable: false,
  like: undefined,
  canDeleteAtSource: false,
  catalogRoute: null,
  canAddTracks: false,
});

const filter = defineModel<string>("filter", { default: "" });

const emit = defineEmits<{
  edit: [];
  delete: [];
  play: [];
  shuffle: [];
  addToQueue: [];
  addTracks: [];
}>();

const { t } = useI18n();
const { isMobileLayout } = useDeviceLayout();

const fallbackSrc = computed(() => {
  return isArtist(props.data)
    ? "/img/artist-fallback.svg"
    : "/img/fallback.svg";
});

/**
 * Edit/delete need a Dexie row behind the hero. Live catalog pages (ND
 * album/artist/playlist) render a VM built straight from the server, so the
 * page tells us via `isLibraryEntity` — a downloaded yt/nd album DOES have a
 * row and stays manageable.
 */
const canManage = computed(() => {
  if (!props.isLibraryEntity) return false;
  return isPlaylist(props.data) ? props.data.isOwner : true;
});

// Batch offline download: any catalog collection whose source can hand over
// files, plus local playlists (filtered to their downloadable tracks at
// enqueue time). Asks the source rather than naming one.
const canDownloadOffline = computed(() => {
  if (!platformCaps.hasFs) return false;
  const data = props.data;
  if (!isAlbum(data) && !isPlaylist(data)) return false;

  const kind = sourceKindOf(data.id);
  if (kind === "local") return isPlaylist(data);
  return sources.get(kind).capabilities.download;
});

async function startOfflineDownload(): Promise<void> {
  const data = props.data;
  try {
    let batchId: string | null = null;
    if (isAlbum(data)) {
      batchId = await enqueueCollectionDownload("album", data.id);
    }
    else if (isPlaylist(data)) {
      batchId = sourceKindOf(data.id) === "local"
        ? await enqueueLocalPlaylistDownload(data.id)
        : await enqueueCollectionDownload("playlist", data.id);
    }
    // No "queued" toast: the header download indicator is the feedback.
    if (!batchId) {
      toaster.add({ title: t("media.nothingToDownload"), color: "info" });
    }
  }
  catch (error) {
    reportError(error, {
      title: t("downloads.enqueueFailed"),
      scope: "MediaHero",
      retry: () => {
        startOfflineDownload().catch(() => undefined);
      },
    });
  }
}

provideMediaContext({
  addToQueue: () => emit("addToQueue"),
  edit: () => emit("edit"),
  delete: () => emit("delete"),
  canManage,
  canDeleteAtSource: computed(() => props.canDeleteAtSource),
  catalogRoute: computed(() => props.catalogRoute),
  canDownloadOffline,
  downloadOffline: () => {
    startOfflineDownload().catch(() => undefined);
  },
});

const { color, extractColor, resetColor } = useImageColor();
const heroColor = computed(() => color.value.palette?.vivid ?? color.value.hex);
const colorReady = ref(false);

watch(
  () => props.data.image,
  async (newImage, oldImage) => {
    if (newImage === oldImage) return;

    colorReady.value = false;
    await nextTick();

    if (newImage) {
      await extractColor(newImage);
    }
    else {
      resetColor();
    }

    colorReady.value = true;
  },
  { immediate: true },
);

const heroSource = computed<QueueSource>(() => {
  const d = props.data;
  if (isAlbum(d)) return { type: "album", albumId: d.id };
  if (isArtist(d)) return { type: "artist", artistId: d.id };
  if (isPlaylist(d)) return { type: "playlist", playlistId: d.id };
  if (isLiked(d)) return { type: "liked" };
  return { type: "unknown" };
});

const canEdit = computed(() =>
  canManage.value && (isPlaylist(props.data) || isAlbum(props.data) || isArtist(props.data)),
);

// Mirrors what the context components render: an empty menu (e.g. catalog
// artist) never opens, and the "⋯" trigger hides with it.
const hasMenuItems = computed(() => {
  if (props.catalogRoute) return true;
  switch (contextType.value) {
    case "artist-page": return canManage.value;
    case "album": return canManage.value || canDownloadOffline.value;
    default: return true;
  }
});

const descriptionText = computed(() => {
  if (isPlaylist(props.data)) {
    return props.data.description?.trim() || null;
  }

  if (isArtist(props.data)) {
    return props.data.bio?.trim() || null;
  }

  return null;
});
const contextType = computed(() => {
  switch (props.data.type) {
    case "artist": return "artist-page";
    case "liked": return "liked";
    case "playlist": return "playlist";
    case "album": return "album";
    default: return "album";
  }
});

const typeLabel = computed(() => {
  switch (props.data.type) {
    case "playlist": return t("media.type.playlist");
    case "artist": return t("media.type.artist");
    case "album": return t("media.type.album");
    case "liked": return t("media.type.playlist");
    default: return t("media.type.album");
  }
});

const imageBindings = computed(() => ({
  src: props.data.image,
  alt: props.data.title,
  rounded: isArtist(props.data),
  editable: canEdit.value,
  fallbackSrc: fallbackSrc.value,
}));

const actionBindings = computed(() => ({
  type: props.data.type,
  source: heroSource.value,
  hasTracks: props.hasTracks,
  isPlaylistOwner: isPlaylist(props.data) ? props.data.isOwner : undefined,
  showMenu: hasMenuItems.value,
  like: props.like,
  canAddTracks: props.canAddTracks,
}));
</script>

<style>
/* The cover colour settles into the card behind the page without an edge.
   Light theme holds it under the white text and fades only below the
   actions (the phone hero has no padding under them, so its fade is
   shorter); on the dark card the fade runs the whole height (smoothstep). */
.media-hero-gradient {
  --hero-fade-length: 4.5rem;
  --hero-fade: linear-gradient(
    to bottom,
    rgb(0 0 0) calc(100% - var(--hero-fade-length)),
    rgb(0 0 0 / 0.9) calc(100% - var(--hero-fade-length) * 0.78),
    rgb(0 0 0 / 0.65) calc(100% - var(--hero-fade-length) * 0.56),
    rgb(0 0 0 / 0.35) calc(100% - var(--hero-fade-length) * 0.33),
    rgb(0 0 0 / 0.1) calc(100% - var(--hero-fade-length) * 0.11),
    transparent 100%
  );
  -webkit-mask-image: var(--hero-fade);
  mask-image: var(--hero-fade);
}

.media-hero-gradient[data-phone] {
  --hero-fade-length: 1.5rem;
}

.dark .media-hero-gradient {
  --hero-fade: linear-gradient(
    to bottom,
    rgb(0 0 0) 0%,
    rgb(0 0 0 / 0.97) 10%,
    rgb(0 0 0 / 0.9) 20%,
    rgb(0 0 0 / 0.78) 30%,
    rgb(0 0 0 / 0.65) 40%,
    rgb(0 0 0 / 0.5) 50%,
    rgb(0 0 0 / 0.35) 60%,
    rgb(0 0 0 / 0.22) 70%,
    rgb(0 0 0 / 0.1) 80%,
    rgb(0 0 0 / 0.03) 90%,
    transparent 100%
  );
}
</style>
