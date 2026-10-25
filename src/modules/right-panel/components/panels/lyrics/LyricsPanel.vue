<template>
  <div
    class="relative flex h-full min-h-0 flex-col overflow-hidden! bg-card"
    :style="keyboardInsetStyle"
  >
    <RightPanelHeader
      :title="title"
      :description="description"
      :show-back="mode !== 'view' || rightPanel.depth > 0"
      @back="handleBack"
      @close="handleClose"
    >
      <template #trailing>
        <template v-if="showMenu && source">
          <MenuTrigger as-child>
            <Button
              size="icon-md"
              class="rounded-full"
              variant="ghost"
              color="muted"
              :aria-label="$t('player.moreOptions')"
            >
              <IconDots class="size-6" />
            </Button>
          </MenuTrigger>
          <Menu
            anchor="top start"
            self="top end"
          >
            <MenuLabel class="text-xs text-muted-foreground">
              {{ sourceLabel }}
            </MenuLabel>
            <MenuItem @click="startEdit">
              <IconPencil class="size-5.5" />
              {{ $t('lyrics.edit') }}
            </MenuItem>
            <MenuItem
              v-if="kind === 'synced'"
              @click="startAdjust"
            >
              <IconClock class="size-5.5" />
              {{ $t('lyrics.adjustTiming') }}
            </MenuItem>
            <MenuItem @click="attachFromMenu">
              <IconFileUpload class="size-5.5" />
              {{ source.type === 'file' ? $t('lyrics.menu.replaceFile') : $t('lyrics.menu.attachFile') }}
            </MenuItem>
            <template v-if="source.type === 'file'">
              <MenuSeparator />
              <MenuItem
                color="destructive"
                @click="deleteFromMenu"
              >
                <IconTrash class="size-5.5" />
                {{ $t('lyrics.delete') }}
              </MenuItem>
            </template>
          </Menu>
        </template>
        <Button
          v-else-if="mode === 'edit' || mode === 'write'"
          size="icon-lg"
          variant="ghost"
          color="muted"
          class="shrink-0 rounded-full"
          :aria-label="$t('lyrics.attachFile')"
          :title="$t('lyrics.attachFile')"
          :disabled="isPending"
          @click="attachFromEditor"
        >
          <IconFileUpload class="size-6" />
        </Button>
        <Button
          v-else-if="mode === 'sync'"
          variant="ghost"
          color="neutral"
          size="sm"
          :disabled="marks.length === 0"
          @click="undoMark"
        >
          <IconArrowBackUp />
          {{ $t('common.undo') }}
        </Button>
      </template>
    </RightPanelHeader>

    <Scrollable
      v-if="mode === 'view'"
      class="min-h-0 flex-1"
    >
      <div
        v-if="track"
        class="flex min-h-full flex-col px-5 pt-2 pb-8"
      >
        <div
          v-if="status === 'loading'"
          class="flex flex-col gap-5"
        >
          <div
            v-for="(verse, verseIndex) in SKELETON_VERSES"
            :key="verseIndex"
            class="flex flex-col gap-1"
          >
            <div
              v-for="(width, lineIndex) in verse"
              :key="lineIndex"
              class="flex h-7 items-center"
            >
              <Skeleton
                class="h-5"
                :style="{ width }"
              />
            </div>
          </div>
        </div>

        <LyricsLines
          v-else-if="hasSyncedText"
          kind="synced"
          :lines="lines"
          :active-index="activeLineIndex"
          align="start"
          size="panel"
          :anchor-ratio="0.33"
          @select="seekToLine"
        />

        <template v-else-if="plainAsLines.length > 0">
          <div class="flex flex-col items-start gap-3 rounded-lg bg-muted p-3">
            <p class="text-sm">
              {{ $t('lyrics.notSynced') }}
            </p>
            <Button
              v-if="attachableTrack"
              variant="solid"
              color="card"
              size="sm"
              @click="startSync"
            >
              <IconClock />
              {{ $t('lyrics.syncLineByLine') }}
            </Button>
          </div>
          <LyricsLines
            class="mt-5"
            kind="plain"
            :lines="plainAsLines"
            :active-index="-1"
            align="start"
            size="panel"
            :anchor-ratio="0.33"
          />
        </template>

        <LyricsPanelEmpty
          v-else
          :track="track"
          :reason="reason"
          @write="startWrite"
        />
      </div>
    </Scrollable>

    <LyricsEditor
      v-else-if="(mode === 'edit' || mode === 'write') && subject"
      v-model="draft"
      :track="subject"
      :mode="mode"
      :dirty="dirty"
      @saved="backToView"
    />

    <LyricsTimingTools
      v-else-if="mode === 'adjust' && subject"
      v-model="offset"
      :track="subject"
      :dirty="dirty"
      @saved="backToView"
    />

    <LyricsSyncMode
      v-else-if="mode === 'sync' && subject"
      v-model="marks"
      :track="subject"
      :lines="syncSource"
      @saved="backToView"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Scrollable } from "@/components/ui/scrollable";
import { Skeleton } from "@/components/ui/skeleton";
import { useKeyboardInset } from "@/composables/useKeyboardInset";
import { formatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import LyricsLines from "@/modules/player/components/lyrics/LyricsLines.vue";
import { useAttachCurrentTrackLyrics } from "@/modules/player/composables/useAttachCurrentTrackLyrics";
import { useCurrentLyrics } from "@/modules/player/composables/useCurrentLyrics";
import { useLyricsActions } from "@/modules/player/composables/useLyricsActions";
import { hasLyricsText, type LyricsLine } from "@/modules/player/lib/lrc";
import { isLibraryTrack, type PlayerTrack, type Track } from "@/types/track";
import RightPanelHeader from "@/modules/right-panel/components/RightPanelHeader.vue";
import { usePanelUiBack } from "@/modules/right-panel/composables/usePanelUiBack";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import IconArrowBackUp from "~icons/tabler/arrow-back-up";
import IconClock from "~icons/tabler/clock";
import IconDots from "~icons/tabler/dots";
import IconFileUpload from "~icons/tabler/file-upload";
import IconPencil from "~icons/tabler/pencil";
import IconTrash from "~icons/tabler/trash";
import LyricsEditor from "./LyricsEditor.vue";
import LyricsPanelEmpty from "./LyricsPanelEmpty.vue";
import LyricsSyncMode from "./LyricsSyncMode.vue";
import LyricsTimingTools from "./LyricsTimingTools.vue";

type Mode = "view" | "edit" | "write" | "adjust" | "sync";

const SKELETON_VERSES = [["62%", "48%", "71%", "40%"], ["55%", "68%", "36%", "58%"], ["64%", "45%"]];

const TITLE_KEYS = {
  view: "lyrics.title",
  edit: "lyrics.edit",
  write: "lyrics.write",
  adjust: "lyrics.adjustTiming",
  sync: "lyrics.sync.title",
} as const satisfies Record<Mode, string>;

const { t } = useI18n();
const rightPanel = useRightPanelStore();
const { track, kind, lines, plainLines, status, reason, source, raw, activeLineIndex, seekToLine } = useCurrentLyrics();
const { attachableTrack } = useAttachCurrentTrackLyrics();
const { attachFile, deleteLyrics, isPending } = useLyricsActions();
const { keyboardInset } = useKeyboardInset();
const keyboardInsetStyle = computed(() => ({ "--keyboard-inset": `${keyboardInset.value}px` }));

const mode = ref<Mode>("view");
const subject = shallowRef<Track | null>(null);
const initialText = ref("");
const draft = ref("");
const offset = ref(0);
const marks = ref<number[]>([]);
const syncSource = shallowRef<readonly string[]>([]);

const hasSyncedText = computed(() => kind.value === "synced" && hasLyricsText({ kind: "synced", lines: lines.value }));

const plainAsLines = computed<LyricsLine[]>(() =>
  kind.value === "plain" && hasLyricsText({ kind: "plain", lines: plainLines.value })
    ? plainLines.value.map(text => ({ time: 0, text }))
    : [],
);

const showMenu = computed(() => mode.value === "view" && status.value === "ready" && attachableTrack.value !== null);

const sourceLabel = computed(() => {
  const current = source.value;
  if (current?.type !== "file") return t("lyrics.source.lrclib");
  return current.fileName ? t("lyrics.source.namedFile", { name: current.fileName }) : t("lyrics.source.file");
});

const describe = (described: PlayerTrack | null) => {
  if (!described) return null;
  return described.artist
    ? t("lyrics.trackLine", { title: described.title, artist: described.artist })
    : described.title;
};

const syncTotal = computed(() => syncSource.value.filter(line => line.trim() !== "").length);

const title = computed(() => t(TITLE_KEYS[mode.value]));
const description = computed(() => {
  if (mode.value === "sync") {
    return t("lyrics.sync.progress", { n: Math.min(marks.value.length + 1, syncTotal.value), total: syncTotal.value });
  }
  return describe(mode.value === "view" ? track.value : subject.value);
});

const dirty = computed(() => {
  if (mode.value === "edit") return draft.value !== initialText.value;
  if (mode.value === "write") return draft.value.trim() !== "";
  if (mode.value === "adjust") return offset.value !== (subject.value?.lyricsOffsetMs ?? 0);
  if (mode.value === "sync") return marks.value.length > 0;
  return false;
});

const enter = (next: Exclude<Mode, "view">, target: Track, text = "") => {
  subject.value = target;
  initialText.value = text;
  draft.value = text;
  mode.value = next;
};

const backToView = () => {
  mode.value = "view";
  subject.value = null;
};

const withLibraryTrack = (action: (target: Track) => unknown) => () => {
  const target = attachableTrack.value;
  if (target) action(target);
};

const attach = async (target: Track) => {
  await attachFile(target);
  backToView();
};

const startEdit = withLibraryTrack(target => enter("edit", target, raw.value ?? ""));
const startWrite = withLibraryTrack(target => enter("write", target));
const startAdjust = withLibraryTrack((target) => {
  offset.value = target.lyricsOffsetMs ?? 0;
  enter("adjust", target);
});
const startSync = withLibraryTrack((target) => {
  syncSource.value = plainLines.value;
  marks.value = [];
  enter("sync", target);
});
const attachFromMenu = withLibraryTrack(attach);
const deleteFromMenu = withLibraryTrack(deleteLyrics);

const undoMark = () => {
  marks.value = marks.value.slice(0, -1);
};

// Timing and marks belong to the track that was playing on entry.
watch(track, (current) => {
  if (mode.value !== "adjust" && mode.value !== "sync") return;
  if (isLibraryTrack(current) && current.id === subject.value?.id) return;
  backToView();
});

const requestLeave = (leave: () => unknown): void => {
  if (!dirty.value) {
    leave();
    return;
  }

  summonDialog("unsavedChanges", {}, { key: "unsaved-changes" })
    .then(discard => (discard ? leave() : undefined))
    .catch((error: unknown) => getLogger().error(`[Lyrics] Leaving the editor failed: ${formatError(error)}`));
};

const handleBack = (): void => {
  if (mode.value === "view") {
    rightPanel.back();
    return;
  }
  requestLeave(backToView);
};
usePanelUiBack(handleBack);

const handleClose = (): void => {
  if (mode.value === "view") {
    rightPanel.close();
    return;
  }
  requestLeave(() => rightPanel.close());
};

const attachFromEditor = () => {
  const target = subject.value;
  if (!target) return;
  requestLeave(() => attach(target));
};
</script>
