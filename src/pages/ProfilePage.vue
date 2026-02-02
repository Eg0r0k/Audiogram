<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import {
  Database,
  Disc,
  Trash2,
  Play,
  RefreshCw,
  Loader2,
  UploadCloud,
  FolderOpen,
  Music,
} from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";

import { libraryImporter } from "@/services/importer.service";
import { db } from "@/db";
import { storageService } from "@/db/storage";
import { StorageErrorCode } from "@/db/errors/storage.errors";
import { usePlayerStore } from "@/modules/player/store/player.store";
import type { ArtistEntity, AlbumEntity, TrackEntity } from "@/db/entities";
import { formatDuration } from "@/lib/format/time";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface AlbumNode {
  data: AlbumEntity;
  tracks: TrackEntity[];
}

interface ArtistNode {
  artist: ArtistEntity;
  albums: AlbumNode[];
}

interface ImportProgress {
  current: number;
  total: number;
  percent: number;
}

interface LibraryStats {
  artists: number;
  albums: number;
  tracks: number;
}

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════

const playerStore = usePlayerStore();

const isImporting = ref(false);
const libraryTree = ref<ArtistNode[]>([]);
const stats = ref<LibraryStats>({ artists: 0, albums: 0, tracks: 0 });
const importProgress = ref<ImportProgress>({ current: 0, total: 0, percent: 0 });

const isNativeAvailable = libraryImporter.isNativeImportAvailable;

// ═══════════════════════════════════════════════════════
// IMPORT HANDLERS
// ═══════════════════════════════════════════════════════

/**
 * Нативный импорт через диалог (Tauri) — БЫСТРЫЙ
 */
async function handleNativeImport(): Promise<void> {
  const paths = await libraryImporter.pickFiles();
  if (!paths || paths.length === 0) return;

  isImporting.value = true;
  importProgress.value = { current: 0, total: paths.length, percent: 0 };

  try {
    console.time("Import Duration (Native)");

    const results = await libraryImporter.importFromPaths(
      paths,
      (current, total) => {
        importProgress.value = {
          current,
          total,
          percent: Math.round((current / total) * 100),
        };
      },
    );

    console.timeEnd("Import Duration (Native)");
    console.log("Import Results:", results);

    await refreshView();
  }
  catch (error) {
    console.error("Native import error:", error);
  }
  finally {
    isImporting.value = false;
  }
}

/**
 * Web импорт через input (Web и fallback)
 */
async function handleFileSelect(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;

  const files = Array.from(input.files);

  isImporting.value = true;
  importProgress.value = { current: 0, total: files.length, percent: 0 };

  try {
    console.time("Import Duration (Web)");

    const results = await libraryImporter.importFiles(
      files,
      (current, total) => {
        importProgress.value = {
          current,
          total,
          percent: Math.round((current / total) * 100),
        };
      },
    );

    console.timeEnd("Import Duration (Web)");
    console.log("Import Results:", results);

    await refreshView();
  }
  catch (error) {
    console.error("Web import error:", error);
  }
  finally {
    isImporting.value = false;
    input.value = "";
  }
}

// ═══════════════════════════════════════════════════════
// DATA OPERATIONS
// ═══════════════════════════════════════════════════════

async function refreshView(): Promise<void> {
  const [artists, albums, tracks] = await Promise.all([
    db.artists.toArray(),
    db.albums.toArray(),
    db.tracks.toArray(),
  ]);

  stats.value = {
    artists: artists.length,
    albums: albums.length,
    tracks: tracks.length,
  };

  libraryTree.value = artists.map((artist) => {
    const artistAlbums = albums.filter(a => a.artistId === artist.id);

    return {
      artist,
      albums: artistAlbums.map(album => ({
        data: album,
        tracks: tracks
          .filter(t => t.albumId === album.id)
          .sort((a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0)),
      })),
    };
  });
}

async function playTrack(track: TrackEntity): Promise<void> {
  const result = await storageService.getAudioUrl(track.storagePath);

  result.match(
    async (url) => {
      const artistNode = libraryTree.value.find(a => a.artist.id === track.artistId);
      const artistName = artistNode?.artist.name ?? "Unknown Artist";

      await playerStore.playUrl(url);

      playerStore.currentTrack = {
        id: track.id,
        title: track.title,
        artist: artistName,
        duration: track.duration,
        url,
      };
    },
    (error) => {
      console.error("Play error:", error);

      if (error.code === StorageErrorCode.FILE_NOT_FOUND) {
        console.warn("Track file not found, may have been deleted");
      }
    },
  );
}

async function nukeDatabase(): Promise<void> {
  isImporting.value = true;

  try {
    playerStore.stop();

    await db.transaction("rw", db.tracks, db.artists, db.albums, async () => {
      await db.tracks.clear();
      await db.artists.clear();
      await db.albums.clear();
    });

    const filesResult = await storageService.listFiles("tracks");

    if (filesResult.isOk()) {
      await Promise.all(
        filesResult.value.map(file => storageService.deleteFile(file)),
      );
    }

    const coversResult = await storageService.listFiles("covers");

    if (coversResult.isOk()) {
      await Promise.all(
        coversResult.value.map(file => storageService.deleteFile(file)),
      );
    }

    await refreshView();
  }
  finally {
    isImporting.value = false;
  }
}

function formatBitrate(bitrate?: number): string {
  if (!bitrate) return "N/A";
  return `${Math.round(bitrate / 1000)}kbps`;
}

function getAlbumsLabel(count: number): string {
  if (count === 1) return "альбом";
  if (count >= 2 && count <= 4) return "альбома";
  return "альбомов";
}

function isCurrentTrack(track: TrackEntity): boolean {
  return playerStore.currentTrack?.id === track.id;
}

// ═══════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════

onMounted(refreshView);

onUnmounted(() => {
  // Опционально: очистка при размонтировании
});
</script>

<template>
  <Scrollable class="p-6">
    <!-- HEADER -->
    <header class="flex items-center justify-between mb-8 border-b border-border pb-6">
      <div>
        <h1 class="text-2xl font-bold flex items-center gap-3">
          <Database class="size-6 text-primary" />
          DB & Import Debugger
        </h1>
        <p class="text-muted-foreground text-sm mt-1">
          Artists: {{ stats.artists }} | Albums: {{ stats.albums }} | Tracks: {{ stats.tracks }}
          <span
            v-if="isNativeAvailable"
            class="text-green-500 ml-2"
          >
            (Native Import ✓)
          </span>
          <span
            v-else
            class="text-yellow-500 ml-2"
          >
            (Web Mode)
          </span>
        </p>
      </div>

      <div class="flex gap-2">
        <!-- Нативный импорт (Tauri) — БЫСТРЫЙ -->
        <Button
          v-if="isNativeAvailable"
          :disabled="isImporting"
          @click="handleNativeImport"
        >
          <FolderOpen class="size-4" />
          Выбрать файлы
        </Button>

        <!-- Web импорт / Fallback -->
        <Button
          as="label"
          :variant="isNativeAvailable ? 'secondary' : 'default'"
          class="cursor-pointer"
          :class="{ 'opacity-50 pointer-events-none': isImporting }"
        >
          <UploadCloud class="size-4" />
          {{ isNativeAvailable ? 'Drag & Drop' : 'Импорт файлов' }}
          <input
            type="file"
            multiple
            accept="audio/*"
            hidden
            :disabled="isImporting"
            @change="handleFileSelect"
          >
        </Button>

        <Button
          variant="ghost"
          size="icon"
          title="Обновить"
          :disabled="isImporting"
          @click="refreshView"
        >
          <RefreshCw
            class="size-4"
            :class="{ 'animate-spin': isImporting }"
          />
        </Button>

        <Button
          variant="destructive"
          size="icon"
          title="Очистить всё"
          :disabled="isImporting"
          @click="nukeDatabase"
        >
          <Trash2 class="size-4" />
        </Button>
      </div>
    </header>

    <!-- CONTENT -->
    <div class="space-y-6 pb-24">
      <!-- Loading State -->
      <div
        v-if="isImporting"
        class="flex flex-col items-center justify-center py-16 max-w-md mx-auto"
      >
        <div class="relative mb-6">
          <Loader2 class="size-12 animate-spin text-primary" />
          <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
            {{ importProgress.percent }}%
          </div>
        </div>

        <h3 class="text-lg font-medium mb-2">
          Импорт медиатеки
        </h3>

        <p class="text-muted-foreground text-sm mb-6 text-center">
          Обработано {{ importProgress.current }} из {{ importProgress.total }} файлов...<br>
          <span class="text-xs opacity-70">
            {{ isNativeAvailable ? 'Нативное копирование файлов' : 'Парсинг метаданных и сохранение' }}
          </span>
        </p>

        <!-- Progress Bar -->
        <div class="h-2 w-full bg-secondary rounded-full overflow-hidden">
          <div
            class="h-full bg-primary transition-all duration-300 ease-out"
            :style="{ width: `${importProgress.percent}%` }"
          />
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="libraryTree.length === 0"
        class="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-xl"
      >
        <Music class="size-12 mb-4 text-muted-foreground" />
        <p class="text-muted-foreground">
          База данных пуста
        </p>
        <p class="text-muted-foreground/60 text-sm mt-1">
          Импортируйте аудиофайлы для начала работы
        </p>
      </div>

      <!-- Library Tree -->
      <template v-else>
        <div
          v-for="node in libraryTree"
          :key="node.artist.id"
          class="bg-card border border-border rounded-xl overflow-hidden"
        >
          <!-- Artist Header -->
          <div class="flex items-center gap-4 p-4 border-b border-border bg-muted/30">
            <div
              class="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0"
            >
              {{ node.artist.name[0] }}
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="font-bold text-lg truncate">
                {{ node.artist.name }}
              </h2>
              <p class="text-xs text-muted-foreground font-mono truncate">
                {{ node.artist.id }}
              </p>
            </div>
            <Badge variant="secondary">
              {{ node.albums.length }} {{ getAlbumsLabel(node.albums.length) }}
            </Badge>
          </div>

          <!-- Albums -->
          <div class="p-4 space-y-6">
            <div
              v-for="albumNode in node.albums"
              :key="albumNode.data.id"
              class="pl-4 border-l-2 border-border"
            >
              <!-- Album Header -->
              <div class="flex items-center gap-3 mb-3">
                <Disc class="size-5 text-muted-foreground shrink-0" />
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold truncate">
                    {{ albumNode.data.title }}
                    <span
                      v-if="albumNode.data.year"
                      class="text-muted-foreground text-sm font-normal"
                    >
                      ({{ albumNode.data.year }})
                    </span>
                  </h3>
                  <p
                    v-if="albumNode.data.coverPath"
                    class="text-[10px] text-primary/80 font-mono truncate"
                  >
                    Cover: {{ albumNode.data.coverPath }}
                  </p>
                </div>
                <Badge variant="outline">
                  {{ albumNode.tracks.length }} треков
                </Badge>
              </div>

              <!-- Tracks -->
              <div class="space-y-1">
                <div
                  v-for="track in albumNode.tracks"
                  :key="track.id"
                  class="group flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer"
                  :class="[
                    isCurrentTrack(track)
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : 'hover:bg-accent',
                  ]"
                  @click="playTrack(track)"
                >
                  <div class="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      class="font-mono text-xs w-6 text-right shrink-0"
                      :class="isCurrentTrack(track) ? 'text-primary' : 'text-muted-foreground'"
                    >
                      {{ track.trackNo ?? '-' }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p
                        class="text-sm transition-colors truncate"
                        :class="isCurrentTrack(track) ? 'text-primary font-medium' : 'group-hover:text-foreground'"
                      >
                        {{ track.title }}
                      </p>
                      <div class="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{{ formatDuration(track.duration) }}</span>
                        <span class="text-border">•</span>
                        <span>{{ track.format?.codec ?? 'Unknown' }} / {{ formatBitrate(track.format?.bitrate) }}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    size="icon"
                    variant="default"
                    class="size-8 transition-opacity shrink-0 ml-2"
                    :class="[
                      isCurrentTrack(track)
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100',
                    ]"
                  >
                    <Play
                      v-if="!isCurrentTrack(track) || !playerStore.isPlaying"
                      class="size-3 fill-current"
                    />
                    <Loader2
                      v-else-if="playerStore.isLoading"
                      class="size-3 animate-spin"
                    />
                    <span
                      v-else
                      class="flex gap-0.5"
                    >
                      <span class="w-0.5 h-3 bg-current animate-pulse" />
                      <span class="w-0.5 h-3 bg-current animate-pulse delay-75" />
                      <span class="w-0.5 h-3 bg-current animate-pulse delay-150" />
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </Scrollable>
</template>
