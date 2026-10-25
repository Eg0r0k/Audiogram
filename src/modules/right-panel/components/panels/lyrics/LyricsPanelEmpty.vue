<template>
  <Empty>
    <EmptyHeader>
      <EmptyTitle>{{ copy.title }}</EmptyTitle>
      <EmptyDescription>{{ copy.description }}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent v-if="hasActions">
      <div class="flex flex-wrap justify-center gap-2">
        <template v-if="reason === 'file-missing' && libraryTrack">
          <Button
            variant="solid"
            color="card"
            size="sm"
            :disabled="isPending"
            @click="attachFile(libraryTrack)"
          >
            {{ $t('lyrics.attachFile') }}
          </Button>
          <Button
            variant="ghost"
            color="destructive"
            size="sm"
            :disabled="isPending"
            @click="removeMissing(libraryTrack)"
          >
            {{ $t('lyrics.remove') }}
          </Button>
        </template>
        <template v-else-if="reason === 'network'">
          <Button
            variant="solid"
            color="card"
            size="sm"
            @click="retry"
          >
            <IconRefresh />
            {{ $t('lyrics.retry') }}
          </Button>
          <Button
            v-if="libraryTrack"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="emit('write')"
          >
            {{ $t('lyrics.write') }}
          </Button>
        </template>
        <template v-else-if="libraryTrack">
          <Button
            variant="solid"
            color="card"
            size="sm"
            @click="emit('write')"
          >
            <IconPencil />
            {{ $t('lyrics.write') }}
          </Button>
          <Button
            variant="ghost"
            color="neutral"
            size="sm"
            :disabled="isPending"
            @click="attachFile(libraryTrack)"
          >
            {{ $t('lyrics.attachFile') }}
          </Button>
        </template>
        <Button
          v-else-if="importPath"
          variant="solid"
          color="card"
          size="sm"
          :disabled="isImportRunning"
          @click="importCurrent"
        >
          <IconFileImport />
          {{ $t('track.contextMenu.addToLibrary') }}
        </Button>
      </div>
    </EmptyContent>
  </Empty>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { useLyricsActions } from "@/modules/player/composables/useLyricsActions";
import type { LyricsFailure } from "@/modules/player/service/track-lyrics-loader.service";
import { useLyricsStore } from "@/modules/player/store/lyrics.store";
import { isLibraryTrack, type PlayerTrack } from "@/types/track";
import { useEphemeralImport } from "@/modules/tracks/composables/useEphemeralImport";
import IconFileImport from "~icons/tabler/file-import";
import IconPencil from "~icons/tabler/pencil";
import IconRefresh from "~icons/tabler/refresh";

const props = defineProps<{
  track: PlayerTrack;
  reason: LyricsFailure | null;
}>();

const emit = defineEmits<{
  write: [];
}>();

const { t } = useI18n();
const lyricsStore = useLyricsStore();
const { attachFile, removeMissing, isPending } = useLyricsActions();
const { importPath, isRunning: isImportRunning, importCurrent } = useEphemeralImport(() => props.track);

const libraryTrack = computed(() => (isLibraryTrack(props.track) ? props.track : null));

const hasActions = computed(() => props.reason === "network" || libraryTrack.value !== null || importPath.value !== null);

const copy = computed(() => {
  if (props.reason === "file-missing") {
    const name = libraryTrack.value?.lyricsFileName;
    return {
      title: t("lyrics.emptyState.fileMissing"),
      description: name
        ? t("lyrics.emptyState.fileMissingHint", { name })
        : t("lyrics.emptyState.fileMissingUnnamedHint"),
    };
  }
  if (props.reason === "network") {
    return { title: t("lyrics.emptyState.network"), description: t("lyrics.emptyState.networkHint") };
  }
  if (libraryTrack.value) {
    return { title: t("lyrics.empty"), description: t("lyrics.emptyState.libraryHint") };
  }
  return {
    title: t("lyrics.emptyState.notFound"),
    description: importPath.value ? t("lyrics.emptyState.notFoundImportHint") : t("lyrics.emptyState.notFoundHint"),
  };
});

const retry = () => {
  lyricsStore.reload()
    .catch(error => getLogger().error(`[Lyrics] Reloading lyrics failed: ${formatError(error)}`));
};
</script>
