<template>
  <div
    class="relative flex h-full min-h-0 flex-col overflow-hidden! bg-card"
    :style="keyboardInsetStyle"
  >
    <RightPanelHeader
      class="bg-card"
      :show-close="true"
      :show-back="isEditing || rightPanel.depth > 0"
      :title="isEditing ? t('chapters.edit') : t('chapters.inThisTrack')"
      :description="isEditing ? trackLine : null"
      @close="rightPanel.close()"
      @back="handleBack"
    >
      <template #trailing>
        <template v-if="!isEditing">
          <Button
            variant="ghost"
            color="muted"
            size="icon-md"
            class="shrink-0 rounded-full"
            :aria-label="t('chapters.importCue')"
            :disabled="isImporting"
            @click="openCueDialog()"
          >
            <IconUpload
              class="size-6"
              :class="{ 'animate-pulse': isImporting }"
            />
          </Button>

          <Button
            variant="ghost"
            color="muted"
            size="icon-md"
            class="shrink-0 rounded-full"
            :aria-label="t('chapters.edit')"
            @click="isEditing = true"
          >
            <IconPencil class="size-6" />
          </Button>
        </template>
      </template>
    </RightPanelHeader>

    <p
      v-if="importError"
      class="px-4 py-2 text-sm text-destructive bg-destructive/10 border-b border-destructive/20 animate-in fade-in duration-200"
    >
      {{ importError }}
    </p>

    <ChapterEditor
      v-if="isEditing"
      v-model="draft"
      :duration="track.duration"
      :save-disabled="!isFormValid || isSaving"
      @save="handleSave"
    />

    <Scrollable
      v-else
      class="min-h-0 flex-1"
    >
      <div class="flex flex-col h-full">
        <Empty
          v-if="chapters.length === 0"
        >
          <EmptyHeader>
            <EmptyMedia>
              <IconBookmarkOff class="size-11 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{{ t("chapters.empty") }}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="solid"
              color="surface"
              :disabled="isImporting"
              @click="openCueDialog()"
            >
              <IconUpload
                class="size-4"
                :class="{ 'animate-pulse': isImporting }"
              />
              {{ t("chapters.importCue") }}
            </Button>
          </EmptyContent>
        </Empty>

        <Item
          v-for="(chapter, index) in chapters"
          :key="`${chapter.time}-${index}`"
          as="button"
          type="button"
          class="group text-left transition-colors hover:bg-muted/50 py-2 flex items-center justify-between"
          :class="{ 'bg-muted/50': activeChapterIndex === index }"
          @click="handleSeek(chapter.time)"
        >
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <ItemMedia class="size-6 pl-2 text-sm text-muted-foreground flex items-center justify-center font-medium shrink-0">
              <IconPlay class="size-4 hidden group-hover:block text-foreground" />
              <span class="group-hover:hidden">{{ index + 1 }}</span>
            </ItemMedia>

            <div class="flex gap-2 items-center min-w-0">
              <Badge
                size="sm"
                class="shrink-0"
              >
                {{ formatDuration(chapter.time) }}
              </Badge>
              <ItemContent class="min-w-0">
                <ItemTitle class="truncate text-sm font-medium text-foreground">
                  {{ chapter.title || t("chapters.untitled") }}
                </ItemTitle>
              </ItemContent>
            </div>
          </div>

          <ItemActions class="opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100 transition-opacity ml-2 shrink-0">
            <Button
              size="icon-md"
              variant="ghost"
              color="destructive"
              class="pointer-events-auto rounded-full"
              :aria-label="t('chapters.delete')"
              @click.stop="removeSavedChapter(index)"
            >
              <IconTrash class="size-5" />
            </Button>
          </ItemActions>
        </Item>
      </div>
    </Scrollable>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useFileDialog } from "@vueuse/core";
import { Button } from "@/components/ui/button";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import IconBookmarkOff from "~icons/tabler/bookmark-off";
import IconPencil from "~icons/tabler/pencil";
import IconUpload from "~icons/tabler/upload";
import IconPlay from "~icons/audiogram/play-rounded";
import IconTrash from "~icons/tabler/trash";
import { type CueTrackEntry, parseCueSheet } from "@/lib/cue/parseCueSheet";
import { formatDuration } from "@/lib/format/time";
import { object, number, string, pipe, minValue, maxValue, safeParse } from "valibot";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useSaveTrackChapters, useTrackChapters } from "@/modules/tracks/composables/useTrackChapters";
import type { Track } from "@/modules/player/types";
import type { TrackChapterMark } from "@/db/entities";
import type { DraftChapter } from "@/components/ChapterEditor.vue";
import ChapterEditor from "@/components/ChapterEditor.vue";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { usePanelUiBack } from "@/modules/right-panel/composables/usePanelUiBack";
import { useKeyboardInset } from "@/composables/useKeyboardInset";
import RightPanelHeader from "@/modules/right-panel/components/RightPanelHeader.vue";
import Badge from "@/components/ui/badge/Badge.vue";

const rightPanel = useRightPanelStore();

const props = defineProps<{ track: Track }>();

const { t } = useI18n();
const player = usePlayerStore();

const { keyboardInset } = useKeyboardInset();
const keyboardInsetStyle = computed(() => ({ "--keyboard-inset": `${keyboardInset.value}px` }));

const trackLine = computed(() => (props.track.artist
  ? t("chapters.trackLine", { title: props.track.title, artist: props.track.artist })
  : props.track.title));

const trackId = computed(() => props.track.id);
const { data: savedChaptersData } = useTrackChapters(trackId);
const saveMutation = useSaveTrackChapters();

const chapters = computed(() => savedChaptersData.value ?? []);

const activeChapterIndex = computed(() => {
  const t = player.currentTime;
  const list = chapters.value;
  if (list.length === 0) return -1;

  for (let i = list.length - 1; i >= 0; i--) {
    if (t >= list[i].time) return i;
  }

  if (t < list[0].time) return -1;

  return -1;
});

const isEditing = ref(false);
const draft = ref<DraftChapter[]>([]);
const isSaving = saveMutation.isPending;
const isImporting = ref(false);
const importError = ref<string | null>(null);

const chapterSchema = computed(() => object({
  time: pipe(number(), minValue(0), maxValue(props.track.duration)),
  title: string(),
}));

const isFormValid = computed(() =>
  draft.value.every(ch => safeParse(chapterSchema.value, { time: ch.time, title: ch.title }).success),
);

const toPayload = (list: DraftChapter[]): TrackChapterMark[] => [...list]
  .sort((a, b) => a.time - b.time)
  .map(c => ({ time: c.time, title: c.title.trim() || undefined }));

const sameChapters = (a: TrackChapterMark[], b: TrackChapterMark[]): boolean =>
  a.length === b.length
  && a.every((c, i) => c.time === b[i].time && (c.title ?? "") === (b[i].title ?? ""));

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

const clearAutoSave = (): void => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
};

watch(isEditing, (editing) => {
  if (!editing) return;
  draft.value = chapters.value.map(c => ({ id: crypto.randomUUID(), time: c.time, title: c.title ?? "" }));
});

watch(draft, () => {
  if (!isEditing.value) return;
  clearAutoSave();
  autoSaveTimer = setTimeout(() => {
    saveMutation.mutate({ trackId: props.track.id, chapters: toPayload(draft.value) });
  }, 1500);
}, { deep: true });

watch(trackId, () => {
  clearAutoSave();
  isEditing.value = false;
  importError.value = null;
});

const { open: openCueDialog, onChange } = useFileDialog({ accept: ".cue", multiple: false });

const readCueEntries = async (file: File): Promise<CueTrackEntry[] | null> => {
  try {
    const parsed = parseCueSheet(await file.text());
    if (parsed.length > 0) return parsed;
    importError.value = t("chapters.cueParseEmpty");
  }
  catch {
    importError.value = t("chapters.cueParseError");
  }
  return null;
};

const importCueFile = async (file: File) => {
  isImporting.value = true;
  importError.value = null;
  try {
    const parsed = await readCueEntries(file);
    if (!parsed) return;

    const existingTimes = new Set(chapters.value.map(c => Math.round(c.time)));
    const merged = [
      ...chapters.value,
      ...parsed
        .filter(entry => !existingTimes.has(Math.round(entry.time)))
        .map(entry => ({ time: entry.time, title: entry.title })),
    ].sort((a, b) => a.time - b.time);

    // A failed save is the save mutation's to report, not a bad file.
    await saveMutation.mutateAsync({ trackId: props.track.id, chapters: merged }).catch(() => undefined);
  }
  finally {
    isImporting.value = false;
  }
};

// importCueFile handles every failure internally (importError + finally),
// so there is nothing left for this rejection path to report.
onChange((files) => {
  const file = files?.[0];
  if (!file) return;
  importCueFile(file).catch(() => {});
});

function handleSeek(time: number): void {
  player.seekTo(time);
}

function removeSavedChapter(index: number): void {
  const next = chapters.value.filter((_, i) => i !== index);
  saveMutation.mutate({ trackId: props.track.id, chapters: next });
}

const handleBack = (): void => {
  if (isEditing.value) {
    handleSave().catch(() => {});
    return;
  }
  rightPanel.back();
};
usePanelUiBack(handleBack);

async function handleSave(): Promise<void> {
  clearAutoSave();
  const payload = toPayload(draft.value);
  if (!sameChapters(payload, chapters.value)) {
    try {
      await saveMutation.mutateAsync({ trackId: props.track.id, chapters: payload });
    }
    catch {
      // The mutation reported it; the draft stays open for another try.
      return;
    }
  }
  isEditing.value = false;
}
</script>
