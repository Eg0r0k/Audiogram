<template>
  <div
    class="relative flex h-full w-full flex-col overflow-hidden! bg-card"
    :style="keyboardInsetStyle"
  >
    <RightPanelHeader
      :title="$t('track.edit.title')"
      :description="track?.title"
      show-back
      @back="handleBack"
      @close="handleClose"
    />

    <Scrollable class="min-h-0 flex-1">
      <form
        class="grid gap-5 px-5 pb-[calc(6rem+var(--keyboard-inset,0px))] pt-2"
        @submit.prevent="onSubmit"
      >
        <div class="space-y-2">
          <Label
            class="text-muted-foreground"
            for="track-title"
          >
            {{ $t('track.edit.fields.title') }}
          </Label>
          <Input
            id="track-title"
            v-model="titleInput"
            variant="soft"
            size="xl"
            :disabled="isPending"
            :aria-invalid="!!errors.title || undefined"
            @keydown.enter.prevent="onSubmit"
          />

          <p
            v-if="errors.title"
            class="text-sm text-destructive"
          >
            {{ errors.title }}
          </p>
        </div>

        <div class="space-y-2">
          <Label
            id="track-artists-label"
            class="text-muted-foreground"
            for="track-artists"
          >
            {{ $t('track.edit.fields.artists') }}
          </Label>
          <button
            id="track-artists"
            type="button"
            :class="pickerButtonClass"
            aria-labelledby="track-artists-label track-artists-value"
            :disabled="isPending"
            @click="openArtistPicker"
          >
            <span
              id="track-artists-value"
              class="flex min-w-0 flex-1 flex-wrap gap-1.5"
            >
              <template v-if="artistChips.length > 0">
                <Badge
                  v-for="name in artistChips"
                  :key="name"
                  color="surface"
                  class="max-w-full"
                >
                  <span class="min-w-0 truncate">{{ name }}</span>
                </Badge>
              </template>
              <span
                v-else
                class="text-muted-foreground"
              >
                {{ $t('track.edit.noArtists') }}
              </span>
            </span>
            <IconChevronRight class="size-5 shrink-0 text-muted-foreground" />
          </button>

          <p
            v-if="artistsError"
            class="text-sm text-destructive"
          >
            {{ artistsError }}
          </p>
        </div>

        <div class="space-y-2">
          <Label
            id="track-album-label"
            class="text-muted-foreground"
            for="track-album"
          >
            {{ $t('track.edit.fields.album') }}
          </Label>
          <button
            id="track-album"
            type="button"
            :class="pickerButtonClass"
            aria-labelledby="track-album-label track-album-value"
            :disabled="isPending"
            @click="openAlbumPicker"
          >
            <span
              v-if="albumId"
              class="size-8 shrink-0 overflow-hidden rounded-sm bg-muted"
            >
              <EntityCoverImage
                owner-type="album"
                :owner-id="albumId"
                alt=""
                image-class="size-full object-cover"
              />
            </span>
            <IconDisc
              v-else
              class="size-5 shrink-0 text-muted-foreground"
            />
            <span
              id="track-album-value"
              class="min-w-0 flex-1 truncate"
              :class="!albumLabel && 'text-muted-foreground font-medium'"
            >
              {{ albumLabel || $t('track.edit.noAlbum') }}
            </span>
            <IconChevronRight class="size-5 shrink-0 text-muted-foreground" />
          </button>

          <p
            v-if="newAlbumTitle"
            class="text-xs text-muted-foreground"
          >
            {{ $t('track.edit.newAlbumHint') }}
          </p>

          <p
            v-if="errors.albumLabel"
            class="text-sm text-destructive"
          >
            {{ errors.albumLabel }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label
              class="text-muted-foreground"
              for="track-number"
            >
              {{ $t('track.edit.fields.trackNo') }}
            </Label>
            <InputNumber
              id="track-number"
              v-model="trackNo"
              variant="soft"
              size="xl"
              orientation="vertical"
              :min="1"
              :format-options="INTEGER_FORMAT"
              :disabled="isPending"
              :aria-invalid="!!errors.trackNo || undefined"
            >
              <InputNumberInput />
              <InputNumberIncrement />
              <InputNumberDecrement />
            </InputNumber>

            <p
              v-if="errors.trackNo"
              class="text-sm text-destructive"
            >
              {{ errors.trackNo }}
            </p>
          </div>

          <div class="space-y-2">
            <Label
              class="text-muted-foreground"
              for="disk-number"
            >
              {{ $t('track.edit.fields.diskNo') }}
            </Label>
            <InputNumber
              id="disk-number"
              v-model="diskNo"
              variant="soft"
              size="xl"
              orientation="vertical"
              :min="1"
              :format-options="INTEGER_FORMAT"
              :disabled="isPending"
              :aria-invalid="!!errors.diskNo || undefined"
            >
              <InputNumberInput />
              <InputNumberIncrement />
              <InputNumberDecrement />
            </InputNumber>

            <p
              v-if="errors.diskNo"
              class="text-sm text-destructive"
            >
              {{ errors.diskNo }}
            </p>
          </div>
        </div>
      </form>
    </Scrollable>

    <FloatingActionButton :show="hasChanges">
      <Button
        type="button"
        class="size-12 rounded-full shadow-lg"
        :disabled="isPending || !meta.valid || !hasChanges"
        @click="onSubmit"
      >
        <IconSave class="size-6" />
      </Button>
    </FloatingActionButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/valibot";
import { array, integer, maxLength, minLength, minValue, number, object, optional, pipe, string } from "valibot";
import type { InferOutput } from "valibot";
import { useI18n } from "vue-i18n";
import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { Badge } from "@/components/ui/badge";
import { sameArtistNames, splitArtistNames } from "@/lib/artist-names";
import { NAME_MAX_LENGTH } from "@/lib/limits";
import { Button } from "@/components/ui/button";
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import { Input, inputVariants } from "@/components/ui/input";
import { InputNumber, InputNumberDecrement, InputNumberIncrement, InputNumberInput } from "@/components/ui/input-number";
import { Label } from "@/components/ui/label";
import { Scrollable } from "@/components/ui/scrollable";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import { useKeyboardInset } from "@/composables/useKeyboardInset";
import type { Track } from "@/modules/player/types";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { usePanelUiBack } from "@/modules/right-panel/composables/usePanelUiBack";
import type { RightPanelEditTrackPayload } from "@/modules/right-panel/types";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { useTrackEditDraft, type TrackEditDraft } from "@/modules/tracks/composables/useTrackEditDraft";
import { updateTrackMetadataAndSync, type TrackMetadataChanges } from "@/queries/track.queries";
import type { AlbumId } from "@/types/ids";
import { cn } from "@/lib/utils";
import RightPanelHeader from "../RightPanelHeader.vue";
import IconChevronRight from "~icons/tabler/chevron-right";
import IconDisc from "~icons/tabler/disc";
import IconSave from "~icons/tabler/device-floppy";

const props = defineProps<{
  payload: RightPanelEditTrackPayload;
}>();

const { t } = useI18n();

// Primary keyboard handling is CSS-only: the viewport meta declares
// interactive-widget=resizes-content, so the panel (fixed inset-0 chain)
// shrinks with the keyboard. On WebViews that ignore it only the visual
// viewport shrinks; the composable measures that leftover overlap (0 when
// the CSS route works) and --keyboard-inset lifts the save button and the
// form's bottom padding above the keyboard.
const { keyboardInset } = useKeyboardInset();
const keyboardInsetStyle = computed(() => ({ "--keyboard-inset": `${keyboardInset.value}px` }));
const queryClient = useQueryClient();
const queueStore = useQueueStore();
const rightPanel = useRightPanelStore();
const { readDraft, setDraft, patchDraft, clearDraft } = useTrackEditDraft();

const buildTrackFormSchema = () => {
  const numberMessage = t("track.edit.validation.numberMin");
  const positiveInteger = () => optional(pipe(
    number(numberMessage),
    integer(numberMessage),
    minValue(1, numberMessage),
  ));

  return object({
    title: pipe(
      string(),
      minLength(1, t("track.edit.validation.titleRequired")),
      maxLength(NAME_MAX_LENGTH, t("track.edit.validation.titleMaxLength", { max: NAME_MAX_LENGTH })),
    ),
    // Empty = no artist, like a tag-less import. Only an album needs one,
    // which onSubmit checks across both fields.
    artists: array(pipe(
      string(),
      maxLength(NAME_MAX_LENGTH, t("track.edit.validation.artistMaxLength", { max: NAME_MAX_LENGTH })),
    )),
    // Empty = no album: the track stays album-less, like an import without album tags.
    albumLabel: pipe(
      string(),
      maxLength(NAME_MAX_LENGTH, t("track.edit.validation.albumMaxLength", { max: NAME_MAX_LENGTH })),
    ),
    trackNo: positiveInteger(),
    diskNo: positiveInteger(),
  });
};

type TrackFormValues = InferOutput<ReturnType<typeof buildTrackFormSchema>>;

const validationSchema = computed(() => toTypedSchema(buildTrackFormSchema()));

const { errors, meta, defineField, handleSubmit, setValues, setFieldError } = useForm<TrackFormValues>({
  validationSchema,
  initialValues: {
    title: "",
    artists: [],
    albumLabel: "",
    trackNo: undefined,
    diskNo: undefined,
  },
});

const [title] = defineField("title");
const [artists] = defineField("artists");
const [albumLabel] = defineField("albumLabel");
const [trackNo] = defineField("trackNo");
const [diskNo] = defineField("diskNo");

const albumId = ref<string | null>(null);
const newAlbumTitle = ref<string | null>(null);

const track = computed<Track>(() => props.payload.track);

const artistChips = computed(() => artists.value);

const artistsError = computed<string | undefined>(() => {
  const fieldErrors = errors.value as Record<string, string | undefined>;
  if (fieldErrors.artists) return fieldErrors.artists;

  return Object.entries(fieldErrors).find(([key]) => key.startsWith("artists["))?.[1];
});

// Artists and album open a picker from a button dressed as the text fields
// around it; it grows past one line when the artist chips wrap.
const pickerButtonClass = cn(
  inputVariants({ variant: "soft", size: "xl" }),
  "state-layer relative flex h-auto min-h-(--control-height-xl)  cursor-pointer items-center gap-4 py-2 text-start",
);

const titleInput = computed<string | number>({
  get: () => title.value,
  set: (value) => {
    title.value = String(value);
  },
});

// Track and disc numbers are whole and never grouped ("1 000").
const INTEGER_FORMAT: Intl.NumberFormatOptions = { maximumFractionDigits: 0, useGrouping: false };

const draftFromTrack = (source: Track): TrackEditDraft => ({
  trackId: source.id,
  title: source.title,
  artists: splitArtistNames(source.artist),
  albumId: source.albumId || null,
  albumLabel: source.albumName,
  newAlbumTitle: null,
  trackNo: source.trackNo ?? null,
  diskNo: source.diskNo ?? null,
});

const applyDraft = (source: TrackEditDraft): void => {
  setValues({
    title: source.title,
    artists: [...source.artists],
    albumLabel: source.albumLabel,
    trackNo: source.trackNo ?? undefined,
    diskNo: source.diskNo ?? undefined,
  }, false);

  albumId.value = source.albumId;
  newAlbumTitle.value = source.newAlbumTitle;
};

const draftValues = computed(() => ({
  title: title.value,
  artists: [...artists.value],
  albumId: albumId.value,
  albumLabel: albumLabel.value,
  newAlbumTitle: newAlbumTitle.value,
  trackNo: trackNo.value ?? null,
  diskNo: diskNo.value ?? null,
}));

const syncDraft = (): void => {
  patchDraft(track.value.id, draftValues.value);
};

watch(
  track,
  (nextTrack) => {
    const stored = readDraft(nextTrack.id);
    const next = stored ?? draftFromTrack(nextTrack);

    if (!stored) setDraft(next);
    applyDraft(next);
  },
  { immediate: true },
);

watch(draftValues, () => {
  syncDraft();
});

const hasChanges = computed(() => {
  const source = track.value;

  return title.value.trim() !== source.title
    || !sameArtistNames(artistChips.value, splitArtistNames(source.artist))
    || albumId.value !== (source.albumId || null)
    || newAlbumTitle.value !== null
    || (trackNo.value ?? null) !== (source.trackNo ?? null)
    || (diskNo.value ?? null) !== (source.diskNo ?? null);
});

const albumChanged = computed(() =>
  newAlbumTitle.value !== null || albumId.value !== (track.value.albumId || null));

const albumChange = computed<Pick<TrackMetadataChanges, "albumId" | "albumTitle">>(() => {
  if (newAlbumTitle.value) return { albumTitle: newAlbumTitle.value };
  if (albumId.value) return { albumId: albumId.value as AlbumId };

  return {};
});

const requestLeave = (leave: () => void): void => {
  if (!hasChanges.value) {
    clearDraft();
    leave();
    return;
  }

  summonDialog("unsavedChanges", {}, { key: "unsaved-changes" })
    .then((discard) => {
      if (!discard) return;
      clearDraft();
      leave();
    })
    .catch(() => undefined);
};

const handleBack = (): void => {
  requestLeave(() => rightPanel.openTrackInfo({ track: props.payload.track }, { depth: 1 }));
};
usePanelUiBack(handleBack);

const handleClose = (): void => {
  requestLeave(() => rightPanel.close());
};

const openArtistPicker = (): void => {
  const source = track.value;
  syncDraft();

  const trackId = source.id;
  const editTrack = props.payload.track;

  rightPanel.openEntitySelect({
    kind: "artists",
    selectedNames: [...artistChips.value],
    onConfirm: ({ names }) => {
      if (!names) return;
      patchDraft(trackId, { artists: [...names] });
    },
    onDone: () => rightPanel.openEditTrack({ track: editTrack }, { depth: 2 }),
  });
};

const openAlbumPicker = (): void => {
  const source = track.value;
  syncDraft();

  const trackId = source.id;
  const editTrack = props.payload.track;

  rightPanel.openEntitySelect({
    kind: "album",
    selectedAlbumId: albumId.value ?? undefined,
    onConfirm: ({ albumId: nextAlbumId, albumTitle }) => {
      if (nextAlbumId) {
        patchDraft(trackId, {
          albumId: nextAlbumId,
          albumLabel: albumTitle ?? "",
          newAlbumTitle: null,
        });
        return;
      }

      patchDraft(trackId, {
        albumId: null,
        albumLabel: albumTitle ?? "",
        newAlbumTitle: albumTitle ?? null,
      });
    },
    onDone: () => rightPanel.openEditTrack({ track: editTrack }, { depth: 2 }),
  });
};

const { mutateAsync: updateTrack, isPending } = useMutation({
  mutationFn: (changes: TrackMetadataChanges) => {
    return updateTrackMetadataAndSync(queryClient, track.value, changes);
  },
  onError: (error) => {
    reportError(error, { title: t("track.edit.saveFailed"), scope: "RightPanel" });
  },
});

const onSubmit = handleSubmit(async (values) => {
  if (!hasChanges.value) return;
  if (values.artists.length === 0 && albumChanged.value) {
    setFieldError("artists", t("track.edit.validation.albumNeedsArtist"));
    return;
  }

  const nextTrack = await updateTrack({
    title: values.title,
    artistNames: values.artists,
    ...albumChange.value,
    trackNo: values.trackNo ?? null,
    diskNo: values.diskNo ?? null,
  }).catch(() => null);

  if (!nextTrack) return;

  clearDraft();
  queueStore.syncTrackMetadata(nextTrack);
  toaster.add({ title: t("track.edit.saved"), color: "success" });
  rightPanel.openTrackInfo({ track: nextTrack }, { depth: 1 });
});
</script>
