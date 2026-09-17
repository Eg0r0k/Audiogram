<template>
  <MediaContextMenu
    :context="contextType"
    :is-playlist-owner="isPlaylist(data) ? data.isOwner : undefined"
    :disabled="!hasMenuItems"
  >
    <div
      class="relative @container"
      data-media-context
    >
      <div
        class="absolute inset-0 transition-opacity duration-400 ease-standard pointer-events-none"
        :class="colorReady ? 'opacity-100' : 'opacity-0'"
        :style="{ background: `linear-gradient(${heroColor} 0%, transparent 145%)` }"
      />

      <MediaHeader
        :title="data.title"
        :color="colorReady ? heroColor : null"
        :source="heroSource"
        @play="$emit('play')"
      />

      <div class="relative mx-auto w-full max-w-page px-4 pb-6 pt-[72px] @lg:px-7 @lg:pb-7">
        <div class="flex flex-col items-center gap-5 text-center @lg:flex-row @lg:items-center @lg:gap-7 @lg:text-left">
          <div class="w-full max-w-44 shrink-0 @sm:max-w-52 @lg:max-w-[232px]">
            <MediaHeroImage
              :src="data.image"
              :alt="data.title"
              :rounded="isArtist(data)"
              :editable="canEdit"
              :fallback-src="fallbackSrc"
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

            <RouterLink
              v-if="props.catalogRoute"
              :to="props.catalogRoute"
              class="mt-3 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90 hover:bg-white/25 transition-colors"
            >
              {{ $t('media.openInCatalog') }}
            </RouterLink>

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
          class="mt-6"
          :type="data.type"
          :source="heroSource"
          :has-tracks="props.hasTracks"
          :is-playlist-owner="isPlaylist(data) ? data.isOwner : undefined"
          :show-menu="hasMenuItems"
          :filterable="props.filterable"
          :like="props.like"
          @play="$emit('play')"
          @shuffle="$emit('shuffle')"
        />
      </div>
    </div>
  </MediaContextMenu>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import { toast } from "vue-sonner";
import { useImageColor } from "@/composables/useImageColor";
import { platformCaps } from "@/lib/environment/platformCaps";
import { getLogger } from "@/lib/logger";
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
}>(), {
  isLibraryEntity: true,
  filterable: false,
  like: undefined,
  canDeleteAtSource: false,
  catalogRoute: null,
});

const filter = defineModel<string>("filter", { default: "" });

const emit = defineEmits<{
  edit: [];
  delete: [];
  play: [];
  shuffle: [];
  addToQueue: [];
  share: [];
}>();

const { t } = useI18n();

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
      toast.info(t("media.nothingToDownload"));
    }
  }
  catch {
    toast.error(t("track.downloadFailed"));
  }
}

provideMediaContext({
  addToQueue: () => emit("addToQueue"),
  edit: () => emit("edit"),
  delete: () => emit("delete"),
  share: () => emit("share"),
  canManage,
  canDeleteAtSource: computed(() => props.canDeleteAtSource),
  canDownloadOffline,
  downloadOffline: () => {
    startOfflineDownload()
      .catch(error => getLogger().error(`[Downloads] Starting an offline download failed: ${String(error)}`));
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
</script>
