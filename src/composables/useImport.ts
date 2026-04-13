import { ref, computed } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { musicLibraryEngine } from "@/services/importer.service";
import { invalidateLibraryData } from "@/queries/library.queries";
import { filterFilesByExtension } from "@/lib/files/filterFiles";
import { IS_TAURI } from "@/lib/environment/userAgent";
import type { ImportBatchResult } from "@/services/importer.service";

export type ImportFileStatus = "pending" | "ok" | "error" | "skipped";

export interface ImportFileItem {
  name: string;
  status: ImportFileStatus;
  error?: string;
}

export interface ImportState {
  isOpen: boolean;
  isRunning: boolean;
  progress: number;
  total: number;
  current: number;
  files: ImportFileItem[];
  visibleFileCount: number;
  result: ImportBatchResult | null;
}

const ACCEPTED_EXTENSIONS = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac", ".opus"];
const MAX_VISIBLE_IMPORT_FILES = 500;

const state = ref<ImportState>({
  isOpen: false,
  isRunning: false,
  progress: 0,
  total: 0,
  current: 0,
  files: [],
  visibleFileCount: 0,
  result: null,
});

export function useImport() {
  const queryClient = useQueryClient();

  const isOpen = computed(() => state.value.isOpen);
  const isRunning = computed(() => state.value.isRunning);
  const progress = computed(() => state.value.progress);
  const files = computed(() => state.value.files);
  const result = computed(() => state.value.result);
  const total = computed(() => state.value.total);
  const current = computed(() => state.value.current);
  const visibleFileCount = computed(() => state.value.visibleFileCount);

  const successCount = computed(() => state.value.result?.successful.length ?? 0);
  const errorCount = computed(() => state.value.result?.failed.length ?? 0);
  const skippedCount = computed(() => state.value.result?.skipped ?? 0);

  function openSheet() {
    state.value.isOpen = true;
  }

  function closeSheet() {
    if (state.value.isRunning) return;
    state.value.isOpen = false;
  }

  function reset() {
    state.value = {
      isOpen: false,
      isRunning: false,
      progress: 0,
      total: 0,
      current: 0,
      files: [],
      visibleFileCount: 0,
      result: null,
    };
  }

  async function importFiles(files: File[]) {
    const filtered = filterFilesByExtension(files, ACCEPTED_EXTENSIONS);
    if (filtered.length === 0) return;

    const firstFile = filtered[0] as File & { path?: string };
    if (IS_TAURI && firstFile.path) {
      const paths = filtered.map(f => (f as File & { path: string }).path);
      return importFromPaths(paths);
    }

    _startImport(filtered.map(f => f.name));

    const result = await musicLibraryEngine.importFiles(
      filtered,
      (current, total) => _onProgress(current, total),
    );

    await _finishImport(result);
  }

  async function importFromPaths(paths: string[]) {
    if (paths.length === 0) return;

    _startImport(paths.map(p => p.split(/[\\/]/).pop() ?? p));

    const result = await musicLibraryEngine.importFromPaths(
      paths,
      (current, total) => _onProgress(current, total),
    );

    await _finishImport(result);
  }

  function _startImport(fileNames: string[]) {
    const visibleFiles = fileNames.slice(0, MAX_VISIBLE_IMPORT_FILES);

    state.value = {
      isOpen: true,
      isRunning: true,
      progress: 0,
      total: fileNames.length,
      current: 0,
      files: visibleFiles.map(name => ({ name, status: "pending" })),
      visibleFileCount: visibleFiles.length,
      result: null,
    };
  }

  function _onProgress(current: number, total: number) {
    const previousCurrent = state.value.current;

    state.value.current = current;
    state.value.total = total;
    state.value.progress = total > 0 ? Math.round((current / total) * 100) : 0;

    for (let i = previousCurrent; i < current && i < state.value.files.length; i++) {
      if (state.value.files[i].status === "pending") {
        state.value.files[i].status = "ok";
      }
    }
  }

  async function _finishImport(result: ImportBatchResult) {
    const successSet = new Set(result.successful.map(s => s.fileName));
    const errorMap = new Map(result.failed.map(f => [f.fileName, f.error.message]));

    state.value.files = state.value.files.map((f) => {
      if (successSet.has(f.name)) return { ...f, status: "ok" };
      if (errorMap.has(f.name)) return { ...f, status: "error", error: errorMap.get(f.name) };
      return { ...f, status: "skipped" };
    });

    state.value.result = result;
    state.value.progress = 100;

    if (result.successful.length > 0) {
      await invalidateLibraryData(queryClient);
    }

    state.value.isRunning = false;
  }

  return {
    isOpen,
    isRunning,
    progress,
    files,
    result,
    total,
    current,
    visibleFileCount,
    successCount,
    errorCount,
    skippedCount,
    openSheet,
    closeSheet,
    reset,
    importFiles,
    importFromPaths,
  };
}
